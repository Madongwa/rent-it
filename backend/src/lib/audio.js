// Accepted voice recordings - shared by chat voice notes and voice search.
// Pure (no network), so it can be used anywhere.

export const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/aac'];
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
export const MAX_VOICE_SECONDS = 120;

// "audio/webm;codecs=opus" -> "audio/webm"; null if not an accepted type.
export function baseAudioType(mimeType) {
  const base = String(mimeType || '').split(';')[0].trim().toLowerCase();
  return AUDIO_TYPES.includes(base) ? base : null;
}
