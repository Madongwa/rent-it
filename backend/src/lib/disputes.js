import { addDays } from './dates.js';

// When a rental's problem can be reported ("Report a problem"): while it's
// agreed, and for a week after its end date even if it was marked complete -
// so an owner can't mark it complete to stop a renter reporting (say, a
// deposit not returned). Agreed rentals are auto-completed at the end of
// that same week (lib/autoComplete.js).
export const DISPUTE_WINDOW_DAYS = 7;
export const MAX_DISPUTE_REASON = 2000;

// null if it can be reported today, else why not.
export function disputeError(rental, today) {
  if (rental.status === 'approved') return null;
  if (rental.status === 'completed') {
    if (today <= addDays(rental.end_date, DISPUTE_WINDOW_DAYS)) return null;
    return `It's more than ${DISPUTE_WINDOW_DAYS} days since this rental ended, so it can't be reported here any more - please contact Rent It support.`;
  }
  return `Cannot dispute a "${rental.status}" rental`;
}
