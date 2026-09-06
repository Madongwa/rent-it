import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const TABS = [
  { key: 'listings', label: 'My Listings' },
  { key: 'mine', label: 'My Rental Requests' },
  { key: 'incoming', label: 'Requests on My Items' },
];

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-stone-200 text-stone-600',
  cancelled: 'bg-stone-200 text-stone-600',
};

export default function Dashboard() {
  const [tab, setTab] = useState('listings');
  const [listings, setListings] = useState([]);
  const [myRentals, setMyRentals] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function loadAll() {
    setLoading(true);
    setError('');
    Promise.all([api.getMyListings(), api.getMyRentals(), api.getIncomingRentals()])
      .then(([l, m, i]) => {
        setListings(l);
        setMyRentals(m);
        setIncoming(i);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, []);

  async function respond(rentalId, status) {
    await api.updateRentalStatus(rentalId, status);
    loadAll();
  }

  async function removeListing(id) {
    if (!confirm('Delete this listing?')) return;
    await api.deleteListing(id);
    loadAll();
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>
        <Link
          to="/list-item"
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          + List an Item
        </Link>
      </div>

      <div className="mt-6 flex gap-1 border-b border-stone-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="py-16 text-center text-stone-500">Loading…</div>}
      {error && <div className="py-16 text-center text-red-500">{error}</div>}

      {!loading && !error && tab === 'listings' && (
        <div className="mt-6 space-y-3">
          {listings.length === 0 && (
            <p className="text-stone-500">You haven't listed anything yet.</p>
          )}
          {listings.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between rounded-lg border border-stone-200 p-4"
            >
              <div>
                <Link to={`/listing/${l.id}`} className="font-semibold text-stone-900 hover:underline">
                  {l.title}
                </Link>
                <p className="text-sm text-stone-500">
                  {l.category?.icon} {l.category?.name} · ${Number(l.price_per_day).toFixed(2)}/day ·{' '}
                  <span className="capitalize">{l.status}</span>
                </p>
              </div>
              <button
                onClick={() => removeListing(l.id)}
                className="text-sm font-medium text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && tab === 'mine' && (
        <div className="mt-6 space-y-3">
          {myRentals.length === 0 && <p className="text-stone-500">You haven't requested any rentals yet.</p>}
          {myRentals.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-stone-200 p-4">
              <div>
                <Link to={`/listing/${r.listing?.id}`} className="font-semibold text-stone-900 hover:underline">
                  {r.listing?.title}
                </Link>
                <p className="text-sm text-stone-500">
                  {r.start_date} → {r.end_date}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_COLORS[r.status]}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && tab === 'incoming' && (
        <div className="mt-6 space-y-3">
          {incoming.length === 0 && <p className="text-stone-500">No rental requests on your items yet.</p>}
          {incoming.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-3 rounded-lg border border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <Link to={`/listing/${r.listing?.id}`} className="font-semibold text-stone-900 hover:underline">
                  {r.listing?.title}
                </Link>
                <p className="text-sm text-stone-500">
                  Requested by {r.renter?.full_name || 'a user'} · {r.start_date} → {r.end_date}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {r.status === 'pending' ? (
                  <>
                    <button
                      onClick={() => respond(r.id, 'approved')}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => respond(r.id, 'rejected')}
                      className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600"
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_COLORS[r.status]}`}>
                    {r.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
