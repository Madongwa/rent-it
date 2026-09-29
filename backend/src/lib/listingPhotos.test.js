import { describe, it, expect } from 'vitest';
import { normalizePhotos } from './listingPhotos.js';

const url = (n) => `https://x.supabase.co/storage/v1/object/public/listing-images/u/${n}.jpg`;

describe('normalizePhotos', () => {
  it('keeps up to 8 unique web URLs, the first as the cover', () => {
    const photos = [url(1), url(2), url(1), 'javascript:alert(1)', 42, ...[3, 4, 5, 6, 7, 8, 9].map(url)];
    expect(normalizePhotos({ image_urls: photos })).toEqual({
      image_urls: [1, 2, 3, 4, 5, 6, 7, 8].map(url),
      image_url: url(1),
    });
  });

  it('clears the cover when every photo is removed', () => {
    expect(normalizePhotos({ image_urls: [] })).toEqual({ image_urls: [], image_url: null });
  });

  it('turns an old single image_url into a one-photo gallery', () => {
    expect(normalizePhotos({ image_url: url(1) })).toEqual({ image_url: url(1), image_urls: [url(1)] });
  });

  it('leaves photos alone when the request does not mention them', () => {
    expect(normalizePhotos({ title: 'Drill' })).toEqual({});
  });
});
