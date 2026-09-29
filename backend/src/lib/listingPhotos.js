// Photos: up to MAX_PHOTOS in image_urls, the first being the cover. The
// cover is also kept in image_url, which cards, sharing previews and older
// code read - so a listing that only ever had one photo keeps working, and
// a client that still sends just image_url gets it as a one-photo gallery.
const MAX_PHOTOS = 8;
export function normalizePhotos(body) {
  if (Array.isArray(body.image_urls)) {
    const urls = [...new Set(body.image_urls.filter((u) => typeof u === 'string' && /^https?:\/\//.test(u) && u.length <= 1000))].slice(0, MAX_PHOTOS);
    return { image_urls: urls, image_url: urls[0] || null };
  }
  if ('image_url' in body) {
    const url = typeof body.image_url === 'string' && body.image_url ? body.image_url : null;
    return { image_url: url, image_urls: url ? [url] : [] };
  }
  return {};
}
