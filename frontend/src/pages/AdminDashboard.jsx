import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

const TABS = [
  { key: 'kyc', label: 'Seller verification' },
  { key: 'disputes', label: 'Disputes' },
  { key: 'users', label: 'Users' },
  { key: 'listings', label: 'Listings' },
];

const ROLE_BADGE = {
  admin: 'bg-emerald-500/15 text-emerald-400',
  user: 'bg-white/10 text-night-muted',
};

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
  const [tab, setTab] = useState('kyc');
  const [kycQueue, setKycQueue] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [resolvingId, setResolvingId] = useState(null);
  const [resolution, setResolution] = useState('');
  const [actionError, setActionError] = useState('');

  function loadAll() {
    setLoading(true);
    Promise.all([api.getKycQueue(), api.getDisputeQueue(), api.getAdminUsers(), api.getAdminListings()])
      .then(([kyc, disputeList, userList, listingList]) => {
        setKycQueue(kyc);
        setDisputes(disputeList);
        setUsers(userList);
        setListings(listingList);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, []);

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

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)]">
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-heading-sm text-night-text">Staff dashboard</h1>

      <div className="mt-6 flex gap-1 border-b border-night-border/15">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-accent text-night-text' : 'border-transparent text-night-muted hover:text-night-text'
            }`}
          >
            {t.label} (
            {t.key === 'kyc' ? kycQueue.length : t.key === 'disputes' ? disputes.length : t.key === 'users' ? users.length : listings.length}
            )
          </button>
        ))}
      </div>

      {loading && <div className="py-16 text-center text-night-muted">Loading…</div>}
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {actionError && <p className="mt-4 text-sm text-red-400">{actionError}</p>}

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
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <DocLink path={k.id_document_url}>ID document</DocLink>
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
