import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';
import { notify } from '../lib/notify.js';

const router = Router();

const CONVERSATION_SELECT =
  '*, listing:listings(id, title, image_url), owner:profiles!conversations_owner_id_fkey(id, full_name), renter:profiles!conversations_renter_id_fkey(id, full_name)';

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

// GET /api/messages/conversations - every thread I'm part of, plus the most
// recent message in each (for a preview line), newest activity first.
router.get('/conversations', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .or(`owner_id.eq.${req.user.id},renter_id.eq.${req.user.id}`);
  if (error) return res.status(500).json({ error: error.message });

  const conversationIds = data.map((c) => c.id);
  let lastByConversation = {};
  if (conversationIds.length > 0) {
    const { data: recent, error: recentError } = await supabase
      .from('messages')
      .select('conversation_id, body, sender_id, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });
    if (recentError) return res.status(500).json({ error: recentError.message });
    for (const m of recent) {
      if (!lastByConversation[m.conversation_id]) lastByConversation[m.conversation_id] = m;
    }
  }

  const withPreview = data
    .map((c) => ({ ...c, last_message: lastByConversation[c.id] || null }))
    .sort((a, b) => new Date(b.last_message?.created_at || b.created_at) - new Date(a.last_message?.created_at || a.created_at));

  res.json(withPreview);
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

  const { data: existing } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .eq('listing_id', listing_id)
    .eq('renter_id', req.user.id)
    .maybeSingle();
  if (existing) return res.json(existing);

  const { data, error } = await supabase
    .from('conversations')
    .insert({ listing_id, owner_id: listing.owner_id, renter_id: req.user.id })
    .select(CONVERSATION_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// GET /api/messages/conversations/:id/messages
router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  const participant = await assertParticipant(req.params.id, req.user.id);
  if (participant === null) return res.status(404).json({ error: 'Conversation not found' });
  if (participant === false) return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/messages/conversations/:id/messages
router.post('/conversations/:id/messages', requireAuth, async (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' });

  const participant = await assertParticipant(req.params.id, req.user.id);
  if (participant === null) return res.status(404).json({ error: 'Conversation not found' });
  if (participant === false) return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: req.params.id, sender_id: req.user.id, body: body.trim() })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const recipientId = participant.owner_id === req.user.id ? participant.renter_id : participant.owner_id;
  const { data: senderProfile } = await supabase.from('profiles').select('full_name').eq('id', req.user.id).single();
  notify({
    userId: recipientId,
    type: 'new_message',
    title: `New message from ${senderProfile?.full_name || 'a Rent It user'}`,
    body: body.trim().slice(0, 140),
    link: `/messages?c=${req.params.id}`,
  });

  res.status(201).json(data);
});

export default router;
