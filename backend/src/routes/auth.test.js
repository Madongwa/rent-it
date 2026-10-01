import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const createUser = vi.fn();
vi.mock('../lib/supabaseClient.js', () => ({ supabase: { auth: { admin: { createUser: (...a) => createUser(...a) } } } }));

const { default: authRouter, validateSignup } = await import('./auth.js');
const app = express().use(express.json()).use('/api/auth', authRouter);

beforeEach(() => createUser.mockReset());

describe('validateSignup', () => {
  it('cleans the input', () => {
    expect(validateSignup({ email: ' Asha@Example.com ', password: 'secret1', full_name: '  Asha   Rao ' })).toEqual({
      value: { email: 'asha@example.com', password: 'secret1', fullName: 'Asha Rao' },
    });
  });
  it('refuses missing or bad fields', () => {
    expect(validateSignup({ email: 'a@b.co', password: 'secret1' }).error).toMatch(/name/);
    expect(validateSignup({ email: 'nope', password: 'secret1', full_name: 'A' }).error).toMatch(/email/);
    expect(validateSignup({ email: 'a@b.co', password: '123', full_name: 'A' }).error).toMatch(/6 characters/);
  });
});

describe('POST /api/auth/signup', () => {
  it('creates the account already confirmed - no email to wait for', async () => {
    createUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const res = await request(app).post('/api/auth/signup').send({ email: 'asha@example.com', password: 'secret1', full_name: 'Asha Rao' });
    expect(res.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith({
      email: 'asha@example.com',
      password: 'secret1',
      email_confirm: true,
      user_metadata: { full_name: 'Asha Rao' },
    });
  });

  it('says so when the email is taken', async () => {
    createUser.mockResolvedValue({ data: null, error: { status: 422, message: 'A user with this email address has already been registered' } });
    const res = await request(app).post('/api/auth/signup').send({ email: 'asha@example.com', password: 'secret1', full_name: 'Asha Rao' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/log in instead/);
  });

  it('rejects bad input without calling Supabase', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'x', password: '1', full_name: '' });
    expect(res.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });
});
