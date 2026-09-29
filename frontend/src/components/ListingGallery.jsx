import { useState } from 'react';

// The listing page's photos: a large main photo with previous/next buttons
// (and left/right arrow keys), a counter, and thumbnails to jump between
// them. With one photo it's just the photo; with none, the category icon.
export default function ListingGallery({ photos, title, fallback, children }) {
  const [index, setIndex] = useState(0);
  const count = photos.length;
  const current = Math.min(index, Math.max(0, count - 1));
  const go = (step) => setIndex((current + step + count) % count);

  function onKeyDown(e) {
    if (count < 2) return;
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  }

  return (
    <div>
      <div
        className="relative aspect-[4/3] w-full overflow-hidden rounded-card bg-white/5"
        tabIndex={count > 1 ? 0 : undefined}
        onKeyDown={onKeyDown}
        aria-label={count > 1 ? `Photo ${current + 1} of ${count}` : undefined}
        role={count > 1 ? 'group' : undefined}
      >
        {count ? (
          <img src={photos[current]} alt={count > 1 ? `${title} - photo ${current + 1} of ${count}` : title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl">{fallback}</div>
        )}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70"
            >
              ›
            </button>
            <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white">{`${current + 1} / ${count}`}</span>
          </>
        )}
        {children}
      </div>
      {count > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === current}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-btn border-2 ${i === current ? 'border-white' : 'border-transparent opacity-70 hover:opacity-100'}`}
            >
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
