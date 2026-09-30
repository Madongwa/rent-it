import { describe, it, expect, vi } from 'vitest';
import { reviewSummary, validateSummary } from './reviewSummary.js';

vi.mock('./groq.js', () => ({ groq: null }));
vi.mock('./gemini.js', () => ({ gemini: null }));
vi.mock('./supabaseClient.js', () => ({ supabase: null }));

const model = (reply, calls = []) => [
  { model: 'fake', client: { chat: { completions: { create: async (a) => (calls.push(a), { choices: [{ message: { content: JSON.stringify(reply) } }] }) } } } },
];

function fakeDb(reviews, cached = null) {
  const saved = [];
  return {
    saved,
    from(table) {
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: async () => ({ data: reviews, error: null }),
        maybeSingle: async () => ({ data: cached }),
        upsert: async (r) => (saved.push(r), { error: null }),
      };
      return q;
    },
  };
}

const reviews = [
  { id: 'a', rating: 5, comment: 'Starts first pull, very powerful' },
  { id: 'b', rating: 4, comment: 'Good machine but heavy to lift' },
  { id: 'c', rating: 5, comment: 'Owner was on time, clean' },
  { id: 'd', rating: 3, comment: '' },
];

describe('reviewSummary', () => {
  it('summarises written reviews and saves it', async () => {
    const calls = [];
    const db = fakeDb(reviews);
    const out = await reviewSummary('l1', {
      db,
      models: model({ summary: 'Renters say it starts easily and is powerful.', liked: ['Starts easily.', 'Powerful'], disliked: ['Heavy'] }, calls),
    });
    expect(out).toEqual({ summary: 'Renters say it starts easily and is powerful.', liked: ['Starts easily', 'Powerful'], disliked: ['Heavy'], based_on: 3 });
    expect(calls[0].messages[1].content).not.toContain('(3/5)'); // the empty review isn't sent
    expect(db.saved).toHaveLength(1);
  });

  it('needs 3 written reviews, and reuses a saved summary', async () => {
    expect(await reviewSummary('l1', { db: fakeDb(reviews.slice(0, 2)), models: model({}) })).toBeNull();
    const calls = [];
    const { reviewsHash } = await import('./reviewSummary.js');
    const cached = { input_hash: reviewsHash(reviews.slice(0, 3)), data: { summary: 'Renters say x', liked: [], disliked: [] } };
    expect(await reviewSummary('l1', { db: fakeDb(reviews, cached), models: model({}, calls) })).toEqual(cached.data);
    expect(calls).toHaveLength(0);
  });

  it('rejects answers that are not a proper summary', () => {
    expect(validateSummary({ summary: 'This item is great' })).toBeNull();
    expect(validateSummary({})).toBeNull();
  });
});
