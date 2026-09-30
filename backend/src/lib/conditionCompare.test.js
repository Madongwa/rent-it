import { describe, it, expect, vi } from 'vitest';
import { compareConditionPhotos, validateComparison } from './conditionCompare.js';

vi.mock('./groq.js', () => ({ groq: null }));
vi.mock('./gemini.js', () => ({ gemini: null }));
vi.mock('./supabaseClient.js', () => ({ supabase: null }));

const rental = {
  id: 'r1',
  renter_id: 'u1',
  pickup_photo_urls: ['r1/p1.jpg', 'r1/p2.jpg'],
  return_photo_urls: ['r1/r1.jpg'],
  listing: { owner_id: 'o1', title: 'Drill' },
};

function fakeDb({ row = rental, cached = null } = {}) {
  const saved = [];
  return {
    saved,
    storage: { from: () => ({ download: async () => ({ data: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }) }) }) },
    from(table) {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: table === 'rentals' ? row : cached, error: null }),
        upsert: async (r) => (saved.push(r), { error: null }),
      };
      return q;
    },
  };
}

const model = (reply, calls = []) => [
  { model: 'qwen-test', vision: true, client: { chat: { completions: { create: async (a) => (calls.push(a), { choices: [{ message: { content: JSON.stringify(reply) } }] }) } } } },
];

describe('validateComparison', () => {
  it('keeps a clean, bounded answer', () => {
    expect(validateComparison({ verdict: 'possible_new_damage', findings: ['New dent on the side panel', ''], note: 'Check the side.' })).toEqual({
      verdict: 'possible_new_damage',
      findings: ['New dent on the side panel'],
      note: 'Check the side.',
    });
    expect(validateComparison({ verdict: 'no_visible_change', findings: ['x'], note: '' }).findings).toEqual([]);
    expect(validateComparison({ verdict: 'possible_new_damage', findings: [] })).toBeNull();
    expect(validateComparison({ verdict: 'guilty' })).toBeNull();
  });
});

describe('compareConditionPhotos', () => {
  it('sends before and after photos to the vision model, and saves the answer', async () => {
    const calls = [];
    const db = fakeDb();
    const out = await compareConditionPhotos('r1', 'o1', { db, models: model({ verdict: 'no_visible_change', findings: [], note: 'Looks the same.' }, calls) });
    expect(out.cached).toBe(false);
    expect(out.result).toMatchObject({ verdict: 'no_visible_change', pickup_photos: 2, return_photos: 1 });
    const content = calls[0].messages[1].content;
    expect(content.filter((c) => c.type === 'image_url')).toHaveLength(3);
    expect(db.saved[0]).toMatchObject({ rental_id: 'r1', model: 'qwen-test' });
  });

  it('only for the two people (or staff), and needs both sets of photos', async () => {
    expect((await compareConditionPhotos('r1', 'x', { db: fakeDb(), models: model({}) })).status).toBe(403);
    expect((await compareConditionPhotos('r1', 'x', { db: fakeDb(), models: model({ verdict: 'unclear', findings: [], note: '' }), isStaff: true })).result.verdict).toBe('unclear');
    expect((await compareConditionPhotos('r1', 'u1', { db: fakeDb({ row: { ...rental, return_photo_urls: [] } }), models: model({}) })).status).toBe(400);
  });
});
