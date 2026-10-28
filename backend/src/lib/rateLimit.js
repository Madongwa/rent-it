import rateLimit from 'express-rate-limit';
import { supabase } from './supabaseClient.js';

// Rate limits shared by every server instance. On Vercel each instance
// keeps its own in-memory count, so "5 sign-ups an hour" was really 5 per
// instance. The limits that matter (sign-up, AI features, ID checks) count
// in the rate_limits table instead (rate_limit_hit in schema.sql). If the
// database can't be reached the request is let through (passOnStoreError)
// rather than blocking everyone. Tests use the in-memory store.

export class SupabaseStore {
  constructor(prefix, db = supabase) {
    this.prefix = `${prefix}:`;
    this.db = db;
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const { data, error } = await this.db.rpc('rate_limit_hit', { p_key: this.prefix + key, p_window_ms: this.windowMs });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return { totalHits: row.hits, resetTime: new Date(row.reset_at) };
  }

  // Only used by options this app doesn't set (e.g. skipSuccessfulRequests).
  async decrement() {}

  async resetKey(key) {
    await this.db.from('rate_limits').delete().eq('key', this.prefix + key);
  }
}

// rateLimit() with the shared store. `name` keeps each limit's counts apart.
export function sharedRateLimit(name, options, { db = supabase, shared = !process.env.VITEST } = {}) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    ...options,
    ...(shared ? { store: new SupabaseStore(name, db), passOnStoreError: true } : {}),
  });
}

// Daily (routes/cron.js): drop windows that ended over a day ago.
export async function pruneRateLimits({ db = supabase } = {}) {
  const { error, count } = await db
    .from('rate_limits')
    .delete({ count: 'exact' })
    .lt('reset_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if (error) throw new Error(error.message);
  return { deleted: count || 0 };
}
