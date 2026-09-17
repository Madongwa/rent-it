import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import categoriesRouter from './routes/categories.js';
import listingsRouter from './routes/listings.js';
import rentalsRouter from './routes/rentals.js';
import profilesRouter from './routes/profiles.js';
import reviewsRouter from './routes/reviews.js';
import favoritesRouter from './routes/favorites.js';
import messagesRouter from './routes/messages.js';
import notificationsRouter from './routes/notifications.js';
import kycRouter from './routes/kyc.js';
import adminRouter from './routes/admin.js';
import chatRouter from './routes/chat.js';
import webhooksRouter from './routes/webhooks.js';

// The Express app itself, with no app.listen() call. Shared between the
// local dev server (server.js) and the Vercel serverless entry (api/index.js).
const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

// Every Vercel deployment of the frontend (not just the production alias in
// CLIENT_ORIGIN) gets its own throwaway preview URL, e.g.
// https://rent-it-exzvxbdqz-shawnharsha2-6771.vercel.app - these change on
// every deploy, so they can't be listed individually. Recognize the whole
// family by shape instead: https://rent-i<anything>-shawnharsha2-6771.vercel.app
const previewOriginPattern = /^https:\/\/rent-i[a-z0-9-]*-shawnharsha2-6771\.vercel\.app$/i;

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header (curl, server-to-server, same-origin) - allow.
      if (!origin || allowedOrigins.includes(origin) || previewOriginPattern.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
  })
);

// Mounted before express.json() below, deliberately - webhook signature
// verification needs the exact raw bytes the sender signed, which a
// JSON.parse()'d-then-reserialized body can't guarantee byte-for-byte.
app.use('/api/webhooks', express.raw({ type: '*/*' }), webhooksRouter);

app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'rent-it-backend' }));

app.use('/api/categories', categoriesRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/rentals', rentalsRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/kyc', kycRouter);
app.use('/api/admin', adminRouter);
app.use('/api/chat', chatRouter);

// Fallback error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
