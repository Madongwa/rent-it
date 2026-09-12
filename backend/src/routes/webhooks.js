// Inbound webhooks from third-party verification vendors. Currently just
// Digio - see services/idVerification.js for the outbound half of this
// integration.
//
// This route is INACTIVE until real Digio credentials exist and a webhook
// URL is registered in Digio's dashboard pointing at it - there is
// nothing for Digio to call yet. Scaffolded now so turning it on later is
// a credentials + URL-registration step, not a rewrite.
//
// Mounted in app.js with express.raw() BEFORE the global express.json()
// middleware, deliberately - signature verification needs the exact raw
// request bytes Digio signed, not a re-serialized JSON.parse(...) of them
// (whitespace/key-order differences would break the HMAC check).
import { Router } from 'express';
import crypto from 'crypto';
import { supabase } from '../lib/supabaseClient.js';

const router = Router();

// Generic HMAC-SHA256-over-the-raw-body check - the same shape most
// webhook providers (Razorpay, Stripe, etc.) use. NOT confirmed against
// Digio's actual current webhook signing scheme, since I don't have
// verified access to their current docs - confirm the header name and
// algorithm there once you have an account, and adjust this if they
// differ.
function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const givenBuf = Buffer.from(signatureHeader, 'utf8');
  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}

// POST /api/webhooks/digio
router.post('/digio', async (req, res) => {
  const secret = process.env.DIGIO_WEBHOOK_SECRET;
  if (!secret) {
    // Not configured - this integration isn't live. Reject rather than
    // silently accept (and trust) an unverifiable request body.
    return res.status(503).json({ error: 'Digio webhook not configured' });
  }

  const rawBody = req.body; // Buffer - see the express.raw() mount in app.js
  // TODO(digio): confirm the actual header name Digio sends the
  // signature in - this is a placeholder guess, not a confirmed value.
  const signature = req.headers['x-digio-signature'];

  if (!verifySignature(rawBody, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // TODO(digio): map these to Digio's actual webhook payload field names
  // once confirmed - `id` and `status` are placeholders, not verified.
  const providerReference = payload?.id;
  const outcome = payload?.status; // expected: something like 'approved' | 'rejected'

  if (!providerReference) {
    return res.status(400).json({ error: 'Missing verification reference in payload' });
  }

  const { data: submission, error: findError } = await supabase
    .from('kyc_submissions')
    .select('user_id')
    .eq('verification_provider_reference', providerReference)
    .maybeSingle();

  if (findError) return res.status(500).json({ error: findError.message });
  if (!submission) return res.status(404).json({ error: 'No submission matches that reference' });

  // Anything other than a clear approve/reject from the vendor lands in
  // the same staff queue as a manual submission, rather than guessing.
  const status = outcome === 'approved' ? 'approved' : outcome === 'rejected' ? 'rejected' : 'manual_review';

  const { error: updateError } = await supabase
    .from('kyc_submissions')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('user_id', submission.user_id);
  if (updateError) return res.status(500).json({ error: updateError.message });

  if (status === 'approved' || status === 'rejected') {
    await supabase.from('profiles').update({ seller_status: status }).eq('id', submission.user_id);
  }

  res.status(200).json({ received: true });
});

export default router;
