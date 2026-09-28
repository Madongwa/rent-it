import { afterEach, describe, it, expect, vi } from 'vitest';
import { createPageTranslator, shouldTranslate } from './pageTranslator';

// Pretend backend: "Hello" -> "[hi] Hello".
function fakeFetch() {
  return vi.fn(async (lang, texts) => Object.fromEntries(texts.map((t) => [t, `[${lang}] ${t}`])));
}

function memoryStorage() {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = v), data };
}

let translator;
afterEach(() => {
  translator?.stop();
  document.body.innerHTML = '';
});

function setup(html, options = {}) {
  document.body.innerHTML = html;
  const fetchTranslations = options.fetchTranslations || fakeFetch();
  translator = createPageTranslator({ root: document.body, fetchTranslations, storage: options.storage || memoryStorage() });
  return fetchTranslations;
}

describe('shouldTranslate', () => {
  it('skips text with no letters, emails and links', () => {
    expect(shouldTranslate('Log in')).toBe(true);
    expect(shouldTranslate('₹1,500')).toBe(false);
    expect(shouldTranslate('12:30')).toBe(false);
    expect(shouldTranslate('help@rentit.in')).toBe(false);
    expect(shouldTranslate('https://rentit.in')).toBe(false);
  });
});

describe('createPageTranslator', () => {
  it('translates text and placeholders, keeping spacing, and leaves translate="no" alone', async () => {
    setup('<p> Hello </p><input placeholder="Search"><div translate="no"><p>Private chat</p></div>');
    translator.start('hi');

    await vi.waitFor(() => expect(document.querySelector('p').textContent).toBe(' [hi] Hello '));
    expect(document.querySelector('input').getAttribute('placeholder')).toBe('[hi] Search');
    expect(document.querySelector('[translate="no"] p').textContent).toBe('Private chat');
  });

  it('translates an element made of several text nodes as one sentence', async () => {
    const fetchTranslations = setup('<span></span>');
    const span = document.querySelector('span');
    span.append('3', ' unread chat', 's'); // how React renders {n} unread chat{s}
    translator.start('te');

    await vi.waitFor(() => expect(span.textContent).toBe('[te] 3 unread chats'));
    expect(fetchTranslations.mock.calls.flat(2)).toContain('3 unread chats');
  });

  it('re-translates text that changes after it was translated (a React update)', async () => {
    setup('<p>Loading</p>');
    translator.start('hi');
    const text = document.querySelector('p').firstChild;
    await vi.waitFor(() => expect(text.nodeValue).toBe('[hi] Loading'));

    text.nodeValue = 'Ready';
    await vi.waitFor(() => expect(text.nodeValue).toBe('[hi] Ready'));
  });

  it('translates content added later', async () => {
    setup('<main></main>');
    translator.start('hi');
    const p = document.createElement('p');
    p.textContent = 'New listing';
    document.querySelector('main').append(p);

    await vi.waitFor(() => expect(p.textContent).toBe('[hi] New listing'));
  });

  it('puts the English back when switched back to English', async () => {
    setup('<p>Hello</p><input placeholder="Search">');
    translator.start('hi');
    await vi.waitFor(() => expect(document.querySelector('p').textContent).toBe('[hi] Hello'));

    translator.start('en');
    expect(document.querySelector('p').textContent).toBe('Hello');
    expect(document.querySelector('input').getAttribute('placeholder')).toBe('Search');
  });

  it('shows stored translations straight away, without asking the backend', () => {
    const storage = memoryStorage();
    storage.setItem('rentit.translations.v1.hi', JSON.stringify({ Hello: 'नमस्ते' }));
    const fetchTranslations = setup('<p>Hello</p>', { storage });
    translator.start('hi');

    expect(document.querySelector('p').textContent).toBe('नमस्ते');
    expect(fetchTranslations).not.toHaveBeenCalled();
  });

  it('asks again later for text the backend could not translate (e.g. rate-limited)', async () => {
    vi.useFakeTimers();
    try {
      const fetchTranslations = vi
        .fn()
        .mockResolvedValueOnce({ Hello: null })
        .mockResolvedValueOnce({ Hello: 'नमस्ते' });
      setup('<p>Hello</p>', { fetchTranslations });
      translator.start('hi');
      await vi.advanceTimersByTimeAsync(100);
      expect(document.querySelector('p').textContent).toBe('Hello');

      await vi.advanceTimersByTimeAsync(15 * 1000);
      expect(fetchTranslations).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(100);
      expect(document.querySelector('p').textContent).toBe('नमस्ते');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the English when the backend has no translation', async () => {
    const fetchTranslations = setup('<p>Hello</p>', { fetchTranslations: vi.fn(async () => ({ Hello: null })) });
    translator.start('hi');

    await vi.waitFor(() => expect(fetchTranslations).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 100));
    expect(document.querySelector('p').textContent).toBe('Hello');
  });
});
