import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import ListingCard from '../components/ListingCard';

// ListingCard is built for the dark glassmorphism treatment used on
// Marketplace (its translucent fill + backdrop-blur wash out on a light
// background - see the Marketplace card redesign) - so this page reuses
// that same dark wrapper rather than the light canvas most other pages use.
export default function Favorites() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getFavorites()
      .then(setListings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // No shared useFavorites() state needed here - every listing on this page
  // is, by definition, already a favorite, so "toggling" one only ever
  // means removing it (and dropping it from the visible list immediately).
  async function handleRemove(listingId) {
    setListings((prev) => prev.filter((l) => l.id !== listingId));
    try {
      await api.removeFavorite(listingId);
    } catch {
      // Put it back if the request failed.
      api.getFavorites().then(setListings).catch(() => {});
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-night-bg text-night-text">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="text-heading-sm text-night-text">Your favorites</h1>
        <p className="mt-1 text-body text-night-muted">Equipment you've saved to come back to later.</p>

        <div className="mt-8">
          {loading && <div className="py-16 text-center text-night-muted">Loading…</div>}
          {error && <div className="py-16 text-center text-red-400">{error}</div>}
          {!loading && !error && listings.length === 0 && (
            <div className="py-16 text-center text-night-muted">
              Nothing saved yet -{' '}
              <a href="/marketplace" className="font-medium text-accent">
                browse the marketplace
              </a>{' '}
              and tap the heart on anything you like.
            </div>
          )}
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} isFavorited onToggleFavorite={handleRemove} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
