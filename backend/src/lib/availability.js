import { supabase } from './supabaseClient.js';

// When a listing can't be rented: dates booked by an agreed rental, and
// dates the owner blocked themselves (repairs, their own use - the
// listing_blocked_dates table). Both count the same everywhere: new requests
// and acceptances for those dates are refused, the "available today / this
// week" filters skip them, and the listing page's calendar shows them.

export const BOOKED_STATUSES = ['approved', 'disputed'];

const today = () => new Date().toISOString().slice(0, 10);

// Two ranges [a,b] and [c,d] overlap iff a <= d and c <= b.
export function overlaps(a, b) {
  return a.start_date <= b.end_date && b.start_date <= a.end_date;
}

// Upcoming unavailable ranges for the listing page - dates and kind only
// (never who booked, or the owner's private note).
export async function unavailableRanges(listingId, db = supabase) {
  const from = today();
  const [booked, blocked] = await Promise.all([
    db.from('rentals').select('start_date, end_date').eq('listing_id', listingId).in('status', BOOKED_STATUSES).gte('end_date', from),
    db.from('listing_blocked_dates').select('start_date, end_date').eq('listing_id', listingId).gte('end_date', from),
  ]);
  if (booked.error) throw new Error(booked.error.message);
  if (blocked.error) throw new Error(blocked.error.message);
  return [
    ...booked.data.map((r) => ({ start_date: r.start_date, end_date: r.end_date, kind: 'booked' })),
    ...blocked.data.map((r) => ({ start_date: r.start_date, end_date: r.end_date, kind: 'blocked' })),
  ].sort((a, b) => a.start_date.localeCompare(b.start_date));
}

// Is any of [startDate, endDate] blocked by the owner?
export async function hasBlockedConflict({ listingId, startDate, endDate }, db = supabase) {
  const { data, error } = await db
    .from('listing_blocked_dates')
    .select('id')
    .eq('listing_id', listingId)
    .lte('start_date', endDate)
    .gte('end_date', startDate)
    .limit(1);
  return { conflict: (data || []).length > 0, error };
}

// For the Marketplace's availability filter: which of these listings are
// unavailable today, and which at some point in the next 7 days - from
// agreed rentals, owner-blocked dates and the listing's past-rental history.
export async function unavailableSoon(listingIds, db = supabase) {
  const from = today();
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const window = (q) => q.in('listing_id', listingIds).lte('start_date', weekEnd).gte('end_date', from);
  const results = await Promise.all([
    window(db.from('rental_history').select('listing_id, start_date, end_date')),
    window(db.from('rentals').select('listing_id, start_date, end_date').in('status', BOOKED_STATUSES)),
    window(db.from('listing_blocked_dates').select('listing_id, start_date, end_date')),
  ]);
  const bookedToday = new Set();
  const bookedThisWeek = new Set();
  for (const { data, error } of results) {
    if (error) throw new Error(error.message);
    for (const row of data) {
      bookedThisWeek.add(row.listing_id);
      if (row.start_date <= from && row.end_date >= from) bookedToday.add(row.listing_id);
    }
  }
  return { bookedToday, bookedThisWeek };
}
