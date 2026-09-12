import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyIdentity } from '../services/idVerification.js';

const router = Router();

// GET /api/kyc/me - the caller's own submission (or null if none yet)
router.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('*')
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/kyc/submit - submit (or resubmit) seller verification documents.
// Documents are uploaded straight from the browser to the private
// kyc-documents bucket first (same pattern as listing image uploads), so
// this only ever receives the resulting storage URLs, never a file.
router.post('/submit', requireAuth, async (req, res) => {
  const { full_name, phone, address, id_document_url, address_proof_url } = req.body;

  if (!full_name || !phone || !address || !id_document_url) {
    return res.status(400).json({
      error: 'full_name, phone, address and id_document_url are required',
    });
  }

  // A fresh submission always resets from scratch - re-review even if a
  // previous submission was rejected or (in an edge case) already
  // approved and the seller is updating their details.
  //
  // verifyIdentity() is the only thing that decides manual vs. automated
  // here - with no DIGIO_API_KEY set it always returns the manual-review
  // result below, so this behaves exactly as before that function
  // existed. See services/idVerification.js.
  const verification = await verifyIdentity({
    userId: req.user.id,
    fullName: full_name,
    phone,
    address,
    idDocumentUrl: id_document_url,
    addressProofUrl: address_proof_url || null,
  });

  const { data, error } = await supabase
    .from('kyc_submissions')
    .upsert(
      {
        user_id: req.user.id,
        full_name,
        phone,
        address,
        id_document_url,
        address_proof_url: address_proof_url || null,
        status: verification.status,
        verification_method: verification.method,
        verification_provider_reference: verification.providerReference,
        rejection_reason: null,
        reviewed_by: null,
        reviewed_at: null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // profiles.seller_status only ever needs 'pending' here (both 'pending'
  // and 'manual_review' mean "not decided yet, can't list") - the finer
  // distinction lives on kyc_submissions.status for the staff dashboard.
  await supabase.from('profiles').update({ seller_status: 'pending' }).eq('id', req.user.id);

  res.status(201).json(data);
});

export default router;
