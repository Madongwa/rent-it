// Photos: up to MAX_PHOTOS in image_urls, the first being the cover. The
// cover is also kept in image_url, which cards, sharing previews and older
// code read - so a listing that only ever had one photo keeps working, and
// a client that still sends just image_url gets it as a one-photo gallery.
//
// A photo must be one the owner uploaded to their own folder of our
// listing-images bucket - not any link on the web, which could track
// everyone who views the listing. Photos already on the listing (older
// sample listings use outside links) are kept when it's edited.
const MAX_PHOTOS = 8;

export function isOwnListingPhoto(url, ownerId, supabaseUrl = process.env.SUPABASE_URL) {
  if (typeof url !== 'string' || !ownerId || !supabaseUrl || url.length > 1000 || url.includes('..')) return false;
  return url.startsWith(`${supabaseUrl}/storage/v1/object/public/listing-images/${ownerId}/`);
}

// { ownerId, existing: urls already on the listing, supabaseUrl }
export function normalizePhotos(body, { ownerId, existing = [], supabaseUrl = process.env.SUPABASE_URL } = {}) {
  const allowed = (u) => typeof u === 'string' && (existing.includes(u) || isOwnListingPhoto(u, ownerId, supabaseUrl));
  if (Array.isArray(body.image_urls)) {
    const urls = [...new Set(body.image_urls.filter(allowed))].slice(0, MAX_PHOTOS);
    return { image_urls: urls, image_url: urls[0] || null };
  }
  if ('image_url' in body) {
    const url = allowed(body.image_url) ? body.image_url : null;
    return { image_url: url, image_urls: url ? [url] : [] };
  }
  return {};
}
