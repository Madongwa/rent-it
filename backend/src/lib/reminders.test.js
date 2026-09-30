import { describe, it, expect, vi } from 'vitest';
import { runRentalReminders } from './reminders.js';

vi.mock('./supabaseClient.js', () => ({ supabase: null }));
vi.mock('./notify.js', () => ({ notify: vi.fn() }));

const listing = { id: 'l1', title: 'Tractor', owner_id: 'o1' };
const rentals = [
  { id: 'r1', renter_id: 'u1', start_date: '2026-10-01', end_date: '2026-10-03', status: 'approved', conversation_id: 'c1', listing },
  { id: 'r2', renter_id: 'u2', start_date: '2026-09-28', end_date: '2026-10-01', status: 'approved', conversation_id: null, listing },
  { id: 'r3', renter_id: 'u3', start_date: '2026-09-25', end_date: '2026-09-29', status: 'completed', conversation_id: null, listing },
  { id: 'r4', renter_id: 'u4', start_date: '2026-09-25', end_date: '2026-09-29', status: 'approved', conversation_id: null, listing },
  { id: 'r5', renter_id: 'u5', start_date: '2026-10-01', end_date: '2026-10-03', status: 'pending', conversation_id: null, listing },
];

function fakeDb({ reviews = [] } = {}) {
  const claimed = new Set();
  return {
    from(table) {
      const f = [];
      const rows = () => rentals.filter((r) => f.every((fn) => fn(r)));
      const q = {
        select: () => q,
        eq: (c, v) => (f.push((r) => r[c] === v), q),
        lt: (c, v) => (f.push((r) => r[c] < v), q),
        in: (c, vs) => (f.push((r) => vs.includes(r[c])), q),
        then: (resolve) => resolve({ data: rows(), error: null }),
        maybeSingle: async () => ({ data: reviews.find((x) => f.every((fn) => fn(x))) || null }),
        insert: async ({ rental_id, kind }) => {
          const key = `${rental_id}:${kind}`;
          if (claimed.has(key)) return { error: { code: '23505' } };
          claimed.add(key);
          return { error: null };
        },
      };
      return q;
    },
  };
}

describe('runRentalReminders', () => {
  it('reminds both sides before pickup and return, and nudges renters to review', async () => {
    const db = fakeDb({ reviews: [{ listing_id: 'l1', reviewer_id: 'u4' }] });
    const notifyFn = vi.fn();
    const counts = await runRentalReminders({ db, notifyFn, today: '2026-09-30' });
    expect(counts).toEqual({ pickup: 1, return: 1, review: 1 });
    const sent = notifyFn.mock.calls.map(([n]) => [n.userId, n.type]);
    expect(sent).toEqual([
      ['u1', 'pickup_reminder'],
      ['o1', 'pickup_reminder'],
      ['u2', 'return_reminder'],
      ['o1', 'return_reminder'],
      ['u3', 'review_nudge'], // u4 already reviewed; r5 isn't agreed
    ]);
    expect(notifyFn.mock.calls[0][0].link).toBe('/messages?c=c1');
    expect(notifyFn.mock.calls[4][0].link).toBe('/listing/l1#write-review');

    // Running again the same day sends nothing new.
    notifyFn.mockClear();
    expect(await runRentalReminders({ db, notifyFn, today: '2026-09-30' })).toEqual({ pickup: 0, return: 0, review: 0 });
    expect(notifyFn).not.toHaveBeenCalled();
  });
});
