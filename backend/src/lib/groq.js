import OpenAI from 'openai';

// Groq speaks the OpenAI API, so the OpenAI SDK is pointed at it. Shared by
// the help assistant (routes/chat.js) and translation (lib/translate.js).
export const groq = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});
