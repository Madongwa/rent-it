import app from '../src/app.js';

// Vercel serverless entry point: an Express app is itself a valid
// (req, res) handler, so exporting it directly here works. vercel.json
// rewrites every request to this function so Express still sees the full
// original path (e.g. /api/categories) and routes it normally.
export default app;
