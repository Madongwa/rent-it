import { describe, it, expect, vi } from 'vitest';
import { suggestReplies, validateReplies } from './replySuggestions.js';

vi.mock('./groq.js', () => ({ groq: null }));
vi.mock('./gemini.js', () => ({ gemini: null }));
vi.mock('./supabaseClient.js', () => ({ supabase: null }));

function fakeDb(tables) {
  const get = (row, col) => col.split('.').reduce((v, k) => v?.[k], row);
  return {
    from(table) {
      const filters = [];
      const rows = () => (tables[table] || []).filter((r) => filters.every((f) => f(r)));
      const q = {
        select: () => q,
        eq: (c, v) => (filters.push((r) => get(r, c) === v), q),
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (resolve) => resolve({ data: rows(), error: null }),
      };
      return q;
    },
  };
}

const conversation = { id: 'c1', owner_id: 'owner', renter_id: 'renter', listing: { title: 'Rotavator', price_per_day: 875 } };
const tables = (messages) => ({
  conversations: [conversation],
  messages: messages.map((m) => ({ conversation_id: 'c1', kind: 'text', ...m })),
  rental_offers: [{ proposed_by: 'renter', price_per_day: 700, start_date: '2026-10-01', end_date: '2026-10-03', status: 'open', rental: { conversation_id: 'c1' } }],
});

function fakeModel(replies) {
  const create = vi.fn(async () => ({ choices: [{ message: { content: JSON.stringify({ replies }) } }] }));
  return { model: 'qwen/fake', client: { chat: { completions: { create } } }, create };
}

describe('validateReplies', () => {
  it('drops unsafe, duplicate and empty drafts and keeps at most three', () => {
    expect(
      validateReplies({
        replies: ['Sure, 7am works.', 'Sure, 7am works.', 'Pay 500 token amount first', 'Call me on 98765 43210', '', 'Where shall we meet?', 'Is it in good condition?', 'One more'],
      })
    ).toEqual(['Sure, 7am works.', 'Where shall we meet?', 'Is it in good condition?']);
    expect(validateReplies({ replies: ['send advance payment'] })).toBeNull();
  });
});

describe('suggestReplies', () => {
  it("drafts replies from the chat and the offer, in the user's language", async () => {
    const model = fakeModel(['Haan, 7 baje ready hai.']);
    const replies = await suggestReplies('c1', 'owner', 'hi', {
      db: fakeDb(tables([{ sender_id: 'renter', body: 'kal milega kya?', created_at: '1' }])),
      models: [model],
    });
    expect(replies).toEqual(['Haan, 7 baje ready hai.']);
    const [system, user] = model.create.mock.calls[0][0].messages;
    expect(system.content).toContain('written in Hindi');
    expect(user.content).toContain('Them: kal milega kya?');
    expect(user.content).toContain('waiting for me to accept, counter or decline');
    expect(user.content).toContain('I am the owner');
  });

  it('refuses someone outside the chat, and has nothing to suggest before the other person writes', async () => {
    const model = fakeModel(['x']);
    expect(await suggestReplies('c1', 'stranger', 'en', { db: fakeDb(tables([])), models: [model] })).toBeNull();
    expect(await suggestReplies('c1', 'owner', 'en', { db: fakeDb(tables([{ sender_id: 'owner', body: 'Hello', created_at: '1' }])), models: [model] })).toEqual([]);
    expect(model.create).not.toHaveBeenCalled();
  });
});
