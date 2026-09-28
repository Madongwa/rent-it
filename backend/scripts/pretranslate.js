// Translates the site's text into every language on the language button
// ahead of time, so visitors get it instantly from ui_translations instead
// of waiting on the AI - and so the free-tier rate limits are only ever hit
// here, slowly, not by a visitor.
//
// What gets translated:
//   - every English string already in ui_translations (in any language) -
//     i.e. everything a page has ever asked to translate. Browse the site
//     once in any one language to collect a page's text.
//   - every listing's title, description, location, condition and
//     accessories note, and every category name, straight from the database.
//
// Only Gemini is used by default, since it gives the best translations -
// anything it can't do this run (quota, "high demand") is left for the next
// run, and anything a visitor's page got from a Groq fallback is redone with
// Gemini. Safe to stop and re-run any time: text that's already translated
// by Gemini is skipped.
//
// Usage: cd backend && node scripts/pretranslate.js [--langs=hi,ta] [--all-models]
//   --langs       only these languages (default: all 12)
//   --all-models  fall back to Groq when Gemini fails, instead of skipping

import 'dotenv/config';
import { supabase } from '../src/lib/supabaseClient.js';
import { LANGUAGE_NAMES } from '../src/lib/languages.js';
import { gemini } from '../src/lib/gemini.js';
import { GEMINI_MODEL, defaultModels, translateUiTexts } from '../src/lib/translate.js';

const GEMINI_BACKUP_MODEL = process.env.GEMINI_BACKUP_MODEL || 'gemini-3.5-flash-lite';

const BATCH_SIZE = 40;
const PAUSE_MS = 6000; // between requests - keeps well under Gemini's free per-minute limit
const MAX_TEXT_LENGTH = 2000; // same cap as the page translator
const RETRY_WAITS_MS = [30, 60, 120, 240].map((s) => s * 1000);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [key, value = 'true'] = a.replace(/^--/, '').split('=');
    return [key, value];
  })
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hasLetters = (t) => /\p{L}/u.test(t);

async function fetchAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function collectSources() {
  const texts = new Set();
  const add = (t) => {
    const trimmed = typeof t === 'string' ? t.trim() : '';
    if (trimmed && trimmed.length <= MAX_TEXT_LENGTH && hasLetters(trimmed)) texts.add(trimmed);
  };

  for (const row of await fetchAll('ui_translations', 'source')) add(row.source);
  const seen = texts.size;

  for (const l of await fetchAll('listings', 'title, description, location, condition, accessories_note')) {
    add(l.title);
    add(l.description);
    add(l.location);
    if (l.location) add(`📍 ${l.location.trim()}`); // how the listing page shows it
    add(l.condition);
    add(l.accessories_note);
  }
  for (const c of await fetchAll('categories', 'name')) add(c.name);

  console.log(`${texts.size} texts (${seen} from pages already browsed, the rest from listings/categories)`);
  return [...texts];
}

async function translateAll(texts, lang, models, redo) {
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    // Gemini's free tier often answers "high demand" (503) for a while -
    // so a batch that fails is retried after 30s, 1, 2 and 4 minutes.
    let batch = texts.slice(i, i + BATCH_SIZE);
    for (let attempt = 0; attempt <= RETRY_WAITS_MS.length && batch.length; attempt++) {
      if (attempt > 0) {
        process.stdout.write(`  ${batch.length} failed - waiting ${RETRY_WAITS_MS[attempt - 1] / 1000}s to retry...      \r`);
        await sleep(RETRY_WAITS_MS[attempt - 1]);
      }
      const result = await translateUiTexts(batch, lang, { models, redo });
      ok += batch.filter((t) => result[t]).length;
      batch = batch.filter((t) => !result[t]);
    }
    failed += batch.length;
    process.stdout.write(`  ${redo ? 'redo ' : ''}${Math.min(i + BATCH_SIZE, texts.length)}/${texts.length} (failed so far: ${failed})      \r`);
    if (i + BATCH_SIZE < texts.length) await sleep(PAUSE_MS);
  }
  return { ok, failed };
}

async function main() {
  let models = defaultModels();
  if (!args['all-models']) {
    if (!gemini) {
      console.error('GEMINI_API_KEY is not set in backend/.env - add it, or pass --all-models to use Groq.');
      process.exit(1);
    }
    // No visitor is waiting here, so each model gets longer, and a slower
    // Gemini model backs up the main one when it's "experiencing high demand"
    // (too slow, ~17s a request, to use for live page loads).
    models = [
      { model: GEMINI_MODEL, client: gemini, timeoutMs: 30 * 1000 },
      { model: GEMINI_BACKUP_MODEL, client: gemini, timeoutMs: 90 * 1000 },
    ];
  }

  const langs = (args.langs ? args.langs.split(',') : Object.keys(LANGUAGE_NAMES)).filter((l) => l !== 'en');
  const unknown = langs.filter((l) => !LANGUAGE_NAMES[l]);
  if (unknown.length) throw new Error(`Unknown language code(s): ${unknown.join(', ')}`);

  const texts = await collectSources();
  const totals = {};

  for (const lang of langs) {
    const stored = (await fetchAll('ui_translations', 'source, lang, model')).filter((r) => r.lang === lang);
    const done = new Set(stored.map((r) => r.source));
    const missing = texts.filter((t) => !done.has(t));
    // Translations a fallback model made while Gemini was busy (or from
    // before models were recorded) - redone with Gemini, when using it.
    const upgrade = args['all-models'] ? [] : stored.filter((r) => !r.model?.startsWith('gemini')).map((r) => r.source);
    console.log(`\n${LANGUAGE_NAMES[lang]}: ${done.size} stored, ${missing.length} missing, ${upgrade.length} to redo with Gemini`);

    const a = await translateAll(missing, lang, models, false);
    const b = await translateAll(upgrade, lang, models, true);
    totals[lang] = { ok: a.ok + b.ok, failed: a.failed + b.failed };
    const { ok, failed } = totals[lang];
    console.log(`  ${LANGUAGE_NAMES[lang]} done: ${ok} translated, ${failed} failed${failed ? ' - re-run later to retry these' : ''}`);
  }

  console.log('\nSummary:', JSON.stringify(totals));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
