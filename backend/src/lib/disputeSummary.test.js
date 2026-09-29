import { describe, it, expect, vi } from 'vitest';
import { disputeRecords, summarizeDispute, validateSummary } from './disputeSummary.js';

vi.mock('./groq.js', () => ({ groq: null }));
vi.mock('./gemini.js', () => ({ gemini: null }));
vi.mock('./supabaseClient.js', () => ({ supabase: null }));

// In-memory stand-in for the Supabase queries disputeSummary.js makes.
// Filters on "listing.owner_id" look inside the row's embedded listing.
function fakeDb(tables) {
  const get = (row, col) => col.split('.').reduce((v, k) => v?.[k], row);
  return {
    tables,
    from(table) {
      const filters = [];
      let head = false;
      let updates = null;
      const rows = () => (tables[table] || []).filter((r) => filters.every((f) => f(r)));
      const q = {
        select: (_cols, opts) => ((head = !!opts?.head), q),
        eq: (c, v) => (filters.push((r) => get(r, c) === v), q),
        order: () => q,
        update: (u) => ((updates = u), q),
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (resolve) => {
          if (updates) rows().forEach((r) => Object.assign(r, updates));
          return resolve(head ? { count: rows().length, error: null } : { data: rows(), error: null });
        },
      };
      return q;
    },
  };
}

const OWNER = 'owner-uuid';
const RENTER = 'renter-uuid';
const listing = { id: 'l1', owner_id: OWNER, title: 'Rotary Tiller', description: 'Petrol, 5 ft', price_per_day: 875, deposit_required: true, deposit_amount: 2000, cancellation_policy: 'flexible', condition: 'Like New' };
const rental = { id: 'r1', renter_id: RENTER, start_date: '2026-09-10', end_date: '2026-09-12', status: 'disputed', price_per_day: 750, listed_price_per_day: 875, pickup_photo_urls: [], return_photo_urls: ['a', 'b'], created_at: '2026-09-01', listing };

function tables() {
  return {
    rental_disputes: [{ id: 'd1', reason: 'Blade came back bent', raised_by: OWNER, created_at: '2026-09-13', rental, ai_summary: null }],
    rental_offers: [
      { rental_id: 'r1', proposed_by: RENTER, price_per_day: 650, start_date: '2026-09-10', end_date: '2026-09-12', status: 'countered', created_at: '2026-09-02' },
      { rental_id: 'r1', proposed_by: OWNER, price_per_day: 750, start_date: '2026-09-10', end_date: '2026-09-12', status: 'accepted', created_at: '2026-09-03' },
    ],
    rentals: [{ ...rental }, { id: 'r0', renter_id: RENTER, status: 'completed', listing: { owner_id: 'someone' } }, { id: 'r9', renter_id: 'x', status: 'completed', listing: { owner_id: OWNER } }],
    listings: [listing, { id: 'l2', owner_id: OWNER }],
    messages: [{ body: 'SECRET CHAT TEXT' }],
  };
}

function fakeModel(answer) {
  const create = vi.fn(async () => ({ choices: [{ message: { content: JSON.stringify(answer) } }] }));
  return { model: 'fake', client: { chat: { completions: { create } } }, create };
}

describe('validateSummary', () => {
  it('needs a summary, and trims the lists', () => {
    expect(validateSummary({ facts: ['x'] })).toBeNull();
    expect(validateSummary({ summary: ' Ok. ', facts: ['a', 7, ' b '], check: 'nope' })).toEqual({ summary: 'Ok.', facts: ['a', 'b'], check: [] });
  });
});

describe('disputeRecords', () => {
  it('describes both sides only as Owner/Renter, with track records and no chat', async () => {
    const records = await disputeRecords('d1', fakeDb(tables()));
    const text = JSON.stringify(records);

    expect(text).not.toContain(OWNER);
    expect(text).not.toContain(RENTER);
    expect(text).not.toContain('SECRET CHAT TEXT');
    expect(records.offers.map((o) => [o.by, o.price_per_day, o.status])).toEqual([
      ['Renter', 650, 'countered'],
      ['Owner', 750, 'accepted'],
    ]);
    expect(records.problem_report).toMatchObject({ raised_by: 'Owner', text: 'Blade came back bent' });
    expect(records.rental).toMatchObject({ agreed_price_per_day: 750, pickup_photos_uploaded: 0, return_photos_uploaded: 2 });
    expect(records.listing.deposit_asked_on_listing).toBe(2000);
    expect(records.track_records).toEqual({
      Owner: { listings: 2, completed_rentals_of_their_items: 1, disputes_raised: 1 },
      Renter: { completed_rentals: 1, disputes_raised: 0 },
    });
  });
});

describe('summarizeDispute', () => {
  const answer = { summary: 'Owner says the blade was bent.', facts: ['No pickup photos'], check: ['Ask the Renter for photos'] };

  it('saves the summary and reuses it until a refresh is asked for', async () => {
    const db = fakeDb(tables());
    const model = fakeModel(answer);

    const first = await summarizeDispute('d1', { db, models: [model] });
    expect(first).toMatchObject({ ...answer, model: 'fake' });
    expect(db.tables.rental_disputes[0].ai_summary).toEqual(first);

    expect(await summarizeDispute('d1', { db, models: [model] })).toEqual(first);
    expect(model.create).toHaveBeenCalledTimes(1);

    await summarizeDispute('d1', { db, models: [model], refresh: true });
    expect(model.create).toHaveBeenCalledTimes(2);
  });

  it('returns undefined for no such dispute, null when the AI has nothing usable', async () => {
    expect(await summarizeDispute('nope', { db: fakeDb(tables()), models: [fakeModel(answer)] })).toBeUndefined();
    expect(await summarizeDispute('d1', { db: fakeDb(tables()), models: [fakeModel({ facts: [] })] })).toBeNull();
  });
});
