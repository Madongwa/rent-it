import { describe, it, expect, vi } from 'vitest';
import { ownerStatusError } from './listingStatus.js';

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
