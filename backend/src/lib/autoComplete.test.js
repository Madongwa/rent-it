import { describe, it, expect, vi } from 'vitest';
import { runAutoComplete, AUTO_COMPLETE_DAYS } from './autoComplete.js';

vi.mock('./supabaseClient.js', () => ({ supabase: null }));

function fakeDb(rentals) {
  return {
    rentals,
    from() {
      const filters = [];
      let patch = null;
      const q = {
        select: () => q,
        update: (p) => ((patch = p), q),
        eq: (c, v) => (filters.push((r) => r[c] === v), q),
        lt: (c, v) => (filters.push((r) => r[c] < v), q),
        limit: () => q,
        then: (resolve) => {
          const hit = rentals.filter((r) => filters.every((f) => f(r)));
          if (patch) hit.forEach((r) => Object.assign(r, patch));
          resolve({ data: hit.map((r) => ({ ...r })), error: null });
        },
      };
      return q;
    },
  };
}

const rental = (id, end_date, status = 'approved') => ({
  id,
  status,
  end_date,
  renter_id: 'renter',
  listing_id: `l-${id}`,
  conversation_id: `c-${id}`,
  listing: { title: 'Tiller', owner_id: 'owner' },
});

describe('runAutoComplete', () => {
  it(`completes agreed rentals that ended over ${AUTO_COMPLETE_DAYS} days ago, and tells both people`, async () => {
    const db = fakeDb([
      rental('old', '2026-10-01'), // 9 days ago
      rental('recent', '2026-10-05'), // 5 days ago - still time to report a problem
      rental('disputed', '2026-09-01', 'disputed'),
    ]);
    const notifyFn = vi.fn();
    const postFn = vi.fn();
    const syncFn = vi.fn();
    expect(await runAutoComplete({ db, notifyFn, postFn, syncFn, today: '2026-10-10' })).toEqual({ completed: 1 });

    expect(db.rentals.map((r) => r.status)).toEqual(['completed', 'approved', 'disputed']);
    expect(postFn).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'c-old', kind: 'system' }));
    expect(notifyFn.mock.calls.map(([n]) => n.userId)).toEqual(['renter', 'owner']);
    expect(syncFn).toHaveBeenCalledWith('l-old');
  });
});
