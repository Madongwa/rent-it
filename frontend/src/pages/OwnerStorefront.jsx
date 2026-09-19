import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import ListingCard from '../components/ListingCard';
import { useFavorites } from '../hooks/useFavorites';
import useSeo from '../hooks/useSeo';
import { DarkGradientBg } from '../components/ui/elegant-dark-pattern';

export default function OwnerStorefront() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [owner, setOwner] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { favoriteIds, toggle: toggleFavorite, isLoggedIn } = useFavorites();

  useSeo({
    title: owner ? `${owner.full_name || 'Rent It user'}'s listings` : 'Owner',
    description: owner ? `Equipment listed by ${owner.full_name || 'this Rent It user'}.` : undefined,
    path: `/owner/${id}`,
    image: owner?.avatar_url || undefined,
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getPublicProfile(id), api.getListings({ ownerId: id })])
      .then(([profile, listingData]) => {
        setOwner(profile);
        setListings(listingData.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function handleToggleFavorite(listingId) {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: { pathname: `/owner/${id}` } } });
      return;
    }
    toggleFavorite(listingId);
  }

  if (loading) return <DarkGradientBg className="min-h-[calc(100vh-4rem)] py-24 text-center text-night-muted">Loading…</DarkGradientBg>;
  if (error || !owner) {
    return <DarkGradientBg className="min-h-[calc(100vh-4rem)] py-24 text-center text-red-400">{error || 'Owner not found.'}</DarkGradientBg>;
  }

  return (
    <DarkGradientBg className="min-h-[calc(100vh-4rem)] text-night-text">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-night-card text-2xl font-bold">
            {owner.avatar_url ? (
              <img src={owner.avatar_url} alt={owner.full_name} className="h-full w-full object-cover" />
            ) : (
              (owner.full_name || 'R')[0].toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-heading-sm text-night-text">{owner.full_name || 'Rent It user'}</h1>
            <p className="text-body text-night-muted">
              {listings.length} listing{listings.length === 1 ? '' : 's'} available
            </p>
          </div>
        </div>

        <div className="mt-10">
          {listings.length === 0 ? (
            <p className="py-16 text-center text-night-muted">This user doesn't have any active listings right now.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isFavorited={favoriteIds.has(listing.id)}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </DarkGradientBg>
  );
}
