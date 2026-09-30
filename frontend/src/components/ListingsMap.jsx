import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatKm } from '../lib/myLocation';

// The Marketplace's Map view. Loaded lazily (Leaflet only downloads when
// someone switches to the map). Pins are the ~1 km-rounded locations the
// API sends, so they show the area, never an owner's exact address. Tiles
// come from OpenStreetMap, like the chat's location picker.
const INDIA_CENTER = [22.5, 79];

function popupContent(listing, onOpen) {
  const box = document.createElement('div');
  box.className = 'min-w-[160px] text-sm';
  const title = document.createElement('p');
  title.className = 'font-semibold';
  title.textContent = listing.title;
  const meta = document.createElement('p');
  meta.textContent = [
    `₹${Number(listing.price_per_day).toLocaleString('en-IN')}/day`,
    listing.location,
    formatKm(listing.distance_from_you_km),
  ].filter(Boolean).join(' · ');
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'mt-1 font-medium text-emerald-700 underline';
  open.textContent = 'View listing';
  open.addEventListener('click', () => onOpen(listing.id));
  box.append(title, meta, open);
  return box;
}

export default function ListingsMap({ listings, me, onOpen }) {
  const el = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    const map = L.map(el.current, { center: INDIA_CENTER, zoom: 5 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds = [];

    // Several listings can share one rounded spot (same town) - nudge them
    // apart slightly so each pin can be tapped.
    const seen = new Map();
    for (const l of listings) {
      if (l.latitude == null || l.longitude == null) continue;
      const key = `${l.latitude},${l.longitude}`;
      const n = seen.get(key) || 0;
      seen.set(key, n + 1);
      const angle = n * 2.4;
      const r = n ? 0.004 * Math.sqrt(n) : 0;
      const pos = [l.latitude + r * Math.sin(angle), l.longitude + r * Math.cos(angle)];
      L.circleMarker(pos, { radius: 8, color: '#ffffff', weight: 2, fillColor: '#10b981', fillOpacity: 0.95 })
        .bindPopup(popupContent(l, onOpen))
        .addTo(layer);
      bounds.push(pos);
    }

    if (me) {
      L.circleMarker([me.lat, me.lng], { radius: 7, color: '#ffffff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 })
        .bindTooltip('You (approximate)')
        .addTo(layer);
      bounds.push([me.lat, me.lng]);
    }

    if (bounds.length === 1) map.setView(bounds[0], 12);
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
  }, [listings, me, onOpen]);

  const unmapped = listings.filter((l) => l.latitude == null || l.longitude == null).length;

  return (
    <div>
      <div ref={el} className="h-[65vh] min-h-[360px] w-full overflow-hidden rounded-card border border-night-border/20" />
      <p className="mt-2 text-xs text-night-muted">
        Pins show the area (about 1 km), not the owner's exact address.
        {unmapped > 0 && ` ${unmapped} matching listing${unmapped === 1 ? " isn't" : "s aren't"} on the map yet - switch to List to see ${unmapped === 1 ? 'it' : 'them'}.`}
      </p>
    </div>
  );
}
