import { describe, it, expect, vi, afterEach } from 'vitest';
import { baseType, formatSeconds, micError, pickMimeType, recordingSupported } from './voiceRecorder';

afterEach(() => vi.unstubAllGlobals());

describe('voiceRecorder', () => {
  it('picks the best format the browser can record', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (t) => t === 'audio/mp4' }); // Safari
    expect(pickMimeType()).toBe('audio/mp4');
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (t) => t.startsWith('audio/webm') }); // Chrome
    expect(pickMimeType()).toBe('audio/webm;codecs=opus');
  });

  it('knows when recording is not possible', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    expect(recordingSupported()).toBe(false);
  });

  it('formats and explains', () => {
    expect(baseType('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(formatSeconds(75.6)).toBe('1:15');
    expect(micError({ name: 'NotAllowedError' })).toMatch(/permission/);
    expect(micError({ name: 'NotFoundError' })).toMatch(/No microphone/);
  });
});
