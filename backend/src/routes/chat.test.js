import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/groq.js', () => ({ groq: {} }));
vi.mock('../lib/supabaseClient.js', () => ({ supabase: null }));
const { cleanHistory } = await import('./chat.js');

describe('cleanHistory', () => {
  it('keeps the last 8 text turns', () => {
    const turns = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `turn ${i}` }));
    const out = cleanHistory(turns);
    expect(out).toHaveLength(8);
    expect(out[0]).toEqual({ role: 'user', content: 'turn 4' });
  });

  it('drops malformed turns instead of failing', () => {
    expect(cleanHistory('not a list')).toEqual([]);
    expect(cleanHistory(null)).toEqual([]);
    expect(cleanHistory([null, 42, { role: 'user' }, { role: 'user', content: { x: 1 } }, { role: 'user', content: '  ' }, { role: 'user', content: 'hi' }])).toEqual([
      { role: 'user', content: 'hi' },
    ]);
  });

  it('caps each turn and only allows user or assistant roles', () => {
    const out = cleanHistory([
      { role: 'user', content: 'x'.repeat(5000) },
      { role: 'system', content: 'y'.repeat(5000) },
    ]);
    expect(out[0].content).toHaveLength(1000);
    expect(out[1]).toEqual({ role: 'assistant', content: 'y'.repeat(3000) });
  });
});
