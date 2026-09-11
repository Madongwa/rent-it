import { Link } from 'react-router-dom';

export default function ListingCard({ listing }) {
  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-text-muted"
    >
      <div className="aspect-[4/3] w-full overflow-hidden">
        {listing.image_url ? (
          <img
            src={listing.image_url}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-canvas text-4xl">
            {listing.category?.icon || '🧰'}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-7">
        <div className="flex flex-wrap gap-2">
          {listing.category?.name && (
            <span className="rounded-badge bg-accent px-2.5 py-1 text-caption font-medium text-white">
              {listing.category.name}
            </span>
          )}
          {listing.condition && (
            <span className="rounded-badge border border-line px-2.5 py-1 text-caption font-medium text-text-secondary">
              {listing.condition}
            </span>
          )}
        </div>

        <h3 className="text-subheading text-text-primary line-clamp-1">{listing.title}</h3>
        {listing.location && (
          <p className="-mt-2 text-caption text-text-muted line-clamp-1">{listing.location}</p>
        )}

        <div className="mt-auto flex items-end justify-between pt-2">
          <span className="text-heading-sm text-text-primary">
            ₹{Number(listing.price_per_day).toLocaleString('en-IN')}
            <span className="ml-1 text-body font-normal text-text-muted">/day</span>
          </span>
          {listing.status !== 'available' && (
            <span className="rounded-badge border border-line px-2.5 py-1 text-caption font-medium capitalize text-text-muted">
              {listing.status}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
