import { describe, it, expect, vi } from 'vitest';
import { interpretSearch, validateIntent } from './searchIntent.js';

vi.mock('./groq.js', () => ({ groq: null }));
vi.mock('./gemini.js', () => ({ gemini: null }));
vi.mock('./supabaseClient.js', () => ({ supabase: null }));

const categories = [
  { slug: 'farming', name: 'Farming Tools' },
  { slug: 'medical', name: 'Medical' },
];
const db = { from: () => ({ select: async () => ({ data: categories, error: null }) }) };

describe('validateIntent', () => {
  it('keeps only filters the Marketplace supports', () => {
    expect(
      validateIntent(
        {
          q: ' tractor ',
          category: 'spaceships',
          maxPrice: '2000',
          minPrice: 5000, // above the max - dropped
          condition: ['Good', 'Mint'],
          powerSource: ['diesel', 'steam'],
          availability: ['weekend', 'week'],
          near: 'Ludhiana%; DROP',
        },
        categories
      )
    ).toEqual({ q: 'tractor', maxPrice: 2000, condition: ['Good'], powerSource: ['diesel'], availability: ['week'], near: 'Ludhiana DROP' });
  });

  it('is null when nothing usable came back', () => {
    expect(validateIntent({ category: 'nope', maxPrice: -1 }, categories)).toBeNull();
    expect(validateIntent(null, categories)).toBeNull();
  });
});

describe('interpretSearch', () => {
  it('asks the AI with the real categories and returns the checked filters', async () => {
    const create = vi.fn(async () => ({ choices: [{ message: { content: JSON.stringify({ q: 'wheelchair', category: 'medical' }) } }] }));
    const models = [{ model: 'fake', client: { chat: { completions: { create } } } }];

    expect(await interpretSearch('wheelchair for my grandmother', { db, models })).toEqual({ q: 'wheelchair', category: 'medical' });
    expect(create.mock.calls[0][0].messages[0].content).toContain('"medical" (Medical)');
    expect(create.mock.calls[0][0].messages[1].content).toBe('wheelchair for my grandmother');
  });

  it('returns null when the AI has nothing usable', async () => {
    const create = async () => ({ choices: [{ message: { content: '{}' } }] });
    expect(await interpretSearch('asdf qwer', { db, models: [{ model: 'fake', client: { chat: { completions: { create } } } }] })).toBeNull();
  });
});
