import { describe, it, expect } from 'vitest';
import { parseAttachmentMessage } from './attachments.js';

const CONV = '11111111-2222-3333-4444-555555555555';
const photo = { path: `${CONV}/abc-photo.jpg`, name: 'photo.jpg', size: 200000, mime_type: 'image/jpeg' };

describe('parseAttachmentMessage', () => {
  it('accepts a photo in this conversation', () => {
    expect(parseAttachmentMessage({ kind: 'image', attachment: photo }, CONV)).toEqual({
      kind: 'image',
      body: '📷 Photo',
      attachment: { path: photo.path, name: 'photo.jpg', size: 200000, mime_type: 'image/jpeg' },
    });
  });

  it('accepts a PDF document and uses its name as the preview', () => {
    const doc = { path: `${CONV}/x-lease.pdf`, name: 'Lease agreement.pdf', size: 90000, mime_type: 'application/pdf' };
    const parsed = parseAttachmentMessage({ kind: 'file', attachment: doc }, CONV);
    expect(parsed.body).toBe('📄 Lease agreement.pdf');
    expect(parsed.attachment.mime_type).toBe('application/pdf');
  });

  it("rejects a file stored in another conversation's folder", () => {
    const other = { ...photo, path: '99999999-0000-0000-0000-000000000000/photo.jpg' };
    expect(parseAttachmentMessage({ kind: 'image', attachment: other }, CONV).error).toMatch(/path/);
    expect(parseAttachmentMessage({ kind: 'image', attachment: { ...photo, path: `${CONV}/../x.jpg` } }, CONV).error).toMatch(/path/);
  });

  it('rejects unsupported types and oversize files', () => {
    expect(parseAttachmentMessage({ kind: 'image', attachment: { ...photo, mime_type: 'application/pdf' } }, CONV).error).toBeTruthy();
    expect(parseAttachmentMessage({ kind: 'file', attachment: { ...photo, mime_type: 'application/x-msdownload' } }, CONV).error).toBeTruthy();
    expect(parseAttachmentMessage({ kind: 'image', attachment: { ...photo, size: 11 * 1024 * 1024 } }, CONV).error).toMatch(/too large/);
    expect(parseAttachmentMessage({ kind: 'file', attachment: { ...photo, size: 0 } }, CONV).error).toBeTruthy();
  });

  it('strips control characters from file names', () => {
    const parsed = parseAttachmentMessage({ kind: 'file', attachment: { ...photo, name: 'evil‮exe.jpg\n' } }, CONV);
    expect(parsed.attachment.name).toBe('evil exe.jpg');
  });

  it('accepts a location and rounds it to ~1 m', () => {
    expect(parseAttachmentMessage({ kind: 'location', attachment: { lat: 28.6139123456, lng: 77.2090123456, label: ' Gate 2 ' } }, CONV)).toEqual({
      kind: 'location',
      body: '📍 Gate 2',
      attachment: { lat: 28.61391, lng: 77.20901, label: 'Gate 2' },
    });
  });

  it('rejects impossible coordinates', () => {
    expect(parseAttachmentMessage({ kind: 'location', attachment: { lat: 91, lng: 0 } }, CONV).error).toBeTruthy();
    expect(parseAttachmentMessage({ kind: 'location', attachment: { lat: 'x', lng: 0 } }, CONV).error).toBeTruthy();
  });

  it('rejects other kinds and missing attachments', () => {
    expect(parseAttachmentMessage({ kind: 'system', attachment: {} }, CONV).error).toBeTruthy();
    expect(parseAttachmentMessage({ kind: 'image' }, CONV).error).toBeTruthy();
  });
});
