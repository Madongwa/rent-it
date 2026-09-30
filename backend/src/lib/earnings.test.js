import { describe, it, expect, vi } from 'vitest';
import { lastMonths, summarise } from './earnings.js';

vi.mock('./supabaseClient.js', () => ({ supabase: null }));

const tractor = { id: 't', title: 'Tractor' };
const drill = { id: 'd', title: 'Drill' };

describe('earnings', () => {
  it('lists the last 12 months, oldest first', () => {
    const m = lastMonths('2026-09-30');
    expect(m).toHaveLength(12);
    expect(m[0]).toBe('2025-10');
    expect(m[11]).toBe('2026-09');
  });

  it('adds up agreed rent: earned, upcoming, by month and by item', () => {
    const out = summarise(
      [
        { status: 'completed', start_date: '2026-08-01', end_date: '2026-08-03', price_per_day: '1000', listing: tractor },
        { status: 'approved', start_date: '2026-09-10', end_date: '2026-09-11', price_per_day: '500', listing: drill }, // over, not marked
        { status: 'approved', start_date: '2026-10-05', end_date: '2026-10-06', price_per_day: '1200', listing: tractor }, // upcoming
      ],
      '2026-09-30'
    );
    expect(out).toMatchObject({ earned: 4000, upcoming: 2400, deals: 3, completed: 1, busiest_month: '2026-08' });
    expect(out.top_listing).toEqual({ id: 't', title: 'Tractor', rentals: 2, amount: 5400 });
    expect(out.months.find((m) => m.month === '2026-08').amount).toBe(3000);
    // October is next month - outside the last-12-months chart.
    expect(out.months.some((m) => m.month === '2026-10')).toBe(false);
  });

  it('handles an owner with no deals yet', () => {
    expect(summarise([], '2026-09-30')).toMatchObject({ earned: 0, upcoming: 0, deals: 0, top_listing: null, busiest_month: null });
  });
});
