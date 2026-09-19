import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from './app.js';

describe('GET /api/health', () => {
  it('responds ok without hitting any auth/rate-limit middleware', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, service: 'rent-it-backend' });
  });
});

describe('security headers (helmet)', () => {
  it('sets baseline hardening headers on every response', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    // Deliberately relaxed for a JSON-only API meant to be fetched
    // cross-origin by the frontend - see the comment in app.js.
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});

describe('rate limiting', () => {
  it('advertises the configured limit on a normal request', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.headers['ratelimit-limit']).toBe('600');
    expect(Number(res.headers['ratelimit-remaining'])).toBeLessThan(600);
  });
});

describe('CORS', () => {
  it('allows a configured origin', async () => {
    const res = await request(app).get('/api/categories').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('does not echo back an unrecognized origin', async () => {
    const res = await request(app).get('/api/categories').set('Origin', 'https://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('auth-protected routes', () => {
  it('reject requests with no Authorization header, without touching Supabase', async () => {
    const res = await request(app).get('/api/rentals/mine');
    expect(res.status).toBe(401);
  });

  it('reject a malformed (non-Bearer) Authorization header', async () => {
    const res = await request(app).get('/api/rentals/mine').set('Authorization', 'Token abc123');
    expect(res.status).toBe(401);
  });
});
