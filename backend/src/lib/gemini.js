import OpenAI from 'openai';

// Google's Gemini API has an OpenAI-compatible endpoint, so the same SDK is
// used as for Groq (lib/groq.js). Optional - translation falls back to Groq
// alone when GEMINI_API_KEY isn't set.
export const gemini = process.env.GEMINI_API_KEY
  ? new OpenAI({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: process.env.GEMINI_API_KEY,
    })
  : null;
