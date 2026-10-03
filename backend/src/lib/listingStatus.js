import { supabase } from './supabaseClient.js';

// A listing is 'rented' while any rental on it is approved (or frozen in a
// dispute). Called after one of those ends - it only flips the listing back
// to 'available' once none are left, so finishing one booking doesn't free
// up dates another approved rental still holds. Leaves a listing staff or
// the owner set to 'inactive' alone.
export async function releaseListingIfIdle(listingId) {
  const { count, error } = await supabase
    .from('rentals')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId)
    .in('status', ['approved', 'disputed']);
  if (error) {
    console.error('[listings] could not check remaining bookings:', error.message);
    return;
  }
  if (count > 0) return;
  await supabase.from('listings').update({ status: 'available' }).eq('id', listingId).eq('status', 'rented');
}

// Why an owner can't set their listing to `next` - { code, error } - or
// null if they can. Owners only pause ('inactive') and reactivate
// ('available'); 'rented' is set by bookings. A listing staff removed stays
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
  if (next === 'available' && listing.status === 'rented') return { code: 400, error: 'This item is booked right now.' };
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
