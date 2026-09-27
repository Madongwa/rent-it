import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';

// Loaded lazily from Messages.jsx (Leaflet only downloads when someone
// actually opens this). Two ways to share a place: send where you are right
// now in one tap, or search / tap anywhere on the map to drop a pin - e.g.
// the gate a renter should come to for pickup.
//
// Map tiles and place search come from OpenStreetMap (tile.openstreetmap.org
// and Nominatim). Both are free public services with fair-use rules, so
// search only runs when the user presses Search, and reverse lookups are
// debounced - never on every keystroke or map drag.
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const INDIA_CENTER = [22.5, 79];

function shortName(displayName) {
  return (displayName || '').split(',').slice(0, 3).join(',').trim();
}

function geolocationError(err) {
  if (!navigator.geolocation) return "Your browser can't share its location.";
  if (err?.code === 1) return 'Location permission was denied - allow it in your browser settings, or pick a place on the map.';
  if (err?.code === 3) return 'Finding your location took too long - try again, or pick a place on the map.';
  return "Couldn't find your location - try again, or pick a place on the map.";
}

function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  });
}

export default function LocationPicker({ onSend, onClose }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const labelEdited = useRef(false);
  const [point, setPoint] = useState(null);
  const [label, setLabel] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(''); // 'current' | 'locate' | 'send'
  const [error, setError] = useState('');

  const placePin = useCallback((lat, lng, { zoom } = {}) => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    else {
      markerRef.current = L.circleMarker([lat, lng], {
        radius: 9,
        color: '#ffffff',
        weight: 3,
        fillColor: '#ef4444',
        fillOpacity: 1,
      }).addTo(map);
    }
    if (zoom) map.setView([lat, lng], zoom);
    labelEdited.current = false;
    setPoint({ lat, lng });
  }, []);

  useEffect(() => {
    const map = L.map(mapEl.current, { center: INDIA_CENTER, zoom: 4 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.on('click', (e) => placePin(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    // The panel may still be settling into its size on first paint.
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [placePin]);

  // Fill in a readable name for the dropped pin (unless the user has typed
  // their own), after the pin has stopped moving for a moment.
  useEffect(() => {
    if (!point) return undefined;
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=18&lat=${point.lat}&lon=${point.lng}`, {
        signal: controller.signal,
        headers: { 'Accept-Language': 'en' },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.display_name && !labelEdited.current) setLabel(shortName(data.display_name));
        })
        .catch(() => {});
    }, 800);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [point]);

  async function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError('');
    try {
      const r = await fetch(`${NOMINATIM}/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(q)}`, {
        headers: { 'Accept-Language': 'en' },
      });
      const data = r.ok ? await r.json() : [];
      setResults(data);
    } catch {
      setError("Search isn't available right now - tap the map to drop a pin instead.");
    } finally {
      setSearching(false);
    }
  }

  function chooseResult(result) {
    placePin(Number(result.lat), Number(result.lon), { zoom: 17 });
    labelEdited.current = true;
    setLabel(shortName(result.display_name));
    setResults(null);
  }

  async function sendCurrent() {
    setBusy('current');
    setError('');
    try {
      const here = await locate();
      await onSend({ ...here, label: 'My current location' });
    } catch (err) {
      // Geolocation failures carry a numeric code; anything else came from
      // sending the message.
      setError(typeof err?.code === 'number' || err?.message === 'unsupported' ? geolocationError(err) : err.message);
      setBusy('');
    }
  }

  async function showMe() {
    setBusy('locate');
    setError('');
    try {
      const here = await locate();
      placePin(here.lat, here.lng, { zoom: 17 });
    } catch (err) {
      setError(geolocationError(err));
    } finally {
      setBusy('');
    }
  }

  async function sendPinned() {
    if (!point) return;
    setBusy('send');
    setError('');
    try {
      await onSend({ ...point, label: label.trim() });
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-night-elevated" role="dialog" aria-label="Share a location">
      <div className="flex items-center justify-between border-b border-night-border/15 px-4 py-3">
        <h2 className="text-sm font-semibold text-night-text">Share a location</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-night-muted hover:bg-white/10 hover:text-night-text">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-3 border-b border-night-border/15 p-4">
        <button
          type="button"
          onClick={sendCurrent}
          disabled={!!busy}
          className="flex w-full items-center gap-3 rounded-card bg-emerald-600/20 px-3 py-2.5 text-left text-sm font-medium text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-60"
        >
          {busy === 'current' ? <Loader2 className="h-5 w-5 animate-spin" /> : <MapPin className="h-5 w-5" />}
          Send my current location
        </button>

        <form onSubmit={handleSearch} className="relative flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-night-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Or search for a place, area or landmark"
              aria-label="Search for a place"
              className="w-full rounded-full border border-night-border/20 bg-black/30 py-2 pl-9 pr-3 text-sm text-night-text placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <button type="submit" disabled={searching} className="shrink-0 rounded-full bg-white px-4 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60">
            {searching ? '…' : 'Search'}
          </button>
          {results && (
            <ul className="absolute left-0 right-0 top-11 z-[1100] max-h-60 overflow-y-auto rounded-card border border-night-border/20 bg-night-elevated shadow-xl">
              {results.length === 0 && <li className="px-3 py-2 text-sm text-night-muted">No places found.</li>}
              {results.map((r) => (
                <li key={r.place_id}>
                  <button type="button" onClick={() => chooseResult(r)} className="w-full px-3 py-2 text-left text-sm text-night-text hover:bg-white/5">
                    {r.display_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
      </div>

      <div className="relative min-h-[200px] flex-1">
        <div ref={mapEl} className="absolute inset-0" />
        <button
          type="button"
          onClick={showMe}
          disabled={!!busy}
          aria-label="Show my location on the map"
          className="absolute bottom-3 right-3 z-[1000] inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg disabled:opacity-60"
        >
          {busy === 'locate' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crosshair className="h-5 w-5" />}
        </button>
        {!point && (
          <p className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
            Tap the map to drop a pin
          </p>
        )}
      </div>

      <div className="space-y-2 border-t border-night-border/15 p-3">
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => {
              labelEdited.current = true;
              setLabel(e.target.value);
            }}
            maxLength={200}
            placeholder={point ? 'Name this place (e.g. "Main gate, Sector 21")' : 'Drop a pin first'}
            aria-label="Place name"
            disabled={!point}
            className="h-10 min-w-0 flex-1 rounded-full border border-night-border/20 bg-black/30 px-4 text-sm text-night-text placeholder:text-night-muted/60 focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
          />
          <button
            type="button"
            onClick={sendPinned}
            disabled={!point || !!busy}
            className="h-10 shrink-0 rounded-full bg-white px-4 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
          >
            {busy === 'send' ? 'Sending…' : 'Send pin'}
          </button>
        </div>
      </div>
    </div>
  );
}
