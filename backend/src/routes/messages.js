import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';
import { notify } from '../lib/notify.js';
import { getOrCreateConversation } from '../lib/conversations.js';
import { ATTACHMENT_BUCKET, parseAttachmentMessage } from '../lib/attachments.js';
import { translateForReader } from '../lib/translate.js';
import { isSupportedLanguage } from '../lib/languages.js';

const router = Router();

const CONVERSATION_SELECT =
  '*, listing:listings(id, title, image_url, status, price_per_day, deposit_required, deposit_amount), owner:profiles!conversations_owner_id_fkey(id, full_name, avatar_url), renter:profiles!conversations_renter_id_fkey(id, full_name, avatar_url)';

// Offer cards (kind 'offer') carry their offer, plus the rental's current
// status and the price the listing had when the request was made, so the
// card can show "offered vs listed" and whether it's still open.
const MESSAGE_SELECT =
  '*, offer:rental_offers(id, rental_id, proposed_by, price_per_day, start_date, end_date, status, created_at, rental:rentals(id, status, renter_id, listed_price_per_day))';

async function assertParticipant(conversationId, userId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, owner_id, renter_id')
    .eq('id', conversationId)
    .single();
  if (error || !data) return null;
  if (data.owner_id !== userId && data.renter_id !== userId) return false;
  return data;
}

// Each thread has exactly two sides - which read-receipt column is "mine"
// and which is the other person's.
function readColumns(conversation, userId) {
  const mine = conversation.owner_id === userId ? 'owner_last_read_at' : 'renter_last_read_at';
  const theirs = mine === 'owner_last_read_at' ? 'renter_last_read_at' : 'owner_last_read_at';
  return { mine, theirs };
}

function isUnread(message, userId, lastReadAt) {
  return message.sender_id !== userId && new Date(message.created_at) > new Date(lastReadAt);
}

// GET /api/messages/conversations - every thread I'm part of, plus the most
// recent message in each (for a preview line), how many messages I haven't
// read yet, and how far the other person has read (for ✓✓ ticks) - newest
// activity first.
router.get('/conversations', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .or(`owner_id.eq.${req.user.id},renter_id.eq.${req.user.id}`);
  if (error) return res.status(500).json({ error: error.message });

  const byId = Object.fromEntries(data.map((c) => [c.id, c]));
  const lastByConversation = {};
  const unreadByConversation = {};
  if (data.length > 0) {
    const { data: recent, error: recentError } = await supabase
      .from('messages')
      .select('id, conversation_id, body, kind, sender_id, created_at')
      .in('conversation_id', Object.keys(byId))
      .order('created_at', { ascending: false });
    if (recentError) return res.status(500).json({ error: recentError.message });
    for (const m of recent) {
      if (!lastByConversation[m.conversation_id]) lastByConversation[m.conversation_id] = m;
      const c = byId[m.conversation_id];
      if (isUnread(m, req.user.id, c[readColumns(c, req.user.id).mine])) {
        unreadByConversation[m.conversation_id] = (unreadByConversation[m.conversation_id] || 0) + 1;
      }
    }
  }

  const withPreview = data
    .map((c) => ({
      ...c,
      last_message: lastByConversation[c.id] || null,
      unread_count: unreadByConversation[c.id] || 0,
      other_last_read_at: c[readColumns(c, req.user.id).theirs],
    }))
    .sort((a, b) => new Date(b.last_message?.created_at || b.created_at) - new Date(a.last_message?.created_at || a.created_at));

  res.json(withPreview);
});

// GET /api/messages/unread-count - for the navbar badge: how many chats
// have messages I haven't read, and how many messages that is in total.
router.get('/unread-count', requireAuth, async (req, res) => {
  const { data: conversations, error } = await supabase
    .from('conversations')
    .select('id, owner_id, renter_id, owner_last_read_at, renter_last_read_at')
    .or(`owner_id.eq.${req.user.id},renter_id.eq.${req.user.id}`);
  if (error) return res.status(500).json({ error: error.message });
  if (conversations.length === 0) return res.json({ count: 0, conversations: 0 });

  const byId = Object.fromEntries(conversations.map((c) => [c.id, c]));
  // Nothing older than the earliest read point can be unread, so there's
  // no need to pull every message ever sent.
  const oldestReadAt = conversations
    .map((c) => c[readColumns(c, req.user.id).mine])
    .reduce((min, t) => (new Date(t) < new Date(min) ? t : min));

  const { data: incoming, error: messagesError } = await supabase
    .from('messages')
    .select('conversation_id, sender_id, created_at')
    .in('conversation_id', Object.keys(byId))
    .neq('sender_id', req.user.id)
    .gt('created_at', oldestReadAt);
  if (messagesError) return res.status(500).json({ error: messagesError.message });

  const unread = incoming.filter((m) => {
    const c = byId[m.conversation_id];
    return isUnread(m, req.user.id, c[readColumns(c, req.user.id).mine]);
  });
  res.json({ count: unread.length, conversations: new Set(unread.map((m) => m.conversation_id)).size });
});

// POST /api/messages/conversations/:id/read - I've seen everything in this
// thread so far. Marks it read up to its newest message (the database's own
// timestamp, so a server clock slightly off can't skip or re-flag one).
router.post('/conversations/:id/read', requireAuth, async (req, res) => {
  const participant = await assertParticipant(req.params.id, req.user.id);
  if (participant === null) return res.status(404).json({ error: 'Conversation not found' });
  if (participant === false) return res.status(403).json({ error: 'Forbidden' });

  const { data: newest, error: newestError } = await supabase
    .from('messages')
    .select('created_at')
    .eq('conversation_id', req.params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (newestError) return res.status(500).json({ error: newestError.message });
  if (!newest) return res.json({ read_up_to: null });

  const column = readColumns(participant, req.user.id).mine;
  // Only ever moves forward - an older tab catching up late can't un-read
  // messages a newer one already marked.
  const { error } = await supabase
    .from('conversations')
    .update({ [column]: newest.created_at })
    .eq('id', req.params.id)
    .lt(column, newest.created_at);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ read_up_to: newest.created_at });
});

// POST /api/messages/conversations - start (or fetch the existing) thread
// with a listing's owner. Only the prospective renter side starts threads;
// the owner replies within one that already exists.
router.post('/conversations', requireAuth, async (req, res) => {
  const { listing_id } = req.body;
  if (!listing_id) return res.status(400).json({ error: 'listing_id is required' });

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, owner_id')
    .eq('id', listing_id)
    .single();
  if (listingError || !listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.owner_id === req.user.id) {
    return res.status(400).json({ error: "You can't message yourself about your own listing" });
  }

  const { data, error, created } = await getOrCreateConversation({
    listingId: listing_id,
    ownerId: listing.owner_id,
    renterId: req.user.id,
    select: CONVERSATION_SELECT,
  });

  if (error) return res.status(500).json({ error: error.message });
  res.status(created ? 201 : 200).json(data);
});

// GET /api/messages/conversations/:id/messages
router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  const participant = await assertParticipant(req.params.id, req.user.id);
  if (participant === null) return res.status(404).json({ error: 'Conversation not found' });
  if (participant === false) return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('conversation_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/messages/conversations/:id/messages - a text message ({ body }),
// or something from the "+" menu ({ kind: 'image' | 'file' | 'location',
// attachment }). Photos/documents are already uploaded to the private
// chat-attachments bucket by the browser; this records the message.
router.post('/conversations/:id/messages', requireAuth, async (req, res) => {
  const { body, kind = 'text' } = req.body;

  const participant = await assertParticipant(req.params.id, req.user.id);
  if (participant === null) return res.status(404).json({ error: 'Conversation not found' });
  if (participant === false) return res.status(403).json({ error: 'Forbidden' });

  let row;
  if (kind === 'text') {
    if (typeof body !== 'string' || !body.trim()) return res.status(400).json({ error: 'Message body is required' });
    row = { kind: 'text', body: body.trim().slice(0, 4000) };
  } else {
    const parsed = parseAttachmentMessage(req.body, req.params.id);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (parsed.kind !== 'location') {
      // The upload has to have actually happened (and landed in this
      // thread's folder) - a signed URL can only be made for a real file.
      const { error: fileError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(parsed.attachment.path, 60);
      if (fileError) return res.status(400).json({ error: 'Attachment upload not found - try sending it again' });
    }
    row = parsed;
  }

  const recipientId = participant.owner_id === req.user.id ? participant.renter_id : participant.owner_id;

  // Translate first, deliver second: if the other person picked a different
  // language (the language button, saved on their profile), the message is
  // translated into it before it's sent, so it arrives - and its
  // notification reads - in their language. `lang` is the sender's own
  // choice; the same language on both sides skips the translator entirely.
  let forReader = null;
  if (row.kind === 'text') {
    const { data: recipient } = await supabase.from('profiles').select('preferred_language').eq('id', recipientId).maybeSingle();
    const readerLang = recipient?.preferred_language || 'en';
    const writerLang = isSupportedLanguage(req.body.lang) ? req.body.lang : null;
    if (readerLang !== writerLang) {
      const result = await translateForReader(row.body, readerLang);
      if (result) forReader = { ...result, lang: readerLang };
    }
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: req.params.id, sender_id: req.user.id, ...row })
    .select(MESSAGE_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });

  if (forReader) {
    const { error: txError } = await supabase.from('message_translations').upsert(
      { message_id: data.id, lang: forReader.lang, body: forReader.text, source_lang: forReader.source },
      { ignoreDuplicates: true }
    );
    if (txError) console.error('[messages] could not store translation:', txError.message);
  }

  const { data: senderProfile } = await supabase.from('profiles').select('full_name').eq('id', req.user.id).single();
  await notify({
    userId: recipientId,
    type: 'new_message',
    title: `New message from ${senderProfile?.full_name || 'a Rent It user'}`,
    body: (forReader?.translated ? forReader.text : row.body).slice(0, 140),
    link: `/messages?c=${req.params.id}`,
  });

  res.status(201).json(data);
});

export default router;
