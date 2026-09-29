import { describe, it, expect, vi } from 'vitest';
import { accountSummary } from './accountContext.js';

vi.mock('./supabaseClient.js', () => ({ supabase: null }));

// Records every filter each query used, so the test can check the summary
// is only ever looked up by the user's own id.
function fakeDb(tables) {
  const calls = [];
  const get = (row, col) => col.split('.').reduce((v, k) => v?.[k], row);
  return {
    calls,
    from(table) {
      const filters = [];
      calls.push({ table, filters });
      const rows = () => (tables[table] || []).filter((r) => filters.every(([c, v]) => get(r, c) === v));
      const q = {
        select: () => q,
        eq: (c, v) => (filters.push([c, v]), q),
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (resolve) => resolve({ data: rows(), error: null }),
      };
      return q;
    },
  };
}

const ME = 'me';
const tables = {
  profiles: [{ id: ME, full_name: 'Ravi', seller_status: 'approved' }],
  rentals: [
    {
      renter_id: ME, status: 'pending', start_date: '2026-10-01', end_date: '2026-10-03', price_per_day: null,
      listing: { title: 'Rotavator', owner_id: 'o1', owner: { full_name: 'Olivia' } },
      offers: [{ status: 'open', proposed_by: 'o1', price_per_day: 800, start_date: '2026-10-01', end_date: '2026-10-03' }],
    },
    {
      renter_id: 'someone', status: 'approved', start_date: '2026-11-01', end_date: '2026-11-02', price_per_day: 400,
      renter: { full_name: 'Sam' }, listing: { title: 'Ladder', owner_id: ME }, offers: [],
    },
    { renter_id: 'other', status: 'approved', listing: { title: 'SECRET other rental', owner_id: 'other-owner' }, offers: [] },
  ],
  listings: [{ owner_id: ME, title: 'Ladder', status: 'available', price_per_day: 400 }],
  rental_disputes: [],
};

describe('accountSummary', () => {
  it("describes only this user's rentals, both ways, with whose turn it is", async () => {
    const db = fakeDb(tables);
    const text = await accountSummary(ME, db);

    expect(text).toContain('Seller verification: verified');
    expect(text).toContain('"Rotavator" with owner Olivia, 2026-10-01 to 2026-10-03: being negotiated.');
    expect(text).toContain('waiting for YOU to accept, counter or decline');
    expect(text).toContain('"Ladder" with renter Sam, 2026-11-01 to 2026-11-02: agreed, at ₹400/day.');
    expect(text).not.toContain('SECRET');
  });

  it('only ever filters by the user\'s own id', async () => {
    const db = fakeDb(tables);
    await accountSummary(ME, db);
    for (const { filters } of db.calls) {
      const idFilters = filters.filter(([c]) => ['id', 'renter_id', 'owner_id', 'listing.owner_id', 'raised_by'].includes(c));
      expect(idFilters.length).toBeGreaterThan(0);
      expect(idFilters.every(([, v]) => v === ME)).toBe(true);
    }
  });
});
