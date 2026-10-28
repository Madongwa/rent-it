import { describe, it, expect, vi } from 'vitest';
import { holdsListingToday, ownerStatusError, runListingStatusSync, syncListingStatus } from './listingStatus.js';

vi.mock('./supabaseClient.js', () => ({ supabase: null }));

const live = { status: 'available', removed_by_staff: null };
const paused = { status: 'inactive', removed_by_staff: null };

describe('ownerStatusError', () => {
  it('lets a verified owner pause and reactivate', () => {
    expect(ownerStatusError(live, 'inactive', 'approved')).toBeNull();
    expect(ownerStatusError(paused, 'available', 'approved')).toBeNull();
  });

  it('only allows available and inactive', () => {
    expect(ownerStatusError(live, 'rented', 'approved').code).toBe(400);
    expect(ownerStatusError(live, 'deleted', 'approved').code).toBe(400);
  });

  it('keeps a listing staff removed down', () => {
    for (const reason of ['policy', 'ban']) {
      const removed = { status: 'inactive', removed_by_staff: reason };
      expect(ownerStatusError(removed, 'available', 'approved').code).toBe(403);
    }
  });

  it('needs a verified seller to reactivate', () => {
    for (const seller of ['rejected', 'pending', 'not_submitted', undefined]) {
      expect(ownerStatusError(paused, 'available', seller).code).toBe(403);
    }
    // ...but anyone can still pause.
    expect(ownerStatusError(live, 'inactive', 'rejected')).toBeNull();
  });

  it("can't turn a booked listing back to available", () => {
    expect(ownerStatusError({ status: 'rented', removed_by_staff: null }, 'available', 'approved').code).toBe(400);
  });

  it('accepts re-sending the current status (edit form saving everything)', () => {
    expect(ownerStatusError({ status: 'inactive', removed_by_staff: 'policy' }, 'inactive', 'rejected')).toBeNull();
    expect(ownerStatusError(live, 'available', 'rejected')).toBeNull();
  });
});

// In-memory stand-in for the rentals/listings queries listingStatus.js makes.
function fakeDb({ rentals = [], listings = [] }) {
  const tables = { rentals, listings };
  return {
    tables,
    from(table) {
      const filters = [];
      let patch = null;
      const rows = () => tables[table].filter((r) => filters.every((f) => f(r)));
      const run = () => {
        const hit = rows();
        if (patch) hit.forEach((r) => Object.assign(r, patch));
        return { data: hit.map((r) => ({ ...r })), error: null };
      };
      const q = {
        select: () => q,
        update: (p) => ((patch = p), q),
        eq: (c, v) => (filters.push((r) => r[c] === v), q),
        in: (c, vs) => (filters.push((r) => vs.includes(r[c])), q),
        not: (c, _op, list) => {
          const ids = list.slice(1, -1).split(',');
          return filters.push((r) => !ids.includes(r[c])), q;
        },
        then: (resolve) => resolve(run()),
      };
      return q;
    },
  };
}

const today = '2026-10-10';

describe('holdsListingToday', () => {
  it('counts agreed rentals covering today, and any dispute', () => {
    expect(holdsListingToday({ status: 'approved', start_date: '2026-10-09', end_date: '2026-10-10' }, today)).toBe(true);
    expect(holdsListingToday({ status: 'approved', start_date: '2026-11-01', end_date: '2026-11-05' }, today)).toBe(false);
    expect(holdsListingToday({ status: 'approved', start_date: '2026-10-01', end_date: '2026-10-09' }, today)).toBe(false);
    expect(holdsListingToday({ status: 'disputed', start_date: '2026-09-01', end_date: '2026-09-02' }, today)).toBe(true);
  });
});

describe('syncListingStatus', () => {
  it("doesn't mark a listing rented for a booking next month", async () => {
    const db = fakeDb({
      rentals: [{ listing_id: 'l1', status: 'approved', start_date: '2026-11-01', end_date: '2026-11-05' }],
      listings: [{ id: 'l1', status: 'available' }],
    });
    await syncListingStatus('l1', { db, today });
    expect(db.tables.listings[0].status).toBe('available');
  });

  it('marks it rented while out today, and frees it after', async () => {
    const db = fakeDb({
      rentals: [{ listing_id: 'l1', status: 'approved', start_date: '2026-10-09', end_date: '2026-10-11' }],
      listings: [{ id: 'l1', status: 'available' }],
    });
    await syncListingStatus('l1', { db, today });
    expect(db.tables.listings[0].status).toBe('rented');
    await syncListingStatus('l1', { db, today: '2026-10-12' });
    expect(db.tables.listings[0].status).toBe('available');
  });

  it('leaves a paused listing paused', async () => {
    const db = fakeDb({
      rentals: [{ listing_id: 'l1', status: 'approved', start_date: today, end_date: today }],
      listings: [{ id: 'l1', status: 'inactive' }],
    });
    await syncListingStatus('l1', { db, today });
    expect(db.tables.listings[0].status).toBe('inactive');
  });
});

describe('runListingStatusSync', () => {
  it('updates every listing from its bookings', async () => {
    const db = fakeDb({
      rentals: [
        { listing_id: 'out', status: 'approved', start_date: '2026-10-09', end_date: '2026-10-12' },
        { listing_id: 'later', status: 'approved', start_date: '2026-12-01', end_date: '2026-12-02' },
        { listing_id: 'disputed', status: 'disputed', start_date: '2026-09-01', end_date: '2026-09-02' },
      ],
      listings: [
        { id: 'out', status: 'available' },
        { id: 'later', status: 'rented' },
        { id: 'disputed', status: 'rented' },
        { id: 'done', status: 'rented' },
        { id: 'paused', status: 'inactive' },
      ],
    });
    expect(await runListingStatusSync({ db, today })).toEqual({ rented: 1, available: 2 });
    expect(Object.fromEntries(db.tables.listings.map((l) => [l.id, l.status]))).toEqual({
      out: 'rented',
      later: 'available',
      disputed: 'rented',
      done: 'available',
      paused: 'inactive',
    });
  });

  it('frees every rented listing when nothing is out', async () => {
    const db = fakeDb({ listings: [{ id: 'a', status: 'rented' }] });
    expect(await runListingStatusSync({ db, today })).toEqual({ rented: 0, available: 1 });
  });
});
