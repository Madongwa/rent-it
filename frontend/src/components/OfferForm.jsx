import { useState } from 'react';
import { formatInr, priceDifference, rentalDays, todayStr } from '../lib/offers';

const INPUT_CLASS =
  'w-full rounded-btn border border-night-border/20 bg-black/20 px-3 py-2 text-sm text-night-text [color-scheme:dark] placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-accent';

const DIFF_TONE = {
  below: 'bg-amber-500/15 text-amber-400',
  above: 'bg-emerald-500/15 text-emerald-400',
  same: 'bg-white/10 text-night-muted',
};

// Dates + "how much you'll pay per day", with the listed price and running
// total alongside. Used for a first request (listing page, or "Make an
// offer" in chat) and for counter-offers on an offer card.
export default function OfferForm({
  listedPrice,
  depositRequired = false,
  depositAmount = null,
  initial = {},
  submitLabel = 'Send request',
  submittingLabel = 'Sending…',
  note = "You pay the owner directly when you pick the item up. Rent It doesn't handle payments.",
  onSubmit,
  onCancel,
}) {
  const [startDate, setStartDate] = useState(initial.start_date || '');
  const [endDate, setEndDate] = useState(initial.end_date || '');
  const [price, setPrice] = useState(String(initial.price_per_day ?? listedPrice ?? ''));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const days = startDate && endDate && endDate >= startDate ? rentalDays(startDate, endDate) : 0;
  const priceNum = Number(price);
  const priceValid = price !== '' && Number.isFinite(priceNum) && priceNum > 0;
  const diff = priceValid ? priceDifference(priceNum, listedPrice) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!startDate || !endDate) return setError('Please choose a start and end date.');
    if (endDate < startDate) return setError('End date must be on or after the start date.');
    if (!priceValid) return setError('Enter the price you want to pay per day.');

    setSubmitting(true);
    try {
      await onSubmit({ start_date: startDate, end_date: endDate, price_per_day: priceNum });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-night-muted">Start date</label>
          <input
            type="date"
            value={startDate}
            min={todayStr()}
            onChange={(e) => setStartDate(e.target.value)}
            className={INPUT_CLASS}
            required
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-night-muted">End date</label>
          <input
            type="date"
            value={endDate}
            min={startDate || todayStr()}
            onChange={(e) => setEndDate(e.target.value)}
            className={INPUT_CLASS}
            required
          />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <label htmlFor="offer-price" className="text-xs font-medium text-night-muted">
            Your price per day
          </label>
          {listedPrice != null && (
            <span className="text-xs text-night-muted">Listed {formatInr(listedPrice)}/day</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-night-muted">₹</span>
            <input
              id="offer-price"
              type="number"
              inputMode="decimal"
              min="1"
              step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={`${INPUT_CLASS} pl-7`}
              required
            />
          </div>
          {diff && (
            <span className={`shrink-0 rounded-badge px-2 py-1 text-caption font-medium ${DIFF_TONE[diff.tone]}`}>
              {diff.label}
            </span>
          )}
        </div>
      </div>

      {days > 0 && priceValid && (
        <div className="rounded-btn bg-black/20 px-3 py-2 text-sm">
          <p className="flex justify-between text-night-muted">
            <span>
              {formatInr(priceNum)} × {days} day{days === 1 ? '' : 's'}
            </span>
            <span className="font-semibold text-night-text">{formatInr(priceNum * days)}</span>
          </p>
          {depositRequired && (
            <p className="mt-1 text-xs text-night-muted">
              + {depositAmount ? `${formatInr(depositAmount)} refundable deposit` : 'a refundable deposit'}, paid to the owner at pickup
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-btn bg-white py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? submittingLabel : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-btn border border-night-border/20 px-4 text-sm font-medium text-night-muted hover:text-night-text disabled:opacity-60"
          >
            Cancel
          </button>
        )}
      </div>
      {note && <p className="text-caption text-night-muted">{note}</p>}
    </form>
  );
}
