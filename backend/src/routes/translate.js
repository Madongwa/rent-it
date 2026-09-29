import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { isSupportedLanguage } from '../lib/languages.js';
import { translateMessages, translateUiTexts } from '../lib/translate.js';

const router = Router();

// UI translation is open to logged-out visitors too (they can switch
// language), so it has its own, tighter limit than the app-wide one. Most
// requests are answered from the cache without touching the model.
const uiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many translation requests - please wait a moment.' },
});

const MAX_UI_TEXTS = 100;
const MAX_UI_TEXT_LENGTH = 2000;
const MAX_UI_TOTAL_CHARS = 12000;

// POST /api/translate/ui - body: { lang, texts: [string] }. Returns
// { translations: { [text]: string | null } }; null means "couldn't
// translate it this time", and the page keeps showing the English.
router.post('/ui', uiRateLimiter, async (req, res) => {
  const { lang, texts } = req.body || {};
  if (!isSupportedLanguage(lang) || lang === 'en') return res.status(400).json({ error: 'Unsupported language' });
  if (!Array.isArray(texts) || texts.length === 0 || texts.length > MAX_UI_TEXTS) {
    return res.status(400).json({ error: `texts must be a list of 1-${MAX_UI_TEXTS} strings` });
  }
  if (texts.some((t) => typeof t !== 'string' || !t.trim() || t.length > MAX_UI_TEXT_LENGTH)) {
    return res.status(400).json({ error: `Each text must be a non-empty string of at most ${MAX_UI_TEXT_LENGTH} characters` });
  }
  if (texts.reduce((n, t) => n + t.length, 0) > MAX_UI_TOTAL_CHARS) {
    return res.status(400).json({ error: 'Too much text in one request' });
  }

  try {
    res.json({ translations: await translateUiTexts(texts, lang) });
  } catch (err) {
    console.error('[translate] ui failed:', err.message);
    res.status(502).json({ error: 'Translation is unavailable right now' });
  }
});

const messagesRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many translation requests - please wait a moment.' },
});

const MAX_MESSAGE_IDS = 50;

// POST /api/translate/messages - body: { lang, ids: [messageId] }. The other
// person's chat messages in the caller's language. Only text messages in
// the caller's own chats are translated; anything else in `ids` is
// silently left out.
router.post('/messages', requireAuth, messagesRateLimiter, async (req, res) => {
  const { lang, ids } = req.body || {};
  if (!isSupportedLanguage(lang)) return res.status(400).json({ error: 'Unsupported language' });
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_MESSAGE_IDS) {
    return res.status(400).json({ error: `ids must be a list of 1-${MAX_MESSAGE_IDS} message ids` });
  }
  if (ids.some((id) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) {
    return res.status(400).json({ error: 'Invalid message id' });
  }
  try {
    res.json({ translations: await translateMessages([...new Set(ids)], lang, req.user.id) });
  } catch (err) {
    console.error('[translate] messages failed:', err.message);
    res.status(502).json({ error: 'Translation is unavailable right now' });
  }
});

export default router;
