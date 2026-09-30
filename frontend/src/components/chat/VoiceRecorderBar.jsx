import { useEffect, useRef, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { formatSeconds, micError, startRecording } from '../../lib/voiceRecorder';

// Replaces the message box while a voice note is being recorded: a red
// dot and timer, Delete, and Send. Stops by itself at the limit.
export const MAX_VOICE_SECONDS = 120;

export default function VoiceRecorderBar({ onSend, onClose }) {
  const recRef = useRef(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    startRecording()
      .then((rec) => {
        if (cancelled) rec.cancel();
        else recRef.current = rec;
      })
      .catch((err) => !cancelled && setError(micError(err)));
    const started = Date.now();
    const t = setInterval(() => setSeconds((Date.now() - started) / 1000), 250);
    return () => {
      cancelled = true;
      clearInterval(t);
      recRef.current?.cancel();
    };
  }, []);

  async function send() {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    setSending(true);
    const recording = await rec.stop();
    if (recording.seconds < 1 || !recording.blob.size) {
      setError('That was too short - hold on a moment longer.');
      setSending(false);
      return;
    }
    onSend(recording);
    onClose();
  }

  // The limit: send what's been said so far.
  useEffect(() => {
    if (seconds >= MAX_VOICE_SECONDS && recRef.current) send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  return (
    <div className="flex w-full items-center gap-2" role="group" aria-label="Recording a voice message">
      <button type="button" onClick={onClose} aria-label="Delete recording" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-night-muted hover:bg-white/10 hover:text-red-400">
        <Trash2 className="h-5 w-5" />
      </button>
      {error ? (
        <p className="min-w-0 flex-1 text-sm text-red-400">{error}</p>
      ) : (
        <p className="flex min-w-0 flex-1 items-center gap-2 text-sm text-night-text" aria-live="polite">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
          Recording {formatSeconds(seconds)} <span className="text-night-muted">/ {formatSeconds(MAX_VOICE_SECONDS)}</span>
        </p>
      )}
      <button
        type="button"
        onClick={send}
        disabled={!!error || sending}
        aria-label="Send voice message"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black hover:opacity-90 disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
