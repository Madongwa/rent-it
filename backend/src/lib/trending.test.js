import { describe, it, expect, vi } from 'vitest';
import { sortByTrending, trendingScores } from './trending.js';

vi.mock('./supabaseClient.js', () => ({ supabase: null }));

function fakeDb(tables) {
  return {
    from(table) {
      let since = '';
      const q = {
        select: () => q,
        gte: (_c, v) => ((since = v), q),
        limit: async () => ({ data: (tables[table] || []).filter((r) => r.created_at >= since), error: null }),
      };
      return q;
    },
  };
}

describe('trending', () => {
  const now = new Date('2026-09-30T12:00:00Z');

  it('weighs a rental request 3x a save, and ignores anything older than 30 days', async () => {
    const db = fakeDb({
      rentals: [
        { listing_id: 'a', created_at: '2026-09-29T00:00:00Z' },
        { listing_id: 'b', created_at: '2026-07-01T00:00:00Z' }, // too old
      ],
      favorites: [
        { listing_id: 'b', created_at: '2026-09-20T00:00:00Z' },
        { listing_id: 'b', created_at: '2026-09-21T00:00:00Z' },
      ],
    });
    const scores = await trendingScores({ db, now });
    expect(scores.get('a')).toBe(3);
    expect(scores.get('b')).toBe(2);
  });

  it('sorts by score and keeps the original order for ties', () => {
    const listings = [{ id: 'x' }, { id: 'a' }, { id: 'y' }, { id: 'b' }];
    const scores = new Map([['a', 3], ['b', 2]]);
    expect(sortByTrending(listings, scores).map((l) => l.id)).toEqual(['a', 'b', 'x', 'y']);
  });
});
