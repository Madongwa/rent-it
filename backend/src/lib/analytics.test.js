import { describe, it, expect, vi } from 'vitest';
import { staffAnalytics, topTerms } from './analytics.js';

vi.mock('./supabaseClient.js', () => ({ supabase: null }));

describe('topTerms', () => {
  it('groups searches case- and space-insensitively', () => {
    expect(topTerms([{ q: 'Tractor' }, { q: ' tractor ' }, { q: 'JCB' }, { q: null, near: 'Pune' }, { q: '' }])).toEqual([
      { term: 'tractor', count: 2 },
      { term: '(near pune)', count: 1 },
      { term: 'jcb', count: 1 },
    ]);
  });
});

describe('staffAnalytics', () => {
  it('reports searches, the ones that found nothing, and the funnel', async () => {
    const counts = { conversations: 20, rentals: 8 };
    const db = {
      from(table) {
        const f = {};
        const q = {
          select: () => q,
          gte: () => q,
          gt: () => q,
          eq: (c, v) => ((f[c] = v), q),
          in: (c, v) => ((f[c] = v), q),
          limit: async () => ({ data: [{ q: 'crane', results: 0 }, { q: 'Crane', results: 0 }, { q: 'drill', results: 3 }, { q: 'tractor', results: 2 }], error: null }),
          then: (resolve) =>
            resolve({ count: table === 'wanted_posts' ? 4 : f.status === 'completed' ? 2 : f.status ? 5 : counts[table], error: null }),
        };
        return q;
      },
    };
    const out = await staffAnalytics({ db });
    expect(out.searches).toBe(4);
    expect(out.no_result_share).toBe(50);
    expect(out.no_result_searches).toEqual([{ term: 'crane', count: 2 }]);
    expect(out.funnel).toEqual({ chats: 20, requests: 8, deals: 5, completed: 2 });
    expect(out.wanted_open).toBe(4);
  });
});
