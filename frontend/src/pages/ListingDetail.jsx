import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .getListing(id)
      .then(setListing)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleRequestRent(e) {
    e.preventDefault();
    setRequestError('');

    if (!user) {
      navigate('/login', { state: { from: { pathname: `/listing/${id}` } } });
      return;
    }
    if (!startDate || !endDate) {
      setRequestError('Please choose a start and end date.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createRental({ listing_id: id, start_date: startDate, end_date: endDate });
      setRequestSuccess(true);
    } catch (err) {
      setRequestError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="py-24 text-center text-stone-500">Loading…</div>;
  if (error || !listing)
    return <div className="py-24 text-center text-red-500">{error || 'Listing not found.'}</div>;

  const isOwner = user && listing.owner_id === user.id;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <Link to="/marketplace" className="text-sm text-stone-500 hover:text-stone-800">
        ← Back to marketplace
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-stone-100">
          {listing.image_url ? (
            <img src={listing.image_url} alt={listing.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl text-stone-300">
              {listing.category?.icon || '🧰'}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-brand-700">
            <span>{listing.category?.icon}</span>
            <span>{listing.category?.name}</span>
          </div>
          <h1 className="mt-1 text-3xl font-bold text-stone-900">{listing.title}</h1>
          <p className="mt-2 text-2xl font-bold text-stone-900">
            ₹{Number(listing.price_per_day).toLocaleString('en-IN')}
            <span className="text-base font-normal text-stone-500"> /day</span>
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {listing.location && (
              <div>
                <dt className="text-stone-500">Location</dt>
                <dd className="font-medium text-stone-800">📍 {listing.location}</dd>
              </div>
            )}
            {listing.condition && (
              <div>
                <dt className="text-stone-500">Condition</dt>
                <dd className="font-medium text-stone-800">{listing.condition}</dd>
              </div>
            )}
            <div>
              <dt className="text-stone-500">Listed by</dt>
              <dd className="font-medium text-stone-800">{listing.owner?.full_name || 'Rent It user'}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Status</dt>
              <dd className="font-medium capitalize text-stone-800">{listing.status}</dd>
            </div>
          </dl>

          {listing.description && (
            <div className="mt-6">
              <h2 className="font-semibold text-stone-900">Description</h2>
              <p className="mt-1 text-stone-600 whitespace-pre-line">{listing.description}</p>
            </div>
          )}

          <div className="mt-8 rounded-xl border border-stone-200 p-5">
            {isOwner ? (
              <p className="text-sm text-stone-500">This is your own listing.</p>
            ) : requestSuccess ? (
              <p className="text-sm font-medium text-green-600">
                ✅ Request sent! Check your dashboard for updates.
              </p>
            ) : listing.status !== 'available' ? (
              <p className="text-sm text-stone-500">This item isn't currently available.</p>
            ) : (
              <form onSubmit={handleRequestRent} className="space-y-3">
                <h2 className="font-semibold text-stone-900">Request to rent</h2>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-stone-500 mb-1">Start date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-stone-500 mb-1">End date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                </div>
                {requestError && <p className="text-sm text-red-500">{requestError}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-md bg-brand-500 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
                >
                  {submitting ? 'Sending…' : user ? 'Request to Rent' : 'Log in to request'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
