import { supabase } from './supabaseClient.js';

// Finds the one (listing, renter) chat thread, creating it if needed.
// Shared by "Message the owner" (messages.js) and sending a rental offer
// (rentals.js), since an offer lands in the same thread.
export async function getOrCreateConversation({ listingId, ownerId, renterId, select = '*' }) {
  const findExisting = () =>
    supabase.from('conversations').select(select).eq('listing_id', listingId).eq('renter_id', renterId).maybeSingle();

  const { data: existing } = await findExisting();
  if (existing) return { data: existing, created: false };

  const { data, error } = await supabase
    .from('conversations')
    .insert({ listing_id: listingId, owner_id: ownerId, renter_id: renterId })
    .select(select)
    .single();

  // Lost a race with a concurrent first message - unique (listing_id,
  // renter_id) means the other request's thread is the one to use.
  if (error?.code === '23505') {
    const { data: raced, error: racedError } = await findExisting();
    return { data: raced, error: racedError, created: false };
  }
  return { data, error, created: !error };
}

// Writes a chat message on the app's behalf - an offer card or a status
// line. Plain text messages from people go through messages.js instead.
export async function postMessage({ conversationId, senderId, body, kind = 'text', offerId = null }) {
  if (!conversationId) return;
  const { error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body, kind, offer_id: offerId });
  if (error) console.error('[messages] failed to post message:', error.message);
}
