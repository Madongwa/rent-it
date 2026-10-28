// Checks PATCH /api/profiles/me (routes/profiles.js). The name is what
// other people see on listings, chats and reviews, and it's what an ID is
// checked against - so it's validated, can't pose as Rent It staff, and
// is locked once the account is ID-verified (changing it would keep the
// "ID verified" badge for a name that was never checked).

export const IMPERSONATION = /\brent\s*-?\s*it\b|\bsupport\b|\bofficial\b/i;

// { updates } or { error, code }. `current` is the caller's profile row.
export function validateProfileUpdate(body = {}, current = {}, { idVerified = false } = {}) {
  const updates = {};

  if (body.full_name !== undefined) {
    const name = typeof body.full_name === 'string' ? body.full_name.trim().replace(/\s+/g, ' ') : '';
    if (!name) return { error: 'Enter your name.', code: 400 };
    if (name.length > 100) return { error: 'That name is too long.', code: 400 };
    if (name !== (current.full_name || '')) {
      if (IMPERSONATION.test(name)) return { error: "Names can't include \"Rent It\", \"support\" or \"official\".", code: 400 };
      if (idVerified) {
        return { error: 'Your name was checked against your ID, so it can’t be changed here - contact Rent It support.', code: 403 };
      }
      updates.full_name = name;
    }
  }

  if (body.phone !== undefined) {
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (phone && (phone.length > 20 || !/^\+?[\d\s-]{7,}$/.test(phone))) return { error: 'Enter a valid phone number.', code: 400 };
    updates.phone = phone || null;
  }

  if (body.email_notifications !== undefined) {
    if (typeof body.email_notifications !== 'boolean') return { error: 'email_notifications must be true or false', code: 400 };
    updates.email_notifications = body.email_notifications;
  }

  return { updates };
}
