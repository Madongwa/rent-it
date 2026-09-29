import { describe, it, expect, vi } from 'vitest';
import { hasBlockedConflict, overlaps, unavailableRanges, unavailableSoon } from './availability.js';

vi.mock('./supabaseClient.js', () => ({ supabase: null }));

// In-memory stand-in for the Supabase queries availability.js makes.
function fakeDb(tables) {
  return {
    from(table) {
      const filters = [];
      const rows = () => (tables[table] || []).filter((r) => filters.every((f) => f(r)));
      const q = {
        select: () => q,
        eq: (c, v) => (filters.push((r) => r[c] === v), q),
        in: (c, vs) => (filters.push((r) => vs.includes(r[c])), q),
        lte: (c, v) => (filters.push((r) => r[c] <= v), q),
        gte: (c, v) => (filters.push((r) => r[c] >= v), q),
        limit: () => q,
        then: (resolve) => resolve({ data: rows(), error: null }),
      };
      return q;
    },
  };
}

const day = (offset) => new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const tables = {
  rentals: [
    { listing_id: 'l1', status: 'approved', start_date: day(3), end_date: day(4) },
    { listing_id: 'l1', status: 'pending', start_date: day(1), end_date: day(2) }, // not booked yet
    { listing_id: 'l1', status: 'approved', start_date: day(-10), end_date: day(-8) }, // over
  ],
  listing_blocked_dates: [{ listing_id: 'l1', start_date: day(0), end_date: day(1), note: 'Servicing - PRIVATE' }],
  rental_history: [{ listing_id: 'l2', start_date: day(5), end_date: day(6) }],
};

describe('overlaps', () => {
  it('treats touching and nested ranges as overlapping', () => {
    const r = (s, e) => ({ start_date: s, end_date: e });
    expect(overlaps(r('2026-10-01', '2026-10-03'), r('2026-10-03', '2026-10-05'))).toBe(true);
    expect(overlaps(r('2026-10-01', '2026-10-10'), r('2026-10-04', '2026-10-05'))).toBe(true);
    expect(overlaps(r('2026-10-01', '2026-10-02'), r('2026-10-03', '2026-10-05'))).toBe(false);
  });
});

describe('unavailableRanges', () => {
  it('lists upcoming booked and owner-blocked dates, sorted, without the private note', async () => {
    const ranges = await unavailableRanges('l1', fakeDb(tables));
    expect(ranges).toEqual([
      { start_date: day(0), end_date: day(1), kind: 'blocked' },
      { start_date: day(3), end_date: day(4), kind: 'booked' },
    ]);
    expect(JSON.stringify(ranges)).not.toContain('PRIVATE');
  });
});

describe('hasBlockedConflict', () => {
  it('spots a request that touches owner-blocked dates', async () => {
    const db = fakeDb(tables);
    expect((await hasBlockedConflict({ listingId: 'l1', startDate: day(1), endDate: day(2) }, db)).conflict).toBe(true);
    expect((await hasBlockedConflict({ listingId: 'l1', startDate: day(2), endDate: day(5) }, db)).conflict).toBe(false);
  });
});

describe('unavailableSoon', () => {
  it('counts agreed rentals, blocked dates and rental history', async () => {
    const { bookedToday, bookedThisWeek } = await unavailableSoon(['l1', 'l2', 'l3'], fakeDb(tables));
    expect([...bookedToday]).toEqual(['l1']); // blocked today
    expect([...bookedThisWeek].sort()).toEqual(['l1', 'l2']);
  });
});
