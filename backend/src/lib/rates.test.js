import { describe, it, expect } from 'vitest';
import { effectiveDailyRate, rentalDays } from './rates.js';

const listing = { price_per_day: 1000, price_per_week: 5600, price_per_month: 18000 };

describe('rentalDays', () => {
  it('counts both ends', () => {
    expect(rentalDays('2026-10-01', '2026-10-01')).toBe(1);
    expect(rentalDays('2026-10-01', '2026-10-07')).toBe(7);
  });
});

describe('effectiveDailyRate', () => {
  it('uses the daily price for short rentals', () => {
    expect(effectiveDailyRate(listing, 6)).toEqual({ rate: 1000, basis: 'day' });
  });

  it('uses the weekly price from 7 days and the monthly from 30', () => {
    expect(effectiveDailyRate(listing, 7)).toEqual({ rate: 800, basis: 'week' });
    expect(effectiveDailyRate(listing, 29)).toEqual({ rate: 800, basis: 'week' });
    expect(effectiveDailyRate(listing, 30)).toEqual({ rate: 600, basis: 'month' });
  });

  it('never makes a long rental dearer, and ignores prices that are not set', () => {
    expect(effectiveDailyRate({ price_per_day: 500, price_per_week: 7000 }, 10)).toEqual({ rate: 500, basis: 'day' });
    expect(effectiveDailyRate({ price_per_day: 500, price_per_week: null, price_per_month: 0 }, 40)).toEqual({ rate: 500, basis: 'day' });
  });
});
