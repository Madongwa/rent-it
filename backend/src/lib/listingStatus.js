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
