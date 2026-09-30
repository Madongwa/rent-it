import { supabase } from './supabaseClient.js';

// "Trending" on the Marketplace: what people asked to rent and saved in the
// last 30 days. A rental request counts three times a save - asking to rent
// is the stronger signal. Only counts are used, never who did it.
export const TRENDING_DAYS = 30;
const REQUEST_WEIGHT = 3;
const MAX_ROWS = 5000;

export async function trendingScores({ db = supabase, now = new Date() } = {}) {
  const since = new Date(now.getTime() - TRENDING_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [requests, saves] = await Promise.all([
    db.from('rentals').select('listing_id').gte('created_at', since).limit(MAX_ROWS),
    db.from('favorites').select('listing_id').gte('created_at', since).limit(MAX_ROWS),
  ]);
  if (requests.error) throw new Error(requests.error.message);
  if (saves.error) throw new Error(saves.error.message);

  const scores = new Map();
  const add = (id, n) => scores.set(id, (scores.get(id) || 0) + n);
  for (const r of requests.data) add(r.listing_id, REQUEST_WEIGHT);
  for (const f of saves.data) add(f.listing_id, 1);
  return scores;
}

// Highest score first; ties (and listings nobody touched) keep their
// newest-first order, since the query is already sorted that way.
export function sortByTrending(listings, scores) {
  return listings
    .map((l, i) => ({ l, i, s: scores.get(l.id) || 0 }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.l);
}
