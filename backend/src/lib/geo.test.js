import { describe, it, expect } from 'vitest';
import { haversineKm, pinChange, roundCoord, savePin, validLatLng, withDistance, withExactPin } from './geo.js';

const mysuru = { lat: 12.2958, lng: 76.6394 };
const bengaluru = { lat: 12.9716, lng: 77.5946 };

describe('haversineKm', () => {
  it('Mysuru to Bengaluru is about 128 km as the crow flies', () => {
    expect(haversineKm(mysuru, bengaluru)).toBeGreaterThan(120);
    expect(haversineKm(mysuru, bengaluru)).toBeLessThan(135);
  });
});

describe('validLatLng', () => {
  it('accepts numbers and numeric strings', () => {
    expect(validLatLng('12.3', '76.6')).toEqual({ lat: 12.3, lng: 76.6 });
  });
  it('rejects missing, blank and out-of-range values', () => {
    expect(validLatLng(undefined, 1)).toBeNull();
    expect(validLatLng('', '')).toBeNull();
    expect(validLatLng(91, 0)).toBeNull();
    expect(validLatLng(0, 181)).toBeNull();
    expect(validLatLng('abc', 0)).toBeNull();
  });
});

describe('withDistance', () => {
  const listing = { id: 'l1', title: 'Drill', pin: { latitude: 12.295812, longitude: 76.639421 } };

  it('never passes the exact pin on - only ~1 km rounding', () => {
    const out = withDistance(listing, null);
    expect(out.pin).toBeUndefined();
    expect(out.latitude).toBe(12.3);
    expect(out.longitude).toBe(76.64);
    expect(out.distance_from_you_km).toBeUndefined();
  });

  it('adds the distance from the renter', () => {
    expect(withDistance(listing, bengaluru).distance_from_you_km).toBeGreaterThan(120);
  });

  it('handles the pin as a one-item array, and no pin at all', () => {
    expect(withDistance({ ...listing, pin: [listing.pin] }, null).latitude).toBe(12.3);
    const none = withDistance({ id: 'l2', pin: null }, bengaluru);
    expect(none.latitude).toBeNull();
    expect(none.distance_from_you_km).toBeUndefined();
  });
});

describe('withExactPin', () => {
  it('gives the owner the exact pin', () => {
    const out = withExactPin({ id: 'l1', pin: { latitude: 12.295812, longitude: 76.639421 } });
    expect(out).toEqual({ id: 'l1', latitude: 12.295812, longitude: 76.639421 });
  });
});

describe('pinChange', () => {
  it('reads set, clear, invalid and absent', () => {
    expect(pinChange({ title: 'x' })).toBeUndefined();
    expect(pinChange({ latitude: null, longitude: null })).toEqual({ clear: true });
    expect(pinChange({ latitude: 12, longitude: 76 })).toEqual({ point: { lat: 12, lng: 76 } });
    expect(pinChange({ latitude: 12 }).error).toBeTruthy();
  });
});

describe('savePin', () => {
  function fakeDb() {
    const calls = [];
    return {
      calls,
      from: (table) => ({
        upsert: async (row) => (calls.push(['upsert', table, row]), { error: null }),
        delete: () => ({ eq: async (c, v) => (calls.push(['delete', table, c, v]), { error: null }) }),
      }),
    };
  }

  it('upserts a new pin and deletes a cleared one', async () => {
    const db = fakeDb();
    await savePin(db, 'l1', { point: { lat: 12, lng: 76 } });
    await savePin(db, 'l1', { clear: true });
    await savePin(db, 'l1', undefined);
    expect(db.calls[0][0]).toBe('upsert');
    expect(db.calls[0][2]).toMatchObject({ listing_id: 'l1', latitude: 12, longitude: 76 });
    expect(db.calls[1]).toEqual(['delete', 'listing_locations', 'listing_id', 'l1']);
    expect(db.calls).toHaveLength(2);
  });
});

it('roundCoord keeps null as null', () => {
  expect(roundCoord(null)).toBeNull();
});
