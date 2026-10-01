import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../lib/supabaseClient.js';

// POST /api/auth/signup - instant accounts. The account is created already
// confirmed (Supabase admin API), so people can log in straight away
// instead of waiting for a confirmation email - Supabase's built-in mailer
// is too limited to rely on. The browser then logs in with the same email
// and password. Listing still needs seller verification, so an unverified
// email address can't do much harm; a strict limit keeps out bulk sign-ups.
const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 6; // same as the sign-up form

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-ups from this network - please try again in an hour.' },
});

// { value } or { error }.
export function validateSignup(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim().replace(/\s+/g, ' ') : '';
  if (!fullName) return { error: 'Full name is required.' };
  if (fullName.length > 100) return { error: 'That name is too long.' };
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: 'Enter a valid email address.' };
  if (password.length < MIN_PASSWORD_LENGTH) return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  if (password.length > 72) return { error: 'Password must be at most 72 characters.' };
  return { value: { email, password, fullName } };
}

router.post('/signup', signupLimiter, async (req, res) => {
  const { value, error: invalid } = validateSignup(req.body);
  if (invalid) return res.status(400).json({ error: invalid });

  const { error } = await supabase.auth.admin.createUser({
    email: value.email,
    password: value.password,
    email_confirm: true,
    user_metadata: { full_name: value.fullName },
  });
  if (error) {
    if (error.status === 422 || /already (been )?registered|already exists/i.test(error.message)) {
      return res.status(409).json({ error: 'An account with this email already exists - log in instead.' });
    }
    if (/password/i.test(error.message)) return res.status(400).json({ error: error.message });
    console.error('[auth] sign-up failed:', error.message);
    return res.status(500).json({ error: 'Could not create the account right now - please try again.' });
  }
  res.status(201).json({ ok: true });
});

export default router;
