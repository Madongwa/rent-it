import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { formatInr } from '../lib/offers';

// "Suggest a price" on the listing form: an AI estimate of what the item
// usually rents for in India, plus any genuinely similar Rent It listings
// with their real prices. The owner still sets the price - "Use ₹X" just
// fills the field in.
export default function PriceSuggestion({ form, listingId, onUse }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const canSuggest = form.title.trim().length >= 3 && form.category_id;

  async function suggest() {
    setLoading(true);
    setError('');
    try {
      setResult(
        await api.suggestPrice({
          title: form.title,
          category_id: Number(form.category_id),
          condition: form.condition,
          location: form.location,
          description: form.description,
          listing_id: listingId,
        })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const estimate = result?.estimate;

  return (
    <div>
      <button
        type="button"
        onClick={suggest}
        disabled={!canSuggest || loading}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {loading ? 'Checking typical prices…' : result ? 'Suggest again' : 'Suggest a price'}
      </button>
      {!canSuggest && <p className="mt-1 text-xs text-night-muted">Add a title and category to get a price suggestion.</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

      {estimate && (
        <div className="mt-2 space-y-2 rounded-btn border border-white/10 bg-black/20 p-3 text-sm" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-night-text">{`Items like this usually rent for ${formatInr(estimate.low)}–${formatInr(estimate.high)} a day.`}</p>
            <button
              type="button"
              onClick={() => onUse(estimate.suggested)}
              className="shrink-0 rounded-btn bg-white px-3 py-1 text-xs font-semibold text-black hover:opacity-90"
            >
              {`Use ${formatInr(estimate.suggested)}`}
            </button>
          </div>
          {estimate.reason && <p className="text-xs text-night-muted">{estimate.reason}</p>}

          {result.similar.length > 0 && (
            <div className="border-t border-white/10 pt-2">
              <p className="text-xs font-medium text-night-muted">
                {result.similar.length === 1 ? 'Similar on Rent It:' : `${result.similar.length} similar on Rent It:`}
              </p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {result.similar.slice(0, 4).map((l) => (
                  <li key={l.id}>
                    {/* A new tab, so the half-filled form isn't lost. */}
                    <a href={`/listing/${l.id}`} target="_blank" rel="noreferrer" className="text-night-text hover:underline">
                      {l.title}
                    </a>
                    <span className="text-night-muted">{` - ${formatInr(l.price_per_day)}/day${l.location ? ` · ${l.location}` : ''}`}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-night-muted/80">AI estimate - it can be off. You choose the final price.</p>
        </div>
      )}
    </div>
  );
}
