// Pickup and return condition photos are the evidence when something goes
// wrong, so once added they can't be removed or swapped: each update must
// keep every photo already there. Photos can only be added while the rental
// is agreed ('approved') - never after it's completed, cancelled or
// disputed - and pickup photos lock once return photos exist. Every path
// must be in this rental's own folder of the rental-photos bucket.

export const MAX_PHOTOS_PER_STAGE = 12;

// { paths } (cleaned, in order) or { error }.
export function checkPhotoUpdate(rental, stage, photoPaths) {
  if (!['pickup', 'return'].includes(stage) || !Array.isArray(photoPaths)) {
    return { error: 'stage ("pickup"|"return") and photo_urls (array) are required' };
  }
  if (rental.status !== 'approved') {
    return { error: 'Photos are locked once a rental is completed, cancelled or a problem is reported.' };
  }
  if (stage === 'pickup' && (rental.return_photo_urls || []).length) {
    return { error: 'Pickup photos are locked once return photos have been added.' };
  }
  const paths = [...new Set(photoPaths)];
  const valid = (p) => typeof p === 'string' && p.startsWith(`${rental.id}/`) && !p.includes('..') && p.length <= 300;
  if (!paths.every(valid)) return { error: 'Upload the photos again.' };
  if (paths.length > MAX_PHOTOS_PER_STAGE) return { error: `Up to ${MAX_PHOTOS_PER_STAGE} photos each for pickup and return.` };
  const existing = (stage === 'pickup' ? rental.pickup_photo_urls : rental.return_photo_urls) || [];
  if (!existing.every((p) => paths.includes(p))) return { error: "Photos already added can't be removed." };
  return { paths };
}
