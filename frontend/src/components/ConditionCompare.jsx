import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../lib/api';

// "Compare pickup and return photos": the AI's read of visible changes
// (backend lib/conditionCompare.js). A neutral second look for the renter
// and owner - or staff, in a dispute - never a decision.
const VERDICT = {
  no_visible_change: { label: 'No visible change spotted', className: 'text-emerald-400' },
  possible_new_damage: { label: 'Possible new damage', className: 'text-amber-300' },
  unclear: { label: "Can't tell from these photos", className: 'text-night-muted' },
};

export default function ConditionCompare({ rentalId, staff = false }) {
  const [state, setState] = useState({});

  async function run() {
    setState({ busy: true });
    try {
      const { result } = await (staff ? api.adminComparePhotos(rentalId) : api.comparePhotos(rentalId));
      setState({ result });
    } catch (err) {
      setState({ error: err.message });
    }
  }

  const v = state.result && VERDICT[state.result.verdict];
  return (
    <div className="rounded-btn border border-emerald-500/20 bg-emerald-500/5 p-3">
      <button
        type="button"
        onClick={run}
        disabled={state.busy}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300 hover:underline disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {state.busy ? 'Comparing photos…' : state.result ? 'Compare again' : 'Compare pickup and return photos'}
      </button>
      {state.error && <p className="mt-2 text-sm text-red-400">{state.error}</p>}
      {v && (
        <div className="mt-2 text-sm" role="status">
          <p className={`font-semibold ${v.className}`}>{v.label}</p>
          {state.result.findings.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-night-text">
              {state.result.findings.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          {state.result.note && <p className="mt-1 text-night-muted">{state.result.note}</p>}
          <p className="mt-2 text-xs text-night-muted">
            An AI suggestion from {state.result.pickup_photos} pickup and {state.result.return_photos} return photo
            {state.result.return_photos === 1 ? '' : 's'} - look at the item together before deciding anything.
          </p>
        </div>
      )}
    </div>
  );
}
