import { describe, it, expect } from 'vitest';
import { disputeError } from './disputes.js';

const today = '2026-10-10';

describe('disputeError', () => {
  it('allows an agreed rental', () => {
    expect(disputeError({ status: 'approved', end_date: '2026-12-01' }, today)).toBeNull();
  });

  it('allows a completed rental for a week after its end date', () => {
    expect(disputeError({ status: 'completed', end_date: '2026-10-03' }, today)).toBeNull();
    expect(disputeError({ status: 'completed', end_date: '2026-10-20' }, today)).toBeNull(); // marked complete early
    expect(disputeError({ status: 'completed', end_date: '2026-10-02' }, today)).toMatch(/more than 7 days/);
  });

  it('refuses other statuses', () => {
    for (const status of ['pending', 'rejected', 'cancelled', 'disputed']) {
      expect(disputeError({ status, end_date: today }, today)).toMatch(/Cannot dispute/);
    }
  });
});
