// Calendar dates for India (Rent It's users are all on IST).

// Today in India, as YYYY-MM-DD.
export function indiaToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

// A YYYY-MM-DD date n days later (or earlier, for negative n).
export const addDays = (iso, n) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
