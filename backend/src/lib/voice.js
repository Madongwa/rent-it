import { toFile } from 'openai';
import { groq } from './groq.js';
import { baseAudioType, MAX_AUDIO_BYTES } from './audio.js';

export { baseAudioType };

// Speech to text with Groq's Whisper (free tier) - for voice messages in
// chat and voice search on the Marketplace. Audio can hold anything people
// say, so like chat text it only ever goes to Groq, never Gemini.

export const WHISPER_MODEL = process.env.WHISPER_MODEL || 'whisper-large-v3-turbo';
const TIMEOUT_MS = 25 * 1000;
// Nudges Whisper towards the words people here actually use.
const CONTEXT = 'Rent It, India: renting a tractor, JCB, generator, drill, ladder or wheelchair in Ludhiana, Pune, Mysuru, Jaipur or a nearby village.';

const EXTENSIONS = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/aac': 'aac' };

// Whisper sometimes "hears" these in silence or noise - treat as nothing.
const HALLUCINATIONS = [/^thank(s| you)( for watching)?[.!]*$/i, /^subtitles? by/i, /^\[?(music|silence|inaudible)\]?$/i, /^you$/i];

export function cleanTranscript(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 4000);
  if (!t || HALLUCINATIONS.some((re) => re.test(t))) return null;
  return t;
}

// The words in `buffer`, or null if nothing usable could be heard (or
// the service failed). Never throws.
export async function transcribeAudio(buffer, mimeType, { client = groq, model = WHISPER_MODEL } = {}) {
  const type = baseAudioType(mimeType);
  if (!type || !buffer?.length || buffer.length > MAX_AUDIO_BYTES) return null;
  try {
    const file = await toFile(buffer, `voice.${EXTENSIONS[type]}`, { type });
    const result = await client.audio.transcriptions.create(
      { file, model, response_format: 'json', temperature: 0, prompt: CONTEXT },
      { timeout: TIMEOUT_MS, maxRetries: 0 }
    );
    return cleanTranscript(result?.text);
  } catch (err) {
    console.error('[voice] transcription failed:', err.message);
    return null;
  }
}
