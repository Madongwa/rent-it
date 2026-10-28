import { describe, it, expect } from 'vitest';
import { validateListingFields } from './listingFields.js';

describe('validateListingFields', () => {
  it('cleans a normal listing', () => {
    expect(validateListingFields({ title: '  Power tiller ', price_per_day: '450', price_per_week: '', description: 'Works well.' }, { creating: true }).fields).toEqual({
      title: 'Power tiller',
      description: 'Works well.',
      price_per_day: 450,
      price_per_week: null,
    });
  });

  it('refuses over-long text and a missing title', () => {
    expect(validateListingFields({ title: 'x'.repeat(121) }).error).toMatch(/at most 120/);
    expect(validateListingFields({ title: 'Drill', description: 'x'.repeat(5001) }).error).toMatch(/description/);
    expect(validateListingFields({ price_per_day: 100 }, { creating: true }).error).toMatch(/title/);
    expect(validateListingFields({ title: '' }).error).toMatch(/title/);
    expect(validateListingFields({ title: { a: 1 } }).error).toMatch(/text/);
  });

  it('checks prices and distance', () => {
    expect(validateListingFields({ price_per_day: 0 }).error).toMatch(/price per day/);
    expect(validateListingFields({ price_per_day: 'abc' }).error).toBeTruthy();
    expect(validateListingFields({ deposit_amount: -5 }).error).toMatch(/deposit/);
    expect(validateListingFields({ price_per_month: 1e9 }).error).toMatch(/too large/);
    expect(validateListingFields({ distance_km: 12345 }).error).toMatch(/distance/);
    expect(validateListingFields({ distance_km: '' }).fields).toEqual({ distance_km: null });
  });

  it('leaves fields that are not in the request alone', () => {
    expect(validateListingFields({ status: 'inactive' }).fields).toEqual({});
  });
});
