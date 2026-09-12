// Applies backend/schema.sql directly against Supabase's Postgres database
// via DATABASE_URL (a direct/pooler connection string - see .env.example),
// since Supabase's REST API can't run DDL. schema.sql is written to be
// safe to re-run (IF NOT EXISTS / OR REPLACE / drop-then-recreate guards
// throughout), so this can be run again any time it's updated.
//
// Usage: cd backend && node scripts/run-migration.js

import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in backend/.env - see backend/.env.example.');
    process.exit(1);
  }

  const sql = readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected. Applying backend/schema.sql...');
  try {
    await client.query(sql);
    console.log('Migration applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
