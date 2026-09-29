import { describe, it, expect, vi } from 'vitest';
import { firstReplyMinutes, median, ownerTrust, replyLabel } from './trust.js';

vi.mock('./supabaseClient.js', () => ({ supabase: null }));

function fakeDb(tables) {
  const get = (row, col) => col.split('.').reduce((v, k) => v?.[k], row);
  return {
    from(table) {
      const filters = [];
      let head = false;
      const rows = () => (tables[table] || []).filter((r) => filters.every((f) => f(r)));
      const q = {
        select: (_c, opts) => ((head = !!opts?.head), q),
        eq: (c, v) => (filters.push((r) => get(r, c) === v), q),
        in: (c, vs) => (filters.push((r) => vs.includes(get(r, c))), q),
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (resolve) => resolve(head ? { count: rows().length, error: null } : { data: rows(), error: null }),
      };
      return q;
    },
  };
}

const at = (min) => new Date(Date.UTC(2026, 8, 1, 10, min)).toISOString();

describe('helpers', () => {
  it('median', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("times the owner's first reply after the renter's first message", () => {
    const chat = [
      { sender_id: 'owner', kind: 'text', created_at: at(0) }, // before the question - ignored
      { sender_id: 'renter', kind: 'text', created_at: at(5) },
      { sender_id: 'owner', kind: 'text', created_at: at(35) },
    ];
    expect(firstReplyMinutes(chat, 'owner')).toBe(30);
    expect(firstReplyMinutes(chat.slice(0, 2), 'owner')).toBeNull();
  });

  it('labels reply times', () => {
    expect(replyLabel(20)).toBe('Replies within an hour');
    expect(replyLabel(180)).toBe('Replies within a few hours');
    expect(replyLabel(900)).toBe('Replies within a day');
    expect(replyLabel(3000)).toBeNull();
    expect(replyLabel(null)).toBeNull();
  });
});

describe('ownerTrust', () => {
  it('adds up verification, completed rentals, reply speed, rating and join year', async () => {
    const db = fakeDb({
      profiles: [{ id: 'o1', seller_status: 'approved', created_at: '2025-03-01T00:00:00Z' }],
      listings: [
        { owner_id: 'o1', avg_rating: 5, review_count: 1 },
        { owner_id: 'o1', avg_rating: 4, review_count: 3 },
        { owner_id: 'o1', avg_rating: 0, review_count: 0 },
      ],
      rentals: [
        { status: 'completed', listing: { owner_id: 'o1' } },
        { status: 'completed', listing: { owner_id: 'o1' } },
        { status: 'cancelled', listing: { owner_id: 'o1' } },
        { status: 'completed', listing: { owner_id: 'someone-else' } },
      ],
      conversations: [{ id: 'c1', owner_id: 'o1' }, { id: 'c2', owner_id: 'o1' }],
      messages: [
        { conversation_id: 'c1', sender_id: 'r1', kind: 'text', created_at: at(0) },
        { conversation_id: 'c1', sender_id: 'o1', kind: 'text', created_at: at(10) },
        { conversation_id: 'c2', sender_id: 'r2', kind: 'text', created_at: at(0) },
        { conversation_id: 'c2', sender_id: 'o1', kind: 'text', created_at: at(50) },
      ],
    });

    expect(await ownerTrust('o1', db)).toEqual({
      verified: true,
      completed_rentals: 2,
      reply_minutes: 30,
      reply_label: 'Replies within an hour',
      rating: 4.3,
      reviews: 4,
      member_since: 2025,
    });
  });

  it('shows nothing about reply speed from a single chat', async () => {
    const db = fakeDb({
      profiles: [{ id: 'o1', seller_status: 'pending', created_at: '2026-01-01T00:00:00Z' }],
      listings: [],
      rentals: [],
      conversations: [{ id: 'c1', owner_id: 'o1' }],
      messages: [
        { conversation_id: 'c1', sender_id: 'r1', kind: 'text', created_at: at(0) },
        { conversation_id: 'c1', sender_id: 'o1', kind: 'text', created_at: at(5) },
      ],
    });
    const trust = await ownerTrust('o1', db);
    expect(trust).toMatchObject({ verified: false, reply_minutes: null, reply_label: null, rating: null, reviews: 0 });
  });
});
