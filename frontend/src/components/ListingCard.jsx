import { Link } from 'react-router-dom';
import { GlowingEffect } from './ui/GlowingEffect';
import './ListingCardGlass.css';

function PinIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function HeartIcon({ filled, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

// isFavorited/onToggleFavorite are optional - callers that haven't loaded
// favorite state yet (or don't care, e.g. a logged-out view) can just omit
// them and the heart button won't render at all.
export default function ListingCard({ listing, isFavorited, onToggleFavorite }) {
  function handleHeartClick(e) {
    e.preventDefault(); // this card is a <Link> - don't navigate on heart click
    e.stopPropagation();
    onToggleFavorite?.(listing.id);
  }

  return (
    <Link to={`/listing/${listing.id}`} className="listing-card group">
      {/* Aceternity-style proximity glow, sized to trace this card's own
          outer edge (see the padding/radius on .listing-card) - the card's
          own layout/shape below is untouched. */}
      <GlowingEffect className="rounded-[1rem]" spread={40} glow disabled={false} proximity={64} inactiveZone={0.01} />
      <div className="listing-card-inner">
        <div className="listing-card-image">
          {listing.image_url ? (
            <img src={listing.image_url} alt={listing.title} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl">
              {listing.category?.icon || '🧰'}
            </div>
          )}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={handleHeartClick}
              aria-label={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
              aria-pressed={isFavorited}
              className={`listing-card-heart ${isFavorited ? 'listing-card-heart--active' : ''}`}
            >
              <HeartIcon filled={isFavorited} className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="listing-card-body">
          <div className="listing-card-tags">
            {listing.category?.name && (
              <span className="listing-card-tag">
                {listing.category.icon} {listing.category.name}
              </span>
            )}
            {/* No subcategory taxonomy exists in the data model yet (see
                FilterSidebar.jsx) - only rendered if a listing ever carries one. */}
            {listing.subcategory && <span className="listing-card-tag">{listing.subcategory}</span>}
            {listing.condition && <span className="listing-card-tag listing-card-tag--condition">{listing.condition}</span>}
          </div>

          <h3 className="listing-card-title">{listing.title}</h3>

          {listing.location && (
            <p className="listing-card-location">
              <PinIcon className="h-3.5 w-3.5 shrink-0" />
              {listing.location}
            </p>
          )}

          <div className="listing-card-price-row">
            <div className="listing-card-price">
              ₹{Number(listing.price_per_day).toLocaleString('en-IN')}
              <span>/day</span>
            </div>
            {listing.review_count > 0 && (
              <div className="listing-card-rating" title={`${listing.avg_rating} out of 5, ${listing.review_count} review${listing.review_count === 1 ? '' : 's'}`}>
                ★{Number(listing.avg_rating).toFixed(1)} <span>({listing.review_count})</span>
              </div>
            )}
          </div>

          {listing.status !== 'available' && (
            <span className="listing-card-tag capitalize" style={{ alignSelf: 'flex-start' }}>
              {listing.status}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
