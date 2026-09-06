import { supabase } from '../lib/supabaseClient.js';

// Verifies the Supabase access token sent by the frontend
// (Authorization: Bearer <token>) and attaches the user to req.user.
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.user = data.user;
  next();
}

// Like requireAuth, but does not fail the request when no/invalid token is
// present - just leaves req.user undefined. Useful for routes that are
// public but behave slightly differently for a logged-in user.
export async function attachUserIfPresent(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    const { data } = await supabase.auth.getUser(token);
    if (data?.user) req.user = data.user;
  }

  next();
}
