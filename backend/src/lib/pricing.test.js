import { describe, it, expect, vi } from 'vitest';
import { listingPriceCheck, priceStats, suggestPrice, validateEstimate } from './pricing.js';
import { parseJsonObject } from './ai.js';

vi.mock('./groq.js', () => ({ groq: null }));
vi.mock('./gemini.js', () => ({ gemini: null }));
vi.mock('./supabaseClient.js', () => ({ supabase: null }));

// A stand-in for the Supabase client over in-memory tables, supporting the
// query shapes pricing.js uses.
function fakeDb(tables) {
  const writes = [];
  return {
    writes,
    from(table) {
      const filters = [];
      let limit = Infinity;
      const run = () => (tables[table] || []).filter((r) => filters.every((f) => f(r))).slice(0, limit);
      const q = {
        select: () => q,
        eq: (c, v) => (filters.push((r) => r[c] === v), q),
        neq: (c, v) => (filters.push((r) => r[c] !== v), q),
        in: (c, vs) => (filters.push((r) => vs.includes(r[c])), q),
        order: () => q,
        limit: (n) => ((limit = n), q),
        maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
        then: (resolve) => resolve({ data: run(), error: null }),
        upsert: async (row) => {
          writes.push({ table, row });
          tables[table] = [...(tables[table] || []).filter((r) => r.listing_id !== row.listing_id), row];
          return { error: null };
        },
      };
      return q;
    },
  };
}

// A model that always answers `answer` (and counts its calls).
function fakeModel(answer) {
  const create = vi.fn(async () => ({ choices: [{ message: { content: JSON.stringify(answer) } }] }));
  return { model: 'fake', client: { chat: { completions: { create } } }, create };
}

const listings = [
  { id: 'tractor-25', title: 'Compact Tractor 25HP', category_id: 1, condition: 'Good', location: 'Ludhiana', price_per_day: '2250.00', status: 'available' },
  { id: 'sprayer', title: 'Boom Sprayer', category_id: 1, condition: 'Good', location: 'Karnal', price_per_day: '375.00', status: 'available' },
  { id: 'old', title: 'Old Tractor', category_id: 1, condition: 'Fair', location: 'Amritsar', price_per_day: '1500.00', status: 'inactive' },
  { id: 'mixer', title: 'Cement Mixer', category_id: 2, condition: 'Good', location: 'Pune', price_per_day: '1000.00', status: 'available' },
];

describe('validateEstimate', () => {
  it('rounds to whole rupees and keeps only real listing ids', () => {
    expect(
      validateEstimate({ low: 1799.6, high: '3000', suggested: 2400, reason: ' ok ', comparable_ids: ['a', 'made-up', 'a'] }, ['a', 'b'])
    ).toEqual({ low: 1800, high: 3000, suggested: 2400, reason: 'ok', comparable_ids: ['a'] });
  });

  it('rejects numbers that make no sense', () => {
    expect(validateEstimate({ low: 3000, high: 1000, suggested: 2000 })).toBeNull(); // low above high
    expect(validateEstimate({ low: 100, high: 300, suggested: 500 })).toBeNull(); // suggested outside range
    expect(validateEstimate({ low: 10, high: 5000, suggested: 100 })).toBeNull(); // range too wide
    expect(validateEstimate({ low: 0, high: 10, suggested: 5 })).toBeNull();
    expect(validateEstimate({ low: 'a lot', high: 10, suggested: 5 })).toBeNull();
    expect(validateEstimate(null)).toBeNull();
  });
});

describe('priceStats', () => {
  it('gives count, min, max and median', () => {
    expect(priceStats([300, 100, 200])).toEqual({ count: 3, min: 100, max: 300, median: 200 });
    expect(priceStats([100, 200])).toEqual({ count: 2, min: 100, max: 200, median: 150 });
    expect(priceStats([])).toBeNull();
  });
});

describe('parseJsonObject', () => {
  it('finds the object in a reply with extra text around it', () => {
    expect(parseJsonObject('<think>hmm</think> Sure: {"low": 1} done')).toEqual({ low: 1 });
    expect(parseJsonObject('no json here')).toBeNull();
  });
});

describe('suggestPrice', () => {
  it("offers only same-category, active listings to the AI and returns comparables' real prices", async () => {
    const db = fakeDb({ categories: [{ id: 1, name: 'Farming' }], listings: [...listings] });
    const model = fakeModel({ low: 1800, high: 3000, suggested: 2400, reason: 'Bigger tractor.', comparable_ids: ['tractor-25', 'mixer'] });

    const result = await suggestPrice({ title: '45HP Tractor', categoryId: 1 }, { db, models: [model] });

    const prompt = model.create.mock.calls[0][0].messages[1].content;
    expect(prompt).toContain('Compact Tractor 25HP');
    expect(prompt).toContain('Boom Sprayer');
    expect(prompt).not.toContain('Old Tractor'); // inactive
    expect(prompt).not.toContain('Cement Mixer'); // other category
    expect(result.estimate).toEqual({ low: 1800, high: 3000, suggested: 2400, reason: 'Bigger tractor.' });
    // The mixer isn't a candidate, so it's dropped even though the AI named it.
    expect(result.similar.map((l) => [l.id, l.price_per_day])).toEqual([['tractor-25', 2250]]);
    expect(result.similar_stats).toEqual({ count: 1, min: 2250, max: 2250, median: 2250 });
  });

  it('returns null when the AI gives no usable estimate', async () => {
    const db = fakeDb({ categories: [], listings: [...listings] });
    expect(await suggestPrice({ title: 'Tractor', categoryId: 1 }, { db, models: [fakeModel({ low: 5, high: 1 })] })).toBeNull();
  });
});

describe('listingPriceCheck', () => {
  it('stores the estimate and reuses it until the listing changes', async () => {
    const tables = { categories: [{ id: 1, name: 'Farming' }], listings: [...listings], price_insights: [] };
    const db = fakeDb(tables);
    const model = fakeModel({ low: 300, high: 500, suggested: 400, reason: 'Sprayers are cheap.', comparable_ids: [] });

    const first = await listingPriceCheck('sprayer', { db, models: [model] });
    const second = await listingPriceCheck('sprayer', { db, models: [model] });
    expect(first.estimate.suggested).toBe(400);
    expect(second).toEqual(first);
    expect(model.create).toHaveBeenCalledTimes(1);
    // The listing is never compared with itself.
    expect(model.create.mock.calls[0][0].messages[1].content).not.toContain('sprayer |');

    tables.listings = tables.listings.map((l) => (l.id === 'sprayer' ? { ...l, title: 'Boom Sprayer 16L' } : l));
    await listingPriceCheck('sprayer', { db, models: [model] });
    expect(model.create).toHaveBeenCalledTimes(2);
  });

  it('returns undefined for a listing that does not exist', async () => {
    const db = fakeDb({ listings: [] });
    expect(await listingPriceCheck('nope', { db, models: [fakeModel({})] })).toBeUndefined();
  });
});
