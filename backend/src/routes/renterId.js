import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { myRenterId, submitRenterId } from '../lib/renterId.js';

// Renter ID verification (lib/renterId.js).
const router = Router();

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many tries - please wait an hour and try again.' },
});

// GET /api/renter-id/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    res.json(await myRenterId(req.user.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/renter-id - body: { id_type, document_path } (the photo is
// uploaded first, straight to the private kyc-documents bucket).
router.post('/', requireAuth, submitLimiter, async (req, res) => {
  try {
    const out = await submitRenterId(req.user.id, req.body || {});
    if (out.error) return res.status(out.code).json({ error: out.error });
    res.json(out);
  } catch (err) {
    console.error('[renter-id] submit failed:', err.message);
    res.status(500).json({ error: 'Could not check your ID right now - please try again.' });
  }
});

export default router;
