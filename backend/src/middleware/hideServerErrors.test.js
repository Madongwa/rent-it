import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { GENERIC_ERROR, hideServerErrors } from './hideServerErrors.js';

const app = express()
  .use('/api', hideServerErrors)
  .get('/api/boom', (_q, res) => res.status(500).json({ error: 'relation "rentals" violates constraint rentals_no_overlap' }))
  .get('/api/ai', (_q, res) => res.status(502).json({ error: 'The listing writer is busy right now.' }))
  .get('/api/maintenance', (_q, res) => res.status(503).json({ error: 'Down for maintenance', code: 'maintenance' }))
  .get('/api/admin/boom', (_q, res) => res.status(500).json({ error: 'raw detail' }))
  .get('/api/bad', (_q, res) => res.status(400).json({ error: 'title is required' }));

describe('hideServerErrors', () => {
  it('replaces raw 500 errors with a plain message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/boom');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe(GENERIC_ERROR);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('leaves AI, maintenance, staff and 4xx messages alone', async () => {
    expect((await request(app).get('/api/ai')).body.error).toMatch(/busy/);
    expect((await request(app).get('/api/maintenance')).body).toEqual({ error: 'Down for maintenance', code: 'maintenance' });
    expect((await request(app).get('/api/admin/boom')).body.error).toBe('raw detail');
    expect((await request(app).get('/api/bad')).body.error).toBe('title is required');
  });
});
