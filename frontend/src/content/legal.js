// Shared details for the Terms of Service, Privacy Policy and the
// accept-the-terms gate (TermsGate.jsx).
//
// TERMS_VERSION must match backend/src/lib/terms.js. Bumping it asks every
// user - guests and account holders - to accept again, so only change it
// when the Terms or Privacy Policy change materially.
export const TERMS_VERSION = '2026-09-27';
export const LEGAL_LAST_UPDATED = '30 September 2026';

// FILL THESE IN before relying on the Terms in production. They're left as
// visible, highlighted placeholders rather than guessed, because the legal
// entity, its address, the Grievance Officer (required by India's IT Rules,
// 2021 and Consumer Protection (E-Commerce) Rules, 2020) and the courts /
// arbitration seat are facts only the business can supply. Anything still
// starting with "[" is shown highlighted on the Terms and Privacy pages.
export const COMPANY = {
  brand: 'Rent It',
  website: 'renthere.in',
  legalName: '[Registered legal name of the business that operates Rent It]',
  entityType: '[type of entity, e.g. private limited company / LLP / sole proprietorship]',
  address: '[Registered office address]',
  supportEmail: '[support email address]',
  grievanceOfficer: '[Name of the Grievance Officer]',
  grievanceEmail: '[Grievance Officer email address]',
  grievancePhone: '[Grievance Officer phone number]',
  grievanceHours: '[working days and hours, e.g. Monday–Friday, 10:00–18:00 IST]',
  jurisdictionCity: '[City]',
  arbitrationSeat: '[City]',
};

export function isPlaceholder(value) {
  return typeof value === 'string' && value.startsWith('[');
}
