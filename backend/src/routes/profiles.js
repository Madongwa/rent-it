import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/profiles/me
router.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, avatar_url, created_at, role, seller_status')
    .eq('id', req.user.id)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ...data, email: req.user.email });
});

// GET /api/profiles/:id - public storefront info only (no phone/email) -
// deliberately not behind requireAuth, and must come after the /me route
// above so "/me" doesn't get captured as an :id param.
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, created_at')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Profile not found' });
  res.json(data);
});

// PATCH /api/profiles/me
router.patch('/me', requireAuth, async (req, res) => {
  const { full_name, phone, avatar_url } = req.body;
  const updates = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (phone !== undefined) updates.phone = phone;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', req.user.id)
    .select('id, full_name, phone, avatar_url, created_at')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
