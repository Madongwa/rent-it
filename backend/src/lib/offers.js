// Pure helpers for rental price offers - no Supabase access here, so the
// validation and wording can be unit-tested directly (offers.test.js).

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// numeric(10, 2) tops out just under 10^8.
const MAX_PRICE = 99999999.99;

function isValidDate(str) {
  if (typeof str !== 'string' || !DATE_RE.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

// Validates the price/dates half of an offer (request body fields
// price_per_day, start_date, end_date). Returns { terms } or { error }.
export function parseOfferTerms({ price_per_day, start_date, end_date } = {}) {
  if (!start_date || !end_date) return { error: 'start_date and end_date are required' };
  if (!isValidDate(start_date) || !isValidDate(end_date)) return { error: 'Dates must be in YYYY-MM-DD format' };
  if (end_date < start_date) return { error: 'End date must be on or after the start date' };

  const price = Number(price_per_day);
  if (price_per_day === undefined || price_per_day === null || price_per_day === '' || !Number.isFinite(price)) {
    return { error: 'price_per_day is required' };
  }
  if (price <= 0) return { error: 'Price per day must be more than ₹0' };
  if (price > MAX_PRICE) return { error: 'Price per day is too large' };

  return { terms: { price_per_day: Math.round(price * 100) / 100, start_date, end_date } };
}

export function rentalDays(startDate, endDate) {
  return Math.round((new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) / DAY_MS) + 1;
}

export function formatInr(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDay(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

// "₹450/day (listed ₹600) for 12 Oct → 15 Oct (4 days, total ₹1,800)" -
// used for chat message bodies and notification text, so the owner sees
// both numbers without opening anything.
export function describeTerms({ price_per_day, start_date, end_date }, listedPrice) {
  const days = rentalDays(start_date, end_date);
  const listed =
    listedPrice != null && Number(listedPrice) !== Number(price_per_day) ? ` (listed ${formatInr(listedPrice)})` : '';
  return `${formatInr(price_per_day)}/day${listed} for ${formatDay(start_date)} → ${formatDay(end_date)} (${days} day${
    days === 1 ? '' : 's'
  }, total ${formatInr(price_per_day * days)})`;
}

// Whose move it is on a pending rental: whoever didn't make the open
// offer. A request from before offers existed has no open offer and
// behaves like the old flow - the owner decides.
export function whoseTurn(rental, openOffer) {
  if (!openOffer) return 'owner';
  return openOffer.proposed_by === rental.renter_id ? 'owner' : 'renter';
}
