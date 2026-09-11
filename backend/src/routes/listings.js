import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const LISTING_SELECT =
  '*, category:categories(id, slug, name, icon), owner:profiles(id, full_name, avatar_url)';

// Query params that accept a comma-separated list for "any of these" (OR
// within the field, AND across different fields) - e.g. condition=Good,Fair.
const MULTI_VALUE_FILTERS = {
  condition: 'condition',
  powerSource: 'power_source',
  delivery: 'delivery_option',
  cancellation: 'cancellation_policy',
  ownerType: 'owner_type',
};

// GET /api/listings?category=farming&q=drill&minPrice=&maxPrice=&sort=...
//   &condition=Good,Fair&powerSource=electric,battery&delivery=either
//   &deposit=true|false&ownerType=individual,business&accessories=true|false
router.get('/', async (req, res) => {
  const { category, q, minPrice, maxPrice, sort, deposit, accessories } = req.query;

  let query = supabase.from('listings').select(LISTING_SELECT).eq('status', 'available');

  if (category) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', category)
      .single();
    if (cat) query = query.eq('category_id', cat.id);
    else return res.json([]); // unknown category slug -> no results
  }

  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }

  if (minPrice) query = query.gte('price_per_day', Number(minPrice));
  if (maxPrice) query = query.lte('price_per_day', Number(maxPrice));

  for (const [param, column] of Object.entries(MULTI_VALUE_FILTERS)) {
    const raw = req.query[param];
    if (raw) query = query.in(column, raw.split(','));
  }

  if (deposit) query = query.eq('deposit_required', deposit === 'true');
  if (accessories) query = query.eq('accessories_included', accessories === 'true');

  if (sort === 'price_asc') query = query.order('price_per_day', { ascending: true });
  else if (sort === 'price_desc') query = query.order('price_per_day', { ascending: false });
  else query = query.order('created_at', { ascending: false }); // 'relevance'/'newest' default

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/listings/mine - listings owned by the logged-in user (any status)
router.get('/mine', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('owner_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/listings/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Listing not found' });
  res.json(data);
});

// POST /api/listings - create a new listing (the "List an Item" form)
router.post('/', requireAuth, async (req, res) => {
  const { title, description, category_id, price_per_day, location, condition, image_url } =
    req.body;

  if (!title || !category_id || !price_per_day) {
    return res.status(400).json({ error: 'title, category_id and price_per_day are required' });
  }

  const { data, error } = await supabase
    .from('listings')
    .insert({
      owner_id: req.user.id,
      title,
      description,
      category_id,
      price_per_day,
      location,
      condition,
      image_url,
    })
    .select(LISTING_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/listings/:id - update your own listing (e.g. status, price)
router.patch('/:id', requireAuth, async (req, res) => {
  const { data: existing, error: findError } = await supabase
    .from('listings')
    .select('owner_id')
    .eq('id', req.params.id)
    .single();

  if (findError || !existing) return res.status(404).json({ error: 'Listing not found' });
  if (existing.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const allowedFields = [
    'title',
    'description',
    'category_id',
    'price_per_day',
    'location',
    'condition',
    'image_url',
    'status',
  ];
  const updates = {};
  for (const field of allowedFields) {
    if (field in req.body) updates[field] = req.body[field];
  }

  const { data, error } = await supabase
    .from('listings')
    .update(updates)
    .eq('id', req.params.id)
    .select(LISTING_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/listings/:id - remove your own listing
router.delete('/:id', requireAuth, async (req, res) => {
  const { data: existing, error: findError } = await supabase
    .from('listings')
    .select('owner_id')
    .eq('id', req.params.id)
    .single();

  if (findError || !existing) return res.status(404).json({ error: 'Listing not found' });
  if (existing.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { error } = await supabase.from('listings').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

export default router;
