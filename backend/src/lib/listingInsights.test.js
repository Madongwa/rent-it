import { describe, it, expect, vi } from 'vitest';
import { ruleTips, searchDemand, seasonalHint, stateOf, titleWords, validateHint } from './listingInsights.js';

vi.mock('./groq.js', () => ({ groq: null }));
vi.mock('./gemini.js', () => ({ gemini: null }));
vi.mock('./supabaseClient.js', () => ({ supabase: null }));

describe('ruleTips', () => {
  it('points out what the listing is missing', () => {
    const keys = ruleTips({ status: 'inactive', image_urls: ['a'], description: 'Drill', location: '' }, { hasPin: false }).map((t) => t.key);
    expect(keys).toEqual(['paused', 'photos', 'weekly', 'pin', 'description', 'location']);
    const done = {
      status: 'available', image_urls: ['a', 'b', 'c'], price_per_week: 2000, location: 'Pune, Maharashtra',
      description: 'A strong cordless drill with two batteries, a charger and a set of bits - good for walls and wood.',
    };
    expect(ruleTips(done, { hasPin: true })).toEqual([]);
  });
});

describe('helpers', () => {
  it('pick title words and the state', () => {
    expect(titleWords('Mini Excavator (1-2 Ton)')).toEqual(['mini', 'excavator']);
    expect(titleWords('Heavy-Duty Power Drill Set')).toEqual(['power', 'drill']);
    expect(stateOf('Ludhiana, Punjab')).toBe('Punjab');
    expect(stateOf('')).toBe('India');
  });
  it('rejects made-up percentages in hints', () => {
    expect(validateHint({ hint: 'Demand rises 40% before sowing season in Punjab.' })).toBeNull();
    expect(validateHint({ hint: 'Tractors are wanted most before wheat sowing in Oct-Nov.' })).toBeTruthy();
  });
});

describe('searchDemand', () => {
  it('counts matching searches in the last two windows', async () => {
    const calls = [];
    const db = {
      from: () => {
        const c = {};
        const q = {
          select: () => q,
          gte: (_k, v) => ((c.from = v), q),
          lt: (_k, v) => ((c.to = v), q),
          or: async (cond) => (calls.push({ ...c, cond }), { count: calls.length === 1 ? 7 : 3, error: null }),
        };
        return q;
      },
    };
    const out = await searchDemand({ title: 'Tractor 45 HP' }, 'farming', { db, now: new Date('2026-09-30T00:00:00Z') });
    expect(out).toEqual({ recent: 7, previous: 3, days: 14 });
    expect(calls[0].cond).toBe('category_slug.eq.farming,q.ilike.%tractor%');
  });
});

describe('seasonalHint', () => {
  it('uses the cache per category, state and month', async () => {
    const db = { from: () => { const q = { select: () => q, eq: (_k, v) => ((q.key = v), q), maybeSingle: async () => ({ data: { hint: 'cached hint' } }) }; return q; } };
    expect(await seasonalHint({ categoryName: 'Farming', title: 'Tractor', location: 'Ludhiana, Punjab' }, { db, today: '2026-09-30' })).toBe('cached hint');
  });
});
