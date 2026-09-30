import { supabase } from './supabaseClient.js';
import { applyListingFilters, FILTER_KEYS } from './listingFilters.js';
import { notify } from './notify.js';

// Saved searches: "tell me when a tractor is listed near Mandya". Once a
// day (routes/cron.js) each search is re-run against listings published
// since it was last checked, with exactly the Marketplace's filters, and
// its owner gets one notification if anything new turned up.

export const MAX_SAVED = 10;
const PER_RUN = 1000;

// Only real Marketplace filters, as short strings. "availability" is left
// out - "free today" means nothing for tomorrow's alert.
export function cleanFilters(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const key of FILTER_KEYS) {
    if (key === 'availability') continue;
    const v = input[key];
    if (v === undefined || v === null || v === '') continue;
    const str = String(v).trim().slice(0, 200);
    if (str) out[key] = str;
  }
  return out;
}

// The Marketplace address to reopen the search: only its own parameters.
export function cleanUrlQuery(raw) {
  const params = new URLSearchParams(String(raw || '').replace(/^\?/, ''));
  const keep = new URLSearchParams();
  for (const [k, v] of params) {
    if (['page', 'view', 'lat', 'lng'].includes(k)) continue;
    if (/^[a-zA-Z]{1,20}$/.test(k) && v.length <= 200) keep.set(k, v);
  }
  return keep.toString().slice(0, 1000);
}

// New matches for one search since it was last checked (up to 10).
export async function newMatches(search, { db = supabase } = {}) {
  const filters = search.filters || {};
  const select = filters.verified === 'true' ? 'id, title, owner:profiles!inner(seller_status)' : 'id, title';
  const base = db
    .from('listings')
    .select(select)
    .eq('status', 'available')
    .neq('owner_id', search.user_id)
    .gt('created_at', search.last_checked_at)
    .order('created_at', { ascending: false });
  const filtered = await applyListingFilters(base, filters, { db });
  if (!filtered) return [];
  const { data, error } = await filtered.query.limit(10);
  if (error) throw new Error(error.message);
  return data;
}

// The daily run. Returns { checked, notified }.
export async function runSavedSearchAlerts({ db = supabase, notifyFn = notify, clock = () => new Date() } = {}) {
  const { data: searches, error } = await db
    .from('saved_searches')
    .select('id, user_id, label, filters, url_query, last_checked_at')
    .order('last_checked_at', { ascending: true })
    .limit(PER_RUN);
  if (error) throw new Error(error.message);

  let notified = 0;
  for (const search of searches) {
    // Taken before the check, so a listing published mid-check is
    // caught next time rather than skipped.
    const checkedAt = clock().toISOString();
    try {
      const found = await newMatches(search, { db });
      if (found.length) {
        const names = found.slice(0, 3).map((l) => `"${l.title}"`).join(', ');
        await notifyFn({
          userId: search.user_id,
          type: 'saved_search',
          title: found.length === 1 ? `New listing for "${search.label}"` : `${found.length} new listings for "${search.label}"`,
          body: found.length > 3 ? `${names} and more.` : `${names}.`,
          link: `/marketplace${search.url_query ? `?${search.url_query}` : ''}`,
        });
        notified += 1;
      }
      await db.from('saved_searches').update({ last_checked_at: checkedAt }).eq('id', search.id);
    } catch (err) {
      // One bad search shouldn't stop everyone else's alerts.
      console.error('[saved-searches] check failed:', search.id, err.message);
    }
  }
  return { checked: searches.length, notified };
}
