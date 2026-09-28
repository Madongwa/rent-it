// Display helpers for rental price offers - shared by the listing page's
// request form, the offer cards in Messages, and the Dashboard.

const DAY_MS = 24 * 60 * 60 * 1000;

export function rentalDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  return Math.round((new Date(`${endDate}T00:00:00`) - new Date(`${startDate}T00:00:00`)) / DAY_MS) + 1;
}

export function formatInr(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatDay(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Today in the viewer's own timezone, as YYYY-MM-DD - for date inputs' min.
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "₹150/day below listed" / "₹50/day above listed" / "Listed price"
export function priceDifference(offered, listed) {
  if (listed == null || offered == null || offered === '') return null;
  const diff = Math.round((Number(offered) - Number(listed)) * 100) / 100;
  if (diff === 0) return { tone: 'same', label: 'Listed price' };
  return {
    tone: diff < 0 ? 'below' : 'above',
    label: `${formatInr(Math.abs(diff))}/day ${diff < 0 ? 'below' : 'above'} listed`,
  };
}

// Where a price sits against the usual range for the item (the AI price
// check): 'below', 'within' or 'above' - null without a price or range.
export function priceVsRange(price, low, high) {
  if (price == null || !Number.isFinite(Number(price)) || low == null || high == null) return null;
  if (Number(price) < low) return 'below';
  if (Number(price) > high) return 'above';
  return 'within';
}

export function findOpenOffer(offers) {
  return (offers || []).find((o) => o.status === 'open') || null;
}

// Mirrors the backend's rule (backend/src/lib/offers.js): on a pending
// rental it's the turn of whoever didn't make the open offer, and a request
// from before offers existed is the owner's to decide.
export function whoseTurn(rental, openOffer) {
  if (!openOffer) return 'owner';
  return openOffer.proposed_by === rental.renter_id ? 'owner' : 'renter';
}
