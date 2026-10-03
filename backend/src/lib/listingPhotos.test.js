import { describe, it, expect } from 'vitest';
import { isOwnListingPhoto, normalizePhotos } from './listingPhotos.js';

const base = 'https://x.supabase.co';
const url = (n, owner = 'u') => `${base}/storage/v1/object/public/listing-images/${owner}/${n}.jpg`;
const opts = { ownerId: 'u', supabaseUrl: base };

describe('normalizePhotos', () => {
  it("keeps up to 8 unique photos from the owner's folder, the first as the cover", () => {
    const photos = [url(1), url(2), url(1), 'javascript:alert(1)', 42, ...[3, 4, 5, 6, 7, 8, 9].map((n) => url(n))];
    expect(normalizePhotos({ image_urls: photos }, opts)).toEqual({
      image_urls: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => url(n)),
      image_url: url(1),
    });
  });

  it("drops outside links and other people's uploads", () => {
    const photos = ['https://tracker.example/pixel.gif', url(1, 'someone-else'), `${base}/storage/v1/object/public/listing-images/u/../v/1.jpg`, url(2)];
    expect(normalizePhotos({ image_urls: photos }, opts).image_urls).toEqual([url(2)]);
  });

  it('keeps photos already on the listing, even outside links', () => {
    const old = 'https://images.unsplash.com/photo-1.jpg';
    expect(normalizePhotos({ image_urls: [old, url(1)] }, { ...opts, existing: [old] }).image_urls).toEqual([old, url(1)]);
  });

  it('clears the cover when every photo is removed', () => {
    expect(normalizePhotos({ image_urls: [] }, opts)).toEqual({ image_urls: [], image_url: null });
  });

  it('turns an old single image_url into a one-photo gallery', () => {
    expect(normalizePhotos({ image_url: url(1) }, opts)).toEqual({ image_url: url(1), image_urls: [url(1)] });
    expect(normalizePhotos({ image_url: 'https://tracker.example/x.gif' }, opts)).toEqual({ image_url: null, image_urls: [] });
  });

  it('leaves photos alone when the request does not mention them', () => {
    expect(normalizePhotos({ title: 'Drill' }, opts)).toEqual({});
  });
});

describe('isOwnListingPhoto', () => {
  it('needs an owner and the Supabase URL', () => {
    expect(isOwnListingPhoto(url(1), null, base)).toBe(false);
    expect(isOwnListingPhoto(url(1), 'u', undefined)).toBe(false);
    expect(isOwnListingPhoto(url(1), 'u', base)).toBe(true);
  });
});
