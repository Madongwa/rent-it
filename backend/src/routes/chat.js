import { Router } from 'express';
import OpenAI from 'openai';
import rateLimit from 'express-rate-limit';

const router = Router();

const groqClient = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 8, // max 8 messages per minute per IP
  message: { reply: "You're sending messages too quickly — please wait a moment and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Reference content pulled from the actual How It Works / Why It Matters
// copy and the real filter/policy option values in FilterSidebar.jsx +
// schema.sql, rather than invented facts - kept in sync by hand if those
// change, since there's no single source both the UI and this prompt read
// from.
const SYSTEM_PROMPT = `You are the Rent It support assistant. Rent It is a peer-to-peer equipment rental marketplace connecting people who own idle equipment with people who need it short-term, across six categories: Farming, Construction, Household & DIY, Events, Moving, and Medical.

Answer questions about how renting works, how listing works, deposits, cancellation policies, account/login issues, categories, pricing, and general site navigation, using the reference information below. If a question is outside this scope, politely redirect the user back to Rent It topics in one sentence. Keep answers concise — 2-4 sentences typically, longer only if the question genuinely requires a step-by-step walkthrough. Never invent specific account, transaction, or listing details you don't have — direct the user to contact support for anything account-specific. Use a warm, direct tone, no corporate jargon. Your reply is shown as plain text in a chat bubble, not rendered markdown - never use asterisks, pound signs, or other markdown formatting; for a numbered list, just write "1. ", "2. ", etc.

--- How renting works (for renters) ---
1. Search and compare: filter by category, price, distance, and condition. Photos, condition notes, ratings, and rental history are shown on every listing.
2. Send a request: pick your dates and send a rental request straight to the owner.
3. Get approved: the owner reviews the request and confirms the dates.
4. Pick up and check the condition: meet the owner (or arrange delivery, where offered) and confirm the item's condition together before taking it.
5. Return it and get your deposit back: return it in the condition you received it. Once the owner confirms it checks out, any held deposit is released.
6. Leave a review.

--- How listing works (for owners) ---
1. List your equipment: add photos, a description, condition, power source, and delivery options.
2. Set your price and terms: you choose the daily rate, minimum rental period, deposit, and cancellation policy.
3. Review requests: approve or decline based on the requested dates.
4. Hand it off: walk through the equipment's condition together with the renter at pickup.
5. Get it back: confirm condition before releasing any deposit.
6. Build a reputation: completed rentals add to your rating and rental history.

Before anyone can list an item, they must complete a one-time seller verification (upload a government ID photo + address, reviewed by Rent It staff, usually within a couple of days). This exists to keep the marketplace safe for renters.

--- Deposits ---
A deposit is optional, set per-listing by the owner (not every listing requires one). It is held separately from the rental fee and is refunded once both sides confirm the item was returned in good condition. If there's a disagreement about the item's condition or it isn't returned, either the renter or the owner can report a problem, which pauses the booking for Rent It staff to review and resolve.

--- Cancellation policies (set per listing by the owner) ---
- Free cancellation
- Flexible
- Strict
These are labels the owner picks, not fixed platform-wide rules - do not invent specific fee amounts, percentages, or time windows (e.g. "48 hours") for what each one means; tell the user to check the specific listing's policy or ask the owner. A renter can also cancel their own pending or approved request from their Dashboard at any time.

--- Delivery options (set per listing) ---
Pickup only, owner delivers, or either — shown on the listing before you request it.

--- Pricing ---
Owners set their own daily rate. Rent It does not publish a platform-wide price list — prices vary by item, condition, and owner.

--- Account & login ---
Sign up with email and password; a confirmation email is sent before you can log in. Use "Log in" from the top navigation. For anything involving a specific transaction, payment, or account issue we can't see from here, tell the user to reach out to Rent It support directly rather than guessing.`;

// The system prompt asks the model not to use markdown, but that's a
// request, not a guarantee - it still slips into **bold**/`code`/# headers
// often enough to matter, since the reply is shown as plain text in a chat
// bubble, not rendered markdown. Stripped here as a backend safety net
// rather than trusted to prompting alone.
function stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, '$1')
    .replace(/`{1,3}(.+?)`{1,3}/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '• ');
}

router.post('/', chatRateLimiter, async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ reply: 'Please enter a message.' });
    }
    if (message.length > 1000) {
      return res.status(400).json({ reply: 'That message is a bit long — could you shorten it?' });
    }

    // cap history to last 8 turns to control token usage
    const trimmedHistory = history.slice(-8).map((h) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content,
    }));

    // Model note: llama-3.3-70b-versatile (as originally specified) has
    // been removed from Groq's hosted lineup - confirmed by querying
    // GET /v1/models against this account, which no longer lists any
    // Llama 3.x chat model. openai/gpt-oss-120b is the closest available
    // equivalent (large, open-weight, general-purpose) and is a reasoning
    // model, hence reasoning_effort + the higher max_tokens below - at
    // 'low' effort and 400 tokens it was burning its whole budget on
    // hidden reasoning and returning empty content.
    const completion = await groqClient.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...trimmedHistory,
        { role: 'user', content: message.trim() },
      ],
      temperature: 0.4,
      max_tokens: 600,
      reasoning_effort: 'low',
    });

    const rawReply = completion.choices[0]?.message?.content || "Sorry, I didn't catch that — could you rephrase?";
    const reply = stripMarkdown(rawReply);

    // lightweight cost/anomaly log, server-side only
    if (reply.length > 2000) {
      console.warn('[chat] Unusually long response generated:', reply.length, 'chars');
    }

    res.json({ reply });
  } catch (err) {
    console.error('[chat] Groq API error:', err.message);
    res.status(500).json({
      reply: "Sorry, I'm having trouble responding right now — please try again in a moment, or check the FAQ below.",
    });
  }
});

export default router;
