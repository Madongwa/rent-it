// Calendar dates for India (Rent It's users are all on IST).

// Today in India, as YYYY-MM-DD.
export function indiaToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

// A YYYY-MM-DD date n days later (or earlier, for negative n).
export const addDays = (iso, n) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// The moment an India date (YYYY-MM-DD) starts, as a Date.
export const indiaMidnight = (iso) => new Date(`${iso}T00:00:00+05:30`);

// The hour of the day (0-23) in India for a Date.
export const indiaHour = (date) => Math.floor(((date.getTime() + 5.5 * 60 * 60 * 1000) % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

// 0 = Monday ... 6 = Sunday, for an India date.
export const indiaWeekday = (iso) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
