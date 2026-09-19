// Inbound webhooks from third parties. Digio's ID Card Verification API
// (see services/idVerification.js) turned out to be synchronous - the
// result comes back in the same HTTP response, no callback involved - so
// there's no Digio webhook here despite what an earlier version of this
// file assumed. Razorpay's payment webhook below is the real one.
//
// Mounted in app.js with express.raw() BEFORE the global express.json()
// middleware, deliberately - signature verification needs the exact raw
// request bytes the sender signed, which a re-serialized JSON.parse(...)
// of them can't guarantee byte-for-byte (whitespace/key-order differences
// would break the HMAC check).
import { Router } from 'express';
import crypto from 'crypto';
import { recordRentalPayment } from '../lib/recordPayment.js';

const router = Router();

// Generic HMAC-SHA256-over-the-raw-body check - the shape Razorpay (and
// most webhook providers) use.
function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const givenBuf = Buffer.from(signatureHeader, 'utf8');
  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}

// POST /api/webhooks/razorpay - fallback path for recording a payment: the
// frontend's own POST /api/rentals/:id/verify-payment (rentals.js) is the
// primary path and fires the instant a checkout succeeds, but if the
// renter's tab closes/crashes before that call completes, this webhook
// still lands the payment. recordRentalPayment() upserts on rental_id, so
// whichever of the two gets there first wins and the other is a no-op.
// Razorpay's signature scheme (HMAC-SHA256 over the raw body, header
// `x-razorpay-signature`) is the documented, stable one - unlike the Digio
// guess above, this isn't a placeholder.
router.post('/razorpay', async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'Razorpay webhook not configured' });

  const rawBody = req.body; // Buffer - see the express.raw() mount in app.js
  const signature = req.headers['x-razorpay-signature'];

  if (!verifySignature(rawBody, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (payload?.event !== 'payment.captured') {
    // Not an event this app acts on (e.g. payment.failed, order.paid,
    // refund.*) - acknowledge so Razorpay doesn't keep retrying it.
    return res.status(200).json({ received: true });
  }

  const payment = payload?.payload?.payment?.entity;
  const rentalId = payment?.notes?.rental_id;
  if (!rentalId || !payment?.order_id || !payment?.id) {
    return res.status(400).json({ error: 'Missing rental_id/order_id/payment_id in webhook payload' });
  }

  try {
    await recordRentalPayment({ rentalId, razorpayOrderId: payment.order_id, razorpayPaymentId: payment.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  res.status(200).json({ received: true });
});

export default router;
