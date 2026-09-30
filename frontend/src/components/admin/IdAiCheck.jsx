import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../../lib/api';

// Staff → Seller verification: an optional AI look at the uploaded ID
// (backend lib/idCheck.js) - checks only, never the ID's details; staff
// still decide.
const LOOKS = { yes: 'Looks like a real ID', no: "Doesn't look like a real ID", unclear: "Can't tell if it's a real ID" };
const READ = { yes: 'readable', partly: 'partly readable', no: 'not readable' };
const NAME = { match: 'name matches the application', mismatch: "name doesn't match the application", unclear: "name can't be compared" };
const TYPE = { aadhaar: 'Aadhaar', pan: 'PAN card', driving_licence: 'Driving licence', voter_id: 'Voter ID', passport: 'Passport', other: 'Other document', unknown: 'Unknown type' };

export default function IdAiCheck({ userId }) {
  const [state, setState] = useState({});

  async function run() {
    setState({ busy: true });
    try {
      setState({ result: await api.aiCheckKyc(userId) });
    } catch (err) {
      setState({ error: err.message });
    }
  }

  const r = state.result;
  const good = r && r.looks_like_id === 'yes' && r.name_match === 'match' && r.readable !== 'no';
  return (
    <div className="mt-3 text-sm">
      {!r && (
        <button type="button" onClick={run} disabled={state.busy} className="inline-flex items-center gap-1.5 font-medium text-emerald-300 hover:underline disabled:opacity-60">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> {state.busy ? 'Checking the ID…' : 'AI check'}
        </button>
      )}
      {state.error && <p className="mt-1 text-red-400">{state.error}</p>}
      {r && (
        <div className={`rounded-btn border p-3 ${good ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-400/40 bg-amber-500/5'}`} role="status">
          <p className={good ? 'text-emerald-300' : 'text-amber-300'}>
            {LOOKS[r.looks_like_id]} · {TYPE[r.document_type]} · {READ[r.readable]} · {NAME[r.name_match]}
          </p>
          {r.issues.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-night-text">
              {r.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-xs text-night-muted">
            AI suggestion from {r.sides_checked} side{r.sides_checked === 1 ? '' : 's'} of the ID - open the documents and decide yourself.
          </p>
        </div>
      )}
    </div>
  );
}
