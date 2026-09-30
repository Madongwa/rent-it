import { useEffect, useState } from 'react';
import { Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { api } from '../lib/api';

// "Renters say..." - an AI summary of a listing's written reviews
// (backend lib/reviewSummary.js). Shown only when there is one; it's the
// reviews themselves that count, so it's labelled as AI.
export default function ReviewSummary({ listingId, reviewCount }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    if (!listingId || reviewCount < 3) return undefined;
    let cancelled = false;
    api
      .getReviewSummary(listingId)
      .then((r) => !cancelled && setData(r.summary))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [listingId, reviewCount]);

  if (!data) return null;
  return (
    <div className="mt-4 rounded-btn border border-emerald-500/20 bg-emerald-500/5 p-4">
      <p className="flex items-start gap-2 text-sm text-night-text">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
        <span>{data.summary}</span>
      </p>
      {(data.liked.length > 0 || data.disliked.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
          {data.liked.map((p) => (
            <span key={`l-${p}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
              <ThumbsUp className="h-3 w-3" aria-hidden="true" /> {p}
            </span>
          ))}
          {data.disliked.map((p) => (
            <span key={`d-${p}`} className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
              <ThumbsDown className="h-3 w-3" aria-hidden="true" /> {p}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 pl-6 text-[11px] text-night-muted">Summarised by AI from {data.based_on} written reviews - read them below.</p>
    </div>
  );
}
