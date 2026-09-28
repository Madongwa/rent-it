// Translates whatever text is on the page into the language picked with the
// navbar language button, by rewriting the page's text in place - so every
// page, including listing titles and descriptions, is covered without each
// component having to know about languages.
//
// How it stays in step with React: each text node we rewrite remembers its
// English original and what we wrote. When React later changes that node
// (new data, a re-render), its value no longer matches what we wrote, so we
// take the new value as the new original and translate that instead. A
// MutationObserver catches those changes and any newly rendered content.
// Our own writes are recognized (value === what we wrote) and ignored.
//
// Opt out with translate="no" on an element - used for chat messages
// (translated separately, per reader), the language menu itself, and
// people's names.
//
// Translations come from the backend (AI, stored server-side so each string
// is translated once per language for everyone), and are also kept in
// localStorage so a return visit shows the translated page straight away.

const SKIP_SELECTOR =
  '[translate="no"], script, style, noscript, textarea, code, pre, svg, [contenteditable=""], [contenteditable="true"]';
const ATTRIBUTES = ['placeholder', 'aria-label', 'title'];
const MAX_TEXT_LENGTH = 2000;
const HAS_LETTERS = /\p{L}/u;
const MAX_REQUEST_ITEMS = 80;
const MAX_REQUEST_CHARS = 10000;
// A string the backend couldn't translate (usually the AI provider's rate
// limit) is asked for again after 15s, then 30s, 1m... up to 5 minutes,
// so a page fills itself in once there's capacity again.
const RETRY_BASE_MS = 15 * 1000;
const RETRY_MAX_MS = 5 * 60 * 1000;

function retryDelay(failures) {
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (failures - 1));
}
const MAX_STORED = 4000;
const FLUSH_DELAY_MS = 60;

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

export function shouldTranslate(text) {
  return (
    text.length > 0 &&
    text.length <= MAX_TEXT_LENGTH &&
    HAS_LETTERS.test(text) &&
    !/^\S+@\S+\.\S+$/.test(text) &&
    !/^https?:\/\/\S+$/.test(text)
  );
}

// "  Log in " -> ["  ", "Log in", " "] - only the middle is sent off, so
// the spacing React put around it survives.
function splitWhitespace(value) {
  const match = value.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return [match[1], match[2], match[3]];
}

// An element whose children are all text nodes - e.g. {count} unread
// chat{s} renders as three - is translated as one sentence rather than
// three fragments.
function isTextGroup(el) {
  const children = el.childNodes;
  if (children.length < 2) return false;
  for (const child of children) if (child.nodeType !== TEXT_NODE) return false;
  return true;
}

function unitFor(textNode) {
  const parent = textNode.parentElement;
  return parent && isTextGroup(parent) ? parent : textNode;
}

function isSkipped(node) {
  const el = node.nodeType === ELEMENT_NODE ? node : node.parentElement;
  return !el || !!el.closest(SKIP_SELECTOR);
}

function storageKey(lang) {
  return `rentit.translations.v1.${lang}`;
}

function loadStored(storage, lang) {
  try {
    const raw = storage?.getItem(storageKey(lang));
    return new Map(raw ? Object.entries(JSON.parse(raw)) : []);
  } catch {
    return new Map();
  }
}

function defaultStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createPageTranslator({ root, fetchTranslations, storage = defaultStorage() }) {
  let lang = null;
  let generation = 0;
  let observer = null;
  let cache = new Map(); // English -> translation, for `lang`
  const textState = new WeakMap(); // Text node -> { orig, shown }
  const attrState = new WeakMap(); // Element -> Map(attribute -> { orig, shown })
  const touched = new Set(); // nodes/elements we've rewritten, to undo on stop()
  let pendingUnits = new Set(); // text nodes / text groups to (re)translate
  let pendingAttrs = new Set(); // elements whose attributes to (re)translate
  let waitingUnits = new Set(); // ...that are waiting on a request
  let waitingAttrs = new Set();
  let missing = new Set(); // English strings to ask the backend for
  const inFlight = new Set();
  const failures = new Map(); // English -> { at, count }
  let flushTimer = null;
  let saveTimer = null;
  let retryTimer = null;

  // The English behind a text node - its current value, unless that's what
  // we last wrote there.
  function originalOf(node) {
    const state = textState.get(node);
    if (state && node.nodeValue === state.shown) return state.orig;
    if (state) textState.delete(node);
    return node.nodeValue;
  }

  function writeText(node, orig, shown) {
    if (node.nodeValue !== shown) node.nodeValue = shown;
    textState.set(node, { orig, shown });
    touched.add(node);
  }

  // Looks a string up, queueing a request if it isn't known yet.
  function lookup(core) {
    const translated = cache.get(core);
    if (translated !== undefined) return translated;
    const failed = failures.get(core);
    if (!inFlight.has(core) && !(failed && Date.now() - failed.at < retryDelay(failed.count))) missing.add(core);
    return undefined;
  }

  function applyUnit(unit) {
    if (!unit.isConnected || isSkipped(unit)) return;
    const isGroup = unit.nodeType === ELEMENT_NODE;
    if (isGroup && !isTextGroup(unit)) {
      // No longer all-text (React added an element) - do its text nodes one by one.
      for (const child of unit.childNodes) if (child.nodeType === TEXT_NODE) applyUnit(child);
      return;
    }
    const nodes = isGroup ? [...unit.childNodes] : [unit];
    const originals = nodes.map(originalOf);
    const [lead, core, trail] = splitWhitespace(originals.join(''));
    if (!shouldTranslate(core)) return;

    const translated = lookup(core);
    if (translated === undefined) {
      waitingUnits.add(unit);
      return;
    }
    nodes.forEach((node, i) => writeText(node, originals[i], i === 0 ? lead + translated + trail : ''));
  }

  function applyAttributes(el) {
    if (!el.isConnected || isSkipped(el)) return;
    const states = attrState.get(el) || new Map();
    for (const attr of ATTRIBUTES) {
      if (!el.hasAttribute(attr)) continue;
      const value = el.getAttribute(attr);
      const state = states.get(attr);
      const orig = state && value === state.shown ? state.orig : value;
      const [lead, core, trail] = splitWhitespace(orig);
      if (!shouldTranslate(core)) continue;
      const translated = lookup(core);
      if (translated === undefined) {
        waitingAttrs.add(el);
        continue;
      }
      const shown = lead + translated + trail;
      if (value !== shown) el.setAttribute(attr, shown);
      states.set(attr, { orig, shown });
    }
    if (states.size) {
      attrState.set(el, states);
      touched.add(el);
    }
  }

  function queueTree(node) {
    if (node.nodeType === TEXT_NODE) {
      if (node.nodeValue.trim()) pendingUnits.add(unitFor(node));
      return;
    }
    if (node.nodeType !== ELEMENT_NODE || isSkipped(node)) return;
    if (ATTRIBUTES.some((a) => node.hasAttribute(a))) pendingAttrs.add(node);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === ELEMENT_NODE) {
          if (n.matches(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
          if (ATTRIBUTES.some((a) => n.hasAttribute(a))) pendingAttrs.add(n);
          return NodeFilter.FILTER_SKIP;
        }
        return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) pendingUnits.add(unitFor(n));
  }

  function onMutations(records) {
    for (const record of records) {
      if (record.type === 'characterData') {
        const node = record.target;
        const state = textState.get(node);
        if (state && node.nodeValue === state.shown) continue; // our own write
        pendingUnits.add(unitFor(node));
      } else if (record.type === 'childList') {
        record.addedNodes.forEach(queueTree);
        // Siblings added or removed can turn a text group into single
        // nodes or back, so its remaining text is re-grouped too.
        for (const child of record.target.childNodes) {
          if (child.nodeType === TEXT_NODE) pendingUnits.add(unitFor(child));
        }
      } else if (record.type === 'attributes') {
        const el = record.target;
        const state = attrState.get(el)?.get(record.attributeName);
        if (state && el.getAttribute(record.attributeName) === state.shown) continue;
        pendingAttrs.add(el);
      }
    }
    scheduleFlush();
  }

  function scheduleFlush() {
    if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
  }

  function flush() {
    clearTimeout(flushTimer);
    flushTimer = null;
    const units = pendingUnits;
    const attrs = pendingAttrs;
    pendingUnits = new Set();
    pendingAttrs = new Set();
    units.forEach(applyUnit);
    attrs.forEach(applyAttributes);
    for (const node of touched) if (!node.isConnected) touched.delete(node);
    requestMissing();
  }

  function requestMissing() {
    if (missing.size === 0) return;
    const texts = [...missing];
    missing = new Set();
    const batches = [];
    let batch = [];
    let chars = 0;
    for (const text of texts) {
      if (batch.length && (batch.length >= MAX_REQUEST_ITEMS || chars + text.length > MAX_REQUEST_CHARS)) {
        batches.push(batch);
        batch = [];
        chars = 0;
      }
      batch.push(text);
      chars += text.length;
    }
    batches.push(batch);

    const requestLang = lang;
    const requestGeneration = generation;
    for (const b of batches) {
      b.forEach((t) => inFlight.add(t));
      Promise.resolve()
        .then(() => fetchTranslations(requestLang, b))
        .catch(() => ({}))
        .then((translations) => {
          if (requestGeneration !== generation) return; // language changed meanwhile
          let soonestRetry = null;
          for (const text of b) {
            inFlight.delete(text);
            const value = translations?.[text];
            if (typeof value === 'string' && value) {
              cache.set(text, value);
              failures.delete(text);
            } else {
              const count = (failures.get(text)?.count || 0) + 1;
              failures.set(text, { at: Date.now(), count });
              soonestRetry = Math.min(soonestRetry ?? Infinity, retryDelay(count));
            }
          }
          if (soonestRetry !== null) scheduleRetry(soonestRetry);
          scheduleSave();
          waitingUnits.forEach((u) => pendingUnits.add(u));
          waitingAttrs.forEach((el) => pendingAttrs.add(el));
          waitingUnits = new Set();
          waitingAttrs = new Set();
          scheduleFlush();
        });
    }
  }

  function scheduleRetry(delay) {
    if (retryTimer) return;
    const retryGeneration = generation;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (retryGeneration !== generation) return;
      waitingUnits.forEach((u) => pendingUnits.add(u));
      waitingAttrs.forEach((el) => pendingAttrs.add(el));
      waitingUnits = new Set();
      waitingAttrs = new Set();
      flush();
    }, delay + 50);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    const saveLang = lang;
    const entries = cache;
    saveTimer = setTimeout(() => {
      try {
        const all = [...entries];
        storage?.setItem(storageKey(saveLang), JSON.stringify(Object.fromEntries(all.slice(-MAX_STORED))));
      } catch {
        // Storage full or blocked - the backend still has everything.
      }
    }, 500);
  }

  // Puts every rewritten text and attribute back to its English.
  function restore() {
    for (const node of touched) {
      if (node.nodeType === TEXT_NODE) {
        const state = textState.get(node);
        if (state && node.nodeValue === state.shown) node.nodeValue = state.orig;
        textState.delete(node);
      } else {
        for (const [attr, state] of attrState.get(node) || []) {
          if (node.getAttribute(attr) === state.shown) node.setAttribute(attr, state.orig);
        }
        attrState.delete(node);
      }
    }
    touched.clear();
  }

  function stop() {
    generation++;
    observer?.disconnect();
    observer = null;
    clearTimeout(flushTimer);
    flushTimer = null;
    clearTimeout(retryTimer);
    retryTimer = null;
    restore();
    pendingUnits = new Set();
    pendingAttrs = new Set();
    waitingUnits = new Set();
    waitingAttrs = new Set();
    missing = new Set();
    inFlight.clear();
    failures.clear();
    lang = null;
  }

  function start(newLang) {
    stop();
    if (!newLang || newLang === 'en') return;
    lang = newLang;
    cache = loadStored(storage, newLang);
    observer = new MutationObserver(onMutations);
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTES,
    });
    queueTree(root);
    flush(); // anything already in localStorage shows immediately
  }

  return { start, stop, flush };
}
