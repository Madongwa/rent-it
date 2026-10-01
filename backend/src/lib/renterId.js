import { supabase } from './supabaseClient.js';
import { checkIdPhotos } from './idCheck.js';
import { notify } from './notify.js';

// Renter ID verification. A renter adds one government ID - asked for once
// a deal is agreed, or up front for listings whose owner chose "Only
// ID-verified renters". Any of five IDs is accepted, so nobody is forced to
// use Aadhaar; Aadhaar only in its masked form (last 4 digits), because
// businesses shouldn't hold full Aadhaar numbers.
//
// The photo stays in the private kyc-documents bucket. Owners never see it -
// only a yes/no "ID verified". To avoid days of waiting, a clear AI check
// (Groq only, lib/idCheck.js) verifies straight away; a full Aadhaar number
// is refused and the photo deleted at once; anything unclear goes to staff.
// Approved sellers already passed a stronger check, so they count too.

export const ID_TYPES = ['aadhaar', 'driving_licence', 'voter_id', 'pan', 'passport'];
const BUCKET = 'kyc-documents';

export const isIdVerified = (profile) =>
  !!profile && (profile.renter_id_status === 'verified' || profile.seller_status === 'approved');

// What the AI check means for a renter's ID.
export function decide(result) {
  if (!result) return { status: 'pending' };
  if (result.aadhaar_number_visible) {
    return {
      status: 'rejected',
      deleteFile: true,
      reason: 'Your full Aadhaar number was visible. Please upload the masked Aadhaar (it shows only the last 4 digits) - download it free from myaadhaar.uidai.gov.in - or use another ID.',
    };
  }
  if (result.looks_like_id === 'no') {
    return { status: 'rejected', reason: "That doesn't look like an ID document - please upload a clear photo of your ID." };
  }
  if (result.looks_like_id === 'yes' && result.readable === 'yes' && result.name_match === 'match') return { status: 'verified' };
  return { status: 'pending' }; // unclear - a person looks at it
}

async function setProfileStatus(db, userId, status) {
  const { error } = await db.from('profiles').update({ renter_id_status: status }).eq('id', userId);
  if (error) throw new Error(error.message);
}

// { status, reason? } or { error, code }.
export async function submitRenterId(userId, { id_type: idType, document_path: path }, { db = supabase, check = checkIdPhotos } = {}) {
  if (!ID_TYPES.includes(idType)) return { error: 'Pick which ID this is.', code: 400 };
  if (typeof path !== 'string' || !path.startsWith(`${userId}/`) || path.includes('..') || path.length > 300) {
    return { error: 'Upload the photo again.', code: 400 };
  }
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('full_name, renter_id_status, seller_status')
    .eq('id', userId)
    .single();
  if (profileError) throw new Error(profileError.message);
  if (isIdVerified(profile)) return { status: 'verified' };

  const { error: fileError } = await db.storage.from(BUCKET).createSignedUrl(path, 60);
  if (fileError) return { error: 'The photo upload was not found - please try again.', code: 400 };

  let ai = null;
  try {
    const out = await check([path], profile.full_name, { db });
    ai = out.result || null;
  } catch (err) {
    console.error('[renter-id] AI check failed:', err.message);
  }
  const verdict = decide(ai);

  if (verdict.deleteFile) await db.storage.from(BUCKET).remove([path]);
  const row = {
    user_id: userId,
    id_type: idType,
    document_path: verdict.deleteFile ? null : path,
    status: verdict.status,
    method: verdict.status === 'pending' ? null : 'ai',
    ai_result: ai,
    rejection_reason: verdict.reason || null,
    reviewed_by: null,
    reviewed_at: verdict.status === 'pending' ? null : new Date().toISOString(),
    submitted_at: new Date().toISOString(),
  };
  const { error } = await db.from('renter_verifications').upsert(row);
  if (error) throw new Error(error.message);
  await setProfileStatus(db, userId, verdict.status);
  return { status: verdict.status, reason: verdict.reason };
}

export async function myRenterId(userId, { db = supabase } = {}) {
  const [{ data: profile }, { data: row }] = await Promise.all([
    db.from('profiles').select('renter_id_status, seller_status').eq('id', userId).single(),
    db.from('renter_verifications').select('id_type, status, rejection_reason, submitted_at').eq('user_id', userId).maybeSingle(),
  ]);
  return {
    verified: isIdVerified(profile),
    via_seller: profile?.seller_status === 'approved',
    status: profile?.renter_id_status || 'none',
    id_type: row?.id_type || null,
    rejection_reason: row?.rejection_reason || null,
    submitted_at: row?.submitted_at || null,
  };
}

// Staff: verify, reject (with a reason) or revoke.
export async function reviewRenterId(userId, action, adminId, reason, { db = supabase, notifyFn = notify } = {}) {
  if (!['verify', 'reject'].includes(action)) return { error: 'action must be verify or reject', code: 400 };
  if (action === 'reject' && !String(reason || '').trim()) return { error: 'Give a reason the renter will see.', code: 400 };
  const status = action === 'verify' ? 'verified' : 'rejected';
  const { data, error } = await db
    .from('renter_verifications')
    .update({ status, method: 'staff', reviewed_by: adminId, reviewed_at: new Date().toISOString(), rejection_reason: status === 'rejected' ? String(reason).trim().slice(0, 300) : null })
    .eq('user_id', userId)
    .select('user_id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { error: 'Not found', code: 404 };
  await setProfileStatus(db, userId, status);
  await notifyFn({
    userId,
    type: 'renter_id',
    title: status === 'verified' ? 'Your ID is verified' : 'Your ID needs another look',
    body: status === 'verified' ? 'Owners now see you as an ID-verified renter.' : String(reason).trim().slice(0, 140),
    link: '/verify-id',
  });
  return { status };
}
