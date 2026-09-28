import { describe, it, expect, vi } from 'vitest';
import { combineReview, listingHash, pendingListings, reviewPending, ruleFlags, validateReviews } from './safety.js';

vi.mock('./groq.js', () => ({ groq: null }));
vi.mock('./gemini.js', () => ({ gemini: null }));
vi.mock('./supabaseClient.js', () => ({ supabase: null }));

function fakeDb(tables) {
  return {
    from(table) {
      const filters = [];
      const q = {
        select: () => q,
        neq: (c, v) => (filters.push((r) => r[c] !== v), q),
        order: () => q,
        limit: () => q,
        then: (resolve) => resolve({ data: (tables[table] || []).filter((r) => filters.every((f) => f(r))), error: null }),
        upsert: async (rows) => {
          const ids = new Set(rows.map((r) => r.listing_id));
          tables[table] = [...(tables[table] || []).filter((r) => !ids.has(r.listing_id)), ...rows];
          return { error: null };
        },
      };
      return q;
    },
  };
}

// A model answering every listing it's sent with `verdictFor(listing)`.
function fakeModel(verdictFor) {
  const create = vi.fn(async ({ messages }) => {
    const { listings } = JSON.parse(messages[1].content);
    return { choices: [{ message: { content: JSON.stringify({ reviews: listings.map((l) => ({ id: l.id, ...verdictFor(l) })) }) } }] };
  });
  return { model: 'fake', client: { chat: { completions: { create } } }, create };
}

const ok = { verdict: 'ok', severity: 'low', reasons: [] };

describe('ruleFlags', () => {
  it('catches phone numbers, UPI IDs, advance-payment asks, OTPs and links', () => {
    const reasons = (t) => ruleFlags(t).map((r) => r.reason);
    expect(reasons('Call 98765 43210 to book')[0]).toMatch(/phone number/);
    expect(reasons('pay to rent.it@okaxis')[0]).toMatch(/UPI ID/);
    expect(reasons('Pay 500 token amount to confirm')[0]).toMatch(/in advance/);
    expect(reasons('share the OTP')[0]).toMatch(/OTP/);
    expect(reasons('photos at https://example.com')[0]).toMatch(/link/);
  });

  it('leaves ordinary listing text alone', () => {
    expect(ruleFlags('5 ft rotavator, 45 HP tractor needed. Deposit ₹2,000 at pickup. Pincode 141001.')).toEqual([]);
  });
});

describe('validateReviews', () => {
  it('needs a verdict for every listing sent', () => {
    expect(validateReviews({ reviews: [{ id: 'a', verdict: 'ok' }] }, ['a', 'b'])).toBeNull();
    expect(validateReviews({ reviews: [{ id: 'a', verdict: 'maybe' }] }, ['a'])).toBeNull();
    expect(validateReviews({ reviews: [{ id: 'a', verdict: 'flagged', severity: 'extreme', reasons: ['x', 5] }] }, ['a'])).toEqual({
      a: { verdict: 'flagged', severity: 'medium', reasons: ['x'] },
    });
  });
});

describe('combineReview', () => {
  it('flags on a rule hit even when the AI says ok, with the most serious severity', () => {
    expect(combineReview({ title: 'Drill', description: 'Pay advance payment first' }, ok)).toEqual({
      status: 'flagged',
      severity: 'high',
      reasons: ['Asks for payment in advance'],
    });
  });

  it('keeps the AI reasons when it flags', () => {
    const r = combineReview({ title: 'Air rifle' }, { verdict: 'flagged', severity: 'high', reasons: ['Weapon'] });
    expect(r).toEqual({ status: 'flagged', severity: 'high', reasons: ['Weapon'] });
  });

  it('is ok when neither flags', () => {
    expect(combineReview({ title: 'Ladder' }, ok)).toEqual({ status: 'ok', severity: null, reasons: [] });
  });
});

describe('reviewPending', () => {
  const listings = [
    { id: 'l1', title: 'Ladder', status: 'available', price_per_day: 150 },
    { id: 'l2', title: 'JCB for ₹150/day', status: 'available', price_per_day: 150 },
    { id: 'l3', title: 'Old drill', status: 'inactive', price_per_day: 100 },
  ];

  it('reviews active listings once, and again only after an edit', async () => {
    const tables = { listings: [...listings], listing_safety_reviews: [] };
    const db = fakeDb(tables);
    const model = fakeModel((l) => (l.id === 'l2' ? { verdict: 'flagged', severity: 'high', reasons: ['Price far too low'] } : ok));

    expect(await reviewPending({ db, models: [model] })).toEqual({ reviewed: 2, flagged: 1, failed: 0, remaining: 0 });
    expect(tables.listing_safety_reviews.find((r) => r.listing_id === 'l2')).toMatchObject({ status: 'flagged', reasons: ['Price far too low'] });
    expect(await pendingListings({ db })).toEqual([]);

    tables.listings = tables.listings.map((l) => (l.id === 'l1' ? { ...l, title: 'Ladder 8ft' } : l));
    expect((await pendingListings({ db })).map((l) => l.id)).toEqual(['l1']);
  });

  it('leaves listings pending when the AI has no usable answer', async () => {
    const tables = { listings: [...listings], listing_safety_reviews: [] };
    const bad = { model: 'bad', client: { chat: { completions: { create: async () => ({ choices: [{ message: { content: '{}' } }] }) } } } };
    expect(await reviewPending({ db: fakeDb(tables), models: [bad] })).toEqual({ reviewed: 0, flagged: 0, failed: 2, remaining: 2 });
  });

  it('hashes the reviewed details, not the status', () => {
    expect(listingHash({ ...listings[0], status: 'rented' })).toBe(listingHash(listings[0]));
  });
});
