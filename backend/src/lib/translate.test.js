import { describe, it, expect, vi } from 'vitest';
import {
  FALLBACK_MODELS,
  TRANSLATE_MODEL,
  batchTexts,
  hasBrokenWord,
  hashText,
  parseTranslations,
  toAsciiDigits,
  translateUiTexts,
} from './translate.js';

// Every test passes its own fake client/db - the real ones need API keys.
vi.mock('./groq.js', () => ({ groq: null }));
vi.mock('./gemini.js', () => ({ gemini: null }));
vi.mock('./supabaseClient.js', () => ({ supabase: null }));

// A stand-in for the Supabase client: from(table).select().eq().in() reads
// the rows given for that table (filtered like the real query), and
// upsert() records what would have been written.
function fakeDb(tables) {
  const writes = {};
  return {
    writes,
    from(table) {
      const filters = [];
      const query = {
        select: () => query,
        eq: (col, value) => (filters.push((r) => r[col] === value), query),
        in: (col, values) => (filters.push((r) => values.includes(r[col])), query),
        then: (resolve) => resolve({ data: (tables[table] || []).filter((r) => filters.every((f) => f(r))), error: null }),
        upsert: async (rows) => {
          writes[table] = [...(writes[table] || []), ...rows];
          return { error: null };
        },
      };
      return query;
    },
  };
}

// A stand-in for the Groq client that answers each call with `reply(texts)`.
function fakeClient(reply) {
  const create = vi.fn(async ({ messages }) => {
    const { texts } = JSON.parse(messages[1].content);
    return { choices: [{ message: { content: JSON.stringify({ translations: reply(texts) }) } }] };
  });
  return { create, chat: { completions: { create } } };
}

describe('parseTranslations', () => {
  it('reads a plain JSON reply', () => {
    expect(parseTranslations('{"translations":["क","ख"]}', 2)).toEqual(['क', 'ख']);
  });

  it('ignores a <think> block and text around the JSON', () => {
    expect(parseTranslations('<think>hmm</think>Here: {"translations":["क"]} done', 1)).toEqual(['क']);
  });

  it('rejects a list that does not line up with the inputs', () => {
    expect(parseTranslations('{"translations":["क"]}', 2)).toBeNull();
    expect(parseTranslations('not json', 1)).toBeNull();
  });
});

describe('toAsciiDigits', () => {
  it('turns Bengali, Devanagari, Tamil and Urdu digits into 0-9', () => {
    expect(toAsciiDigits('₹১,৫০০/দিন')).toBe('₹1,500/দিন');
    expect(toAsciiDigits('३ दिन')).toBe('3 दिन');
    expect(toAsciiDigits('௫ நாள்')).toBe('5 நாள்');
    expect(toAsciiDigits('۱۲ بجے')).toBe('12 بجے');
    expect(toAsciiDigits('no digits')).toBe('no digits');
  });
});

describe('batchTexts', () => {
  it('splits on item count and total length', () => {
    expect(batchTexts(['a', 'b', 'c'], 2, 100)).toEqual([['a', 'b'], ['c']]);
    expect(batchTexts(['aaaa', 'bbbb', 'c'], 10, 6)).toEqual([['aaaa'], ['bbbb', 'c']]);
  });

  it('keeps a single over-long text in its own batch rather than dropping it', () => {
    expect(batchTexts(['x'.repeat(50)], 10, 6)).toEqual([['x'.repeat(50)]]);
  });
});

describe('translateUiTexts', () => {
  it('serves cached text without calling the model, and translates + stores the rest', async () => {
    const db = fakeDb({
      ui_translations: [{ lang: 'hi', source_hash: hashText('Home'), translated: 'होम' }],
    });
    const client = fakeClient((texts) => texts.map((t) => `hi:${t}`));

    const result = await translateUiTexts(['Home', 'Messages', 'Home'], 'hi', { client, db });

    expect(result).toEqual({ Home: 'होम', Messages: 'hi:Messages' });
    expect(client.create).toHaveBeenCalledTimes(1);
    expect(JSON.parse(client.create.mock.calls[0][0].messages[1].content).texts).toEqual(['Messages']);
    expect(db.writes.ui_translations).toEqual([
      { lang: 'hi', source_hash: hashText('Messages'), source: 'Messages', translated: 'hi:Messages', model: TRANSLATE_MODEL },
    ]);
  });

  it('returns null (and stores nothing) when the model keeps giving an unusable reply', async () => {
    const db = fakeDb({});
    const client = fakeClient(() => []);

    expect(await translateUiTexts(['Home'], 'te', { client, db })).toEqual({ Home: null });
    // Main model and fallback, each retried once.
    expect(client.create).toHaveBeenCalledTimes(2 * (1 + FALLBACK_MODELS.length));
    expect(db.writes.ui_translations).toBeUndefined();
  });
});

describe('hasBrokenWord', () => {
  it('spots a word half in English letters and half in another script', () => {
    expect(hasBrokenWord('یہ کیسے کام کرta ہے')).toBe(true);
    expect(hasBrokenWord('جاipur، راجستھان')).toBe(true);
    expect(hasBrokenWord('नashik')).toBe(true);
  });

  it('allows whole English words inside translated text', () => {
    expect(hasBrokenWord('LED اسٹیج/اپ لائٹنگ کٹ')).toBe(false);
    expect(hasBrokenWord('🛠️ गृहस्थी और DIY')).toBe(false);
    expect(hasBrokenWord('Mahindra 575 DI ट्रैक्टर')).toBe(false);
    expect(hasBrokenWord('Plain English')).toBe(false);
  });
});

describe('broken words', () => {
  it('redoes just the broken strings on the fallback model', async () => {
    const db = fakeDb({});
    const create = vi.fn(async ({ model, messages }) => {
      const { texts } = JSON.parse(messages[1].content);
      const out = texts.map((t) => (model === TRANSLATE_MODEL && t === 'Jaipur' ? 'جاipur' : `ur:${t}`));
      return { choices: [{ message: { content: JSON.stringify({ translations: out }) } }] };
    });

    const result = await translateUiTexts(['Home', 'Jaipur'], 'ur', { client: { chat: { completions: { create } } }, db });

    expect(result).toEqual({ Home: 'ur:Home', Jaipur: 'ur:Jaipur' });
    expect(JSON.parse(create.mock.calls[1][0].messages[1].content).texts).toEqual(['Jaipur']);
  });
});

describe('rate limits', () => {
  it('moves on to the fallback model when the main one is rate-limited', async () => {
    const db = fakeDb({});
    const create = vi.fn(async ({ model, messages }) => {
      if (model === TRANSLATE_MODEL) throw Object.assign(new Error('Rate limit reached'), { status: 429 });
      const { texts } = JSON.parse(messages[1].content);
      return { choices: [{ message: { content: JSON.stringify({ translations: texts.map((t) => `hi:${t}`) }) } }] };
    });

    const result = await translateUiTexts(['Home'], 'hi', { client: { chat: { completions: { create } } }, db });

    expect(result).toEqual({ Home: 'hi:Home' });
    // Not retried on the rate-limited model - straight to the fallback.
    expect(create.mock.calls.map(([args]) => args.model)).toEqual([TRANSLATE_MODEL, FALLBACK_MODELS[0]]);
  });

  it('does not store text that came back unchanged', async () => {
    const db = fakeDb({});
    const client = fakeClient((texts) => texts);

    expect(await translateUiTexts(['Rotavator'], 'hi', { client, db })).toEqual({ Rotavator: 'Rotavator' });
    expect(db.writes.ui_translations).toBeUndefined();
  });
});

describe('redo', () => {
  it('skips the stored copy and overwrites it', async () => {
    const db = fakeDb({ ui_translations: [{ lang: 'hi', source_hash: hashText('Home'), translated: 'old' }] });
    const client = fakeClient((texts) => texts.map(() => 'होम'));

    expect(await translateUiTexts(['Home'], 'hi', { client, db, redo: true })).toEqual({ Home: 'होम' });
    expect(db.writes.ui_translations).toEqual([
      { lang: 'hi', source_hash: hashText('Home'), source: 'Home', translated: 'होम', model: TRANSLATE_MODEL },
    ]);
  });
});
