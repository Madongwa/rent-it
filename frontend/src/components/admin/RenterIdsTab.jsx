import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

// Staff → Renter IDs (backend lib/renterId.js): IDs the automatic check
// couldn't confirm wait here for a person; the latest decided ones are
// listed too, so a mistake (AI or staff) can be reversed. DocLink is the
// staff page's signed-URL viewer for the private kyc-documents bucket.
const STATUS = {
  pending: 'bg-amber-500/15 text-amber-300',
  verified: 'bg-emerald-500/15 text-emerald-300',
  rejected: 'bg-red-500/15 text-red-300',
};
const TYPE = { aadhaar: 'Aadhaar (masked)', driving_licence: 'Driving licence', voter_id: 'Voter ID', pan: 'PAN card', passport: 'Passport' };

export default function RenterIdsTab({ DocLink }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  const load = () => api.adminRenterIds().then(setRows).catch((err) => setError(err.message));
  useEffect(() => {
    load();
  }, []);

  async function review(userId, action) {
    setError('');
    try {
      await api.adminReviewRenterId(userId, action, action === 'reject' ? reason : undefined);
      setRejecting(null);
      setReason('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!rows && !error) return <p className="mt-6 text-night-muted">Loading…</p>;
  return (
    <div className="mt-6 space-y-3">
      <p className="text-sm text-night-muted">
        Renters verify one government ID. Clear ones are verified automatically; the rest wait here. Owners only ever see "ID
        verified" - never the document.
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {rows?.length === 0 && <p className="text-night-muted">No renter IDs yet.</p>}
      {rows?.map((r) => (
        <div key={r.user_id} className="rounded-card border border-night-border/15 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-night-text" translate="no">{r.person?.full_name || 'Unknown'}</p>
              <p className="text-xs text-night-muted">
                {TYPE[r.id_type] || r.id_type} · sent {new Date(r.submitted_at).toLocaleString()}
                {r.method && ` · decided by ${r.method === 'ai' ? 'the automatic check' : 'staff'}`}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS[r.status]}`}>{r.status}</span>
              {r.document_path ? <DocLink path={r.document_path}>ID</DocLink> : <span className="text-xs text-night-muted">photo deleted</span>}
            </div>
          </div>
          {r.ai_result && (
            <p className="mt-2 text-xs text-night-muted">
              AI: {r.ai_result.looks_like_id === 'yes' ? 'looks real' : r.ai_result.looks_like_id === 'no' ? "doesn't look like an ID" : 'unclear'} ·{' '}
              {r.ai_result.readable} readable · name {r.ai_result.name_match}
              {r.ai_result.issues?.length ? ` · ${r.ai_result.issues.join('; ')}` : ''}
            </p>
          )}
          {r.rejection_reason && <p className="mt-1 text-xs text-red-300">Told the renter: {r.rejection_reason}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {r.status !== 'verified' && r.document_path && (
              <button onClick={() => review(r.user_id, 'verify')} className="rounded-btn bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
                Verify
              </button>
            )}
            {r.status !== 'rejected' &&
              (rejecting === r.user_id ? (
                <>
                  <input
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason shown to the renter"
                    className="min-w-0 flex-1 rounded-btn border border-night-border/20 bg-black/20 px-3 py-1.5 text-sm text-night-text placeholder:text-night-muted/60"
                  />
                  <button onClick={() => review(r.user_id, 'reject')} className="rounded-btn border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10">
                    Confirm reject
                  </button>
                </>
              ) : (
                <button onClick={() => setRejecting(r.user_id)} className="rounded-btn border border-night-border/15 px-3 py-1.5 text-sm font-medium text-night-muted hover:border-night-muted">
                  {r.status === 'verified' ? 'Revoke' : 'Reject'}
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
