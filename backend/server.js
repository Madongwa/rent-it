import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import categoriesRouter from './src/routes/categories.js';
import listingsRouter from './src/routes/listings.js';
import rentalsRouter from './src/routes/rentals.js';
import profilesRouter from './src/routes/profiles.js';

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Rent It API listening on http://localhost:${PORT}`);
});
