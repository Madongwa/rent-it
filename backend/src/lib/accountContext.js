import { supabase } from './supabaseClient.js';

// What the help assistant knows about a logged-in user, so it can answer
// "where's my tiller rental?" or "did the owner reply to my offer?". Looked
// up only by the id from the user's own login token (routes/chat.js) - never
// from anything they type - so it can only ever describe their own account.
// Kept short: the latest rentals each way, their listings, open disputes.

const MAX_RENTALS = 8;
const MAX_LISTINGS = 10;

const STATUS = {
  pending: 'being negotiated',
  approved: 'agreed',
  rejected: 'declined',
  completed: 'completed',
  cancelled: 'cancelled',
  disputed: 'disputed (a problem was reported)',
};

const SELLER = {
  not_submitted: 'not submitted (needed before listing items)',
  pending: 'submitted, waiting for staff review',
  manual_review: 'waiting for staff review',
  approved: 'verified - can list items',
  rejected: 'rejected - can resubmit',
};

const rupees = (n) => (n == null ? null : `₹${Number(n).toLocaleString('en-IN')}/day`);

// "their turn" / "your turn" on an open offer, from this user's side.
function turnNote(rental, userId) {
  const open = (rental.offers || []).find((o) => o.status === 'open');
  if (!open) return '';
  const offeredBy = open.proposed_by === userId ? 'you' : 'the other side';
  const waitingOn = open.proposed_by === userId ? 'waiting for the other side to reply' : 'waiting for YOU to accept, counter or decline';
  return ` Latest offer ${rupees(open.price_per_day)} for ${open.start_date} to ${open.end_date}, made by ${offeredBy} - ${waitingOn}.`;
}

function rentalLine(r, userId, role) {
  const other = role === 'renter' ? `owner ${r.listing?.owner?.full_name || 'unknown'}` : `renter ${r.renter?.full_name || 'unknown'}`;
  const price = r.status === 'approved' || r.status === 'completed' ? `, at ${rupees(r.price_per_day)}` : '';
  return `- "${r.listing?.title || 'a listing'}" with ${other}, ${r.start_date} to ${r.end_date}: ${STATUS[r.status] || r.status}${price}.${turnNote(r, userId)}`;
}

export async function accountSummary(userId, db = supabase) {
  const rentalSelect =
    'id, status, start_date, end_date, price_per_day, created_at, listing:listings!inner(id, title, owner_id, owner:profiles(full_name)), renter:profiles!rentals_renter_id_fkey(full_name), offers:rental_offers(status, proposed_by, price_per_day, start_date, end_date)';

  const [profile, asRenter, asOwner, listings, disputes] = await Promise.all([
    db.from('profiles').select('full_name, seller_status, created_at').eq('id', userId).maybeSingle(),
    db.from('rentals').select(rentalSelect).eq('renter_id', userId).order('created_at', { ascending: false }).limit(MAX_RENTALS),
    db.from('rentals').select(rentalSelect).eq('listing.owner_id', userId).order('created_at', { ascending: false }).limit(MAX_RENTALS),
    db.from('listings').select('title, status, price_per_day').eq('owner_id', userId).order('created_at', { ascending: false }).limit(MAX_LISTINGS),
    db.from('rental_disputes').select('status, reason, created_at, rental:rentals(listing:listings(title))').eq('raised_by', userId).eq('status', 'open'),
  ]);
  for (const q of [profile, asRenter, asOwner, listings, disputes]) if (q.error) throw new Error(q.error.message);

  const lines = [
    `Name: ${profile.data?.full_name || 'not set'}. Seller verification: ${SELLER[profile.data?.seller_status] || 'unknown'}.`,
    '',
    `Items they are renting from others (latest ${MAX_RENTALS}):`,
    ...(asRenter.data.length ? asRenter.data.map((r) => rentalLine(r, userId, 'renter')) : ['- none']),
    '',
    `Requests from others to rent their items (latest ${MAX_RENTALS}):`,
    ...(asOwner.data.length ? asOwner.data.map((r) => rentalLine(r, userId, 'owner')) : ['- none']),
    '',
    'Their listings:',
    ...(listings.data.length ? listings.data.map((l) => `- "${l.title}", ${rupees(l.price_per_day)}, ${l.status}`) : ['- none']),
    '',
    'Problems they reported that staff are still reviewing:',
    ...(disputes.data.length ? disputes.data.map((d) => `- "${d.rental?.listing?.title || 'a rental'}": ${String(d.reason).slice(0, 200)}`) : ['- none']),
  ];
  return lines.join('\n');
}
