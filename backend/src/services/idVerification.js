// Seller identity verification via Digio's ID Card OCR + Verification API
// (https://documentation.digio.in/digikyc/id_proof/api_integration/,
// confirmed against their live docs - not a guess). Falls back to the
// existing manual-review-by-staff flow whenever DIGIO_CLIENT_ID/
// DIGIO_CLIENT_SECRET aren't set, or if the API call itself fails for any
// reason - a broken/unconfigured automated path must never block someone
// from submitting.
//
// How it actually works: unlike a typical async "submit now, get a
// webhook later" eKYC flow, Digio's ID Card API is synchronous - you POST
// the front and back of the ID as a multipart upload and get OCR +
// (for PAN/Driving License/Voter ID) a real central-database verification
// result back in that same HTTP response. No webhook involved for this
// product, so there is nothing to register in Digio's dashboard beyond
// the API credentials themselves.
//
// Decision policy (deliberately conservative - see webhooks.js's original
// comment on this same principle): only auto-approve when Digio's own
// `verification_result.verified` comes back true, i.e. the ID was actually
// checked against a government database, not just OCR'd. Aadhaar doesn't
// support that central-database check through this API, so an Aadhaar
// submission can never auto-approve here - it always lands in
// 'manual_review', same as any PAN/DL/Voter ID submission that isn't
// cleanly verified. Nothing here ever produces 'rejected' automatically;
// a human makes that call.
import crypto from 'crypto';
import { supabase } from '../lib/supabaseClient.js';

const DIGIO_CLIENT_ID = process.env.DIGIO_CLIENT_ID;
const DIGIO_CLIENT_SECRET = process.env.DIGIO_CLIENT_SECRET;
// Sandbox by default - switch to https://api.digio.in once Digio has
// approved your account for production and you're ready for this to check
// real documents against real government databases.
const DIGIO_BASE_URL = process.env.DIGIO_BASE_URL || 'https://ext.digio.in:444';

export const verificationMode = DIGIO_CLIENT_ID && DIGIO_CLIENT_SECRET ? 'automated' : 'manual';

async function downloadKycDocument(path) {
  const { data, error } = await supabase.storage.from('kyc-documents').download(path);
  if (error) throw new Error(`Could not read ${path} from storage: ${error.message}`);
  return data; // a Blob - fetch()'s FormData accepts this directly
}

/**
 * @param {{ userId: string, fullName: string, phone: string, address: string, idDocumentFrontPath: string, idDocumentBackPath: string }} submission
 * @returns {Promise<{ method: 'manual'|'automated', status: 'pending'|'manual_review'|'approved', providerReference: string|null, details: object|null }>}
 */
export async function verifyIdentity(submission) {
  if (verificationMode === 'manual') {
    return { method: 'manual', status: 'pending', providerReference: null, details: null };
  }

  const requestId = crypto.randomUUID();

  try {
    const [front, back] = await Promise.all([
      downloadKycDocument(submission.idDocumentFrontPath),
      downloadKycDocument(submission.idDocumentBackPath),
    ]);

    const form = new FormData();
    form.append('front_part', front, 'front');
    form.append('back_part', back, 'back');
    form.append('unique_request_id', requestId);
    form.append('additional_request', JSON.stringify({ features: ['VERIFY'] }));

    const response = await fetch(`${DIGIO_BASE_URL}/v4/client/kyc/analyze/file/idcard`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${DIGIO_CLIENT_ID}:${DIGIO_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: form,
    });

    const data = await response.json();
    if (!response.ok || data?.details?.status === false) {
      throw new Error(data?.details?.error_message || `Digio returned ${response.status}`);
    }

    const detail = {
      id_type: data.detections?.[0]?.id_type || null,
      front_image_result: data.front_image_checks_result?.result ?? null,
      back_image_result: data.back_image_checks_result?.result ?? null,
      verified: data.verification_result?.verified ?? null,
    };

    const status = detail.verified === true ? 'approved' : 'manual_review';
    return { method: 'automated', status, providerReference: requestId, details: detail };
  } catch (err) {
    console.error('[idVerification] Automated check unavailable, falling back to manual review:', err.message);
    return { method: 'manual', status: 'pending', providerReference: requestId, details: { error: err.message } };
  }
}
