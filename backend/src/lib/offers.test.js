import { describe, it, expect } from 'vitest';
import { parseOfferTerms, rentalDays, describeTerms, whoseTurn } from './offers.js';

describe('parseOfferTerms', () => {
  const valid = { price_per_day: '450', start_date: '2026-10-12', end_date: '2026-10-15' };

  it('accepts valid terms and coerces the price to a number', () => {
    expect(parseOfferTerms(valid)).toEqual({
      terms: { price_per_day: 450, start_date: '2026-10-12', end_date: '2026-10-15' },
    });
  });

  it('rounds the price to paise', () => {
    expect(parseOfferTerms({ ...valid, price_per_day: 99.999 }).terms.price_per_day).toBe(100);
  });

  it('rejects a missing, zero, negative or non-numeric price', () => {
    for (const price_per_day of [undefined, '', 0, -5, 'abc']) {
      expect(parseOfferTerms({ ...valid, price_per_day }).error).toBeTruthy();
    }
  });

  it('rejects a price too large for the database column', () => {
    expect(parseOfferTerms({ ...valid, price_per_day: 1e9 }).error).toMatch(/too large/);
  });

  it('rejects missing, malformed, impossible or reversed dates', () => {
    expect(parseOfferTerms({ ...valid, start_date: undefined }).error).toBeTruthy();
    expect(parseOfferTerms({ ...valid, start_date: '12/10/2026' }).error).toMatch(/YYYY-MM-DD/);
    expect(parseOfferTerms({ ...valid, end_date: '2026-02-30' }).error).toMatch(/YYYY-MM-DD/);
    expect(parseOfferTerms({ ...valid, end_date: '2026-10-11' }).error).toMatch(/on or after/);
  });

  it('allows a same-day rental', () => {
    expect(parseOfferTerms({ ...valid, end_date: valid.start_date }).terms).toBeTruthy();
  });
});

describe('rentalDays', () => {
  it('counts both the start and end day', () => {
    expect(rentalDays('2026-10-12', '2026-10-15')).toBe(4);
    expect(rentalDays('2026-10-12', '2026-10-12')).toBe(1);
  });

  it('is not thrown off by month boundaries', () => {
    expect(rentalDays('2026-10-30', '2026-11-02')).toBe(4);
  });
});

describe('describeTerms', () => {
  const terms = { price_per_day: 450, start_date: '2026-10-12', end_date: '2026-10-15' };

  it('shows the offered price, the listed price, the dates and the total', () => {
    expect(describeTerms(terms, 600)).toBe('₹450/day (listed ₹600) for 12 Oct → 15 Oct (4 days, total ₹1,800)');
  });

  it('leaves out the listed price when the offer matches it', () => {
    expect(describeTerms(terms, 450)).toBe('₹450/day for 12 Oct → 15 Oct (4 days, total ₹1,800)');
  });

  it('uses the singular for a one-day rental', () => {
    expect(describeTerms({ ...terms, end_date: '2026-10-12' }, 600)).toMatch(/\(1 day, total ₹450\)/);
  });
});

describe('whoseTurn', () => {
  const rental = { renter_id: 'renter-1' };

  it("is the owner's turn after the renter's offer", () => {
    expect(whoseTurn(rental, { proposed_by: 'renter-1' })).toBe('owner');
  });

  it("is the renter's turn after the owner's counter-offer", () => {
    expect(whoseTurn(rental, { proposed_by: 'owner-1' })).toBe('renter');
  });

  it('falls back to the owner deciding when there is no open offer', () => {
    expect(whoseTurn(rental, null)).toBe('owner');
  });
});
