// Recording from the microphone for voice notes (chat) and voice search
// (Marketplace). The server turns the audio into text with Groq Whisper.

// What this browser can record, best first: Chrome/Firefox/Android do
// WebM (Opus), Safari/iPhone do MP4 (AAC).
const PREFERRED = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function recordingSupported() {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== 'undefined';
}

export function pickMimeType() {
  if (typeof window === 'undefined' || !window.MediaRecorder?.isTypeSupported) return '';
  return PREFERRED.find((t) => window.MediaRecorder.isTypeSupported(t)) || '';
}

// "audio/webm;codecs=opus" -> "audio/webm" (what storage and the API accept).
export const baseType = (mime) => String(mime || '').split(';')[0].trim() || 'audio/webm';

export function micError(err) {
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
    return 'Microphone permission was denied - allow it in your browser settings to record.';
  }
  if (err?.name === 'NotFoundError') return 'No microphone was found.';
  return "Couldn't start recording on this device.";
}

export function formatSeconds(s) {
  const n = Math.max(0, Math.floor(s));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

// Starts recording. Resolves to { stop, cancel }: stop() resolves to
// { blob, type, seconds }; cancel() throws the recording away. The mic is
// released either way. Rejects if the mic can't be used.
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  const startedAt = Date.now();
  recorder.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
  recorder.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());

  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          release();
          const type = baseType(recorder.mimeType || mimeType);
          resolve({ blob: new Blob(chunks, { type }), type, seconds: (Date.now() - startedAt) / 1000 });
        };
        recorder.stop();
      }),
    cancel: () => {
      recorder.onstop = release;
      if (recorder.state !== 'inactive') recorder.stop();
      else release();
    },
  };
}
