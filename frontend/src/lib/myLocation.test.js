import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatKm, forgetLocation, locateMe, round2, savedLocation } from './myLocation';

describe('myLocation', () => {
  beforeEach(() => sessionStorage.clear());

  it('rounds to ~1 km before anything leaves the browser', async () => {
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition: (ok) => ok({ coords: { latitude: 12.295812, longitude: 76.639421 } }) },
    });
    expect(await locateMe()).toEqual({ lat: 12.3, lng: 76.64 });
    expect(savedLocation()).toEqual({ lat: 12.3, lng: 76.64 });
    forgetLocation();
    expect(savedLocation()).toBeNull();
    vi.unstubAllGlobals();
  });

  it('ignores junk in storage', () => {
    sessionStorage.setItem('rentit.myLocation', '{"lat":"x"}');
    expect(savedLocation()).toBeNull();
  });

  it('formats distances', () => {
    expect(round2(1.23456)).toBe(1.23);
    expect(formatKm(0.4)).toBe('Under 1 km away');
    expect(formatKm(3.24)).toBe('3.2 km away');
    expect(formatKm(42.6)).toBe('43 km away');
    expect(formatKm(null)).toBe('');
  });
});
