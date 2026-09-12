import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../hooks/useFavorites';
import {
  POWER_SOURCE_OPTIONS,
  DELIVERY_OPTIONS,
  CANCELLATION_OPTIONS,
  OWNER_TYPE_OPTIONS,
  DURATION_OPTIONS,
  MIN_RENTAL_PERIOD_OPTIONS,
} from '../components/FilterSidebar';

const labelMap = (options) => Object.fromEntries(options.map((o) => [o.value, o.label]));
const POWER_SOURCE_LABEL = labelMap(POWER_SOURCE_OPTIONS);
const DELIVERY_LABEL = labelMap(DELIVERY_OPTIONS);
const CANCELLATION_LABEL = labelMap(CANCELLATION_OPTIONS);
const OWNER_TYPE_LABEL = labelMap(OWNER_TYPE_OPTIONS);
const DURATION_LABEL = labelMap(DURATION_OPTIONS);
const MIN_RENTAL_PERIOD_LABEL = labelMap(MIN_RENTAL_PERIOD_OPTIONS);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function daysBetween(startStr, endStr) {
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  return Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

function StarRating({ rating, className = '' }) {
  const rounded = Math.round(rating);
  return (
    <span className={`text-amber-500 ${className}`} aria-hidden="true">
      {'★'.repeat(rounded)}
      <span className="text-line">{'★'.repeat(Math.max(0, 5 - rounded))}</span>
    </span>
  );
}

function SectionCard({ title, children }) {
  return (
    <section className="mt-8 rounded-card border border-line bg-surface p-6">
      <h2 className="text-subheading text-text-primary">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// A single month-view calendar with every day inside a rental_history
// range highlighted. Defaults to the most recent rental's month (rather
// than the current month) since most seeded history is months in the
// past - otherwise it'd usually open on a blank month.
function RentalHistoryCalendar({ history }) {
  const initialMonth = useMemo(() => {
    if (history.length === 0) return new Date();
    return new Date(`${history[0].start_date}T00:00:00`);
  }, [history]);
  const [viewDate, setViewDate] = useState(initialMonth);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  function dateStrFor(day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  function isBooked(day) {
    const d = dateStrFor(day);
    return history.some((h) => d >= h.start_date && d <= h.end_date);
  }

  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="w-full max-w-xs">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          aria-label="Previous month"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-text-secondary hover:border-text-muted"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-text-primary">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          aria-label="Next month"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-text-secondary hover:border-text-muted"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-caption text-text-muted">
        {WEEKDAY_LABELS.map((d, i) => (
          <div key={i} className="py-1 font-medium">{d}</div>
        ))}
        {cells.map((day, i) =>
          day ? (
            <div
              key={i}
              className={`flex h-8 items-center justify-center rounded-md text-sm ${
                isBooked(day)
                  ? 'bg-accent/15 font-semibold text-accent'
                  : 'text-text-secondary'
              } ${dateStrFor(day) === todayStr ? 'ring-1 ring-inset ring-text-primary' : ''}`}
            >
              {day}
            </div>
          ) : (
            <div key={i} />
          )
        )}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-caption text-text-muted">
        <span className="h-2.5 w-2.5 rounded-sm bg-accent/15" /> Booked date
      </p>
    </div>
  );
}

// Rating picker - plain buttons, not a native <input type="range">, so the
// current value is always visible at a glance rather than needing a drag.
function StarPicker({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          className={`text-2xl leading-none ${n <= value ? 'text-amber-500' : 'text-line'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function WriteReviewForm({ listingId, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createReview({ listing_id: listingId, rating, comment: comment.trim() || undefined });
      setComment('');
      onSubmitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-3 border-b border-line pb-6">
      <h3 className="text-sm font-semibold text-text-primary">Leave a review</h3>
      <StarPicker value={rating} onChange={setRating} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="How did it go? (optional)"
        className="w-full rounded-btn border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-btn bg-text-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : 'Submit review'}
      </button>
    </form>
  );
}

function ReviewsSection({ reviews, avgRating, reviewCount, canReview, listingId, onReviewSubmitted }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? reviews : reviews.slice(0, 5);

  return (
    <SectionCard title="Reviews">
      <div className="flex items-center gap-2 border-b border-line pb-4">
        <StarRating rating={avgRating} className="text-lg" />
        <span className="text-subheading text-text-primary">{Number(avgRating).toFixed(1)}</span>
        <span className="text-body text-text-muted">
          · {reviewCount} review{reviewCount === 1 ? '' : 's'}
        </span>
      </div>

      {canReview && (
        <div className="mt-6">
          <WriteReviewForm listingId={listingId} onSubmitted={onReviewSubmitted} />
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="mt-4 text-body text-text-muted">No reviews yet.</p>
      ) : (
        <>
          <ul className="mt-4 space-y-4">
            {shown.map((r) => (
              <li key={r.id} className="border-b border-line pb-4 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-medium text-text-primary">{r.reviewer_name}</span>
                  <span className="text-caption text-text-muted">{formatDate(r.created_at.slice(0, 10))}</span>
                </div>
                <StarRating rating={r.rating} className="text-sm" />
                {r.comment && <p className="mt-1.5 text-body text-text-secondary">{r.comment}</p>}
              </li>
            ))}
          </ul>
          {reviews.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="mt-4 text-sm font-medium text-accent hover:underline"
            >
              {showAll ? 'Show less' : `Show all ${reviews.length} reviews`}
            </button>
          )}
        </>
      )}
    </SectionCard>
  );
}

export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [messageError, setMessageError] = useState('');

  const { favoriteIds, toggle: toggleFavorite, isLoggedIn } = useFavorites();

  function reload() {
    return api.getListing(id).then(setListing);
  }

  useEffect(() => {
    setLoading(true);
    reload()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleToggleFavorite() {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: { pathname: `/listing/${id}` } } });
      return;
    }
    toggleFavorite(id);
  }

  async function handleMessageOwner() {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/listing/${id}` } } });
      return;
    }
    setMessaging(true);
    setMessageError('');
    try {
      const conversation = await api.startConversation(id);
      navigate(`/messages?c=${conversation.id}`);
    } catch (err) {
      setMessageError(err.message);
    } finally {
      setMessaging(false);
    }
  }

  async function handleRequestRent(e) {
    e.preventDefault();
    setRequestError('');

    if (!user) {
      navigate('/login', { state: { from: { pathname: `/listing/${id}` } } });
      return;
    }
    if (!startDate || !endDate) {
      setRequestError('Please choose a start and end date.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createRental({ listing_id: id, start_date: startDate, end_date: endDate });
      setRequestSuccess(true);
    } catch (err) {
      setRequestError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="py-24 text-center text-text-muted">Loading…</div>;
  if (error || !listing)
    return <div className="py-24 text-center text-red-500">{error || 'Listing not found.'}</div>;

  const isOwner = user && listing.owner_id === user.id;
  const reviews = listing.reviews || [];
  const rentalHistory = listing.rental_history || [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link to="/marketplace" className="text-sm text-text-muted hover:text-text-primary">
        ← Back to marketplace
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        {/* 1. Image */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-card bg-canvas">
          {listing.image_url ? (
            <img src={listing.image_url} alt={listing.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-6xl">
              {listing.category?.icon || '🧰'}
            </div>
          )}
          <button
            type="button"
            onClick={handleToggleFavorite}
            aria-label={favoriteIds.has(id) ? 'Remove from favorites' : 'Save to favorites'}
            aria-pressed={favoriteIds.has(id)}
            className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 backdrop-blur transition-transform hover:scale-110 ${
              favoriteIds.has(id) ? 'text-[#ff5a7a]' : 'text-white'
            }`}
          >
            <svg viewBox="0 0 24 24" fill={favoriteIds.has(id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
            </svg>
          </button>
        </div>

        <div>
          {/* 1. Category/subcategory tags + condition badge */}
          <div className="flex flex-wrap gap-2">
            {listing.category?.name && (
              <span className="rounded-badge bg-accent px-2.5 py-1 text-caption font-medium text-white">
                {listing.category.icon} {listing.category.name}
              </span>
            )}
            {listing.condition && (
              <span className="rounded-badge border border-line px-2.5 py-1 text-caption font-medium text-text-secondary">
                {listing.condition}
              </span>
            )}
            {listing.status !== 'available' && (
              <span className="rounded-badge border border-line px-2.5 py-1 text-caption font-medium capitalize text-text-muted">
                {listing.status}
              </span>
            )}
          </div>

          <h1 className="mt-3 text-heading-sm text-text-primary">{listing.title}</h1>

          {/* 5. Rating/review count, kept up near the title as specified */}
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-body text-text-muted">
            {listing.review_count > 0 && (
              <>
                <StarRating rating={listing.avg_rating} className="text-sm" />
                <span className="font-medium text-text-primary">{Number(listing.avg_rating).toFixed(1)}</span>
                <span>· {listing.review_count} reviews</span>
                {listing.location && <span aria-hidden="true">·</span>}
              </>
            )}
            {listing.location && <span>📍 {listing.location}</span>}
          </p>

          {/* 2. Price, deposit, min rental period, supported durations */}
          <div className="mt-4">
            <p className="text-heading-sm text-text-primary">
              ₹{Number(listing.price_per_day).toLocaleString('en-IN')}
              <span className="text-body font-normal text-text-muted"> /day</span>
            </p>
            <div className="mt-1.5 space-y-0.5 text-body text-text-muted">
              {listing.deposit_required && (
                <p>
                  Refundable deposit:{' '}
                  <span className="font-medium text-text-secondary">
                    {listing.deposit_amount ? `₹${Number(listing.deposit_amount).toLocaleString('en-IN')}` : 'Required'}
                  </span>
                </p>
              )}
              <p>
                Minimum rental: <span className="font-medium text-text-secondary">{MIN_RENTAL_PERIOD_LABEL[listing.min_rental_period] || 'No minimum'}</span>
              </p>
              {listing.supported_durations?.length > 0 && (
                <p>
                  Available by:{' '}
                  <span className="font-medium text-text-secondary">
                    {listing.supported_durations.map((d) => DURATION_LABEL[d] || d).join(', ')}
                  </span>
                </p>
              )}
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
            <div>
              <dt className="text-text-muted">Listed by</dt>
              <dd className="font-medium text-text-primary">
                {listing.owner_id ? (
                  <Link to={`/owner/${listing.owner_id}`} className="hover:underline">
                    {listing.owner?.full_name || 'Rent It user'}
                  </Link>
                ) : (
                  listing.owner?.full_name || 'Rent It user'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Owner type</dt>
              <dd className="font-medium text-text-primary">{OWNER_TYPE_LABEL[listing.owner_type] || '—'}</dd>
            </div>
          </dl>

          {!isOwner && (
            <button
              type="button"
              onClick={handleMessageOwner}
              disabled={messaging}
              className="mt-3 text-sm font-medium text-accent hover:underline disabled:opacity-60"
            >
              {messaging ? 'Starting conversation…' : '💬 Message the owner'}
            </button>
          )}
          {messageError && <p className="mt-1 text-sm text-red-500">{messageError}</p>}

          {/* 3. Description */}
          {listing.description && (
            <div className="mt-6">
              <h2 className="font-semibold text-text-primary">Description</h2>
              <p className="mt-1 whitespace-pre-line text-text-secondary">{listing.description}</p>
            </div>
          )}

          {/* 6. Availability/booking request form - unchanged logic */}
          <div className="mt-8 rounded-card border border-line bg-canvas p-5">
            {isOwner ? (
              <p className="text-sm text-text-muted">This is your own listing.</p>
            ) : requestSuccess ? (
              <p className="text-sm font-medium text-green-600">
                ✅ Request sent! Check your dashboard for updates.
              </p>
            ) : listing.status !== 'available' ? (
              <p className="text-sm text-text-muted">This item isn't currently available.</p>
            ) : (
              <form onSubmit={handleRequestRent} className="space-y-3">
                <h2 className="font-semibold text-text-primary">Request to rent</h2>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-text-muted">Start date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-btn border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-text-muted">End date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-btn border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      required
                    />
                  </div>
                </div>
                {requestError && <p className="text-sm text-red-500">{requestError}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-btn bg-text-primary py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {submitting ? 'Sending…' : user ? 'Request to Rent' : 'Log in to request'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* 4. Specs/details */}
      <SectionCard title="Details">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-text-muted">Power source</dt>
            <dd className="font-medium text-text-primary">{POWER_SOURCE_LABEL[listing.power_source] || '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Delivery</dt>
            <dd className="font-medium text-text-primary">{DELIVERY_LABEL[listing.delivery_option] || '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Cancellation policy</dt>
            <dd className="font-medium text-text-primary">{CANCELLATION_LABEL[listing.cancellation_policy] || '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Accessories included</dt>
            <dd className="font-medium text-text-primary">
              {listing.accessories_included ? listing.accessories_note || 'Yes' : 'Bare equipment only'}
            </dd>
          </div>
          {listing.distance_km != null && (
            <div>
              <dt className="text-text-muted">Distance</dt>
              <dd className="font-medium text-text-primary">{listing.distance_km} km away</dd>
            </div>
          )}
        </dl>
      </SectionCard>

      {/* 7. Rental history calendar + list */}
      <SectionCard title="Rental History">
        {rentalHistory.length === 0 ? (
          <p className="text-body text-text-muted">No past rentals yet.</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-[auto_1fr]">
            <RentalHistoryCalendar history={rentalHistory} />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-text-muted">
                    <th className="pb-2 font-medium">Renter</th>
                    <th className="pb-2 font-medium">Dates</th>
                    <th className="pb-2 font-medium">Duration</th>
                    <th className="pb-2 pr-0 text-right font-medium">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {rentalHistory.map((h) => (
                    <tr key={h.id} className="border-b border-line last:border-b-0">
                      <td className="py-2.5 font-medium text-text-primary">{h.renter_display_name}</td>
                      <td className="py-2.5 text-text-secondary">
                        {formatDate(h.start_date)} – {formatDate(h.end_date)}
                      </td>
                      <td className="py-2.5 text-text-secondary">
                        {daysBetween(h.start_date, h.end_date)} day{daysBetween(h.start_date, h.end_date) === 1 ? '' : 's'}
                      </td>
                      <td className="py-2.5 text-right font-medium text-text-primary">
                        ₹{Number(h.amount_paid).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionCard>

      {/* 8. Reviews */}
      <ReviewsSection
        reviews={reviews}
        avgRating={listing.avg_rating}
        reviewCount={listing.review_count}
        listingId={id}
        canReview={!!user && !isOwner && !reviews.some((r) => r.reviewer_id === user.id)}
        onReviewSubmitted={reload}
      />
    </div>
  );
}
