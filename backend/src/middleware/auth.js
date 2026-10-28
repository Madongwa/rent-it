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

// Like requireAuth, but also checks the caller's profile has role='admin'.
// Must run after requireAuth (relies on req.user being set) - mounted as
// [requireAuth, requireAdmin] on admin-only routes.
export async function requireAdmin(req, res, next) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (error || data?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

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

// Is this request from a signed-in staff member? For checks outside the
// admin routes (e.g. maintenance mode letting staff keep working).
export async function isStaffRequest(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return false;
  const { data } = await supabase.auth.getUser(token);
  if (!data?.user) return false;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  return profile?.role === 'admin';
}
