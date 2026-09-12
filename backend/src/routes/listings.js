import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const LISTING_SELECT =
  '*, category:categories(id, slug, name, icon), owner:profiles(id, full_name, avatar_url)';

// The detail page additionally wants the reviews and past-rental history for
// the calendar/reviews sections - kept out of LISTING_SELECT above so the
// Marketplace grid (30+ cards) doesn't pull every review row for every card.
const LISTING_DETAIL_SELECT = `${LISTING_SELECT}, reviews(*), rental_history(*)`;

// Query params that accept a comma-separated list for "any of these" (OR
// within the field, AND across different fields) - e.g. condition=Good,Fair.
const MULTI_VALUE_FILTERS = {
  condition: 'condition',
  powerSource: 'power_source',
  delivery: 'delivery_option',
  cancellation: 'cancellation_policy',
  ownerType: 'owner_type',
};

// Max km for each "Within X km" distance-filter option.
const DISTANCE_BUCKET_KM = { '2': 2, '5': 5, '10': 10, '25': 25 };

// Hard cap on how many rows a single request can pull back - the previous
// version had no limit at all (fine at 30 seed rows, not fine once real
// listings accumulate). Not full page-by-page pagination (the frontend
// doesn't have page controls yet), just a ceiling.
const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 120;

// GET /api/listings?category=farming&q=drill&minPrice=&maxPrice=&sort=...
//   &condition=Good,Fair&powerSource=electric,battery&delivery=either
//   &deposit=true|false&ownerType=individual,business&accessories=true|false
//   &distance=10&duration=daily,weekly&minRating=4&minRentalPeriod=1_day
//   &availability=today,week&ownerId=<uuid>&limit=60
router.get('/', async (req, res) => {
  const {
    category, q, minPrice, maxPrice, sort, deposit, accessories,
    distance, duration, minRating, minRentalPeriod, availability, ownerId, limit,
  } = req.query;

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

  if (ownerId) query = query.eq('owner_id', ownerId);

  // Full-text search (title weighted over description) instead of a plain
  // substring scan - handles multi-word queries and word-order/prefix
  // matching better, and can use the search_vector GIN index.
  if (q) {
    query = query.textSearch('search_vector', q, { type: 'websearch', config: 'english' });
  }

  if (minPrice) query = query.gte('price_per_day', Number(minPrice));
  if (maxPrice) query = query.lte('price_per_day', Number(maxPrice));

  for (const [param, column] of Object.entries(MULTI_VALUE_FILTERS)) {
    const raw = req.query[param];
    if (raw) query = query.in(column, raw.split(','));
  }

  if (deposit) query = query.eq('deposit_required', deposit === 'true');
  if (accessories) query = query.eq('accessories_included', accessories === 'true');

  if (distance && DISTANCE_BUCKET_KM[distance] !== undefined) {
    query = query.lte('distance_km', DISTANCE_BUCKET_KM[distance]);
  }
  if (duration) query = query.overlaps('supported_durations', duration.split(','));
  if (minRating) query = query.gte('avg_rating', Number(minRating));
  if (minRentalPeriod) query = query.eq('min_rental_period', minRentalPeriod);

  if (sort === 'price_asc') query = query.order('price_per_day', { ascending: true });
  else if (sort === 'price_desc') query = query.order('price_per_day', { ascending: false });
  else query = query.order('created_at', { ascending: false }); // 'relevance'/'newest' default

  const limitNum = Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT);
  query = query.limit(limitNum);

  let { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Availability isn't a listings column - it's derived by checking whether
  // any rental_history row for a listing overlaps the requested window(s),
  // so it's applied as a post-filter here rather than in the query above.
  const availabilityWindows = (availability || '').split(',').filter(Boolean);
  if (availabilityWindows.length && data.length) {
    const today = new Date().toISOString().slice(0, 10);
    const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const listingIds = data.map((l) => l.id);

    const { data: history, error: historyError } = await supabase
      .from('rental_history')
      .select('listing_id, start_date, end_date')
      .in('listing_id', listingIds)
      .lte('start_date', weekEnd)
      .gte('end_date', today);
    if (historyError) return res.status(500).json({ error: historyError.message });

    const bookedToday = new Set();
    const bookedThisWeek = new Set();
    for (const row of history) {
      bookedThisWeek.add(row.listing_id);
      if (row.start_date <= today && row.end_date >= today) bookedToday.add(row.listing_id);
    }

    data = data.filter((l) => {
      // Multiple checked windows are OR'd together, matching how every
      // other multi-select filter group on this page behaves.
      return availabilityWindows.some((w) =>
        w === 'today' ? !bookedToday.has(l.id) : w === 'week' ? !bookedThisWeek.has(l.id) : true
      );
    });
  }

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

// GET /api/listings/:id - includes reviews + rental_history for the detail
// page's reviews section and rental-history calendar/list.
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_DETAIL_SELECT)
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Listing not found' });

  // Supabase's embedded-resource select doesn't take its own .order() here
  // (that applies to the top-level query), so sort these two in JS instead:
  // most recent review first, most recent past rental first.
  data.reviews = (data.reviews || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  data.rental_history = (data.rental_history || []).sort(
    (a, b) => new Date(b.start_date) - new Date(a.start_date)
  );

  res.json(data);
});

// Fields the "List an Item" create form and the Dashboard edit form are
// both allowed to set, beyond the original core 7. All optional - a
// listing created without them just keeps the column defaults from
// schema.sql (pickup_only/not-required/flexible/individual/no_minimum/
// ['daily']), same as before this list existed.
const WRITABLE_FIELDS = [
  'title',
  'description',
  'category_id',
  'price_per_day',
  'location',
  'condition',
  'image_url',
  'power_source',
  'delivery_option',
  'deposit_required',
  'deposit_amount',
  'cancellation_policy',
  'owner_type',
  'accessories_included',
  'accessories_note',
  'min_rental_period',
  'supported_durations',
  'distance_km',
];

// POST /api/listings - create a new listing (the "List an Item" form)
router.post('/', requireAuth, async (req, res) => {
  const { title, category_id, price_per_day } = req.body;

  if (!title || !category_id || !price_per_day) {
    return res.status(400).json({ error: 'title, category_id and price_per_day are required' });
  }

  const fields = {};
  for (const field of WRITABLE_FIELDS) {
    if (field in req.body) fields[field] = req.body[field];
  }

  const { data, error } = await supabase
    .from('listings')
    .insert({ ...fields, owner_id: req.user.id })
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

  const allowedFields = [...WRITABLE_FIELDS, 'status'];
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
