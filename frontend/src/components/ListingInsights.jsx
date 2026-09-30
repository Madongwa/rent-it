import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, Lightbulb, Search } from 'lucide-react';
import { api } from '../lib/api';

// The owner's "💡 Tips" panel for one listing (backend lib/listingInsights.js):
// what to improve, how many searches match it lately, and the seasonal
// outlook (AI).
function demandLine({ recent, previous, days }) {
  if (!recent && !previous) return `No Marketplace searches for this kind of item in the last ${days} days yet.`;
  const trend = recent > previous ? `up from ${previous}` : recent < previous ? `down from ${previous}` : 'about the same as before';
  return `${recent} search${recent === 1 ? '' : 'es'} for this kind of item in the last ${days} days - ${trend}.`;
}

export default function ListingInsights({ listingId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getListingInsights(listingId).then(setData).catch((err) => setError(err.message));
  }, [listingId]);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!data) return <p className="text-sm text-night-muted">Loading tips…</p>;
  return (
    <div className="space-y-3 text-sm">
      {data.tips.length ? (
        <ul className="space-y-1.5">
          {data.tips.map((t) => (
            <li key={t.key} className="flex gap-2 text-night-text">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
              <span>{t.text}</span>
            </li>
          ))}
          <li>
            <Link to={`/listing/${listingId}/edit`} className="pl-6 text-accent hover:underline">
              Edit listing
            </Link>
          </li>
        </ul>
      ) : (
        <p className="flex gap-2 text-emerald-400">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Nothing to fix - this listing has everything renters look for.
        </p>
      )}
      {data.demand && (
        <p className="flex gap-2 text-night-muted">
          <Search className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {demandLine(data.demand)}
        </p>
      )}
      {data.season && (
        <p className="flex gap-2 text-night-muted">
          <CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
          <span>
            {data.season} <span className="text-[11px]">(AI - general seasonal pattern)</span>
          </span>
        </p>
      )}
    </div>
  );
}
