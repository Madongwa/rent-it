import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const LISTING_SELECT =
  '*, category:categories(id, slug, name, icon), owner:profiles(id, full_name, avatar_url)';

// GET /api/favorites - my saved listings
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('favorites')
    .select(`created_at, listing:listings(${LISTING_SELECT})`)
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  // Flatten to a plain list of listings (with the save date attached) -
  // callers just want "my saved listings", not the join shape.
  res.json(data.map((row) => ({ ...row.listing, saved_at: row.created_at })));
});

// GET /api/favorites/ids - just the listing ids I've saved, for cheaply
// marking "already saved" hearts across a grid of cards without fetching
// every listing's full record again.
router.get('/ids', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('favorites').select('listing_id').eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map((row) => row.listing_id));
});

// POST /api/favorites - save a listing
router.post('/', requireAuth, async (req, res) => {
  const { listing_id } = req.body;
  if (!listing_id) return res.status(400).json({ error: 'listing_id is required' });

  const { error } = await supabase
    .from('favorites')
    .upsert({ user_id: req.user.id, listing_id }, { onConflict: 'user_id,listing_id' });

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ok: true });
});

// DELETE /api/favorites/:listingId - unsave a listing
router.delete('/:listingId', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', req.user.id)
    .eq('listing_id', req.params.listingId);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

export default router;
