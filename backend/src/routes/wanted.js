import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../lib/supabaseClient.js';
import { attachUserIfPresent, requireAuth } from '../middleware/auth.js';
import { getOrCreateConversation, postMessage } from '../lib/conversations.js';
import { notify } from '../lib/notify.js';
import { draftWanted, publicWanted, validateWantedInput } from '../lib/wanted.js';

// Wanted posts (lib/wanted.js). Anyone can browse open posts; posting,
// replying and managing your own posts need a login.
const router = Router();

const WANTED_SELECT =
  'id, user_id, title, details, location, category_id, max_price_per_day, needed_from, needed_until, status, created_at, expires_at, category:categories(id, slug, name, icon), poster:profiles(full_name)';
const MAX_OPEN_POSTS = 5;
const PAGE = 60;

const limiter = (max, error) =>
  rateLimit({ windowMs: 60 * 1000, max, standardHeaders: true, legacyHeaders: false, message: { error } });
const draftLimiter = limiter(6, 'Too many requests - please wait a minute and try again.');
const writeLimiter = limiter(10, 'Too many requests - please wait a minute and try again.');

async function categories() {
  const { data, error } = await supabase.from('categories').select('id, name');
  if (error) throw new Error(error.message);
  return data;
}

// GET /api/wanted?category=<slug>&q=<words> - open posts, newest first.
router.get('/', attachUserIfPresent, async (req, res) => {
  let query = supabase
    .from('wanted_posts')
    .select(WANTED_SELECT)
    .eq('status', 'open')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(PAGE);

  if (req.query.category) {
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', req.query.category).maybeSingle();
    if (!cat) return res.json([]);
    query = query.eq('category_id', cat.id);
  }
  const q = String(req.query.q || '').replace(/[%_,()]/g, ' ').trim().slice(0, 60);
  if (q) query = query.or(`title.ilike.%${q}%,details.ilike.%${q}%,location.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map((row) => publicWanted(row, req.user?.id)));
});

// GET /api/wanted/mine - my posts, open and closed.
router.get('/mine', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('wanted_posts')
    .select(WANTED_SELECT)
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map((row) => ({ ...publicWanted(row, req.user.id), expired: new Date(row.expires_at) <= new Date() })));
});

// POST /api/wanted/draft - body: { text }. The AI writer: fields for the
// form, never saved.
router.post('/draft', requireAuth, draftLimiter, async (req, res) => {
  const message = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (message.length < 3) return res.status(400).json({ error: 'Describe what you need in a few words first.' });
  try {
    const draft = await draftWanted(message);
    if (!draft) return res.status(502).json({ error: "Couldn't fill that in right now - please try again, or fill in the form yourself." });
    res.json(draft);
  } catch (err) {
    console.error('[wanted] draft failed:', err.message);
    res.status(502).json({ error: "Couldn't fill that in right now - please try again, or fill in the form yourself." });
  }
});

// POST /api/wanted - create a post. Returns it plus a few listings that may
// already match (a plain word search on the title).
router.post('/', requireAuth, writeLimiter, async (req, res) => {
  let cats;
  try {
    cats = await categories();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
  const { value, error: invalid } = validateWantedInput(req.body, cats);
  if (invalid) return res.status(400).json({ error: invalid });

  const { count } = await supabase
    .from('wanted_posts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.id)
    .eq('status', 'open')
    .gt('expires_at', new Date().toISOString());
  if (count >= MAX_OPEN_POSTS) {
    return res.status(400).json({ error: `You can have up to ${MAX_OPEN_POSTS} open Wanted posts - close one first.` });
  }

  const { data, error } = await supabase
    .from('wanted_posts')
    .insert({ ...value, user_id: req.user.id })
    .select(WANTED_SELECT)
    .single();
  if (error) return res.status(500).json({ error: error.message });

  const words = value.title.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter((w) => w.length > 2).slice(0, 6).join(' or ');
  let maybe = [];
  if (words) {
    const { data: listings } = await supabase
      .from('listings')
      .select('id, title, price_per_day, location, image_url')
      .eq('status', 'available')
      .neq('owner_id', req.user.id)
      .textSearch('search_vector', words, { type: 'websearch', config: 'english' })
      .limit(4);
    maybe = listings || [];
  }
  res.status(201).json({ post: publicWanted(data, req.user.id), maybe_matches: maybe });
});

async function ownPost(id, userId) {
  const { data } = await supabase.from('wanted_posts').select('id, user_id').eq('id', id).maybeSingle();
  if (!data) return 404;
  return data.user_id === userId ? null : 403;
}

// PATCH /api/wanted/:id - body: { status: 'open' | 'closed' }. Reopening
// gives it another 30 days.
router.patch('/:id', requireAuth, writeLimiter, async (req, res) => {
  const denied = await ownPost(req.params.id, req.user.id);
  if (denied) return res.status(denied).json({ error: denied === 404 ? 'Post not found' : 'Forbidden' });
  const { status } = req.body || {};
  if (!['open', 'closed'].includes(status)) return res.status(400).json({ error: 'status must be open or closed' });
  const updates = { status };
  if (status === 'open') updates.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('wanted_posts').update(updates).eq('id', req.params.id).select(WANTED_SELECT).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(publicWanted(data, req.user.id));
});

// DELETE /api/wanted/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const denied = await ownPost(req.params.id, req.user.id);
  if (denied) return res.status(denied).json({ error: denied === 404 ? 'Post not found' : 'Forbidden' });
  const { error } = await supabase.from('wanted_posts').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// POST /api/wanted/:id/respond - body: { listing_id }. An owner says "I have
// one": opens (or reuses) the chat about that listing with the poster,
// posts a first message and notifies them. Once per listing per post.
router.post('/:id/respond', requireAuth, writeLimiter, async (req, res) => {
  const { listing_id } = req.body || {};
  if (!listing_id) return res.status(400).json({ error: 'Pick one of your listings.' });

  const { data: post } = await supabase
    .from('wanted_posts')
    .select('id, user_id, title, status, expires_at')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!post || post.status !== 'open' || new Date(post.expires_at) <= new Date()) {
    return res.status(404).json({ error: 'This Wanted post is closed.' });
  }
  if (post.user_id === req.user.id) return res.status(400).json({ error: "That's your own post." });

  const { data: listing } = await supabase
    .from('listings')
    .select('id, owner_id, title, status')
    .eq('id', listing_id)
    .maybeSingle();
  if (!listing || listing.owner_id !== req.user.id) return res.status(403).json({ error: 'Pick one of your own listings.' });
  if (listing.status !== 'available') return res.status(400).json({ error: 'That listing is paused - make it available first.' });

  const { error: matchError } = await supabase
    .from('wanted_matches')
    .insert({ wanted_id: post.id, listing_id: listing.id, source: 'owner' });
  // Already linked (you replied before, or the AI already told them about
  // it) - just take them to the chat, without a second message.
  const repeat = matchError?.code === '23505';
  if (matchError && !repeat) return res.status(500).json({ error: matchError.message });

  const { data: convo, error } = await getOrCreateConversation({
    listingId: listing.id,
    ownerId: req.user.id,
    renterId: post.user_id,
    select: 'id',
  });
  if (error || !convo) return res.status(500).json({ error: error?.message || 'Could not open the chat.' });

  if (!repeat) {
    await postMessage({
      conversationId: convo.id,
      senderId: req.user.id,
      body: `Hi! I saw your Wanted post "${post.title}" - I have "${listing.title}" for rent. Take a look and send me a request if it works for you.`,
    });
    await notify({
      userId: post.user_id,
      type: 'wanted_reply',
      title: 'An owner replied to your Wanted post',
      body: `Someone has "${listing.title}" for your request "${post.title}".`,
      link: `/messages?c=${convo.id}`,
    });
  }
  res.status(repeat ? 200 : 201).json({ conversation_id: convo.id, already: repeat });
});

export default router;
