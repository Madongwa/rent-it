import { describe, it, expect, vi } from 'vitest';
import {
  indiaToday,
  matchNewListing,
  publicWanted,
  searchAlternatives,
  validateDraft,
  validateMatches,
  validateTerms,
  validateWantedInput,
} from './wanted.js';

vi.mock('./groq.js', () => ({ groq: null }));
vi.mock('./gemini.js', () => ({ gemini: null }));
vi.mock('./supabaseClient.js', () => ({ supabase: null }));
vi.mock('./notify.js', () => ({ notify: vi.fn() }));

const categories = [
  { id: 1, name: 'Farming Tools' },
  { id: 2, name: 'Construction Tools' },
];
const today = '2026-09-30';

// A model stand-in for chatJson: always answers with `reply`.
const fakeModels = (reply) => [
  { model: 'fake', client: { chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify(reply) } }] }) } } } },
];

describe('indiaToday', () => {
  it('uses the Indian date, not UTC', () => {
    // 20:00 UTC on the 30th is already the 1st in India.
    expect(indiaToday(new Date('2026-09-30T20:00:00Z'))).toBe('2026-10-01');
  });
});

describe('validateWantedInput', () => {
  it('cleans a normal post', () => {
    const { value } = validateWantedInput(
      { title: '  JCB   backhoe ', details: 'For a foundation', category_id: '2', max_price_per_day: '4000', needed_from: '2026-10-05', needed_until: '2026-10-07', location: 'Pune' },
      categories,
      today
    );
    expect(value).toEqual({
      title: 'JCB backhoe',
      details: 'For a foundation',
      location: 'Pune',
      category_id: 2,
      max_price_per_day: 4000,
      needed_from: '2026-10-05',
      needed_until: '2026-10-07',
    });
  });

  it('drops past or backwards dates rather than guessing', () => {
    const { value } = validateWantedInput({ title: 'Ladder', needed_from: '2026-01-01', needed_until: '2026-10-02' }, categories, today);
    expect(value.needed_from).toBeNull();
    expect(value.needed_until).toBe('2026-10-02');
    const back = validateWantedInput({ title: 'Ladder', needed_from: '2026-10-09', needed_until: '2026-10-02' }, categories, today).value;
    expect(back.needed_until).toBeNull();
  });

  it('refuses phone numbers, UPI IDs and advance-payment talk', () => {
    expect(validateWantedInput({ title: 'Tractor, call 9876543210' }, categories, today).error).toMatch(/phone number/);
    expect(validateWantedInput({ title: 'Drill', details: 'pay to ravi@ybl' }, categories, today).error).toMatch(/UPI/);
  });

  it('refuses nonsense', () => {
    expect(validateWantedInput({ title: 'x' }, categories, today).error).toBeTruthy();
    expect(validateWantedInput({ title: 'Drill', category_id: 99 }, categories, today).error).toBeTruthy();
    expect(validateWantedInput({ title: 'Drill', max_price_per_day: -5 }, categories, today).error).toBeTruthy();
  });
});

describe('publicWanted', () => {
  it('shows the first name only, never the poster id', () => {
    const out = publicWanted({ id: 'w1', user_id: 'u1', title: 'Drill', poster: { full_name: 'Asha Rao' } }, 'u2');
    expect(out.poster_name).toBe('Asha');
    expect(out.is_mine).toBe(false);
    expect(out).not.toHaveProperty('user_id');
    expect(publicWanted({ id: 'w1', user_id: 'u1', title: 'Drill' }, 'u1').is_mine).toBe(true);
  });
});

describe('validateDraft', () => {
  it('maps the category name and keeps sane values', () => {
    expect(
      validateDraft({ title: 'Tractor', category: 'farming tools', max_price_per_day: '2000', needed_from: '2026-10-03', needed_until: 'soon' }, categories, today)
    ).toEqual({ title: 'Tractor', details: null, category_id: 1, location: null, max_price_per_day: 2000, needed_from: '2026-10-03', needed_until: null });
    expect(validateDraft({ title: '' }, categories, today)).toBeNull();
  });
});

describe('validateMatches / validateTerms', () => {
  it('keeps only real request numbers', () => {
    expect(validateMatches({ matches: [1, 3, 3, 9, 'x'] }, 3)).toEqual([1, 3]);
    expect(validateMatches({}, 3)).toBeNull();
  });
  it('keeps short, new search words', () => {
    expect(validateTerms({ terms: ['Auger', 'post hole digger', 'auger', 'a very long phrase here', '<b>x</b>'] }, 'Post hole digger')).toEqual(['Auger']);
  });
});

function fakeDb({ posts = [], counts = {} } = {}) {
  const inserted = [];
  return {
    inserted,
    from(table) {
      const q = {
        select: () => q,
        eq: () => q,
        gt: () => q,
        neq: () => q,
        order: () => q,
        limit: async () => ({ data: posts, error: null }),
        textSearch: async (_c, term) => ({ count: counts[term] ?? 0, error: null }),
        insert: async (row) => {
          if (inserted.some((r) => r.wanted_id === row.wanted_id && r.listing_id === row.listing_id)) return { error: { code: '23505' } };
          inserted.push({ table, ...row });
          return { error: null };
        },
      };
      return q;
    },
  };
}

describe('matchNewListing', () => {
  const listing = { id: 'l1', owner_id: 'o1', title: 'Mini Excavator', description: 'Digs foundations', location: 'Pune' };

  it('notifies only the renters the AI matched, once each', async () => {
    const db = fakeDb({ posts: [
      { id: 'w1', user_id: 'r1', title: 'JCB for foundation', location: 'Pune' },
      { id: 'w2', user_id: 'r2', title: 'Wheelchair' },
    ] });
    const notifyFn = vi.fn();
    expect(await matchNewListing(listing, { db, models: fakeModels({ matches: [1] }), notifyFn })).toBe(1);
    expect(notifyFn).toHaveBeenCalledTimes(1);
    expect(notifyFn.mock.calls[0][0]).toMatchObject({ userId: 'r1', type: 'wanted_match', link: '/listing/l1' });
    // Same listing again - already told.
    expect(await matchNewListing(listing, { db, models: fakeModels({ matches: [1] }), notifyFn })).toBe(0);
  });

  it('never throws, and does nothing with no open posts', async () => {
    expect(await matchNewListing(listing, { db: fakeDb(), models: fakeModels({ matches: [1] }) })).toBe(0);
    const broken = { from: () => { throw new Error('db down'); } };
    expect(await matchNewListing(listing, { db: broken })).toBe(0);
  });
});

describe('searchAlternatives', () => {
  it('only suggests words that have listings', async () => {
    const db = fakeDb({ counts: { auger: 2, 'earth auger': 0 } });
    expect(await searchAlternatives('post hole digger', { db, models: fakeModels({ terms: ['auger', 'earth auger'] }) })).toEqual([{ term: 'auger', count: 2 }]);
  });
});
