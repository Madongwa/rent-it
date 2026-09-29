import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../../lib/api';

// The AI summary on a dispute card in the staff dashboard: what was agreed,
// what went wrong, the key facts, and what to check. Made from the rental's
// records only - never the chat (staff read that themselves) - and it
// doesn't decide who is right. Saved once made, so it shows straight away
// next time.
export default function DisputeSummary({ disputeId, initial }) {
  const [summary, setSummary] = useState(initial || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(refresh) {
    setLoading(true);
    setError('');
    try {
      setSummary(await api.getDisputeSummary(disputeId, refresh));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!summary) {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => load(false)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:underline disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {loading ? 'Summarising…' : 'Summarise with AI'}
        </button>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-btn border border-white/10 bg-black/20 p-3 text-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium text-night-muted">
        <Sparkles className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
        AI summary - from the rental records, not the chat. Check before deciding.
      </p>
      <p className="text-night-text">{summary.summary}</p>
      {summary.facts?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-night-muted">Key facts</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-night-text">
            {summary.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {summary.check?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-night-muted">Check before deciding</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-night-text">
            {summary.check.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" onClick={() => load(true)} disabled={loading} className="text-xs text-night-muted hover:text-night-text hover:underline disabled:opacity-60">
        {loading ? 'Summarising…' : 'Make a new summary'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
