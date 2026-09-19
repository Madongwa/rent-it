import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'rentals', label: 'Rental requests' },
  { key: 'disputes', label: 'Disputes' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'kyc', label: 'Seller verification' },
  { key: 'users', label: 'Users' },
  { key: 'listings', label: 'Listings' },
  { key: 'activity', label: 'Activity log' },
];

const ROLE_BADGE = {
  admin: 'bg-emerald-500/15 text-emerald-400',
  user: 'bg-white/10 text-night-muted',
};

const RENTAL_STATUS_BADGE = {
  pending: 'bg-amber-500/15 text-amber-400',
  approved: 'bg-emerald-500/15 text-emerald-400',
  rejected: 'bg-red-500/15 text-red-400',
  completed: 'bg-white/10 text-night-muted',
  cancelled: 'bg-white/10 text-night-muted',
  disputed: 'bg-red-500/15 text-red-400',
};

const RENTAL_STATUSES = ['pending', 'approved', 'rejected', 'completed', 'cancelled', 'disputed'];

function StatTile({ label, value }) {
  return (
    <div className="rounded-card border border-night-border/15 p-4">
      <p className="text-2xl font-bold text-night-text">{value}</p>
      <p className="text-sm text-night-muted">{label}</p>
    </div>
  );
}

// Signed URLs for the private kyc-documents bucket - createSignedUrl works
// here because the viewer is an admin, and the storage RLS policy on that
// bucket explicitly allows admins to read every path, not just their own.
function DocLink({ path, children }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);

  async function reveal() {
    const { data, error: signError } = await supabase.storage
      .from('kyc-documents')
      .createSignedUrl(path, 300);
    if (signError || !data) setError(true);
    else setUrl(data.signedUrl);
  }

  if (!path) return <span className="text-night-muted">—</span>;
  if (url) return <a href={url} target="_blank" rel="noreferrer" className="text-accent underline">{children}</a>;
  return (
    <button onClick={reveal} className="text-accent underline">
      {error ? 'Failed to load - retry' : `View ${children}`}
    </button>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [kycQueue, setKycQueue] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [rentalStatusFilter, setRentalStatusFilter] = useState('');
  const [reviews, setReviews] = useState([]);
  const [reviewsFlaggedOnly, setReviewsFlaggedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [resolvingId, setResolvingId] = useState(null);
  const [resolution, setResolution] = useState('');
  const [deletingReviewId, setDeletingReviewId] = useState(null);
  const [actionError, setActionError] = useState('');

  const [activityLog, setActivityLog] = useState([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([
      api.getAdminOverview(),
      api.getKycQueue(),
      api.getDisputeQueue(),
      api.getAdminUsers(),
      api.getAdminListings(),
      api.getAdminRentals(),
      api.getAdminReviews(),
    ])
      .then(([overviewData, kyc, disputeList, userList, listingList, rentalList, reviewList]) => {
        setOverview(overviewData);
        setKycQueue(kyc);
        setDisputes(disputeList);
        setUsers(userList);
        setListings(listingList);
        setRentals(rentalList);
        setReviews(reviewList);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, []);

  useEffect(() => {
    if (tab !== 'activity') return;
    setActivityLoading(true);
    api
      .getActivityLog(activityPage)
      .then((result) => {
        setActivityLog(result.data);
        setActivityHasMore(result.hasMore);
      })
      .catch((err) => setError(err.message))
      .finally(() => setActivityLoading(false));
  }, [tab, activityPage]);

  async function changeRole(userId, role) {
    setActionError('');
    try {
      await api.updateUserRole(userId, role);
      loadAll();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function toggleBan(userId, banned) {
    setActionError('');
    try {
      await (banned ? api.unbanUser(userId) : api.banUser(userId));
      loadAll();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function toggleListingStatus(listingId, status) {
    setActionError('');
    try {
      await api.updateAdminListingStatus(listingId, status);
      loadAll();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function approve(userId) {
    setError('');
    try {
      await api.approveKyc(userId);
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function reject(userId) {
    if (!rejectReason.trim()) return;
    setError('');
    try {
      await api.rejectKyc(userId, rejectReason.trim());
      setRejectingId(null);
      setRejectReason('');
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function resolve(disputeId, outcome) {
    if (!resolution.trim()) return;
    setError('');
    try {
      await api.resolveDispute(disputeId, resolution.trim(), outcome);
      setResolvingId(null);
      setResolution('');
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function unflagReview(id) {
    setActionError('');
    try {
      await api.unflagReview(id);
      loadAll();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function deleteReview(id) {
    setActionError('');
    try {
      await api.deleteAdminReview(id);
      setDeletingReviewId(null);
      loadAll();
    } catch (err) {
      setActionError(err.message);
    }
  }

  const tabCounts = {
    rentals: rentals.length,
    disputes: disputes.length,
    reviews: reviews.filter((r) => r.flagged).length,
    kyc: kycQueue.length,
    users: users.length,
    listings: listings.length,
  };

  const filteredRentals = rentalStatusFilter ? rentals.filter((r) => r.status === rentalStatusFilter) : rentals;
  const filteredReviews = reviewsFlaggedOnly ? reviews.filter((r) => r.flagged) : reviews;

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-heading-sm text-night-text">Staff dashboard</h1>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-night-border/15">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-accent text-night-text' : 'border-transparent text-night-muted hover:text-night-text'
            }`}
          >
            {t.label}
            {tabCounts[t.key] != null ? ` (${tabCounts[t.key]})` : ''}
          </button>
        ))}
      </div>

      {loading && <div className="py-16 text-center text-night-muted">Loading…</div>}
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {actionError && <p className="mt-4 text-sm text-red-400">{actionError}</p>}

      {!loading && tab === 'overview' && overview && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <StatTile label="Total users" value={overview.total_users} />
          <StatTile label="Total listings" value={overview.total_listings} />
          <StatTile label="Active rentals" value={overview.active_rentals} />
          <StatTile label="Pending KYC" value={overview.pending_kyc} />
          <StatTile label="Open disputes" value={overview.open_disputes} />
          <StatTile label="Flagged reviews" value={overview.flagged_reviews} />
          <StatTile label="Total reviews" value={overview.total_reviews} />
        </div>
      )}

      {!loading && tab === 'rentals' && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setRentalStatusFilter('')}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                rentalStatusFilter === '' ? 'border-white bg-white text-black' : 'border-night-border/20 text-night-muted'
              }`}
            >
              All
            </button>
            {RENTAL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setRentalStatusFilter(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                  rentalStatusFilter === s ? 'border-white bg-white text-black' : 'border-night-border/20 text-night-muted'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {filteredRentals.length === 0 && <p className="text-night-muted">No rental requests found.</p>}
          {filteredRentals.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-night-border/15 p-4">
              <div>
                <p className="font-semibold text-night-text">{r.listing?.title}</p>
                <p className="text-sm text-night-muted">
                  {r.start_date} → {r.end_date} · Owner: {r.listing?.owner?.full_name || 'Unknown'} · Renter:{' '}
                  {r.renter?.full_name || 'Unknown'}
                </p>
                <p className="text-xs text-night-muted">Requested {new Date(r.created_at).toLocaleString()}</p>
              </div>
              <span className={`rounded-badge px-2 py-0.5 text-xs font-medium capitalize ${RENTAL_STATUS_BADGE[r.status] || 'bg-white/10 text-night-muted'}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'reviews' && (
        <div className="mt-6 space-y-4">
          <button
            onClick={() => setReviewsFlaggedOnly((v) => !v)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              reviewsFlaggedOnly ? 'border-white bg-white text-black' : 'border-night-border/20 text-night-muted'
            }`}
          >
            {reviewsFlaggedOnly ? 'Showing flagged only' : 'Show flagged only'}
          </button>

          {filteredReviews.length === 0 && <p className="text-night-muted">No reviews found.</p>}
          {filteredReviews.map((r) => (
            <div key={r.id} className="rounded-card border border-night-border/15 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-night-text">
                    {r.listing?.title} · {'★'.repeat(r.rating)}
                    {r.flagged && (
                      <span className="ml-2 rounded-badge bg-red-500/15 px-2 py-0.5 text-caption font-medium text-red-400">Flagged</span>
                    )}
                  </p>
                  <p className="text-sm text-night-muted">{r.reviewer_name}</p>
                  {r.comment && <p className="mt-1 text-sm text-night-text/85">{r.comment}</p>}
                  {r.flagged && (
                    <p className="mt-1 text-xs text-red-400">
                      Reported by {r.flagged_by_user?.full_name || 'a user'}: {r.flag_reason}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {r.flagged && (
                  <button
                    onClick={() => unflagReview(r.id)}
                    className="rounded-btn border border-night-border/15 px-3 py-1.5 text-sm font-medium text-night-muted hover:border-night-muted"
                  >
                    Dismiss flag
                  </button>
                )}
                {deletingReviewId === r.id ? (
                  <button
                    onClick={() => deleteReview(r.id)}
                    className="rounded-btn border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10"
                  >
                    Confirm delete
                  </button>
                ) : (
                  <button
                    onClick={() => setDeletingReviewId(r.id)}
                    className="rounded-btn border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10"
                  >
                    Delete review
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'activity' && (
        <div className="mt-6 space-y-4">
          {activityLoading && <div className="py-8 text-center text-night-muted">Loading…</div>}
          {!activityLoading && activityLog.length === 0 && <p className="text-night-muted">No activity recorded yet.</p>}
          {!activityLoading &&
            activityLog.map((a) => (
              <div key={a.id} className="rounded-card border border-night-border/15 p-4">
                <p className="text-sm text-night-text">
                  <span className="font-semibold">{a.admin?.full_name || 'Unknown admin'}</span>{' '}
                  <span className="font-mono text-night-muted">{a.action}</span> on {a.target_type} <span className="font-mono">{a.target_id}</span>
                </p>
                {a.note && <p className="mt-1 text-sm text-night-muted">{a.note}</p>}
                <p className="mt-1 text-xs text-night-muted">{new Date(a.created_at).toLocaleString()}</p>
              </div>
            ))}

          {!activityLoading && (activityPage > 1 || activityHasMore) && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                onClick={() => setActivityPage((p) => Math.max(p - 1, 1))}
                disabled={activityPage <= 1}
                className="rounded-btn border border-night-border/20 px-4 py-2 text-sm font-medium text-night-text disabled:cursor-not-allowed disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-sm text-night-muted">Page {activityPage}</span>
              <button
                onClick={() => setActivityPage((p) => p + 1)}
                disabled={!activityHasMore}
                className="rounded-btn border border-night-border/20 px-4 py-2 text-sm font-medium text-night-text disabled:cursor-not-allowed disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'kyc' && (
        <div className="mt-6 space-y-4">
          {kycQueue.length === 0 && <p className="text-night-muted">No pending seller applications.</p>}
          {kycQueue.map((k) => (
            <div key={k.user_id} className="rounded-card border border-night-border/15 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-night-text">{k.full_name}</p>
                  <p className="text-sm text-night-muted">{k.phone} · {k.address}</p>
                  <p className="text-xs text-night-muted">Submitted {new Date(k.submitted_at).toLocaleString()}</p>
                  {k.verification_method === 'automated' && (
                    <p className="mt-1 text-xs text-night-muted">
                      Checked by Digio - flagged for review rather than auto-approved
                      {k.verification_details?.id_type ? ` (detected: ${k.verification_details.id_type})` : ''}.
                      {k.verification_details?.front_image_result === 'FAIL' && ' Front image quality check failed.'}
                      {k.verification_details?.back_image_result === 'FAIL' && ' Back image quality check failed.'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <DocLink path={k.id_document_url}>ID front</DocLink>
                  <DocLink path={k.id_document_back_url}>ID back</DocLink>
                  <DocLink path={k.address_proof_url}>address proof</DocLink>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => approve(k.user_id)}
                  className="rounded-btn bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  Approve
                </button>
                {rejectingId === k.user_id ? (
                  <>
                    <input
                      autoFocus
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason shown to the applicant"
                      className="flex-1 rounded-btn border border-night-border/20 bg-black/20 px-3 py-1.5 text-sm text-night-text placeholder:text-night-muted/60"
                    />
                    <button
                      onClick={() => reject(k.user_id)}
                      className="rounded-btn border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10"
                    >
                      Confirm reject
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setRejectingId(k.user_id)}
                    className="rounded-btn border border-night-border/15 px-3 py-1.5 text-sm font-medium text-night-muted hover:border-night-muted"
                  >
                    Reject
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'disputes' && (
        <div className="mt-6 space-y-4">
          {disputes.length === 0 && <p className="text-night-muted">No open disputes.</p>}
          {disputes.map((d) => (
            <div key={d.id} className="rounded-card border border-night-border/15 p-4">
              <p className="font-semibold text-night-text">{d.rental?.listing?.title}</p>
              <p className="text-sm text-night-muted">
                {d.rental?.start_date} → {d.rental?.end_date} · Owner: {d.rental?.listing?.owner?.full_name} ·
                Renter: {d.rental?.renter?.full_name}
              </p>
              <p className="mt-2 text-sm text-night-text">
                <span className="font-medium">{d.raiser?.full_name}</span> reported: {d.reason}
              </p>
              <p className="text-xs text-night-muted">
                Freezes until {new Date(d.freeze_until).toLocaleDateString()}
              </p>

              {resolvingId === d.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    autoFocus
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Resolution notes (kept on record)"
                    rows={2}
                    className="w-full rounded-btn border border-night-border/20 bg-black/20 px-3 py-2 text-sm text-night-text placeholder:text-night-muted/60"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolve(d.id, 'completed')}
                      className="rounded-btn bg-white px-3 py-1.5 text-sm font-medium text-black hover:opacity-90"
                    >
                      Side with owner (release payout)
                    </button>
                    <button
                      onClick={() => resolve(d.id, 'cancelled')}
                      className="rounded-btn border border-night-border/15 px-3 py-1.5 text-sm font-medium text-night-muted hover:border-night-muted"
                    >
                      Side with renter (refund)
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setResolvingId(d.id)}
                  className="mt-3 rounded-btn border border-night-border/15 px-3 py-1.5 text-sm font-medium text-night-muted hover:border-night-muted"
                >
                  Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'users' && (
        <div className="mt-6 space-y-3">
          {users.length === 0 && <p className="text-night-muted">No users yet.</p>}
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-night-border/15 p-4">
              <div>
                <p className="font-semibold text-night-text">
                  {u.full_name || 'Unnamed user'}
                  {u.banned && (
                    <span className="ml-2 rounded-badge bg-red-500/15 px-2 py-0.5 text-caption font-medium text-red-400">Banned</span>
                  )}
                </p>
                <p className="text-sm text-night-muted">{u.email}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={`rounded-badge px-2 py-0.5 font-medium capitalize ${ROLE_BADGE[u.role]}`}>{u.role}</span>
                  <span className="rounded-badge bg-white/10 px-2 py-0.5 font-medium capitalize text-night-muted">
                    seller: {u.seller_status.replace('_', ' ')}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeRole(u.id, u.role === 'admin' ? 'user' : 'admin')}
                  className="rounded-btn border border-night-border/15 px-3 py-1.5 text-sm font-medium text-night-muted hover:border-night-muted"
                >
                  {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                </button>
                <button
                  onClick={() => toggleBan(u.id, u.banned)}
                  className={
                    u.banned
                      ? 'rounded-btn bg-white px-3 py-1.5 text-sm font-medium text-black hover:opacity-90'
                      : 'rounded-btn border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10'
                  }
                >
                  {u.banned ? 'Unban' : 'Ban'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'listings' && (
        <div className="mt-6 space-y-3">
          {listings.length === 0 && <p className="text-night-muted">No listings yet.</p>}
          {listings.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-night-border/15 p-4">
              <div>
                <p className="font-semibold text-night-text">{l.title}</p>
                <p className="text-sm text-night-muted">
                  {l.owner?.full_name || 'Unknown owner'} · ₹{Number(l.price_per_day).toLocaleString('en-IN')}/day ·{' '}
                  <span className="capitalize">{l.status}</span>
                </p>
              </div>
              <button
                onClick={() => toggleListingStatus(l.id, l.status === 'inactive' ? 'available' : 'inactive')}
                className={
                  l.status === 'inactive'
                    ? 'rounded-btn bg-white px-3 py-1.5 text-sm font-medium text-black hover:opacity-90'
                    : 'rounded-btn border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10'
                }
              >
                {l.status === 'inactive' ? 'Restore' : 'Remove listing'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
    </DarkGradientBg>
  );
}
