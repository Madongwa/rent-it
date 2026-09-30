import { describe, it, expect, vi } from 'vitest';
import { agreementText, buildAgreement, TEXT } from './agreement.js';

vi.mock('./groq.js', () => ({ groq: null }));
vi.mock('./gemini.js', () => ({ gemini: null }));
vi.mock('./supabaseClient.js', () => ({ supabase: null }));

const rental = {
  id: 'r1',
  renter_id: 'u1',
  status: 'approved',
  start_date: '2026-10-05',
  end_date: '2026-10-07',
  price_per_day: '1500.00',
  created_at: '2026-09-30T10:00:00Z',
  pickup_photo_urls: ['a', 'b'],
  return_photo_urls: [],
  listing: { id: 'l1', title: 'Tractor', owner_id: 'o1', location: 'Ludhiana', condition: 'Good', deposit_required: true, deposit_amount: '5000', cancellation_policy: 'flexible' },
};
const people = [
  { id: 'o1', full_name: 'Gurpreet Singh', preferred_language: 'pa' },
  { id: 'u1', full_name: 'Asha Rao', preferred_language: 'en' },
];

function fakeDb(row = rental) {
  return {
    from(table) {
      const q = {
        select: () => q,
        eq: () => q,
        in: async () => ({ data: people, error: null }),
        maybeSingle: async () => ({ data: table === 'rentals' ? row : null, error: null }),
      };
      return q;
    },
  };
}

describe('buildAgreement', () => {
  it('works out the totals and adds each person\'s language', async () => {
    const textFor = vi.fn(async (lang) => (lang === 'pa' ? { ...TEXT, title: 'ਕਿਰਾਇਆ ਸਮਝੌਤਾ' } : TEXT));
    const result = await buildAgreement('r1', 'u1', { db: fakeDb(), textFor });
    expect(result.agreement).toMatchObject({
      owner_name: 'Gurpreet Singh',
      renter_name: 'Asha Rao',
      days: 3,
      price_per_day: 1500,
      total: 4500,
      deposit: 5000,
      pickup_photos: 2,
      return_photos: 0,
    });
    expect(result.languages).toEqual(['en', 'pa']);
    expect(result.text.pa.title).toBe('ਕਿਰਾਇਆ ਸਮਝੌਤਾ');
    // Only fixed wording is translated - never names or prices.
    expect(textFor.mock.calls.map((c) => c[0])).toEqual(['en', 'pa']);
  });

  it('only for the two people, and only once agreed', async () => {
    expect((await buildAgreement('r1', 'stranger', { db: fakeDb(), textFor: async () => TEXT })).status).toBe(403);
    expect((await buildAgreement('r1', 'u1', { db: fakeDb({ ...rental, status: 'pending' }), textFor: async () => TEXT })).status).toBe(409);
    expect((await buildAgreement('r1', 'u1', { db: fakeDb(null), textFor: async () => TEXT })).status).toBe(404);
  });
});

describe('agreementText', () => {
  it('falls back to English line by line', async () => {
    const translate = async (texts) => ({ [texts[0]]: 'किराया समझौता' });
    const text = await agreementText('hi', { translate });
    expect(text.title).toBe('किराया समझौता');
    expect(text.term1).toBe(TEXT.term1);
    expect(await agreementText('en')).toBe(TEXT);
  });
});
