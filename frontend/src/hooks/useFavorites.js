import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

// Shared "which listings has this user saved" state, so Marketplace,
// Favorites, and Listing Detail all show the same heart state without each
// fetching/toggling independently. Logged-out users just get an always-empty
// set and a toggle that's a no-op for state (callers should redirect to
// /login instead of calling toggle when there's no user).
export function useFavorites() {
  const { user } = useAuth();
  const [ids, setIds] = useState(() => new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      setLoaded(true);
      return;
    }
    api
      .getFavoriteIds()
      .then((list) => setIds(new Set(list)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [user]);

  const toggle = useCallback(
    async (listingId) => {
      if (!user) return;
      const isFavorited = ids.has(listingId);
      // Optimistic update - a failed request rolls back below.
      setIds((prev) => {
        const next = new Set(prev);
        isFavorited ? next.delete(listingId) : next.add(listingId);
        return next;
      });
      try {
        if (isFavorited) await api.removeFavorite(listingId);
        else await api.addFavorite(listingId);
      } catch {
        setIds((prev) => {
          const next = new Set(prev);
          isFavorited ? next.add(listingId) : next.delete(listingId);
          return next;
        });
      }
    },
    [ids, user]
  );

  return { favoriteIds: ids, loaded, toggle, isLoggedIn: !!user };
}
