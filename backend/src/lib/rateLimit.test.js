import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { SupabaseStore, sharedRateLimit } from './rateLimit.js';

vi.mock('./supabaseClient.js', () => ({ supabase: null }));

// Stand-in for the rate_limit_hit function: one shared count per key.
function fakeDb({ fail = false } = {}) {
  const counts = {};
  return {
    counts,
    rpc: async (_fn, { p_key }) => {
      if (fail) return { error: { message: 'database down' } };
      counts[p_key] = (counts[p_key] || 0) + 1;
      return { data: [{ hits: counts[p_key], reset_at: '2026-10-03T10:00:00Z' }], error: null };
    },
  };
}

describe('SupabaseStore', () => {
  it('counts per limit name and key', async () => {
    const db = fakeDb();
    const store = new SupabaseStore('signup', db);
    store.init({ windowMs: 1000 });
    expect((await store.increment('1.2.3.4')).totalHits).toBe(1);
    expect((await store.increment('1.2.3.4')).totalHits).toBe(2);
    expect(db.counts).toEqual({ 'signup:1.2.3.4': 2 });
  });
});

describe('sharedRateLimit', () => {
  const app = (db) =>
    express().use(sharedRateLimit('test', { windowMs: 60_000, max: 2, message: { error: 'slow down' } }, { db, shared: true })).get('/', (_q, r) => r.send('ok'));

  it('limits across instances sharing one count', async () => {
    const db = fakeDb();
    const a = app(db);
    const b = app(db); // a second server instance
    expect((await request(a).get('/')).status).toBe(200);
    expect((await request(b).get('/')).status).toBe(200);
    expect((await request(a).get('/')).status).toBe(429);
  });

  it('lets requests through if the database is down', async () => {
    expect((await request(app(fakeDb({ fail: true }))).get('/')).status).toBe(200);
  });
});
