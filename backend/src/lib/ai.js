import { groq } from './groq.js';
import { gemini } from './gemini.js';

// A JSON answer from whichever model is available: Gemini first (when
// GEMINI_API_KEY is set), then Groq's gpt-oss-120b and Qwen. Same idea as
// translation's model chain (lib/translate.js) - Gemini's free tier is
// often busy, so each model gets a short timeout and no SDK retries before
// the next one is tried. Used by price suggestions (lib/pricing.js).

const TIMEOUT_MS = 15 * 1000;

export function defaultModels() {
  return [
    gemini && { model: process.env.GEMINI_TRANSLATE_MODEL || 'gemini-3.1-flash-lite', client: gemini },
    { model: 'openai/gpt-oss-120b', client: groq },
    { model: process.env.TRANSLATE_MODEL || 'qwen/qwen3.8-27b', client: groq },
  ].filter(Boolean);
}

// The first {...} object in a reply, tolerating a <think> block or prose
// around it. null if there isn't one.
export function parseJsonObject(content) {
  const cleaned = String(content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const candidates = [cleaned, cleaned.match(/\{[\s\S]*\}/)?.[0]];
  for (const text of candidates) {
    if (!text) continue;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

// Returns { data, model } from the first model whose reply parses and
// passes `validate` (return a cleaned object, or null to reject it), or
// null if none did. `images` (data: URLs; `image` for just one) are shown
// to models that can see pictures - Gemini, or any entry marked
// { vision: true } - and the others get the text alone.
export async function chatJson({ system, user, image, images = image ? [image] : [], maxTokens = 1200, validate = (d) => d, models = defaultModels() }) {
  for (const { model, client, vision } of models) {
    const content =
      images.length && (vision || model.startsWith('gemini'))
        ? [{ type: 'text', text: user }, ...images.map((url) => ({ type: 'image_url', image_url: { url } }))]
        : user;
    try {
      // gpt-oss and Gemini think first, which comes out of max_tokens too.
      const reasoning = model.startsWith('openai/gpt-oss') || model.startsWith('gemini');
      const completion = await client.chat.completions.create(
        {
          model,
          temperature: 0.2,
          max_tokens: maxTokens + (reasoning ? 1500 : 0),
          ...(reasoning ? { reasoning_effort: 'low' } : {}),
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content },
          ],
        },
        { timeout: TIMEOUT_MS, maxRetries: 0 }
      );
      const data = validate(parseJsonObject(completion.choices[0]?.message?.content));
      if (data) return { data, model };
      console.error(`[ai] ${model} gave an unusable answer`);
    } catch (err) {
      console.error(`[ai] ${model} failed:`, err.message);
    }
  }
  return null;
}
