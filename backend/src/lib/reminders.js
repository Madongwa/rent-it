import { supabase } from './supabaseClient.js';
import { notify } from './notify.js';
import { addDays, indiaToday } from './dates.js';

// Daily reminders (run by routes/cron.js at 9:00 IST):
//   - pickup: an agreed rental starts tomorrow -> renter and owner;
//   - return: it ends tomorrow (and didn't start tomorrow) -> both;
//   - review: it ended yesterday -> the renter, unless they've already
//     reviewed that listing.
// rental_reminders keeps each (rental, kind) to one send, ever.

const SELECT = 'id, renter_id, start_date, end_date, status, conversation_id, listing:listings!inner(id, title, owner_id)';

// Claims a reminder; false if it was already sent.
async function claim(db, rentalId, kind) {
  const { error } = await db.from('rental_reminders').insert({ rental_id: rentalId, kind });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw new Error(error.message);
}

const chatLink = (r, fallback) => (r.conversation_id ? `/messages?c=${r.conversation_id}` : fallback);

export async function runRentalReminders({ db = supabase, notifyFn = notify, today = indiaToday() } = {}) {
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const counts = { pickup: 0, return: 0, review: 0 };

  const [starting, ending, ended] = await Promise.all([
    db.from('rentals').select(SELECT).eq('status', 'approved').eq('start_date', tomorrow),
    db.from('rentals').select(SELECT).eq('status', 'approved').eq('end_date', tomorrow).lt('start_date', tomorrow),
    db.from('rentals').select(SELECT).in('status', ['approved', 'completed']).eq('end_date', yesterday),
  ]);
  for (const r of [starting, ending, ended]) if (r.error) throw new Error(r.error.message);

  for (const r of starting.data) {
    if (!(await claim(db, r.id, 'pickup'))) continue;
    const oneDay = r.start_date === r.end_date;
    await notifyFn({
      userId: r.renter_id,
      type: 'pickup_reminder',
      title: `Pickup tomorrow: ${r.listing.title}`,
      body: `${oneDay ? 'Your one-day rental is tomorrow.' : 'Your rental starts tomorrow.'} Check the time and place in chat, take pickup photos together, and pay the owner in person - never in advance.`,
      link: chatLink(r, '/dashboard?tab=mine'),
    });
    await notifyFn({
      userId: r.listing.owner_id,
      type: 'pickup_reminder',
      title: `Handover tomorrow: ${r.listing.title}`,
      body: 'The renter picks it up tomorrow. Confirm the time in chat and take pickup photos together.',
      link: chatLink(r, '/dashboard?tab=incoming'),
    });
    counts.pickup += 1;
  }

  for (const r of ending.data) {
    if (!(await claim(db, r.id, 'return'))) continue;
    await notifyFn({
      userId: r.renter_id,
      type: 'return_reminder',
      title: `Return due tomorrow: ${r.listing.title}`,
      body: 'Agree the return time in chat, and take return photos together when you hand it back.',
      link: chatLink(r, '/dashboard?tab=mine'),
    });
    await notifyFn({
      userId: r.listing.owner_id,
      type: 'return_reminder',
      title: `Coming back tomorrow: ${r.listing.title}`,
      body: 'Check its condition with the renter and take return photos before giving back any deposit.',
      link: chatLink(r, '/dashboard?tab=incoming'),
    });
    counts.return += 1;
  }

  for (const r of ended.data) {
    const { data: reviewed } = await db
      .from('reviews')
      .select('id')
      .eq('listing_id', r.listing.id)
      .eq('reviewer_id', r.renter_id)
      .maybeSingle();
    if (reviewed || !(await claim(db, r.id, 'review'))) continue;
    await notifyFn({
      userId: r.renter_id,
      type: 'review_nudge',
      title: `How was ${r.listing.title}?`,
      body: 'A quick rating helps the next renter - and good owners get booked more.',
      link: `/listing/${r.listing.id}#write-review`,
    });
    counts.review += 1;
  }

  return counts;
}
