import { describe, it, expect, vi } from 'vitest';
import { baseAudioType, cleanTranscript, transcribeAudio } from './voice.js';
import { parseAttachmentMessage } from './attachments.js';

vi.mock('./groq.js', () => ({ groq: null }));

const fakeClient = (text, calls = []) => ({
  audio: { transcriptions: { create: async (args, opts) => (calls.push([args, opts]), { text }) } },
});

describe('voice', () => {
  it('accepts browser recording types, ignoring codec details', () => {
    expect(baseAudioType('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(baseAudioType('audio/mp4')).toBe('audio/mp4');
    expect(baseAudioType('video/webm')).toBeNull();
  });

  it('drops the phrases Whisper invents for silence', () => {
    expect(cleanTranscript('  Thank you. ')).toBeNull();
    expect(cleanTranscript('[Music]')).toBeNull();
    expect(cleanTranscript('Kal subah 9 baje aa jaunga')).toBe('Kal subah 9 baje aa jaunga');
  });

  it('transcribes with Whisper, with a timeout and no retries', async () => {
    const calls = [];
    const text = await transcribeAudio(Buffer.from('abc'), 'audio/webm;codecs=opus', { client: fakeClient(' Tractor chahiye ', calls) });
    expect(text).toBe('Tractor chahiye');
    expect(calls[0][0].model).toMatch(/whisper/);
    expect(calls[0][1]).toMatchObject({ maxRetries: 0 });
  });

  it('never throws, and refuses what it cannot use', async () => {
    const broken = { audio: { transcriptions: { create: async () => { throw new Error('down'); } } } };
    expect(await transcribeAudio(Buffer.from('abc'), 'audio/webm', { client: broken })).toBeNull();
    expect(await transcribeAudio(Buffer.from('abc'), 'text/plain', { client: fakeClient('x') })).toBeNull();
    expect(await transcribeAudio(Buffer.alloc(0), 'audio/webm', { client: fakeClient('x') })).toBeNull();
  });
});

describe('voice attachments', () => {
  const base = { path: 'c1/abc-voice.webm', size: 20000, mime_type: 'audio/webm;codecs=opus', duration: 12.4 };

  it('accepts a recording in this chat\'s folder', () => {
    expect(parseAttachmentMessage({ kind: 'voice', attachment: base }, 'c1')).toEqual({
      kind: 'voice',
      body: '🎤 Voice message',
      attachment: { path: 'c1/abc-voice.webm', size: 20000, mime_type: 'audio/webm', duration: 12, transcribed: false },
    });
  });

  it('refuses other folders, other types, empty or too long', () => {
    expect(parseAttachmentMessage({ kind: 'voice', attachment: base }, 'c2').error).toBeTruthy();
    expect(parseAttachmentMessage({ kind: 'voice', attachment: { ...base, mime_type: 'image/png' } }, 'c1').error).toBeTruthy();
    expect(parseAttachmentMessage({ kind: 'voice', attachment: { ...base, duration: 0 } }, 'c1').error).toBeTruthy();
    expect(parseAttachmentMessage({ kind: 'voice', attachment: { ...base, duration: 600 } }, 'c1').error).toBeTruthy();
    expect(parseAttachmentMessage({ kind: 'voice', attachment: { ...base, size: 9e6 } }, 'c1').error).toBeTruthy();
  });
});
