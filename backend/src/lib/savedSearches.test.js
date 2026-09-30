import { describe, it, expect, vi } from 'vitest';
import { cleanFilters, cleanUrlQuery, runSavedSearchAlerts } from './savedSearches.js';
import { authorized } from '../routes/cron.js';

vi.mock('./groq.js', () => ({ groq: null }));
vi.mock('./gemini.js', () => ({ gemini: null }));
vi.mock('./supabaseClient.js', () => ({ supabase: null }));
vi.mock('./notify.js', () => ({ notify: vi.fn() }));

describe('cleanFilters / cleanUrlQuery', () => {
  it('keeps only Marketplace filters, never location or availability', () => {
    expect(cleanFilters({ q: ' tractor ', near: 'Mandya', availability: 'today', lat: '12.3', evil: 'x', maxPrice: 2000 })).toEqual({
      q: 'tractor',
      near: 'Mandya',
      maxPrice: '2000',
    });
  });
  it('drops page, view and location from the address', () => {
    expect(cleanUrlQuery('?q=drill&page=3&view=map&lat=1&lng=2&sort=newest')).toBe('q=drill&sort=newest');
  });
});

// A tiny query-builder stand-in: records filters, returns `rows` for listings.
function fakeDb({ searches, listings }) {
  const updates = [];
  return {
    updates,
    from(table) {
      const calls = [];
      const q = {
        select: () => q,
        eq: (c, v) => (calls.push(['eq', c, v]), q),
        neq: (c, v) => (calls.push(['neq', c, v]), q),
        gt: (c, v) => (calls.push(['gt', c, v]), q),
        textSearch: (c, v) => (calls.push(['text', v]), q),
        ilike: () => q,
        order: () => q,
        maybeSingle: async () => ({ data: { id: 1 } }),
        limit: async () => {
          if (table === 'saved_searches') return { data: searches, error: null };
          const owner = calls.find((c) => c[0] === 'neq')?.[2];
          const word = calls.find((c) => c[0] === 'text')?.[1];
          return { data: listings.filter((l) => l.owner_id !== owner && (!word || l.title.toLowerCase().includes(word))), error: null };
        },
        update: (row) => ({ eq: async (_c, id) => (updates.push([id, row]), { error: null }) }),
      };
      return q;
    },
  };
}

describe('runSavedSearchAlerts', () => {
  it('sends one notification per search with new matches, and moves every search forward', async () => {
    const db = fakeDb({
      searches: [
        { id: 's1', user_id: 'u1', label: 'tractor', filters: { q: 'tractor' }, url_query: 'q=tractor', last_checked_at: '2026-09-29T00:00:00Z' },
        { id: 's2', user_id: 'u2', label: 'crane', filters: { q: 'crane' }, url_query: '', last_checked_at: '2026-09-29T00:00:00Z' },
      ],
      listings: [
        { id: 'l1', owner_id: 'o1', title: 'Tractor 45 HP' },
        { id: 'l2', owner_id: 'u1', title: 'My own tractor' },
      ],
    });
    const notifyFn = vi.fn();
    const result = await runSavedSearchAlerts({ db, notifyFn, clock: () => new Date('2026-09-30T03:30:00Z') });
    expect(result).toEqual({ checked: 2, notified: 1 });
    expect(notifyFn).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', type: 'saved_search', link: '/marketplace?q=tractor' }));
    expect(notifyFn.mock.calls[0][0].body).toBe('"Tractor 45 HP".');
    expect(db.updates.map((u) => u[0])).toEqual(['s1', 's2']);
    expect(db.updates[0][1]).toEqual({ last_checked_at: '2026-09-30T03:30:00.000Z' });
  });
});

describe('cron authorized', () => {
  it('needs the exact secret, and refuses everything with no secret set', () => {
    expect(authorized('Bearer abc', 'abc')).toBe(true);
    expect(authorized('Bearer abd', 'abc')).toBe(false);
    expect(authorized(undefined, 'abc')).toBe(false);
    expect(authorized('Bearer ', '')).toBe(false);
    expect(authorized('Bearer undefined', undefined)).toBe(false);
  });
});
