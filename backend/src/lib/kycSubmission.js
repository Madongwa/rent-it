// Checks a seller verification submission (routes/kyc.js). The documents
// are uploaded by the browser first, so the request only names storage
// paths - each must be in the seller's own folder of the private
// kyc-documents bucket, or someone could submit another person's ID.

const MAX = { full_name: 100, phone: 20, address: 500 };

export function ownDocPath(path, userId) {
  return typeof path === 'string' && path.startsWith(`${userId}/`) && !path.includes('..') && path.length <= 300;
}

// { value } or { error }.
export function validateKycSubmission(userId, body = {}) {
  const text = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
  const fullName = text(body.full_name);
  const phone = text(body.phone);
  const address = text(body.address);
  const { id_document_url: front, id_document_back_url: back, address_proof_url: proof } = body;

  if (!fullName || !phone || !address || !front || !back) {
    return { error: 'full_name, phone, address, id_document_url and id_document_back_url are required' };
  }
  if (fullName.length > MAX.full_name) return { error: 'That name is too long.' };
  if (address.length > MAX.address) return { error: 'That address is too long.' };
  if (phone.length > MAX.phone || !/^\+?[\d\s-]{7,}$/.test(phone)) return { error: 'Enter a valid phone number.' };
  if (![front, back].every((p) => ownDocPath(p, userId)) || (proof && !ownDocPath(proof, userId))) {
    return { error: 'Upload the documents again.' };
  }
  return {
    value: {
      full_name: fullName,
      phone,
      address,
      id_document_url: front,
      id_document_back_url: back,
      address_proof_url: proof || null,
    },
  };
}
