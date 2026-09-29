import { supabase } from './supabaseClient.js';

// Trust badges for an owner, from real activity - shown on their listings'
// pages and their storefront:
//   verified          passed seller verification (KYC)
//   completed_rentals rentals of their items marked completed
//   reply_minutes     median time to their first reply in their latest chats
//                     (null until they've answered at least 2)
//   rating/reviews    across all their listings
//   member_since      when they joined

const RECENT_CHATS = 20;
const MIN_REPLIES = 2;

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Minutes from the renter's first message to the owner's first reply after
// it, for each chat where both happened. `messages` are one chat's, oldest first.
export function firstReplyMinutes(messages, ownerId) {
  const asked = messages.find((m) => m.sender_id !== ownerId && m.kind === 'text');
  if (!asked) return null;
  const reply = messages.find((m) => m.sender_id === ownerId && m.created_at > asked.created_at);
  return reply ? (new Date(reply.created_at) - new Date(asked.created_at)) / 60000 : null;
}

// "Replies within an hour" etc. - null when there isn't enough to say.
export function replyLabel(minutes) {
  if (minutes == null) return null;
  if (minutes <= 60) return 'Replies within an hour';
  if (minutes <= 6 * 60) return 'Replies within a few hours';
  if (minutes <= 24 * 60) return 'Replies within a day';
  return null;
}

export async function ownerTrust(ownerId, db = supabase) {
  const [profile, listings, completed, chats] = await Promise.all([
    db.from('profiles').select('seller_status, created_at').eq('id', ownerId).maybeSingle(),
    db.from('listings').select('avg_rating, review_count').eq('owner_id', ownerId),
    db.from('rentals').select('id, listing:listings!inner(owner_id)', { count: 'exact', head: true }).eq('listing.owner_id', ownerId).eq('status', 'completed'),
    db.from('conversations').select('id').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(RECENT_CHATS),
  ]);
  for (const q of [profile, listings, completed, chats]) if (q.error) throw new Error(q.error.message);

  let replyMinutes = null;
  if (chats.data.length) {
    const { data: messages, error } = await db
      .from('messages')
      .select('conversation_id, sender_id, kind, created_at')
      .in('conversation_id', chats.data.map((c) => c.id))
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    const byChat = {};
    for (const m of messages) (byChat[m.conversation_id] ||= []).push(m);
    const times = Object.values(byChat)
      .map((list) => firstReplyMinutes(list, ownerId))
      .filter((t) => t != null);
    if (times.length >= MIN_REPLIES) replyMinutes = Math.round(median(times));
  }

  const reviewed = listings.data.filter((l) => l.review_count > 0);
  const reviews = reviewed.reduce((n, l) => n + l.review_count, 0);
  const rating = reviews ? Math.round((reviewed.reduce((s, l) => s + Number(l.avg_rating) * l.review_count, 0) / reviews) * 10) / 10 : null;

  return {
    verified: profile.data?.seller_status === 'approved',
    completed_rentals: completed.count ?? 0,
    reply_minutes: replyMinutes,
    reply_label: replyLabel(replyMinutes),
    rating,
    reviews,
    member_since: profile.data?.created_at ? new Date(profile.data.created_at).getFullYear() : null,
  };
}
