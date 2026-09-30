import { supabase } from './supabaseClient.js';
import { rentalDays } from './rates.js';
import { indiaToday } from './dates.js';

// The owner's earnings summary on their Profile: what renters agreed to pay
// for their items (agreed price per day × days - deposits excluded, since
// those go back). Rent It never handles the money, so these are the agreed
// amounts, not payments.

const DEALS = ['approved', 'completed', 'disputed'];

// The last 12 months, oldest first, as 'YYYY-MM'.
export function lastMonths(today, n = 12) {
  const [y, m] = today.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

export function summarise(rentals, today) {
  const months = lastMonths(today);
  const byMonth = Object.fromEntries(months.map((k) => [k, 0]));
  const byListing = new Map();
  let earned = 0;
  let upcoming = 0;
  let completed = 0;

  for (const r of rentals) {
    const amount = Math.round(Number(r.price_per_day) * rentalDays(r.start_date, r.end_date));
    if (!Number.isFinite(amount)) continue;
    if (r.status === 'completed') {
      earned += amount;
      completed += 1;
    } else if (r.end_date >= today) {
      upcoming += amount; // agreed, not finished yet
    } else {
      earned += amount; // agreed and over, just not marked completed
    }
    const month = r.start_date.slice(0, 7);
    if (month in byMonth) byMonth[month] += amount;
    const l = byListing.get(r.listing.id) || { id: r.listing.id, title: r.listing.title, rentals: 0, amount: 0 };
    l.rentals += 1;
    l.amount += amount;
    byListing.set(r.listing.id, l);
  }

  const listings = [...byListing.values()].sort((a, b) => b.amount - a.amount || b.rentals - a.rentals);
  const busiest = months.reduce((best, k) => (byMonth[k] > (byMonth[best] || 0) ? k : best), null);
  return {
    earned,
    upcoming,
    deals: rentals.length,
    completed,
    top_listing: listings[0] || null,
    listings: listings.slice(0, 5),
    months: months.map((k) => ({ month: k, amount: byMonth[k] })),
    busiest_month: busiest && byMonth[busiest] > 0 ? busiest : null,
  };
}

export async function ownerEarnings(userId, { db = supabase, today = indiaToday() } = {}) {
  const { data, error } = await db
    .from('rentals')
    .select('id, status, start_date, end_date, price_per_day, listing:listings!inner(id, title, owner_id)')
    .eq('listing.owner_id', userId)
    .in('status', DEALS);
  if (error) throw new Error(error.message);
  return summarise(data, today);
}
