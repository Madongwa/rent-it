import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import RentalPhotoSection from '../components/RentalPhotos';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

// Condition photos are only meaningful once a handoff has actually
// happened (or is being disputed) - hidden for 'pending'/'rejected'/
// 'cancelled' rentals where nothing physical occurred.
const PHOTOS_VISIBLE_STATUSES = ['approved', 'completed', 'disputed'];

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
// Translucent fill + bright text, not the original's opaque light-100
// pastels - those read as jarring white patches against this page's dark
// background.
const STATUS_COLORS = {
  pending: 'bg-amber-500/15 text-amber-400',
  approved: 'bg-emerald-500/15 text-emerald-400',
  rejected: 'bg-red-500/15 text-red-400',
  completed: 'bg-white/10 text-night-muted',
  cancelled: 'bg-white/10 text-night-muted',
  disputed: 'bg-red-500/15 text-red-400',
};

function StatusBadge({ status }) {
  return (
    <span className={`rounded-badge px-2.5 py-1 text-caption font-medium capitalize ${STATUS_COLORS[status] || 'bg-white/10 text-night-muted'}`}>
      {status}
    </span>
  );
}

// Inline "report a problem" control - either party on an approved rental
// can use this instead of confirming a clean return. Kept as its own small
// component since both the renter and owner tabs below need it.
function DisputeControl({ rentalId, onSubmit }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm font-medium text-red-400 hover:text-red-300">
        Report a problem
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="What went wrong?"
        className="w-48 rounded-btn border border-night-border/20 bg-black/20 px-2 py-1 text-sm text-night-text placeholder:text-night-muted/60"
      />
      <button
        onClick={() => reason.trim() && onSubmit(rentalId, reason.trim())}
        className="rounded-btn border border-red-500/40 px-2 py-1 text-sm font-medium text-red-400 hover:bg-red-500/10"
      >
        Submit
      </button>
    </div>
  );
}

function RentalPhotosPanel({ rental, onChange }) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-4 border-t border-night-border/15 pt-3 sm:grid-cols-2">
      <RentalPhotoSection
        rentalId={rental.id}
        stage="pickup"
        photoPaths={rental.pickup_photo_urls}
        editable
        onChange={onChange}
      />
      <RentalPhotoSection
        rentalId={rental.id}
        stage="return"
        photoPaths={rental.return_photo_urls}
        editable
        onChange={onChange}
      />
    </div>
  );
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_TABS = TABS.map((t) => t.key);
  const [tab, setTabState] = useState(() => {
    const fromUrl = searchParams.get('tab');
    return VALID_TABS.includes(fromUrl) ? fromUrl : 'listings';
  });
  // Notifications deep-link here with e.g. /dashboard?tab=incoming - kept
  // in sync both ways so a manual tab click also updates the URL (refresh
  // stays on the same tab instead of bouncing back to "My Listings").
  function setTab(next) {
    setTabState(next);
    setSearchParams(next === 'listings' ? {} : { tab: next }, { replace: true });
  }
  const [listings, setListings] = useState([]);
  const [myRentals, setMyRentals] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

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

  async function dispute(rentalId, reason) {
    setActionError('');
    try {
      await api.raiseDispute(rentalId, reason);
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
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading-sm text-night-text">Dashboard</h1>
        <Link
          to="/list-item"
          className="rounded-btn bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
        >
          + List an Item
        </Link>
      </div>

      <div className="mt-6 flex gap-1 border-b border-night-border/15">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-accent text-night-text' : 'border-transparent text-night-muted hover:text-night-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="py-16 text-center text-night-muted">Loading…</div>}
      {error && <div className="py-16 text-center text-red-400">{error}</div>}
      {actionError && <p className="mt-4 text-sm text-red-400">{actionError}</p>}

      {!loading && !error && tab === 'listings' && (
        <div className="mt-6 space-y-3">
          {listings.length === 0 && <p className="text-night-muted">You haven't listed anything yet.</p>}
          {listings.map((l) => (
            <div key={l.id} className="flex flex-col gap-3 rounded-card border border-night-border/15 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link to={`/listing/${l.id}`} className="font-semibold text-night-text hover:underline">
                  {l.title}
                </Link>
                <p className="text-sm text-night-muted">
                  {l.category?.icon} {l.category?.name} · ₹{Number(l.price_per_day).toLocaleString('en-IN')}/day ·{' '}
                  <span className="capitalize">{l.status}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/listing/${l.id}/edit`} className="text-sm font-medium text-night-muted hover:text-night-text">
                  Edit
                </Link>
                {l.status !== 'rented' && (
                  <button onClick={() => togglePause(l)} className="text-sm font-medium text-night-muted hover:text-night-text">
                    {l.status === 'inactive' ? 'Reactivate' : 'Pause'}
                  </button>
                )}
                <button onClick={() => removeListing(l.id)} className="text-sm font-medium text-red-400 hover:text-red-300">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && tab === 'mine' && (
        <div className="mt-6 space-y-3">
          {myRentals.length === 0 && <p className="text-night-muted">You haven't requested any rentals yet.</p>}
          {myRentals.map((r) => (
            <div key={r.id} className="rounded-card border border-night-border/15 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link to={`/listing/${r.listing?.id}`} className="font-semibold text-night-text hover:underline">
                    {r.listing?.title}
                  </Link>
                  <p className="text-sm text-night-muted">
                    {r.start_date} → {r.end_date}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {['pending', 'approved'].includes(r.status) && (
                    <button onClick={() => respond(r.id, 'cancelled')} className="text-sm font-medium text-red-400 hover:text-red-300">
                      Cancel
                    </button>
                  )}
                  {r.status === 'approved' && <DisputeControl rentalId={r.id} onSubmit={dispute} />}
                  {PHOTOS_VISIBLE_STATUSES.includes(r.status) && (
                    <button
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      className="text-sm font-medium text-night-muted hover:text-night-text"
                    >
                      {expandedId === r.id ? 'Hide photos' : 'Photos'}
                    </button>
                  )}
                  <StatusBadge status={r.status} />
                </div>
              </div>
              {expandedId === r.id && <RentalPhotosPanel rental={r} onChange={loadAll} />}
            </div>
          ))}
        </div>
      )}

      {!loading && !error && tab === 'incoming' && (
        <div className="mt-6 space-y-3">
          {incoming.length === 0 && <p className="text-night-muted">No rental requests on your items yet.</p>}
          {incoming.map((r) => (
            <div key={r.id} className="rounded-card border border-night-border/15 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link to={`/listing/${r.listing?.id}`} className="font-semibold text-night-text hover:underline">
                    {r.listing?.title}
                  </Link>
                  <p className="text-sm text-night-muted">
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
                        className="rounded-btn border border-night-border/20 px-3 py-1.5 text-sm font-medium text-night-muted hover:border-night-muted hover:text-night-text"
                      >
                        Reject
                      </button>
                    </>
                  ) : r.status === 'approved' ? (
                    <>
                      <button
                        onClick={() => respond(r.id, 'completed')}
                        className="rounded-btn bg-white px-3 py-1.5 text-sm font-medium text-black hover:opacity-90"
                      >
                        Mark completed
                      </button>
                      <DisputeControl rentalId={r.id} onSubmit={dispute} />
                      <StatusBadge status={r.status} />
                    </>
                  ) : (
                    <StatusBadge status={r.status} />
                  )}
                  {PHOTOS_VISIBLE_STATUSES.includes(r.status) && (
                    <button
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                      className="text-sm font-medium text-night-muted hover:text-night-text"
                    >
                      {expandedId === r.id ? 'Hide photos' : 'Photos'}
                    </button>
                  )}
                </div>
              </div>
              {expandedId === r.id && <RentalPhotosPanel rental={r} onChange={loadAll} />}
            </div>
          ))}
        </div>
      )}
    </div>
    </DarkGradientBg>
  );
}
