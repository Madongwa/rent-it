import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn(
    '[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. ' +
      'Copy backend/.env.example to backend/.env and fill in your Supabase project credentials.'
  );
}

// TEMPORARY DEBUG - remove once the "Invalid path specified" issue is
// diagnosed. Logs the exact SUPABASE_URL value (quoted, so stray
// whitespace/newlines are visible) and the service role key's length only
// (never its content) to Vercel's function logs.
console.log(
  '[debug] SUPABASE_URL =', JSON.stringify(supabaseUrl),
  '| SUPABASE_SERVICE_ROLE_KEY length =', serviceRoleKey ? serviceRoleKey.length : 0
);

// Server-side client using the service role key. This key bypasses Row
// Level Security, so every route in this app must enforce ownership /
// authorization checks itself before reading or writing data.
export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
