// Chat attachments (the "+" menu in Messages): photos, documents and
// locations. Photos/documents upload straight from the browser into the
// private chat-attachments bucket under <conversation id>/, same pattern as
// rental condition photos - the backend then records the message.
import { supabase } from './supabaseClient';

export const ATTACHMENT_BUCKET = 'chat-attachments';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

// Browsers often report an empty type for Office/OpenDocument files, so the
// extension is the fallback - and what the file picker filters on.
const EXTENSION_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  txt: 'text/plain',
  csv: 'text/csv',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
};
const DOCUMENT_TYPES = Object.values(EXTENSION_TYPES).filter((t) => !t.startsWith('image/'));

export const DOCUMENT_ACCEPT = ['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'csv', 'xls', 'xlsx'].map((e) => `.${e}`).join(',');

export function mimeTypeOf(file) {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return EXTENSION_TYPES[ext] || file.type || '';
}

// Returns an error message, or '' if the file can be sent as this kind.
export function checkAttachment(file, kind) {
  const type = mimeTypeOf(file);
  if (kind === 'image') {
    if (!IMAGE_TYPES.includes(type)) return `${file.name} isn't a supported photo (JPG, PNG, WEBP, GIF or HEIC).`;
    if (file.size > MAX_IMAGE_BYTES) return `${file.name} is over 10 MB.`;
  } else {
    if (![...DOCUMENT_TYPES, ...IMAGE_TYPES].includes(type)) {
      return `${file.name} isn't a supported document (PDF, Word, text, spreadsheet or image).`;
    }
    if (file.size > MAX_FILE_BYTES) return `${file.name} is over 20 MB.`;
  }
  if (file.size === 0) return `${file.name} is empty.`;
  return '';
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Phone photos are often 5-10 MB; a 1920px JPEG is plenty in a chat and
// uploads far faster on mobile data. GIFs keep their animation, and
// anything the browser can't decode (e.g. HEIC outside Safari) goes as-is.
export async function shrinkImage(file, maxSide = 1920) {
  const type = mimeTypeOf(file);
  if (type === 'image/gif' || file.size < 1.5 * 1024 * 1024 || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

function randomId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Uploads into this conversation's folder and returns the attachment
// details the backend expects.
export async function uploadAttachment(conversationId, file) {
  const mimeType = mimeTypeOf(file);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'file';
  const path = `${conversationId}/${randomId()}-${safeName}`;
  const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file, { contentType: mimeType, upsert: false });
  if (error) throw new Error(error.message || 'Upload failed');
  return { path, name: file.name, size: file.size, mime_type: mimeType };
}

export async function signedAttachmentUrl(path, { download } = {}) {
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, 60 * 60, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

export function mapsLink(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

// Web-Mercator maths for the static map preview on a location message:
// which OpenStreetMap tile the point falls in at this zoom, and where in
// that 256px tile it sits.
export function tileFor(lat, lng, zoom) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x: Math.floor(x), y: Math.floor(y), px: (x - Math.floor(x)) * 256, py: (y - Math.floor(y)) * 256 };
}
