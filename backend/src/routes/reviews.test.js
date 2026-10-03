import { describe, it, expect, vi } from 'vitest';
import { canReviewListing } from './reviews.js';

vi.mock('../lib/supabaseClient.js', () => ({ supabase: null }));

// In-memory stand-in for the one rentals query canReviewListing makes.
function fakeDb(rentals) {
  return {
    from() {
      const filters = [];
      const q = {
        select: () => q,
        eq: (c, v) => (filters.push((r) => r[c] === v), q),
        in: (c, vs) => (filters.push((r) => vs.includes(r[c])), q),
        then: (resolve) => resolve({ data: rentals.filter((r) => filters.every((f) => f(r))), error: null }),
      };
      return q;
    },
  };
}

const today = '2026-10-03';
const rental = (over) => ({ id: 'r', listing_id: 'l1', renter_id: 'u1', status: 'completed', end_date: '2026-09-20', ...over });
const check = (rentals, user = 'u1') => canReviewListing(user, 'l1', { db: fakeDb(rentals), today });

describe('canReviewListing', () => {
  it('allows a renter with a completed rental', async () => {
    expect(await check([rental()])).toBe(true);
  });

  it('allows an agreed rental whose last day has passed', async () => {
    expect(await check([rental({ status: 'approved', end_date: '2026-10-02' })])).toBe(true);
  });

  it('refuses an agreed rental that is still running or upcoming', async () => {
    expect(await check([rental({ status: 'approved', end_date: today })])).toBe(false);
  });

  it('refuses people who never rented it', async () => {
    expect(await check([])).toBe(false);
    expect(await check([rental()], 'someone-else')).toBe(false);
    for (const status of ['pending', 'rejected', 'cancelled', 'disputed']) {
      expect(await check([rental({ status })])).toBe(false);
    }
  });

  it('throws when the lookup fails', async () => {
    const db = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ in: async () => ({ error: { message: 'boom' } }) }) }) }) }) };
    await expect(canReviewListing('u1', 'l1', { db, today })).rejects.toThrow('boom');
  });
});
