import { Link } from 'react-router-dom';

export default function ListingCard({ listing }) {
  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
        {listing.image_url ? (
          <img
            src={listing.image_url}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-stone-300">
            {listing.category?.icon || '🧰'}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-brand-700">
          <span>{listing.category?.icon}</span>
          <span>{listing.category?.name}</span>
        </div>
        <h3 className="font-semibold text-stone-900 line-clamp-1">{listing.title}</h3>
        {listing.location && <p className="text-sm text-stone-500 line-clamp-1">📍 {listing.location}</p>}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-lg font-bold text-stone-900">
            ${Number(listing.price_per_day).toFixed(2)}
            <span className="text-sm font-normal text-stone-500"> /day</span>
          </span>
          {listing.status !== 'available' && (
            <span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-medium text-stone-500 capitalize">
              {listing.status}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
