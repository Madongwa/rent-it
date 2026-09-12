import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const TABS = [
  { key: 'listings', label: 'My Listings' },
  { key: 'mine', label: 'My Rental Requests' },
  { key: 'incoming', label: 'Requests on My Items' },
];

// Was bg-amber-100/bg-green-100/etc mixed with a couple of literal
// `bg-brand-500`/`text-brand-700` uses elsewhere on this page - `brand` was
// never defined in tailwind.config.js, so those rendered with no
// background/text color at all (an actually-invisible button, not just a
// stale color choice). Everything on this page now uses real tokens.
const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-line text-text-muted',
  cancelled: 'bg-line text-text-muted',
};

function StatusBadge({ status }) {
  return (
    <span className={`rounded-badge px-2.5 py-1 text-caption font-medium capitalize ${STATUS_COLORS[status] || 'bg-line text-text-muted'}`}>
      {status}
    </span>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState('listings');
  const [listings, setListings] = useState([]);
  const [myRentals, setMyRentals] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

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
    setActionError('');
    try {
      await api.updateRentalStatus(rentalId, status);
      loadAll();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function removeListing(id) {
    if (!confirm('Delete this listing? This cannot be undone.')) return;
    setActionError('');
    try {
      await api.deleteListing(id);
      loadAll();
    } catch (err) {
      setActionError(err.message);
    }
  }

  // Pause/reactivate - just flips status between 'inactive' and
  // 'available'. Doesn't touch a listing that's currently 'rented' (an
  // active approved rental), since that state is driven by the rental
  // lifecycle below, not something to silently override here.
  async function togglePause(listing) {
    setActionError('');
    const nextStatus = listing.status === 'inactive' ? 'available' : 'inactive';
    try {
      await api.updateListing(listing.id, { status: nextStatus });
      loadAll();
    } catch (err) {
      setActionError(err.message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading-sm text-text-primary">Dashboard</h1>
        <Link
          to="/list-item"
          className="rounded-btn bg-text-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          + List an Item
        </Link>
      </div>

      <div className="mt-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-accent text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="py-16 text-center text-text-muted">Loading…</div>}
      {error && <div className="py-16 text-center text-red-500">{error}</div>}
      {actionError && <p className="mt-4 text-sm text-red-500">{actionError}</p>}

      {!loading && !error && tab === 'listings' && (
        <div className="mt-6 space-y-3">
          {listings.length === 0 && <p className="text-text-muted">You haven't listed anything yet.</p>}
          {listings.map((l) => (
            <div key={l.id} className="flex flex-col gap-3 rounded-card border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link to={`/listing/${l.id}`} className="font-semibold text-text-primary hover:underline">
                  {l.title}
                </Link>
                <p className="text-sm text-text-muted">
                  {l.category?.icon} {l.category?.name} · ₹{Number(l.price_per_day).toLocaleString('en-IN')}/day ·{' '}
                  <span className="capitalize">{l.status}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/listing/${l.id}/edit`} className="text-sm font-medium text-text-secondary hover:text-text-primary">
                  Edit
                </Link>
                {l.status !== 'rented' && (
                  <button onClick={() => togglePause(l)} className="text-sm font-medium text-text-secondary hover:text-text-primary">
                    {l.status === 'inactive' ? 'Reactivate' : 'Pause'}
                  </button>
                )}
                <button onClick={() => removeListing(l.id)} className="text-sm font-medium text-red-500 hover:text-red-700">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && tab === 'mine' && (
        <div className="mt-6 space-y-3">
          {myRentals.length === 0 && <p className="text-text-muted">You haven't requested any rentals yet.</p>}
          {myRentals.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 rounded-card border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link to={`/listing/${r.listing?.id}`} className="font-semibold text-text-primary hover:underline">
                  {r.listing?.title}
                </Link>
                <p className="text-sm text-text-muted">
                  {r.start_date} → {r.end_date}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {['pending', 'approved'].includes(r.status) && (
                  <button onClick={() => respond(r.id, 'cancelled')} className="text-sm font-medium text-red-500 hover:text-red-700">
                    Cancel
                  </button>
                )}
                <StatusBadge status={r.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && tab === 'incoming' && (
        <div className="mt-6 space-y-3">
          {incoming.length === 0 && <p className="text-text-muted">No rental requests on your items yet.</p>}
          {incoming.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 rounded-card border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link to={`/listing/${r.listing?.id}`} className="font-semibold text-text-primary hover:underline">
                  {r.listing?.title}
                </Link>
                <p className="text-sm text-text-muted">
                  Requested by {r.renter?.full_name || 'a user'} · {r.start_date} → {r.end_date}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {r.status === 'pending' ? (
                  <>
                    <button
                      onClick={() => respond(r.id, 'approved')}
                      className="rounded-btn bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => respond(r.id, 'rejected')}
                      className="rounded-btn border border-line px-3 py-1.5 text-sm font-medium text-text-secondary hover:border-text-muted"
                    >
                      Reject
                    </button>
                  </>
                ) : r.status === 'approved' ? (
                  <>
                    <button
                      onClick={() => respond(r.id, 'completed')}
                      className="rounded-btn bg-text-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                    >
                      Mark completed
                    </button>
                    <StatusBadge status={r.status} />
                  </>
                ) : (
                  <StatusBadge status={r.status} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
