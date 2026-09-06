import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import categoriesRouter from './routes/categories.js';
import listingsRouter from './routes/listings.js';
import rentalsRouter from './routes/rentals.js';
import profilesRouter from './routes/profiles.js';

// The Express app itself, with no app.listen() call. Shared between the
// local dev server (server.js) and the Vercel serverless entry (api/index.js).
const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'rent-it-backend' }));

app.use('/api/categories', categoriesRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/rentals', rentalsRouter);
app.use('/api/profiles', profilesRouter);

// Fallback error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
