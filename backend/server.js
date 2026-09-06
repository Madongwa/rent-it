import app from './src/app.js';

// Local dev entry point only. On Vercel, api/index.js imports the same app
// and exports it directly as a serverless function (no app.listen there).
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Rent It API listening on http://localhost:${PORT}`);
});
