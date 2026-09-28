import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { listingPriceCheck, suggestPrice } from '../lib/pricing.js';

const router = Router();

// Each suggestion is an AI call - kept well below the free-tier limits.
const suggestRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many price suggestions - please wait a minute and try again.' },
});

// Mostly served from price_insights, so more generous.
const checkRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests - please wait a moment.' },
});

const UNAVAILABLE = 'Price suggestions are unavailable right now - please try again in a minute.';

// POST /api/pricing/suggest - body: { title, category_id, condition?,
// location?, description?, listing_id? }. For the listing form: a price
// suggestion for an item that may not be saved yet. listing_id (when
// editing) keeps the listing from being compared with itself.
router.post('/suggest', requireAuth, suggestRateLimiter, async (req, res) => {
  const { title, category_id, condition, location, description, listing_id } = req.body || {};
  if (typeof title !== 'string' || title.trim().length < 3) {
    return res.status(400).json({ error: 'Add a title first, so there is something to price.' });
  }
  if (!Number.isInteger(Number(category_id))) return res.status(400).json({ error: 'Choose a category first.' });

  try {
    const result = await suggestPrice({
      title: title.trim().slice(0, 200),
      categoryId: Number(category_id),
      condition: typeof condition === 'string' ? condition.slice(0, 40) : undefined,
      location: typeof location === 'string' ? location.slice(0, 120) : undefined,
      description: typeof description === 'string' ? description : undefined,
      excludeListingId: typeof listing_id === 'string' ? listing_id : undefined,
    });
    if (!result) return res.status(502).json({ error: UNAVAILABLE });
    res.json(result);
  } catch (err) {
    console.error('[pricing] suggest failed:', err.message);
    res.status(502).json({ error: UNAVAILABLE });
  }
});

// GET /api/pricing/listing/:id - the price check shown while making or
// countering an offer. Public data only (other listings' prices), so no
// login needed - the listing page's offer form shows it to everyone.
router.get('/listing/:id', checkRateLimiter, async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid listing id' });
  try {
    const result = await listingPriceCheck(req.params.id);
    if (result === undefined) return res.status(404).json({ error: 'Listing not found' });
    if (!result) return res.status(502).json({ error: UNAVAILABLE });
    res.json(result);
  } catch (err) {
    console.error('[pricing] listing check failed:', err.message);
    res.status(502).json({ error: UNAVAILABLE });
  }
});

export default router;
