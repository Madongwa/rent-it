import { describe, it, expect } from 'vitest';
import { describeIntent, intentToParams } from './searchIntent';

const intent = {
  q: 'auger or "post hole digger"',
  maxPrice: 1000,
  powerSource: ['petrol', 'diesel'],
  availability: ['week'],
  near: 'Mandya',
};

describe('intentToParams', () => {
  it('turns the filters into Marketplace URL parameters, keeping the sort', () => {
    expect(Object.fromEntries(intentToParams(intent, 'price_asc'))).toEqual({
      q: 'auger or "post hole digger"',
      maxPrice: '1000',
      powerSource: 'petrol,diesel',
      availability: 'week',
      near: 'Mandya',
      sort: 'price_asc',
    });
    expect(intentToParams({ category: 'farming' }, 'relevance').toString()).toBe('category=farming');
  });
});

describe('describeIntent', () => {
  it('reads as a short plain line', () => {
    expect(describeIntent(intent)).toBe('auger or post hole digger · under ₹1,000 a day · petrol or diesel · available this week · near Mandya');
    expect(describeIntent({ category: 'farming', minPrice: 200, maxPrice: 500, delivery: ['owner_delivers'] }, [{ slug: 'farming', name: 'Farming Tools' }])).toBe(
      'Farming Tools · ₹200-₹500 a day · delivered'
    );
  });
});
