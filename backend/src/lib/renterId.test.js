import { describe, it, expect, vi } from 'vitest';
import { decide, isIdVerified, reviewRenterId, submitRenterId } from './renterId.js';

vi.mock('./groq.js', () => ({ groq: null }));
vi.mock('./gemini.js', () => ({ gemini: null }));
vi.mock('./supabaseClient.js', () => ({ supabase: null }));
vi.mock('./notify.js', () => ({ notify: vi.fn() }));

const good = { looks_like_id: 'yes', readable: 'yes', name_match: 'match', document_type: 'driving_licence', aadhaar_number_visible: false, issues: [] };

describe('decide', () => {
  it('verifies only a clear, matching ID', () => {
    expect(decide(good)).toEqual({ status: 'verified' });
    expect(decide({ ...good, name_match: 'unclear' }).status).toBe('pending');
    expect(decide({ ...good, readable: 'partly' }).status).toBe('pending');
    expect(decide(null).status).toBe('pending'); // AI unavailable -> staff
  });
  it('refuses a full Aadhaar number and deletes the photo', () => {
    const out = decide({ ...good, document_type: 'aadhaar', aadhaar_number_visible: true });
    expect(out).toMatchObject({ status: 'rejected', deleteFile: true });
    expect(out.reason).toMatch(/masked Aadhaar/);
  });
  it('refuses something that is not an ID', () => {
    expect(decide({ ...good, looks_like_id: 'no' }).status).toBe('rejected');
  });
});

describe('isIdVerified', () => {
  it('counts verified renters and approved sellers', () => {
    expect(isIdVerified({ renter_id_status: 'verified' })).toBe(true);
    expect(isIdVerified({ renter_id_status: 'none', seller_status: 'approved' })).toBe(true);
    expect(isIdVerified({ renter_id_status: 'pending', seller_status: 'pending' })).toBe(false);
    expect(isIdVerified(null)).toBe(false);
  });
});

function fakeDb(profile = { full_name: 'Asha Rao', renter_id_status: 'none', seller_status: 'not_submitted' }) {
  const calls = { upserts: [], profileUpdates: [], removed: [] };
  return {
    calls,
    storage: { from: () => ({ createSignedUrl: async () => ({ data: {}, error: null }), remove: async (p) => (calls.removed.push(...p), {}) }) },
    from(table) {
      const q = {
        select: () => q,
        eq: () => q,
        single: async () => ({ data: profile, error: null }),
        upsert: async (row) => (calls.upserts.push(row), { error: null }),
        update: (row) => {
          if (table === 'profiles') calls.profileUpdates.push(row);
          return { eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { user_id: 'u1' }, error: null }) }), then: (r) => r({ error: null }) }) };
        },
      };
      return q;
    },
  };
}

describe('submitRenterId', () => {
  it('verifies at once on a clear AI check', async () => {
    const db = fakeDb();
    const out = await submitRenterId('u1', { id_type: 'driving_licence', document_path: 'u1/renter-id.jpg' }, { db, check: async () => ({ result: good }) });
    expect(out.status).toBe('verified');
    expect(db.calls.upserts[0]).toMatchObject({ user_id: 'u1', status: 'verified', method: 'ai', document_path: 'u1/renter-id.jpg' });
    expect(db.calls.profileUpdates).toEqual([{ renter_id_status: 'verified' }]);
  });

  it('deletes an unmasked Aadhaar and keeps no path', async () => {
    const db = fakeDb();
    const out = await submitRenterId('u1', { id_type: 'aadhaar', document_path: 'u1/a.jpg' }, { db, check: async () => ({ result: { ...good, aadhaar_number_visible: true } }) });
    expect(out.status).toBe('rejected');
    expect(db.calls.removed).toEqual(['u1/a.jpg']);
    expect(db.calls.upserts[0].document_path).toBeNull();
  });

  it("refuses another user's folder and unknown ID types", async () => {
    expect((await submitRenterId('u1', { id_type: 'pan', document_path: 'u2/x.jpg' }, { db: fakeDb() })).code).toBe(400);
    expect((await submitRenterId('u1', { id_type: 'ration_card', document_path: 'u1/x.jpg' }, { db: fakeDb() })).code).toBe(400);
  });

  it('does nothing for someone already verified', async () => {
    const db = fakeDb({ full_name: 'A', renter_id_status: 'none', seller_status: 'approved' });
    expect(await submitRenterId('u1', { id_type: 'pan', document_path: 'u1/x.jpg' }, { db, check: async () => ({}) })).toEqual({ status: 'verified' });
    expect(db.calls.upserts).toHaveLength(0);
  });
});

describe('reviewRenterId', () => {
  it('needs a reason to reject, and tells the renter', async () => {
    expect((await reviewRenterId('u1', 'reject', 'a1', '', { db: fakeDb() })).code).toBe(400);
    const notifyFn = vi.fn();
    expect(await reviewRenterId('u1', 'verify', 'a1', null, { db: fakeDb(), notifyFn })).toEqual({ status: 'verified' });
    expect(notifyFn).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', title: 'Your ID is verified' }));
  });
});
