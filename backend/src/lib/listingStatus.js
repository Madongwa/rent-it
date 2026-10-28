import { supabase } from './supabaseClient.js';
import { indiaToday } from './dates.js';

// A listing's status: 'available', 'rented' (out with a renter today) or
// 'inactive' (paused by its owner, or removed by staff). 'rented' is only
// a label for today - an agreed booking next month doesn't hide the listing
// or stop people asking for other dates (the booking calendar and the
// overlap check handle that). Both 'available' and 'rented' listings show
// on the Marketplace and take requests.
export const BOOKABLE_STATUSES = ['available', 'rented'];

// Out with a renter today: an agreed rental covering today, or one frozen
// in a dispute (the item may not be back).
export function holdsListingToday(rental, today) {
  return rental.status === 'disputed' || (rental.status === 'approved' && rental.start_date <= today && rental.end_date >= today);
}

// Sets one listing to 'rented' or 'available' from its bookings - called
// whenever one is agreed or ends. Leaves 'inactive' listings alone.
export async function syncListingStatus(listingId, { db = supabase, today = indiaToday() } = {}) {
  const { data, error } = await db
    .from('rentals')
    .select('status, start_date, end_date')
    .eq('listing_id', listingId)
    .in('status', ['approved', 'disputed']);
  if (error) {
    console.error('[listings] could not check bookings:', error.message);
    return;
  }
  const next = data.some((r) => holdsListingToday(r, today)) ? 'rented' : 'available';
  const { error: updateError } = await db
    .from('listings')
    .update({ status: next })
    .eq('id', listingId)
    .in('status', BOOKABLE_STATUSES);
  if (updateError) console.error('[listings] could not update status:', updateError.message);
}

// Daily (routes/cron.js): every listing's 'rented' label brought up to date -
// bookings start and end without anyone pressing a button.
export async function runListingStatusSync({ db = supabase, today = indiaToday() } = {}) {
  const { data, error } = await db
    .from('rentals')
    .select('listing_id, status, start_date, end_date')
    .in('status', ['approved', 'disputed']);
  if (error) throw new Error(error.message);
  const outToday = [...new Set(data.filter((r) => holdsListingToday(r, today)).map((r) => r.listing_id))];

  let toRented = { data: [] };
  if (outToday.length) {
    toRented = await db.from('listings').update({ status: 'rented' }).eq('status', 'available').in('id', outToday).select('id');
    if (toRented.error) throw new Error(toRented.error.message);
  }
  let back = db.from('listings').update({ status: 'available' }).eq('status', 'rented');
  if (outToday.length) back = back.not('id', 'in', `(${outToday.join(',')})`);
  const toAvailable = await back.select('id');
  if (toAvailable.error) throw new Error(toAvailable.error.message);
  return { rented: toRented.data.length, available: toAvailable.data.length };
}

// Why an owner can't set their listing to `next` - { code, error } - or
// null if they can. Owners only pause ('inactive') and reactivate
// ('available'); 'rented' is set from bookings. A listing staff removed stays
// down until staff restore it, and only a verified seller can reactivate.
// Re-sending the current status (an edit form saving everything) is fine.
export function ownerStatusError(listing, next, sellerStatus) {
  if (next === listing.status) return null;
  if (!['available', 'inactive'].includes(next)) return { code: 400, error: "status must be 'available' or 'inactive'" };
  if (listing.removed_by_staff) {
    return { code: 403, error: 'Rent It staff removed this listing, so it stays hidden. Contact support if you think this is a mistake.' };
  }
  if (next === 'available' && sellerStatus !== 'approved') {
    return { code: 403, error: 'Your seller account must be verified before this listing can go live again.' };
  }
  if (next === 'available' && listing.status === 'rented') return { code: 400, error: 'This item is out with a renter right now.' };
  return null;
}

// ownerStatusError, looking up the owner's seller status when it matters.
export async function ownerStatusDenied(userId, listing, next, db = supabase) {
  let sellerStatus = null;
  if (next === 'available' && next !== listing.status) {
    const { data } = await db.from('profiles').select('seller_status').eq('id', userId).maybeSingle();
    sellerStatus = data?.seller_status;
  }
  return ownerStatusError(listing, next, sellerStatus);
}
