import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';
import { cleanFilters, cleanUrlQuery, MAX_SAVED } from '../lib/savedSearches.js';

// Saved searches + daily alerts (lib/savedSearches.js).
const router = Router();

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests - please wait a minute and try again.' },
});

const SELECT = 'id, label, url_query, created_at';

// GET /api/saved-searches - mine, newest first.
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('saved_searches')
    .select(SELECT)
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/saved-searches - body: { label, filters, url_query }.
router.post('/', requireAuth, writeLimiter, async (req, res) => {
  const label = typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 200) : '';
  const filters = cleanFilters(req.body?.filters);
  if (!label || !Object.keys(filters).length) {
    return res.status(400).json({ error: 'Search for something or pick a filter first.' });
  }

  const { count } = await supabase
    .from('saved_searches')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.id);
  if (count >= MAX_SAVED) return res.status(400).json({ error: `You can save up to ${MAX_SAVED} searches - delete one first.` });

  const { data, error } = await supabase
    .from('saved_searches')
    .insert({ user_id: req.user.id, label, filters, url_query: cleanUrlQuery(req.body?.url_query) })
    .select(SELECT)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE /api/saved-searches/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('id');
  if (error) return res.status(500).json({ error: error.message });
  if (!data.length) return res.status(404).json({ error: 'Saved search not found' });
  res.status(204).send();
});

export default router;
