import { describe, it, expect } from 'vitest';
import { rentalDays, formatInr, priceDifference, findOpenOffer, whoseTurn } from './offers.js';

describe('rentalDays', () => {
  it('counts both the start and end day', () => {
    expect(rentalDays('2026-10-12', '2026-10-15')).toBe(4);
    expect(rentalDays('2026-10-12', '2026-10-12')).toBe(1);
  });

  it('is 0 until both dates are picked', () => {
    expect(rentalDays('2026-10-12', '')).toBe(0);
  });
});

describe('formatInr', () => {
  it('uses Indian digit grouping', () => {
    expect(formatInr(125000)).toBe('₹1,25,000');
  });
});

describe('priceDifference', () => {
  it('describes an offer below the listed price', () => {
    expect(priceDifference(450, 600)).toEqual({ tone: 'below', label: '₹150/day below listed' });
  });

  it('describes an offer above the listed price', () => {
    expect(priceDifference('650', '600')).toEqual({ tone: 'above', label: '₹50/day above listed' });
  });

  it('recognises an offer at the listed price', () => {
    expect(priceDifference(600, 600).tone).toBe('same');
  });

  it('returns null while the price is still empty', () => {
    expect(priceDifference('', 600)).toBeNull();
  });
});

describe('findOpenOffer / whoseTurn', () => {
  const rental = { renter_id: 'renter-1' };

  it("is the owner's turn after the renter's offer, and the renter's after a counter", () => {
    const offers = [
      { id: 'a', proposed_by: 'renter-1', status: 'countered' },
      { id: 'b', proposed_by: 'owner-1', status: 'open' },
    ];
    expect(findOpenOffer(offers).id).toBe('b');
    expect(whoseTurn(rental, findOpenOffer(offers))).toBe('renter');
    expect(whoseTurn(rental, { proposed_by: 'renter-1' })).toBe('owner');
  });

  it('falls back to the owner deciding when there is no open offer', () => {
    expect(findOpenOffer([])).toBeNull();
    expect(whoseTurn(rental, null)).toBe('owner');
  });
});
