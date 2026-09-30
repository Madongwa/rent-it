// Validation for chat messages sent from the "+" menu - photos, documents
// and locations - and voice notes. Pure (no Supabase access), so it's unit-tested directly
// in attachments.test.js; messages.js then checks the file really exists.

import { baseAudioType, MAX_AUDIO_BYTES, MAX_VOICE_SECONDS } from './audio.js';

export const ATTACHMENT_BUCKET = 'chat-attachments';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  // Strip control characters (e.g. a newline or bidi override smuggled into
  // a filename) before length-capping.
  return value.replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ').trim().slice(0, max);
}

function parseFile(kind, attachment, conversationId) {
  const { path, name, size, mime_type: mimeType } = attachment;
  // Uploads go to <conversation id>/<file> - a path into another thread's
  // folder would let someone "send" a file they can't otherwise see.
  if (typeof path !== 'string' || !path.startsWith(`${conversationId}/`) || path.includes('..') || path.length > 500) {
    return { error: 'Invalid attachment path' };
  }
  const allowed = kind === 'image' ? IMAGE_TYPES : [...DOCUMENT_TYPES, ...IMAGE_TYPES];
  if (!allowed.includes(mimeType)) {
    return { error: kind === 'image' ? 'That image type isn’t supported' : 'That file type isn’t supported' };
  }
  const bytes = Number(size);
  const limit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
  if (!Number.isFinite(bytes) || bytes <= 0) return { error: 'Invalid file size' };
  if (bytes > limit) return { error: `File is too large (max ${limit / 1024 / 1024} MB)` };

  const cleanName = cleanText(name, 200) || (kind === 'image' ? 'Photo' : 'Document');
  return {
    attachment: { path, name: cleanName, size: bytes, mime_type: mimeType },
    body: kind === 'image' ? '📷 Photo' : `📄 ${cleanName}`,
  };
}

function parseLocation(attachment) {
  const lat = Number(attachment.lat);
  const lng = Number(attachment.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: 'Invalid location' };
  }
  const label = cleanText(attachment.label, 200);
  return {
    // ~1 m precision is plenty for a meeting point.
    attachment: { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, label: label || null },
    body: `📍 ${label || 'Location'}`,
  };
}

// A voice note: the recording in this thread's folder. The body is a
// placeholder until the backend has turned the audio into text.
function parseVoice(attachment, conversationId) {
  const { path, size, mime_type: mimeType, duration } = attachment;
  if (typeof path !== 'string' || !path.startsWith(`${conversationId}/`) || path.includes('..') || path.length > 500) {
    return { error: 'Invalid attachment path' };
  }
  const type = baseAudioType(mimeType);
  if (!type) return { error: 'That audio type isn’t supported' };
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return { error: 'Invalid file size' };
  if (bytes > MAX_AUDIO_BYTES) return { error: 'Voice message is too long' };
  const seconds = Math.round(Number(duration));
  if (!Number.isFinite(seconds) || seconds < 1) return { error: 'That voice message is empty' };
  if (seconds > MAX_VOICE_SECONDS + 5) return { error: `Voice messages can be up to ${MAX_VOICE_SECONDS / 60} minutes` };
  return {
    attachment: { path, size: bytes, mime_type: type, duration: Math.min(seconds, MAX_VOICE_SECONDS), transcribed: false },
    body: '🎤 Voice message',
  };
}

// Returns { kind, body, attachment } ready to insert, or { error }.
export function parseAttachmentMessage({ kind, attachment }, conversationId) {
  if (!['image', 'file', 'location', 'voice'].includes(kind)) return { error: 'Unsupported message type' };
  if (!attachment || typeof attachment !== 'object') return { error: 'attachment is required' };
  const parsed =
    kind === 'location'
      ? parseLocation(attachment)
      : kind === 'voice'
        ? parseVoice(attachment, conversationId)
        : parseFile(kind, attachment, conversationId);
  return parsed.error ? parsed : { kind, ...parsed };
}
