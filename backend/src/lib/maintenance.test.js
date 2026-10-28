import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { changesData, isMaintenanceMode, maintenanceGuard, setMaintenanceCache } from './maintenance.js';

vi.mock('./supabaseClient.js', () => ({ supabase: null }));

describe('changesData', () => {
  it('lets reads and read-like POSTs through', () => {
    expect(changesData('GET', '/listings')).toBe(false);
    expect(changesData('POST', '/chat')).toBe(false);
    expect(changesData('POST', '/translate/ui')).toBe(false);
    expect(changesData('POST', '/listings/search-intent')).toBe(false);
    expect(changesData('POST', '/messages/conversations/abc/read')).toBe(false);
    expect(changesData('POST', '/profiles/me/accept-terms')).toBe(false);
    expect(changesData('PATCH', '/admin/settings')).toBe(false);
  });

  it('counts anything else as a change', () => {
    expect(changesData('POST', '/rentals')).toBe(true);
    expect(changesData('POST', '/messages/conversations/abc/messages')).toBe(true);
    expect(changesData('PATCH', '/listings/l1')).toBe(true);
    expect(changesData('DELETE', '/listings/l1')).toBe(true);
    expect(changesData('POST', '/auth/signup')).toBe(true);
  });
});

describe('maintenanceGuard', () => {
  const app = (on, staff = false) =>
    express()
      .use('/api', maintenanceGuard({ check: async () => on, isStaff: async () => staff }))
      .use('/api', (_req, res) => res.json({ ok: true }));

  it('refuses changes while on, for everyone but staff', async () => {
    const res = await request(app(true)).post('/api/rentals');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('maintenance');
    expect((await request(app(true, true)).post('/api/rentals')).status).toBe(200);
  });

  it('lets browsing through while on, and everything while off', async () => {
    expect((await request(app(true)).get('/api/listings')).status).toBe(200);
    expect((await request(app(false)).post('/api/rentals')).status).toBe(200);
  });
});

describe('isMaintenanceMode', () => {
  const db = (value, error = null) => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { maintenance_mode: value }, error }) }) }) }),
  });

  it('reads the setting, caching it for 30 seconds', async () => {
    setMaintenanceCache(false, 0);
    expect(await isMaintenanceMode({ db: db(true), now: 60_000 })).toBe(true);
    expect(await isMaintenanceMode({ db: db(false), now: 70_000 })).toBe(true); // cached
    expect(await isMaintenanceMode({ db: db(false), now: 100_000 })).toBe(false);
  });

  it('stays open if the setting can not be read', async () => {
    setMaintenanceCache(true, 0);
    expect(await isMaintenanceMode({ db: db(true, { message: 'down' }), now: 60_000 })).toBe(false);
  });
});
