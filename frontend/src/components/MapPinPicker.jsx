import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Loader2, Search, Trash2 } from 'lucide-react';

// "Pin on map" on the listing form. Loaded lazily from ListingForm. The
// owner taps where the item is kept, searches a place, or uses their current
// location. The exact pin is private to the owner: renters only ever see it
// rounded to ~1 km (backend lib/geo.js), and it powers "near me" search and
// the Marketplace map. Place search uses OpenStreetMap's Nominatim, only when
// Search is pressed (its fair-use rules).
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const INDIA_CENTER = [22.5, 79];

export default function MapPinPicker({ value, onChange, placeHint }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [query, setQuery] = useState(placeHint || '');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const has = value?.latitude != null && value?.longitude != null;

  useEffect(() => {
    const start = has ? [value.latitude, value.longitude] : INDIA_CENTER;
    const map = L.map(mapEl.current, { center: start, zoom: has ? 15 : 4 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.on('click', (e) => onChangeRef.current({ latitude: e.latlng.lat, longitude: e.latlng.lng }));
    mapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is built once; the pin below follows `value`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!has) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const pos = [value.latitude, value.longitude];
    if (markerRef.current) markerRef.current.setLatLng(pos);
    else {
      markerRef.current = L.circleMarker(pos, { radius: 9, color: '#ffffff', weight: 3, fillColor: '#ef4444', fillOpacity: 1 }).addTo(map);
    }
  }, [has, value?.latitude, value?.longitude]);

  function moveTo(lat, lng) {
    onChange({ latitude: lat, longitude: lng });
    mapRef.current?.setView([lat, lng], 16);
  }

  async function search(e) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setBusy('search');
    setError('');
    try {
      const r = await fetch(`${NOMINATIM}/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(q)}`, {
        headers: { 'Accept-Language': 'en' },
      });
      setResults(r.ok ? await r.json() : []);
    } catch {
      setError("Search isn't available right now - tap the map instead.");
    } finally {
      setBusy('');
    }
  }

  function useCurrent() {
    if (!navigator.geolocation) {
      setError("Your browser can't share its location - tap the map instead.");
      return;
    }
    setBusy('locate');
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        moveTo(pos.coords.latitude, pos.coords.longitude);
        setBusy('');
      },
      () => {
        setError("Couldn't find your location - tap the map instead.");
        setBusy('');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  return (
    <div className="space-y-2">
      {/* Not a <form>: this sits inside the listing form. */}
      <div className="relative flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-night-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search(e)}
            placeholder="Search a village, area or landmark"
            aria-label="Search for a place"
            className="w-full rounded-btn border border-night-border/20 bg-black/20 py-2 pl-9 pr-3 text-sm text-night-text placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <button type="button" onClick={search} disabled={!!busy} className="shrink-0 rounded-btn bg-white px-3 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60">
          {busy === 'search' ? '…' : 'Search'}
        </button>
        {results && (
          <ul className="absolute left-0 right-0 top-11 z-[1100] max-h-60 overflow-y-auto rounded-card border border-night-border/20 bg-night-elevated shadow-xl">
            {results.length === 0 && <li className="px-3 py-2 text-sm text-night-muted">No places found.</li>}
            {results.map((r) => (
              <li key={r.place_id}>
                <button
                  type="button"
                  onClick={() => {
                    moveTo(Number(r.lat), Number(r.lon));
                    setResults(null);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-night-text hover:bg-white/5"
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative h-64 overflow-hidden rounded-card border border-night-border/20">
        <div ref={mapEl} className="absolute inset-0" />
        <button
          type="button"
          onClick={useCurrent}
          disabled={!!busy}
          aria-label="Use my current location"
          className="absolute bottom-3 right-3 z-[1000] inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg disabled:opacity-60"
        >
          {busy === 'locate' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crosshair className="h-5 w-5" />}
        </button>
        {!has && (
          <p className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
            Tap where the item is kept
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-night-muted">
        <span>Renters only see the area (about 1 km), never the exact spot.</span>
        {has && (
          <button type="button" onClick={() => onChange({ latitude: null, longitude: null })} className="inline-flex items-center gap-1 text-red-400 hover:underline">
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove pin
          </button>
        )}
      </div>
    </div>
  );
}
