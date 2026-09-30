import { describe, it, expect } from 'vitest';
import { postedAgo, wantedBudget, wantedDates } from './wanted';

describe('wanted display helpers', () => {
  it('reads the dates plainly', () => {
    expect(wantedDates({ needed_from: '2026-10-05', needed_until: '2026-10-07' })).toBe('5 Oct - 7 Oct');
    expect(wantedDates({ needed_from: '2026-10-05', needed_until: '2026-10-05' })).toBe('5 Oct');
    expect(wantedDates({ needed_from: '2026-10-05' })).toBe('From 5 Oct');
    expect(wantedDates({ needed_until: '2026-10-07' })).toBe('Until 7 Oct');
    expect(wantedDates({})).toBe('');
  });

  it('shows the budget and age', () => {
    expect(wantedBudget({ max_price_per_day: 4000 })).toBe('Up to ₹4,000/day');
    expect(wantedBudget({})).toBe('');
    const now = Date.parse('2026-09-30T12:00:00Z');
    expect(postedAgo('2026-09-30T08:00:00Z', now)).toBe('today');
    expect(postedAgo('2026-09-29T08:00:00Z', now)).toBe('yesterday');
    expect(postedAgo('2026-09-25T08:00:00Z', now)).toBe('5 days ago');
  });
});
