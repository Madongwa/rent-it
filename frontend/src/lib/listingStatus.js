// Mirrors backend/src/lib/listingStatus.js: 'rented' only means the item is
// out with a renter today - it can still be requested for other dates.
export const BOOKABLE_STATUSES = ['available', 'rented'];

export const isBookable = (listing) => BOOKABLE_STATUSES.includes(listing?.status);

// The tag shown on cards and the listing page (nothing when available).
export function statusLabel(status) {
  if (status === 'rented') return 'Rented today';
  if (status === 'inactive') return 'Paused';
  return null;
}
