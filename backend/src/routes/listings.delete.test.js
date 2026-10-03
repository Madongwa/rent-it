import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Just enough of Supabase for DELETE /api/listings/:id.
const state = {};
const deleted = vi.fn();
function query(table) {
  const q = {
    select: (_cols, opts) => ((q.head = opts?.head), q),
    eq: () => q,
    in: () => q,
    single: async () => ({ data: state.listing, error: state.listing ? null : { message: 'none' } }),
    delete: () => ({ eq: async () => (deleted(table), { error: null }) }),
    then: (resolve) =>
      resolve({ count: table === 'rentals' ? state.live : table === 'rental_disputes' ? state.disputes : 0, error: null }),
  };
  return q;
}
vi.mock('../lib/supabaseClient.js', () => ({
  supabase: {
    from: (table) => query(table),
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
  },
}));

vi.mock('../lib/groq.js', () => ({ groq: {} }));

const { default: listingsRouter } = await import('./listings.js');
const app = express().use(express.json()).use('/api/listings', listingsRouter);
const del = () => request(app).delete('/api/listings/l1').set('Authorization', 'Bearer t');

beforeEach(() => {
  deleted.mockReset();
  Object.assign(state, { listing: { owner_id: 'owner' }, live: 0, disputes: 0 });
});

describe('DELETE /api/listings/:id', () => {
  it('deletes a listing with no booking or dispute', async () => {
    expect((await del()).status).toBe(204);
    expect(deleted).toHaveBeenCalledWith('listings');
  });

  it('refuses while a booking is agreed', async () => {
    state.live = 1;
    const res = await del();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/agreed booking/);
    expect(deleted).not.toHaveBeenCalled();
  });

  it('refuses once a problem was reported on it', async () => {
    state.disputes = 1;
    const res = await del();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/problem was reported/);
    expect(deleted).not.toHaveBeenCalled();
  });

  it("refuses someone else's listing", async () => {
    state.listing = { owner_id: 'someone-else' };
    expect((await del()).status).toBe(403);
    expect(deleted).not.toHaveBeenCalled();
  });
});
