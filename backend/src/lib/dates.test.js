import { describe, it, expect } from 'vitest';
import { addDays, indiaHour, indiaMidnight, indiaToday, indiaWeekday } from './dates.js';

describe('India dates', () => {
  it('knows the India date late at night UTC', () => {
    expect(indiaToday(new Date('2026-10-03T19:00:00Z'))).toBe('2026-10-04');
    expect(indiaToday(new Date('2026-10-03T18:00:00Z'))).toBe('2026-10-03');
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });

  it('finds midnight, the hour and the weekday in India', () => {
    expect(indiaMidnight('2026-10-03').toISOString()).toBe('2026-10-02T18:30:00.000Z');
    expect(indiaHour(new Date('2026-10-03T20:00:00Z'))).toBe(1);
    expect(indiaHour(new Date('2026-10-03T00:00:00Z'))).toBe(5);
    expect(indiaWeekday('2026-10-05')).toBe(0); // Monday
    expect(indiaWeekday('2026-10-04')).toBe(6); // Sunday
  });
});
