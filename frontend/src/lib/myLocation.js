// The renter's own location for "near me" search. Rounded to 2 decimal
// places (~1 km) before it leaves the browser, only ever sent to our own
// backend to work out distances (never stored there), and remembered only
// for this browser tab - never put in the page URL, so shared links don't
// carry it.

const KEY = 'rentit.myLocation';

export const round2 = (n) => Math.round(Number(n) * 100) / 100;

export function savedLocation() {
  try {
    const raw = sessionStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) ? v : null;
  } catch {
    return null;
  }
}

export function forgetLocation() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // storage blocked - nothing to forget
  }
}

export function locationError(err) {
  if (err?.code === 1) return 'Location permission was denied - allow it in your browser settings to see what is near you.';
  if (err?.code === 3) return 'Finding your location took too long - please try again.';
  if (err?.message === 'unsupported') return "Your browser can't share its location.";
  return "Couldn't find your location - please try again.";
}

export function locateMe() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: round2(pos.coords.latitude), lng: round2(pos.coords.longitude) };
        try {
          sessionStorage.setItem(KEY, JSON.stringify(here));
        } catch {
          // storage blocked - still works for this page view
        }
        resolve(here);
      },
      reject,
      // Rough is fine: it's rounded to ~1 km anyway.
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

export function formatKm(km) {
  if (km == null) return '';
  if (km < 1) return 'Under 1 km away';
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}
