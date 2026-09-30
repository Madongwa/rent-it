import { Router } from 'express';
import { timingSafeEqual } from 'crypto';
import { runSavedSearchAlerts } from '../lib/savedSearches.js';
import { runRentalReminders } from '../lib/reminders.js';

// Scheduled jobs. Vercel Cron calls GET /api/cron/daily once a day (see
// backend/vercel.json) with "Authorization: Bearer <CRON_SECRET>". Without
// CRON_SECRET set, the endpoint refuses everything - it must never be
// something anyone on the internet can trigger.
const router = Router();

export function authorized(header, secret) {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(String(header || ''));
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// Each job runs on its own - one failing doesn't stop the others.
export const DAILY_JOBS = {
  savedSearches: () => runSavedSearchAlerts(),
  rentalReminders: () => runRentalReminders(),
};

router.get('/daily', async (req, res) => {
  if (!authorized(req.headers.authorization, process.env.CRON_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const results = {};
  for (const [name, job] of Object.entries(DAILY_JOBS)) {
    try {
      results[name] = await job();
    } catch (err) {
      console.error(`[cron] ${name} failed:`, err.message);
      results[name] = { error: err.message };
    }
  }
  res.json({ ok: true, results });
});

export default router;
