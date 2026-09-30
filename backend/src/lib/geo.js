// Distances for "near me" search and the Marketplace map.
//
// Privacy: a listing's exact pin (often the owner's home) lives in the
// backend-only listing_locations table and is only ever used on the server
// to work out distances. Anything sent to other people is rounded to 2
// decimal places - about 1 km - and the renter's own location arrives
// already rounded the same way and is never stored.

const EARTH_KM = 6371;
const rad = (deg) => (deg * Math.PI) / 180;

// Embed this in a listings select to get the pin: `${...}, ${PIN_SELECT}`.
export const PIN_SELECT = 'pin:listing_locations(latitude, longitude)';

// Great-circle distance in km.
export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

export function validLatLng(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  return lat !== undefined && lat !== null && lat !== '' && lng !== undefined && lng !== null && lng !== '' &&
    Number.isFinite(la) && Number.isFinite(ln) && la >= -90 && la <= 90 && ln >= -180 && ln <= 180
    ? { lat: la, lng: ln }
    : null;
}

export const roundCoord = (n) => (n == null ? null : Math.round(Number(n) * 100) / 100);

// The embedded pin comes back as an object (one-to-one) or, depending on how
// PostgREST reads the relationship, a one-item array.
function pinOf(listing) {
  const pin = Array.isArray(listing.pin) ? listing.pin[0] : listing.pin;
  return pin ? validLatLng(pin.latitude, pin.longitude) : null;
}

// For everyone but the owner: the pin rounded to ~1 km, plus
// distance_from_you_km (1 decimal) when there's an origin.
export function withDistance(listing, origin) {
  const point = pinOf(listing);
  const { pin, ...rest } = listing;
  const out = { ...rest, latitude: roundCoord(point?.lat), longitude: roundCoord(point?.lng) };
  if (origin && point) out.distance_from_you_km = Math.round(haversineKm(origin, point) * 10) / 10;
  return out;
}

// For the owner only (editing their own listing): the exact pin.
export function withExactPin(listing) {
  const point = pinOf(listing);
  const { pin, ...rest } = listing;
  return { ...rest, latitude: point?.lat ?? null, longitude: point?.lng ?? null };
}

// Reads a pin change from a create/update body: undefined when the body
// doesn't mention one, { clear: true } for "remove the pin", { point } for a
// new pin, or { error } when it's not a real place.
export function pinChange(body) {
  if (!body || (!('latitude' in body) && !('longitude' in body))) return undefined;
  if (body.latitude == null && body.longitude == null) return { clear: true };
  const point = validLatLng(body.latitude, body.longitude);
  return point ? { point } : { error: 'The map pin is not a valid location.' };
}

export async function savePin(db, listingId, change) {
  if (!change || change.error) return;
  const { error } = change.clear
    ? await db.from('listing_locations').delete().eq('listing_id', listingId)
    : await db.from('listing_locations').upsert({
        listing_id: listingId,
        latitude: change.point.lat,
        longitude: change.point.lng,
        updated_at: new Date().toISOString(),
      });
  if (error) throw new Error(error.message);
}
