import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabaseClient', () => ({ supabase: {} }));
const { checkAttachment, formatBytes, mimeTypeOf, tileFor, mapsLink } = await import('./chatAttachments.js');

const file = (name, type, size = 1000) => ({ name, type, size });

describe('chat attachments', () => {
  it('works out a type from the extension when the browser gives none', () => {
    expect(mimeTypeOf(file('Lease.DOCX', ''))).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(mimeTypeOf(file('scan.pdf', 'application/octet-stream'))).toBe('application/pdf');
    expect(mimeTypeOf(file('photo.jpg', 'image/jpeg'))).toBe('image/jpeg');
  });

  it('accepts photos and documents within their limits', () => {
    expect(checkAttachment(file('a.jpg', 'image/jpeg'), 'image')).toBe('');
    expect(checkAttachment(file('lease.pdf', 'application/pdf'), 'file')).toBe('');
    expect(checkAttachment(file('receipt.png', 'image/png'), 'file')).toBe('');
  });

  it('rejects wrong types, oversize and empty files', () => {
    expect(checkAttachment(file('lease.pdf', 'application/pdf'), 'image')).toMatch(/supported photo/);
    expect(checkAttachment(file('setup.exe', 'application/x-msdownload'), 'file')).toMatch(/supported document/);
    expect(checkAttachment(file('big.jpg', 'image/jpeg', 11 * 1024 * 1024), 'image')).toMatch(/10 MB/);
    expect(checkAttachment(file('big.pdf', 'application/pdf', 21 * 1024 * 1024), 'file')).toMatch(/20 MB/);
    expect(checkAttachment(file('empty.pdf', 'application/pdf', 0), 'file')).toMatch(/empty/);
  });

  it('formats sizes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3.5 * 1024 * 1024)).toBe('3.5 MB');
  });

  it('finds the OpenStreetMap tile for a point', () => {
    // India Gate, New Delhi at zoom 15.
    const t = tileFor(28.6129, 77.2295, 15);
    expect(t).toMatchObject({ x: 23413, y: 13664 });
    expect(t.px).toBeGreaterThanOrEqual(0);
    expect(t.px).toBeLessThan(256);
  });

  it('links to Google Maps', () => {
    expect(mapsLink(28.6129, 77.2295)).toBe('https://www.google.com/maps/search/?api=1&query=28.6129,77.2295');
  });
});
