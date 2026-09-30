import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { attachUserIfPresent, requireAuth } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { draftListing } from '../lib/listingDraft.js';
import { interpretSearch } from '../lib/searchIntent.js';
import { normalizePhotos } from '../lib/listingPhotos.js';
import { BOOKED_STATUSES, unavailableRanges, unavailableSoon } from '../lib/availability.js';
import { ownerTrust } from '../lib/trust.js';
import { sortByTrending, trendingScores } from '../lib/trending.js';
import { PIN_SELECT, pinChange, savePin, validLatLng, withDistance, withExactPin } from '../lib/geo.js';

const router = Router();

// Includes the map pin - every response passes through withDistance (rounds
// it) or, for the owner, withExactPin, so the raw pin never leaves as-is.
const LISTING_SELECT =
  `*, category:categories(id, slug, name, icon), owner:profiles(id, full_name, avatar_url, seller_status), ${PIN_SELECT}`;

// Public listing responses show whether the owner is a verified seller -
// as a yes/no, never their actual verification status (e.g. 'rejected').
function publicOwner(listing) {
  if (!listing?.owner) return listing;
  const { seller_status, ...owner } = listing.owner;
  return { ...listing, owner: { ...owner, verified: seller_status === 'approved' } };
}

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

// Page size cap - the previous version had no limit at all (fine at 30 seed
// rows, not fine once real listings accumulate).
const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 120;
// The map view, and distance filtering/sorting, look at up to this many
// matching listings at once.
const MAP_LIMIT = 500;

// GET /api/listings?category=farming&q=drill&minPrice=&maxPrice=&sort=...
//   &condition=Good,Fair&powerSource=electric,battery&delivery=either
//   &deposit=true|false&ownerType=individual,business&accessories=true|false
//   &distance=10&duration=daily,weekly&minRating=4&minRentalPeriod=1_day
//   &availability=today,week&ownerId=<uuid>&limit=60&page=1
router.get('/', async (req, res) => {
  const {
    category, q, minPrice, maxPrice, sort, deposit, accessories,
    distance, duration, minRating, minRentalPeriod, availability, ownerId, limit, page, near,
  } = req.query;

  // "Verified owners" needs an inner join so the owner filter drops rows.
  const verifiedOnly = req.query.verified === 'true';
  let query = supabase
    .from('listings')
    .select(verifiedOnly ? LISTING_SELECT.replace('owner:profiles(', 'owner:profiles!inner(') : LISTING_SELECT)
    .eq('status', 'available');
  if (verifiedOnly) query = query.eq('owner.seller_status', 'approved');

  if (category) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', category)
      .single();
    if (cat) query = query.eq('category_id', cat.id);
    else return res.json({ data: [], page: 1, pageSize: DEFAULT_LIMIT, hasMore: false }); // unknown category slug -> no results
  }

  if (ownerId) query = query.eq('owner_id', ownerId);

  // Full-text search (title weighted over description) instead of a plain
  // substring scan - handles multi-word queries and word-order/prefix
  // matching better, and can use the search_vector GIN index.
  if (q) {
    query = query.textSearch('search_vector', q, { type: 'websearch', config: 'english' });
  }

  // "Near Mandya" - listings whose location mentions the town. % and _ are
  // stripped so the text can't act as a wildcard pattern of its own.
  if (near) {
    const town = String(near).replace(/[%_,()]/g, '').trim().slice(0, 60);
    if (town) query = query.ilike('location', `%${town}%`);
  }

  if (minPrice) query = query.gte('price_per_day', Number(minPrice));
  if (maxPrice) query = query.lte('price_per_day', Number(maxPrice));

  for (const [param, column] of Object.entries(MULTI_VALUE_FILTERS)) {
    const raw = req.query[param];
    if (raw) query = query.in(column, raw.split(','));
  }

  if (deposit) query = query.eq('deposit_required', deposit === 'true');
  if (accessories) query = query.eq('accessories_included', accessories === 'true');

  // "Near me": with the renter's (rounded) location, distances are real and
  // worked out below; without it, the distance filter falls back to the
  // owner-entered distance_km as before.
  const origin = validLatLng(req.query.lat, req.query.lng);
  const maxKm = distance && DISTANCE_BUCKET_KM[distance] !== undefined ? DISTANCE_BUCKET_KM[distance] : null;
  if (maxKm != null && !origin) query = query.lte('distance_km', maxKm);
  // Distance filtering/sorting and the map need every match, not one page.
  // So does "Trending" (ranked by recent requests and saves, below).
  const wholeSet = (origin && (maxKm != null || sort === 'nearest')) || req.query.view === 'map' || sort === 'trending';
  if (duration) query = query.overlaps('supported_durations', duration.split(','));
  if (minRating) query = query.gte('avg_rating', Number(minRating));
  if (minRentalPeriod) query = query.eq('min_rental_period', minRentalPeriod);

  if (sort === 'price_asc') query = query.order('price_per_day', { ascending: true });
  else if (sort === 'price_desc') query = query.order('price_per_day', { ascending: false });
  else if (sort === 'rating_desc') {
    query = query.order('avg_rating', { ascending: false, nullsFirst: false }).order('review_count', { ascending: false });
  }
  else query = query.order('created_at', { ascending: false }); // 'relevance'/'newest' default

  const limitNum = req.query.view === 'map' ? MAP_LIMIT : Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT);
  const pageNum = Math.max(Number(page) || 1, 1);
  const from = (pageNum - 1) * limitNum;
  // Fetch one extra row past the page size so we can tell the frontend
  // whether a next page exists, without a separate count query (a count
  // would double the DB round-trips, and wouldn't account for the
  // availability post-filter below anyway).
  query = wholeSet ? query.limit(MAP_LIMIT) : query.range(from, from + limitNum);

  let { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  data = data.map((l) => withDistance(l, origin));
  let hasMore;
  if (wholeSet) {
    if (origin && maxKm != null) data = data.filter((l) => l.distance_from_you_km != null && l.distance_from_you_km <= maxKm);
    if (origin && sort === 'nearest') {
      data.sort((a, b) => (a.distance_from_you_km ?? Infinity) - (b.distance_from_you_km ?? Infinity));
    }
    if (sort === 'trending') {
      try {
        data = sortByTrending(data, await trendingScores());
      } catch (err) {
        console.error('[listings] trending failed:', err.message); // newest first instead
      }
    }
    if (req.query.view !== 'map') {
      hasMore = data.length > from + limitNum;
      data = data.slice(from, from + limitNum);
    } else {
      hasMore = false;
    }
  } else {
    hasMore = data.length > limitNum;
    data = data.slice(0, limitNum);
  }

  // Availability isn't a listings column - it's derived by checking whether
  // any rental_history row for a listing overlaps the requested window(s),
  // so it's applied as a post-filter here rather than in the query above.
  const availabilityWindows = (availability || '').split(',').filter(Boolean);
  if (availabilityWindows.length && data.length) {
    // Agreed rentals and owner-blocked dates count too (lib/availability.js).
    let bookedToday;
    let bookedThisWeek;
    try {
      ({ bookedToday, bookedThisWeek } = await unavailableSoon(data.map((l) => l.id)));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }

    data = data.filter((l) => {
      // Multiple checked windows are OR'd together, matching how every
      // other multi-select filter group on this page behaves.
      return availabilityWindows.some((w) =>
        w === 'today' ? !bookedToday.has(l.id) : w === 'week' ? !bookedThisWeek.has(l.id) : true
      );
    });
  }

  res.json({ data: data.map(publicOwner), page: pageNum, pageSize: limitNum, hasMore });
});

// GET /api/listings/mine - listings owned by the logged-in user (any status)
router.get('/mine', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('owner_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(withExactPin));
});

// GET /api/listings/:id - includes reviews + rental_history for the detail
// page's reviews section and rental-history calendar/list.
router.get('/:id', attachUserIfPresent, async (req, res) => {
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

  // Upcoming dates it can't be rented - booked or blocked by the owner.
  try {
    data.unavailable = await unavailableRanges(data.id);
  } catch (err) {
    console.error('[listings] availability failed:', err.message);
    data.unavailable = [];
  }

  // The owner's trust badges (lib/trust.js).
  try {
    data.owner_trust = await ownerTrust(data.owner_id);
  } catch (err) {
    console.error('[listings] trust badges failed:', err.message);
    data.owner_trust = null;
  }

  // The exact pin is only for the owner (editing it); everyone else gets it
  // rounded to ~1 km, plus their distance when they shared a location.
  const shown = req.user?.id === data.owner_id ? withExactPin(data) : withDistance(data, validLatLng(req.query.lat, req.query.lng));
  res.json(publicOwner(shown));
});

async function assertOwner(listingId, userId) {
  const { data } = await supabase.from('listings').select('owner_id').eq('id', listingId).maybeSingle();
  if (!data) return 404;
  return data.owner_id === userId ? null : 403;
}

// GET /api/listings/:id/blocked-dates - the owner's own blocked dates,
// with their private notes (upcoming ones).
router.get('/:id/blocked-dates', requireAuth, async (req, res) => {
  const denied = await assertOwner(req.params.id, req.user.id);
  if (denied) return res.status(denied).json({ error: denied === 404 ? 'Listing not found' : 'Forbidden' });
  const { data, error } = await supabase
    .from('listing_blocked_dates')
    .select('id, start_date, end_date, note')
    .eq('listing_id', req.params.id)
    .gte('end_date', new Date().toISOString().slice(0, 10))
    .order('start_date', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/listings/:id/blocked-dates - body: { start_date, end_date, note? }.
// The owner marks dates the item isn't available (repairs, own use). Can't
// cover dates a renter already has an agreed booking for.
router.post('/:id/blocked-dates', requireAuth, async (req, res) => {
  const denied = await assertOwner(req.params.id, req.user.id);
  if (denied) return res.status(denied).json({ error: denied === 404 ? 'Listing not found' : 'Forbidden' });
  const { start_date, end_date, note } = req.body || {};
  const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!isDate(start_date) || !isDate(end_date) || end_date < start_date) {
    return res.status(400).json({ error: 'Choose a start date and an end date on or after it.' });
  }
  if (end_date < new Date().toISOString().slice(0, 10)) return res.status(400).json({ error: 'Those dates are in the past.' });

  const { data: booked, error: bookedError } = await supabase
    .from('rentals')
    .select('id')
    .eq('listing_id', req.params.id)
    .in('status', BOOKED_STATUSES)
    .lte('start_date', end_date)
    .gte('end_date', start_date)
    .limit(1);
  if (bookedError) return res.status(500).json({ error: bookedError.message });
  if (booked.length) return res.status(409).json({ error: 'A renter already has an agreed booking in those dates.' });

  const { data, error } = await supabase
    .from('listing_blocked_dates')
    .insert({ listing_id: req.params.id, start_date, end_date, note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 200) : null })
    .select('id, start_date, end_date, note')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE /api/listings/:id/blocked-dates/:blockId - make those dates available again.
router.delete('/:id/blocked-dates/:blockId', requireAuth, async (req, res) => {
  const denied = await assertOwner(req.params.id, req.user.id);
  if (denied) return res.status(denied).json({ error: denied === 404 ? 'Listing not found' : 'Forbidden' });
  const { error } = await supabase.from('listing_blocked_dates').delete().eq('id', req.params.blockId).eq('listing_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
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
  'price_per_week',
  'price_per_month',
  'location',
  'condition',
  'image_url',
  'image_urls',
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

// Each draft is an AI call - kept well below the free-tier limits.
const draftRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests - please wait a minute and try again.' },
});

// Each interpretation may be an AI call - but repeats are cached, and the
// Marketplace searches the plain words if this fails, so it degrades softly.
const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many searches - please wait a moment.' },
});

// POST /api/listings/search-intent - body: { text }. Plain-language search:
// returns Marketplace filters for the request (see lib/searchIntent.js).
// Public, like browsing itself.
router.post('/search-intent', searchRateLimiter, async (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'Type what you are looking for.' });
  try {
    const filters = await interpretSearch(text);
    if (!filters) return res.status(502).json({ error: 'Could not understand that search right now.' });
    res.json(filters);
  } catch (err) {
    console.error('[listings] search intent failed:', err.message);
    res.status(502).json({ error: 'Could not understand that search right now.' });
  }
});

// POST /api/listings/draft - body: { notes, image_url? }. The AI listing
// writer on the List an Item form: returns suggested field values (never
// saves anything). See lib/listingDraft.js.
router.post('/draft', requireAuth, draftRateLimiter, async (req, res) => {
  const { notes, image_url, image_urls } = req.body || {};
  const photos = (Array.isArray(image_urls) ? image_urls : image_url ? [image_url] : []).filter((u) => typeof u === 'string');
  if (typeof notes !== 'string' || notes.trim().length < 3) {
    return res.status(400).json({ error: 'Describe the item in a few words first.' });
  }
  try {
    const draft = await draftListing({ notes: notes.trim().slice(0, 1500), imageUrls: photos });
    if (!draft) return res.status(502).json({ error: 'The listing writer is unavailable right now - please try again in a minute.' });
    res.json(draft);
  } catch (err) {
    console.error('[listings] draft failed:', err.message);
    res.status(502).json({ error: 'The listing writer is unavailable right now - please try again in a minute.' });
  }
});

// POST /api/listings - create a new listing (the "List an Item" form)
router.post('/', requireAuth, async (req, res) => {
  const { title, category_id, price_per_day } = req.body;

  if (!title || !category_id || !price_per_day) {
    return res.status(400).json({ error: 'title, category_id and price_per_day are required' });
  }

  // Sellers must pass KYC review before they can publish anything - see
  // kyc.js. Checked here (not just hidden in the UI) since this is a real
  // trust & safety boundary, not just a UX nicety.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('seller_status')
    .eq('id', req.user.id)
    .single();
  if (profileError) return res.status(500).json({ error: profileError.message });
  if (profile.seller_status !== 'approved') {
    return res.status(403).json({
      error: 'Your seller account must be verified before you can list an item.',
      seller_status: profile.seller_status,
    });
  }

  const fields = {};
  for (const field of WRITABLE_FIELDS) {
    if (field in req.body) fields[field] = req.body[field];
  }
  Object.assign(fields, normalizePhotos(req.body));
  // The map pin is stored separately (backend-only table, lib/geo.js).
  const pin = pinChange(req.body);
  if (pin?.error) return res.status(400).json({ error: pin.error });

  const { data, error } = await supabase
    .from('listings')
    .insert({ ...fields, owner_id: req.user.id })
    .select(LISTING_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  try {
    await savePin(supabase, data.id, pin);
  } catch (err) {
    console.error('[listings] saving map pin failed:', err.message);
    return res.status(201).json({ ...withExactPin(data), pin_error: 'The listing was saved, but its map pin was not - please set it again.' });
  }
  if (pin?.point) data.pin = { latitude: pin.point.lat, longitude: pin.point.lng };
  res.status(201).json(withExactPin(data));
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
  Object.assign(updates, normalizePhotos(req.body));
  const pin = pinChange(req.body);
  if (pin?.error) return res.status(400).json({ error: pin.error });

  try {
    await savePin(supabase, req.params.id, pin);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const { data, error } = await supabase
    .from('listings')
    .update(updates)
    .eq('id', req.params.id)
    .select(LISTING_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(withExactPin(data));
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
