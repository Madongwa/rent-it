import { describe, it, expect, vi } from 'vitest';
import { checkPhotos, validateCheck } from './photoCheck.js';

vi.mock('./groq.js', () => ({ groq: null }));
vi.mock('./gemini.js', () => ({ gemini: null }));
vi.mock('./supabaseClient.js', () => ({ supabase: null }));

const model = (name, reply, calls = []) => ({
  model: name,
  client: { chat: { completions: { create: async (args) => (calls.push(args), { choices: [{ message: { content: JSON.stringify(reply) } }] }) } } },
});

describe('validateCheck', () => {
  it('keeps known problems per photo, fills in the rest as fine', () => {
    expect(validateCheck({ photos: [{ index: 2, problems: ['blurry', 'blurry', 'made_up'] }] }, 3)).toEqual([
      { index: 1, problems: [] },
      { index: 2, problems: ['blurry'] },
      { index: 3, problems: [] },
    ]);
    expect(validateCheck({ photos: [{ index: 9, problems: [] }] }, 3)).toBeNull();
  });
});

describe('checkPhotos', () => {
  const loadPhoto = async (u) => (u.includes('bad') ? null : 'data:image/jpeg;base64,xx');

  it('asks only an image-capable model, and labels the problems', async () => {
    const calls = [];
    const result = await checkPhotos(['https://x/1.jpg', 'https://x/bad.jpg', 'https://x/2.jpg'], 'Tractor', {
      models: [model('openai/gpt-oss-120b', {}), model('gemini-test', { photos: [{ index: 2, problems: ['dark'] }] }, calls)],
      loadPhoto,
    });
    expect(calls).toHaveLength(1);
    expect(result.photos).toEqual([
      { url: 'https://x/1.jpg', problems: [] },
      { url: 'https://x/2.jpg', problems: [{ code: 'dark', label: 'Too dark to see the item' }] },
    ]);
  });

  it('gives up cleanly without photos or an image model', async () => {
    expect(await checkPhotos(['https://x/bad.jpg'], '', { models: [model('gemini-test', {})], loadPhoto })).toBeNull();
    expect(await checkPhotos(['https://x/1.jpg'], '', { models: [model('openai/gpt-oss-120b', {})], loadPhoto })).toBeNull();
  });
});
