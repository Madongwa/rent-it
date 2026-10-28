// Checks the text and number fields of a listing create/edit (routes/
// listings.js) - the database has no length limits of its own, so without
// this a listing could carry a megabyte-long title. Fields that aren't in
// the request are left alone. Returns { fields } (cleaned) or { error }.

const TEXT_LIMITS = { title: 120, description: 5000, location: 120, condition: 40, accessories_note: 500 };
const MAX_PRICE = 99999999.99; // numeric(10, 2)

export function validateListingFields(body, { creating = false } = {}) {
  const fields = {};

  for (const [field, max] of Object.entries(TEXT_LIMITS)) {
    if (!(field in body)) continue;
    const value = body[field];
    if (value === null || value === '') {
      if (field === 'title') return { error: 'Add a title.' };
      fields[field] = null;
      continue;
    }
    if (typeof value !== 'string') return { error: `${field} must be text` };
    const text = value.trim();
    if (text.length > max) return { error: `The ${field.replace('_', ' ')} can be at most ${max.toLocaleString('en-IN')} characters.` };
    if (field === 'title' && text.length < 3) return { error: 'Add a title of at least 3 characters.' };
    fields[field] = text || null;
  }
  if (creating && !fields.title) return { error: 'Add a title.' };

  const money = (field, { required = false } = {}) => {
    if (!(field in body)) return null;
    const raw = body[field];
    if ((raw === null || raw === '') && !required) {
      fields[field] = null;
      return null;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || (required && n <= 0)) return `Enter a valid ${field.replace(/_/g, ' ')}.`;
    if (n > MAX_PRICE) return `The ${field.replace(/_/g, ' ')} is too large.`;
    fields[field] = Math.round(n * 100) / 100;
    return null;
  };
  const moneyError =
    money('price_per_day', { required: true }) || money('price_per_week') || money('price_per_month') || money('deposit_amount');
  if (moneyError) return { error: moneyError };

  if ('distance_km' in body && body.distance_km !== null && body.distance_km !== '') {
    const km = Number(body.distance_km);
    if (!Number.isFinite(km) || km < 0 || km > 9999) return { error: 'Enter a valid distance.' };
    fields.distance_km = Math.round(km * 10) / 10;
  } else if ('distance_km' in body) {
    fields.distance_km = null;
  }

  return { fields };
}
