import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';
import { TERMS_VERSION } from '../lib/terms.js';
import { isSupportedLanguage } from '../lib/languages.js';
import { ownerTrust } from '../lib/trust.js';

const router = Router();

// GET /api/profiles/me
router.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, avatar_url, created_at, role, seller_status, terms_accepted_at, terms_version, preferred_language')
    .eq('id', req.user.id)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ...data, email: req.user.email, current_terms_version: TERMS_VERSION });
});

// POST /api/profiles/me/accept-terms - body: { version }. Records that this
// user ticked "I agree" on the current Terms of Service + Privacy Policy
// (the clickwrap in TermsGate.jsx): stamped on the profile, plus a row in
// terms_acceptances as the evidence trail. Only the current version can be
// accepted, so a stale tab can't record agreement to terms it never showed.
router.post('/me/accept-terms', requireAuth, async (req, res) => {
  if (req.body?.version !== TERMS_VERSION) {
    return res.status(409).json({ error: 'The terms have been updated - reload the page to review the latest version.' });
  }

  const acceptedAt = new Date().toISOString();
  const { error: logError } = await supabase.from('terms_acceptances').insert({
    user_id: req.user.id,
    terms_version: TERMS_VERSION,
    accepted_at: acceptedAt,
    user_agent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
  });
  if (logError) return res.status(500).json({ error: logError.message });

  const { data, error } = await supabase
    .from('profiles')
    .update({ terms_accepted_at: acceptedAt, terms_version: TERMS_VERSION })
    .eq('id', req.user.id)
    .select('terms_accepted_at, terms_version')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/profiles/:id - public storefront info only (no phone/email) -
// deliberately not behind requireAuth, and must come after the /me route
// above so "/me" doesn't get captured as an :id param.
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, created_at')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Profile not found' });
  let trust = null;
  try {
    trust = await ownerTrust(data.id);
  } catch (err) {
    console.error('[profiles] trust badges failed:', err.message);
  }
  res.json({ ...data, trust });
});

// PATCH /api/profiles/me
router.patch('/me', requireAuth, async (req, res) => {
  const { full_name, phone, avatar_url, preferred_language } = req.body;
  const updates = {};
  if (preferred_language !== undefined) {
    if (!isSupportedLanguage(preferred_language)) return res.status(400).json({ error: 'Unsupported language' });
    updates.preferred_language = preferred_language;
  }
  if (full_name !== undefined) updates.full_name = full_name;
  if (phone !== undefined) updates.phone = phone;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', req.user.id)
    .select('id, full_name, phone, avatar_url, created_at, preferred_language')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
