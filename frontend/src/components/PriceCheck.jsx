import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { formatInr, priceVsRange } from '../lib/offers';

const VERDICT = {
  below: { tone: 'text-amber-400', text: (p) => `${p} is below the usual range for items like this.` },
  within: { tone: 'text-emerald-400', text: (p) => `${p} is within the usual range for items like this.` },
  above: { tone: 'text-amber-400', text: (p) => `${p} is above the usual range for items like this.` },
};

// The price check in the offer form while bargaining: what items like this
// usually rent for (AI estimate) and any similar Rent It listings, and
// where the price being offered sits against that. The estimate is stored
// per listing on the backend, so opening this is usually instant. Shows
// nothing at all if it isn't available - it's a hint, not part of the form.
export default function PriceCheck({ listingId, price }) {
  const [check, setCheck] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setCheck(null);
    api
      .getPriceCheck(listingId)
      .then((data) => {
        if (!cancelled) setCheck(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const estimate = check?.estimate;
  if (!estimate) return null;

  const verdict = VERDICT[priceVsRange(price, estimate.low, estimate.high)];
  const stats = check.similar_stats;

  return (
    <div className="rounded-btn border border-white/10 bg-black/20 px-3 py-2 text-xs" aria-live="polite">
      <p className="flex items-center gap-1.5 font-medium text-night-text">
        <Sparkles className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
        Price check
        <span className="rounded-badge bg-white/10 px-1.5 py-0.5 text-[10px] font-normal text-night-muted">AI estimate</span>
      </p>
      <p className="mt-1 text-night-muted">{`Items like this usually rent for ${formatInr(estimate.low)}–${formatInr(estimate.high)} a day.`}</p>
      {stats && (
        <p className="mt-0.5 text-night-muted">
          {stats.count === 1
            ? `1 similar item on Rent It: ${formatInr(stats.min)}/day.`
            : `${stats.count} similar items on Rent It: ${formatInr(stats.min)}–${formatInr(stats.max)}/day.`}
        </p>
      )}
      {verdict && <p className={`mt-1 font-medium ${verdict.tone}`}>{verdict.text(formatInr(price))}</p>}
    </div>
  );
}
