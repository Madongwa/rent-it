import { supabase } from './supabaseClient.js';
import { notify } from './notify.js';
import { postMessage } from './conversations.js';
import { syncListingStatus } from './listingStatus.js';
import { addDays, indiaToday } from './dates.js';
import { DISPUTE_WINDOW_DAYS } from './disputes.js';

// Daily (routes/cron.js): an agreed rental nobody marked complete is
// completed automatically a week after its last day - otherwise it stays
// "agreed" forever and keeps showing as an open booking. The week leaves
// time to report a problem first (that freezes it as 'disputed' instead).
export const AUTO_COMPLETE_DAYS = DISPUTE_WINDOW_DAYS;
const PER_RUN = 200;

export async function runAutoComplete({
  db = supabase,
  notifyFn = notify,
  postFn = postMessage,
  syncFn = (listingId) => syncListingStatus(listingId, { db }),
  today = indiaToday(),
} = {}) {
  const cutoff = addDays(today, -AUTO_COMPLETE_DAYS);
  const { data, error } = await db
    .from('rentals')
    .select('id, renter_id, listing_id, conversation_id, listing:listings!inner(title, owner_id)')
    .eq('status', 'approved')
    .lt('end_date', cutoff)
    .limit(PER_RUN);
  if (error) throw new Error(error.message);

  let completed = 0;
  for (const r of data) {
    // Compare-and-set, in case someone acted on it meanwhile.
    const { data: claimed, error: claimError } = await db
      .from('rentals')
      .update({ status: 'completed' })
      .eq('id', r.id)
      .eq('status', 'approved')
      .select('id');
    if (claimError) throw new Error(claimError.message);
    if (!claimed.length) continue;
    completed += 1;

    await postFn({
      conversationId: r.conversation_id,
      senderId: r.listing.owner_id,
      body: `This rental was marked complete automatically, ${AUTO_COMPLETE_DAYS} days after its end date, as no problem was reported.`,
      kind: 'system',
    });
    for (const [userId, tab] of [[r.renter_id, 'mine'], [r.listing.owner_id, 'incoming']]) {
      await notifyFn({
        userId,
        type: 'rental_completed',
        title: 'Rental marked complete',
        body: `The rental of "${r.listing.title}" ended over a week ago, so it's now marked complete.`,
        link: r.conversation_id ? `/messages?c=${r.conversation_id}` : `/dashboard?tab=${tab}`,
      });
    }
    await syncFn(r.listing_id);
  }
  return { completed };
}
