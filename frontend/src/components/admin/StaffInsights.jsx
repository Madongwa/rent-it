import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

// Staff → Insights (backend lib/analytics.js): last 30 days of searches -
// including the ones that found nothing, i.e. what people want that nobody
// lists yet - and how chats turn into deals.
function Stat({ label, value, note }) {
  return (
    <div className="rounded-card border border-night-border/15 p-4">
      <p className="text-xs text-night-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-night-text">{value}</p>
      {note && <p className="mt-0.5 text-xs text-night-muted">{note}</p>}
    </div>
  );
}

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');

function TermList({ title, hint, terms, empty }) {
  return (
    <div className="rounded-card border border-night-border/15 p-4">
      <h3 className="text-sm font-semibold text-night-text">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-night-muted">{hint}</p>}
      {terms.length === 0 ? (
        <p className="mt-3 text-sm text-night-muted">{empty}</p>
      ) : (
        <ol className="mt-3 space-y-1 text-sm">
          {terms.map((t) => (
            <li key={t.term} className="flex justify-between gap-3 border-b border-night-border/10 py-1">
              <Link to={`/marketplace?q=${encodeURIComponent(t.term)}`} className="truncate text-night-text hover:underline" translate="no">
                {t.term}
              </Link>
              <span className="shrink-0 tabular-nums text-night-muted">{t.count}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function StaffInsights() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getStaffAnalytics().then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="mt-6 text-sm text-red-400">{error}</p>;
  if (!data) return <p className="mt-6 text-night-muted">Loading…</p>;
  const f = data.funnel;
  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-night-muted">Last {data.days} days.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Chats started" value={f.chats} />
        <Stat label="Rental requests" value={f.requests} note={`${pct(f.requests, f.chats)} of chats`} />
        <Stat label="Deals agreed" value={f.deals} note={`${pct(f.deals, f.requests)} of requests`} />
        <Stat label="Completed" value={f.completed} note={`${pct(f.completed, f.deals)} of deals`} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Searches" value={data.searches} />
        <Stat label="Found nothing" value={`${data.no_result_share}%`} note="of searches" />
        <Stat label="Open Wanted posts" value={data.wanted_open} note={<Link to="/wanted" className="hover:underline">See them</Link>} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <TermList
          title="Searches that found nothing"
          hint="What people want that nobody lists yet - worth telling owners about."
          terms={data.no_result_searches}
          empty="None - every search found something."
        />
        <TermList title="Top searches" terms={data.top_searches} empty="No searches yet." />
      </div>
    </div>
  );
}
