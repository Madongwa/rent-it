import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';

const TABS = [
  { key: 'kyc', label: 'Seller verification' },
  { key: 'disputes', label: 'Disputes' },
];

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

  if (!path) return <span className="text-text-muted">—</span>;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [resolvingId, setResolvingId] = useState(null);
  const [resolution, setResolution] = useState('');

  function loadAll() {
    setLoading(true);
    Promise.all([api.getKycQueue(), api.getDisputeQueue()])
      .then(([kyc, disputeList]) => {
        setKycQueue(kyc);
        setDisputes(disputeList);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, []);

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
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-heading-sm text-text-primary">Staff dashboard</h1>

      <div className="mt-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-accent text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {t.label} {t.key === 'kyc' ? `(${kycQueue.length})` : `(${disputes.length})`}
          </button>
        ))}
      </div>

      {loading && <div className="py-16 text-center text-text-muted">Loading…</div>}
      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {!loading && tab === 'kyc' && (
        <div className="mt-6 space-y-4">
          {kycQueue.length === 0 && <p className="text-text-muted">No pending seller applications.</p>}
          {kycQueue.map((k) => (
            <div key={k.user_id} className="rounded-card border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-text-primary">{k.full_name}</p>
                  <p className="text-sm text-text-muted">{k.phone} · {k.address}</p>
                  <p className="text-xs text-text-muted">Submitted {new Date(k.submitted_at).toLocaleString()}</p>
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
                      className="flex-1 rounded-btn border border-line px-3 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => reject(k.user_id)}
                      className="rounded-btn border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Confirm reject
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setRejectingId(k.user_id)}
                    className="rounded-btn border border-line px-3 py-1.5 text-sm font-medium text-text-secondary hover:border-text-muted"
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
          {disputes.length === 0 && <p className="text-text-muted">No open disputes.</p>}
          {disputes.map((d) => (
            <div key={d.id} className="rounded-card border border-line p-4">
              <p className="font-semibold text-text-primary">{d.rental?.listing?.title}</p>
              <p className="text-sm text-text-muted">
                {d.rental?.start_date} → {d.rental?.end_date} · Owner: {d.rental?.listing?.owner?.full_name} ·
                Renter: {d.rental?.renter?.full_name}
              </p>
              <p className="mt-2 text-sm text-text-primary">
                <span className="font-medium">{d.raiser?.full_name}</span> reported: {d.reason}
              </p>
              <p className="text-xs text-text-muted">
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
                    className="w-full rounded-btn border border-line px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolve(d.id, 'completed')}
                      className="rounded-btn bg-text-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                    >
                      Side with owner (release payout)
                    </button>
                    <button
                      onClick={() => resolve(d.id, 'cancelled')}
                      className="rounded-btn border border-line px-3 py-1.5 text-sm font-medium text-text-secondary hover:border-text-muted"
                    >
                      Side with renter (refund)
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setResolvingId(d.id)}
                  className="mt-3 rounded-btn border border-line px-3 py-1.5 text-sm font-medium text-text-secondary hover:border-text-muted"
                >
                  Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
