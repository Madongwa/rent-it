// Seller identity verification, structured so an automated eKYC vendor
// (Digio) can be switched on later purely by setting an env var - nothing
// in kyc.js (the caller) needs to change either way.
//
// Today, with no DIGIO_API_KEY set, every submission falls back to the
// existing manual-review-by-staff flow, unchanged from before this file
// existed. That fallback is real and tested. The automated branch below
// is NOT a working Digio integration - it's a stub. I don't have a
// verified, current copy of Digio's API docs (exact endpoint URLs,
// request/response field names), so rather than invent a request shape
// that looks plausible but might be wrong, the actual HTTP call is left
// as a clearly marked TODO. Once you have a Digio account, their docs
// will give you the real endpoint and payload shape - drop that call in
// where marked, and this whole module goes live with no other changes
// needed anywhere else in the codebase.
//
// Kept intentionally provider-agnostic in its public shape (a plain
// verifyIdentity() function returning { method, status, providerReference
// }) so swapping Digio for Karza or anything else later means rewriting
// the inside of this one function, not touching kyc.js, the schema, the
// admin dashboard, or the webhook route.

const DIGIO_API_KEY = process.env.DIGIO_API_KEY;

// 'manual'    - staff review the uploaded documents by hand (today's only
//               real path).
// 'automated' - a vendor API is doing the check (once DIGIO_API_KEY is
//               set - not implemented yet, see verifyIdentity below).
export const verificationMode = DIGIO_API_KEY ? 'automated' : 'manual';

/**
 * @param {{ userId: string, fullName: string, phone: string, address: string, idDocumentUrl: string, addressProofUrl: string|null }} submission
 * @returns {Promise<{ method: 'manual'|'automated', status: 'pending'|'manual_review', providerReference: string|null }>}
 *
 * The returned status is always non-final. 'approved'/'rejected' only
 * ever get set afterwards, either by a human via
 * POST /api/admin/kyc/:userId/approve|reject, or (once the automated path
 * is actually implemented) by Digio's callback hitting
 * POST /api/webhooks/digio.
 */
export async function verifyIdentity(submission) {
  if (verificationMode === 'manual') {
    return { method: 'manual', status: 'pending', providerReference: null };
  }

  try {
    // TODO(digio): replace this block with the real Digio eKYC request
    // once you have API credentials and current docs. The shape below is
    // a guess at how async eKYC vendors generally work (create a
    // verification request, get back a reference id, wait for their
    // webhook) - it is NOT confirmed against Digio's actual API and must
    // not be trusted as-is.
    //
    //   const response = await fetch('https://api.digio.in/v2/client/kyc/request', {
    //     method: 'POST',
    //     headers: {
    //       Authorization: `Basic ${Buffer.from(`${DIGIO_API_KEY}:`).toString('base64')}`,
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //       customer_identifier: submission.phone,
    //       customer_name: submission.fullName,
    //       // ...whatever fields Digio's real API actually wants
    //     }),
    //   });
    //   if (!response.ok) throw new Error(`Digio request failed: ${response.status}`);
    //   const data = await response.json();
    //   return { method: 'automated', status: 'manual_review', providerReference: data.id };

    throw new Error('DIGIO_API_KEY is set, but the Digio API call itself is not implemented yet.');
  } catch (err) {
    // Never let a broken/unimplemented automated path block someone from
    // submitting - fall back to the manual queue exactly as if
    // DIGIO_API_KEY had never been set.
    console.error('[idVerification] Automated check unavailable, falling back to manual review:', err.message);
    return { method: 'manual', status: 'pending', providerReference: null };
  }
}
