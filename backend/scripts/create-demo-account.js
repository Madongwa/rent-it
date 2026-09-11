// DEMO ACCOUNT — REMOVE BEFORE PRODUCTION / when asked
//
// Creates (or fixes up) a single demo login for showcasing the site
// without creating a fresh account live. Email is confirmed immediately
// via the admin API, bypassing the normal signup confirmation flow for
// this one seeded user only - the underlying auth flow for real users is
// untouched.
//
// Usage: cd backend && node scripts/create-demo-account.js

import { supabase } from '../src/lib/supabaseClient.js';

const DEMO_EMAIL = 'shawn@gmail.com';
const DEMO_PASSWORD = '12345678';
const DEMO_FULL_NAME = 'Shawn (Demo)';

async function findExistingUserByEmail(email) {
  const perPage = 1000;
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < perPage) break;
  }
  return null;
}

async function main() {
  const existing = await findExistingUserByEmail(DEMO_EMAIL);

  if (existing) {
    console.log(`Demo account already exists (${existing.id}) - confirming email + resetting password.`);
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    console.log('Done. Demo account is confirmed and ready to log in.');
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true, // skip the normal confirmation-email step for this user only
    user_metadata: { full_name: DEMO_FULL_NAME },
  });
  if (error) throw error;

  console.log(`Created demo account ${DEMO_EMAIL} (${data.user.id}), email pre-confirmed.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to set up demo account:', err);
    process.exit(1);
  });
