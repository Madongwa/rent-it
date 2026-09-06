import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';

const router = Router();

// GET /api/categories - the 3 top-level categories shown on the home page
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('categories')
    .select('id, slug, name, description, icon')
    .order('id', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
