// Weekly and monthly prices: an owner can set a cheaper price per week and
// per month on top of the daily price. For a rental of 7+ days the weekly
// rate applies (as a day rate: week / 7), for 30+ days the monthly rate
// (month / 30) - whichever is cheapest that the length allows. Offers are
// still made per day, so this is the "listed price" a request starts from and
// is compared against. Mirrored in frontend/src/lib/offers.js.

const DAY_MS = 24 * 60 * 60 * 1000;

export function rentalDays(startDate, endDate) {
  return Math.round((new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) / DAY_MS) + 1;
}

const round2 = (n) => Math.round(n * 100) / 100;

// { rate, basis: 'day' | 'week' | 'month' } for a rental of `days` days.
export function effectiveDailyRate(listing, days) {
  const daily = Number(listing.price_per_day);
  const options = [{ rate: daily, basis: 'day' }];
  if (days >= 7 && Number(listing.price_per_week) > 0) options.push({ rate: round2(Number(listing.price_per_week) / 7), basis: 'week' });
  if (days >= 30 && Number(listing.price_per_month) > 0) options.push({ rate: round2(Number(listing.price_per_month) / 30), basis: 'month' });
  return options.reduce((best, o) => (o.rate < best.rate ? o : best));
}
