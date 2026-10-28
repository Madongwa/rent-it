import { supabase } from './supabaseClient.js';

// Maintenance mode (Staff -> Settings): the site goes read-only for
// everyone but staff. Browsing and anything that only reads or helps people
// find things keeps working; anything that changes data is refused with a
// clear message, so nothing half-saves while staff fix something.

const CACHE_MS = 30 * 1000;
let cached = { value: false, at: 0 };

export async function isMaintenanceMode({ db = supabase, now = Date.now() } = {}) {
  if (now - cached.at < CACHE_MS) return cached.value;
  const { data, error } = await db.from('platform_settings').select('maintenance_mode').eq('id', 1).maybeSingle();
  // If the setting can't be read, stay open rather than lock everyone out.
  cached = { value: error ? false : !!data?.maintenance_mode, at: now };
  return cached.value;
}

// Staff just changed it - don't wait out the cache on this instance.
export function setMaintenanceCache(value, now = Date.now()) {
  cached = { value: !!value, at: now };
}

// Requests that only read or help people find things, even though they're
// POSTs (paths are relative to /api).
const READ_LIKE = [
  /^\/chat\/?$/,
  /^\/translate\//,
  /^\/listings\/(search-intent|alternatives|voice-search)\/?$/,
  /^\/messages\/conversations\/[^/]+\/read\/?$/,
  /^\/profiles\/me\/accept-terms\/?$/, // or the terms screen would block browsing
];

export function changesData(method, path) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return false;
  if (path.startsWith('/admin') || path.startsWith('/cron')) return false; // staff-only / scheduled
  return !READ_LIKE.some((re) => re.test(path));
}

export const MAINTENANCE_ERROR = 'Rent It is down for maintenance right now - you can browse, but changes are paused. Please try again soon.';

// Express middleware for /api. Staff can still make changes.
export function maintenanceGuard({ check = isMaintenanceMode, isStaff } = {}) {
  return async (req, res, next) => {
    try {
      if (!changesData(req.method, req.path) || !(await check())) return next();
      if (isStaff && (await isStaff(req))) return next();
      return res.status(503).json({ error: MAINTENANCE_ERROR, code: 'maintenance' });
    } catch (err) {
      next(err);
    }
  };
}
