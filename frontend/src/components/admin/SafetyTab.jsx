import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { api } from '../../lib/api';

const SEVERITY_BADGE = {
  high: 'bg-red-500/15 text-red-400',
  medium: 'bg-amber-500/15 text-amber-400',
  low: 'bg-white/10 text-night-muted',
};

const MAX_SCAN_ROUNDS = 10;

// Staff dashboard "Safety" tab: listings the safety review (rules + AI,
// backend/src/lib/safety.js) flagged. Opening the tab first reviews any new
// or edited listings, a batch at a time. Staff remove a listing or mark it
// fine - nothing is taken down automatically.
export default function SafetyTab({ onListingRemoved }) {
  const [flagged, setFlagged] = useState([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const data = await api.getSafetyQueue();
    setFlagged(data.flagged);
    setPending(data.pending);
    return data;
  }, []);

  // Reviews pending listings batch by batch, stopping when none are left or
  // a round makes no progress (the AI is unavailable right now).
  const scan = useCallback(async () => {
    setScanning(true);
    setScanNote('');
    setError('');
    try {
      for (let round = 0; round < MAX_SCAN_ROUNDS; round++) {
        const result = await api.runSafetyScan();
        if (result.remaining === 0) break;
        if (result.reviewed === 0) {
          setScanNote(`${result.remaining} listing${result.remaining === 1 ? '' : 's'} couldn't be checked right now - try again in a few minutes.`);
          break;
        }
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }, [load]);

  useEffect(() => {
    load()
      .then((data) => {
        if (data.pending > 0) scan();
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [load, scan]);

  async function act(listingId, action) {
    setBusyId(listingId);
    setError('');
    try {
      if (action === 'remove') {
        await api.updateAdminListingStatus(listingId, 'inactive');
        onListingRemoved?.();
      } else {
        await api.dismissSafetyFlag(listingId);
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-night-muted">
          Every listing is checked for scam signs, prohibited items and fake or offensive text - by fixed rules and by AI. Nothing is
          removed automatically.
        </p>
        <button
          type="button"
          onClick={scan}
          disabled={scanning}
          className="rounded-btn border border-night-border/20 px-3 py-1.5 text-sm font-medium text-night-text hover:bg-white/5 disabled:opacity-60"
        >
          {scanning ? 'Checking listings…' : 'Check again'}
        </button>
      </div>

      {scanning && <p className="text-sm text-night-muted">{`Checking ${pending} new or edited listing${pending === 1 ? '' : 's'}…`}</p>}
      {scanNote && <p className="text-sm text-amber-400">{scanNote}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading && <p className="text-night-muted">Loading…</p>}
      {!loading && !scanning && flagged.length === 0 && (
        <p className="rounded-card border border-night-border/15 p-4 text-night-muted">No flagged listings. 🎉</p>
      )}

      {flagged.map((f) => (
        <div key={f.listing_id} className="rounded-card border border-night-border/15 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                <Link to={`/listing/${f.listing.id}`} className="font-semibold text-night-text hover:underline">
                  {f.listing.title}
                </Link>
                <span className={`rounded-badge px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_BADGE[f.severity] || SEVERITY_BADGE.low}`}>
                  {f.severity}
                </span>
              </div>
              <p className="mt-1 text-sm text-night-muted">
                {f.listing.owner?.full_name || 'Unknown owner'} · ₹{Number(f.listing.price_per_day).toLocaleString('en-IN')}/day
              </p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-night-text">
                {f.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => act(f.listing_id, 'dismiss')}
                disabled={busyId === f.listing_id}
                className="rounded-btn border border-night-border/20 px-3 py-1.5 text-sm font-medium text-night-muted hover:text-night-text disabled:opacity-60"
              >
                Looks fine
              </button>
              <button
                type="button"
                onClick={() => act(f.listing_id, 'remove')}
                disabled={busyId === f.listing_id}
                className="rounded-btn border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-60"
              >
                Remove listing
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
