import { supabase } from './supabaseClient.js';

// The Marketplace's filters, shared by the listings API and saved-search
// alerts (lib/savedSearches.js) so an alert means exactly what the same
// search shows on the Marketplace.

// Query params that accept a comma-separated list for "any of these" (OR
// within the field, AND across different fields) - e.g. condition=Good,Fair.
export const MULTI_VALUE_FILTERS = {
  condition: 'condition',
  powerSource: 'power_source',
  delivery: 'delivery_option',
  cancellation: 'cancellation_policy',
  ownerType: 'owner_type',
};

// Max km for each "Within X km" distance-filter option.
export const DISTANCE_BUCKET_KM = { '2': 2, '5': 5, '10': 10, '25': 25 };

// Every filter parameter the Marketplace understands (not sort/page/view,
// and never the renter's location).
export const FILTER_KEYS = [
  'category', 'q', 'near', 'minPrice', 'maxPrice', 'deposit', 'accessories', 'distance',
  'duration', 'minRating', 'minRentalPeriod', 'availability', 'verified', ...Object.keys(MULTI_VALUE_FILTERS),
];

// Applies the filters in `params` to a listings query. "verified" needs the
// query to select the owner with an inner join (owner:profiles!inner(...)).
// Distance uses the owner-entered distance_km unless `origin` is given (the
// caller then filters by real distance). Availability and sorting are left
// to the caller. Resolves to { query } - wrapped, because a Supabase query
// is itself awaitable and would run if returned bare - or null for an
// unknown category (no results).
export async function applyListingFilters(query, params, { db = supabase, origin = null } = {}) {
  const { category, q, near, minPrice, maxPrice, deposit, accessories, distance, duration, minRating, minRentalPeriod, ownerId } = params;

  if (params.verified === 'true') query = query.eq('owner.seller_status', 'approved');

  if (category) {
    const { data: cat } = await db.from('categories').select('id').eq('slug', category).maybeSingle();
    if (!cat) return null;
    query = query.eq('category_id', cat.id);
  }

  if (ownerId) query = query.eq('owner_id', ownerId);

  // Full-text search (title weighted over description) instead of a plain
  // substring scan - handles multi-word queries and word-order/prefix
  // matching better, and can use the search_vector GIN index.
  if (q) query = query.textSearch('search_vector', q, { type: 'websearch', config: 'english' });

  // "Near Mandya" - listings whose location mentions the town. % and _ are
  // stripped so the text can't act as a wildcard pattern of its own.
  if (near) {
    const town = String(near).replace(/[%_,()]/g, '').trim().slice(0, 60);
    if (town) query = query.ilike('location', `%${town}%`);
  }

  if (minPrice) query = query.gte('price_per_day', Number(minPrice));
  if (maxPrice) query = query.lte('price_per_day', Number(maxPrice));

  for (const [param, column] of Object.entries(MULTI_VALUE_FILTERS)) {
    const raw = params[param];
    if (raw) query = query.in(column, String(raw).split(','));
  }

  if (deposit) query = query.eq('deposit_required', deposit === 'true');
  if (accessories) query = query.eq('accessories_included', accessories === 'true');

  const maxKm = distance && DISTANCE_BUCKET_KM[distance] !== undefined ? DISTANCE_BUCKET_KM[distance] : null;
  if (maxKm != null && !origin) query = query.lte('distance_km', maxKm);

  if (duration) query = query.overlaps('supported_durations', String(duration).split(','));
  if (minRating) query = query.gte('avg_rating', Number(minRating));
  if (minRentalPeriod) query = query.eq('min_rental_period', minRentalPeriod);

  return { query };
}
