import { supabase } from './supabaseClient.js';

// Staff → Insights: what people search for, what they search for and don't
// find (demand nobody is meeting yet), and how chats turn into deals - all
// over the last 30 days, from counts only (the search log has no users).

const DAYS = 30;
const MAX_ROWS = 5000;
const DEALS = ['approved', 'completed', 'disputed'];

const norm = (q) => String(q || '').toLowerCase().replace(/\s+/g, ' ').trim();

// [{ term, count, near? }] - most common first; ties by term.
export function topTerms(rows, limit = 10) {
  const counts = new Map();
  for (const r of rows) {
    const term = norm(r.q) || (r.near ? `(near ${norm(r.near)})` : '');
    if (!term) continue;
    counts.set(term, (counts.get(term) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, limit);
}

export async function staffAnalytics({ db = supabase, now = new Date() } = {}) {
  const since = new Date(now.getTime() - DAYS * 24 * 60 * 60 * 1000).toISOString();
  const count = (table, build = (q) => q) =>
    build(db.from(table).select('id', { count: 'exact', head: true }).gte('created_at', since)).then((r) => {
      if (r.error) throw new Error(r.error.message);
      return r.count || 0;
    });

  const [searches, chats, requests, deals, completed, wantedOpen] = await Promise.all([
    db.from('search_log').select('q, near, results').gte('created_at', since).limit(MAX_ROWS),
    count('conversations'),
    count('rentals'),
    count('rentals', (q) => q.in('status', DEALS)),
    count('rentals', (q) => q.eq('status', 'completed')),
    db
      .from('wanted_posts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .gt('expires_at', now.toISOString())
      .then((r) => r.count || 0),
  ]);
  if (searches.error) throw new Error(searches.error.message);

  const rows = searches.data;
  const empty = rows.filter((r) => r.results === 0);
  return {
    days: DAYS,
    searches: rows.length,
    no_result_share: rows.length ? Math.round((empty.length / rows.length) * 100) : 0,
    top_searches: topTerms(rows),
    no_result_searches: topTerms(empty),
    funnel: { chats, requests, deals, completed },
    wanted_open: wantedOpen,
  };
}
