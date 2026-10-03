import { describe, it, expect } from 'vitest';
import { checkPhotoUpdate, MAX_PHOTOS_PER_STAGE } from './rentalPhotos.js';

const rental = (over) => ({ id: 'r1', status: 'approved', pickup_photo_urls: [], return_photo_urls: [], ...over });

describe('checkPhotoUpdate', () => {
  it('accepts new photos in the rental folder', () => {
    expect(checkPhotoUpdate(rental(), 'pickup', ['r1/a.jpg', 'r1/b.jpg', 'r1/a.jpg'])).toEqual({ paths: ['r1/a.jpg', 'r1/b.jpg'] });
  });

  it('refuses photos once the rental is no longer agreed', () => {
    for (const status of ['completed', 'cancelled', 'disputed', 'pending']) {
      expect(checkPhotoUpdate(rental({ status }), 'return', ['r1/a.jpg']).error).toMatch(/locked/);
    }
  });

  it("can't remove or swap photos already added", () => {
    const r = rental({ return_photo_urls: ['r1/old.jpg'] });
    expect(checkPhotoUpdate(r, 'return', ['r1/new.jpg']).error).toMatch(/removed/);
    expect(checkPhotoUpdate(r, 'return', ['r1/old.jpg', 'r1/new.jpg']).paths).toEqual(['r1/old.jpg', 'r1/new.jpg']);
  });

  it('locks pickup photos once return photos exist', () => {
    const r = rental({ pickup_photo_urls: ['r1/p.jpg'], return_photo_urls: ['r1/q.jpg'] });
    expect(checkPhotoUpdate(r, 'pickup', ['r1/p.jpg', 'r1/p2.jpg']).error).toMatch(/Pickup photos are locked/);
  });

  it("refuses paths outside this rental's folder", () => {
    for (const p of ['r2/a.jpg', 'r1/../r2/a.jpg', 'a.jpg', 42, null, `r1/${'x'.repeat(300)}`]) {
      expect(checkPhotoUpdate(rental(), 'pickup', [p]).error).toBeTruthy();
    }
  });

  it('caps the number of photos and checks the input shape', () => {
    const many = Array.from({ length: MAX_PHOTOS_PER_STAGE + 1 }, (_, i) => `r1/${i}.jpg`);
    expect(checkPhotoUpdate(rental(), 'pickup', many).error).toMatch(/Up to/);
    expect(checkPhotoUpdate(rental(), 'during', []).error).toMatch(/stage/);
    expect(checkPhotoUpdate(rental(), 'pickup', 'r1/a.jpg').error).toMatch(/stage/);
  });
});
