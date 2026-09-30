// One-off (safe to re-run): gives every listing that has no map pin yet a
// pin at the centre of the town in its "location" text (e.g. "Mysuru,
// Karnataka"), so existing listings show up on the Marketplace map and in
// "Nearby". Owners can move the pin to the exact spot on Edit listing.
//
// Uses OpenStreetMap's free Nominatim geocoder: one lookup per distinct town,
// one per second (its fair-use rule). Listings it can't place are listed at
// the end and simply stay off the map.
//
// Usage: cd backend && node scripts/pin-listings-from-towns.js

import { supabase } from '../src/lib/supabaseClient.js';
import { savePin, validLatLng } from '../src/lib/geo.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(place) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(place)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'RentIt/1.0 (renthere.in)', 'Accept-Language': 'en' } });
  if (!res.ok) return null;
  const [hit] = await res.json();
  return hit ? validLatLng(hit.lat, hit.lon) : null;
}

async function main() {
  const { data: listings, error } = await supabase.from('listings').select('id, title, location');
  if (error) throw new Error(error.message);
  const { data: pinned, error: pinError } = await supabase.from('listing_locations').select('listing_id');
  if (pinError) throw new Error(`${pinError.message} - run node scripts/run-migration.js first.`);

  const done = new Set(pinned.map((p) => p.listing_id));
  const todo = listings.filter((l) => !done.has(l.id) && l.location?.trim());
  console.log(`${todo.length} listing(s) to pin (${done.size} already pinned).`);

  const towns = new Map();
  const failed = [];
  for (const l of todo) {
    const town = l.location.trim();
    if (!towns.has(town)) {
      towns.set(town, await geocode(town));
      await wait(1100);
    }
    const point = towns.get(town);
    if (!point) {
      failed.push(`${l.title} (${town})`);
      continue;
    }
    await savePin(supabase, l.id, { point });
    console.log(`  ${l.title} -> ${town} (${point.lat.toFixed(3)}, ${point.lng.toFixed(3)})`);
  }

  if (failed.length) console.log(`\nCouldn't place:\n  ${failed.join('\n  ')}`);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
