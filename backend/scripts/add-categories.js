// Adds the 3 new categories (Events, Moving, Medical) needed by the Home
// page's CategoryShowcase component. Safe to re-run - uses the same
// on-conflict-do-nothing pattern as schema.sql's initial category seed.
//
// Usage: cd backend && node scripts/add-categories.js

import { supabase } from '../src/lib/supabaseClient.js';

const NEW_CATEGORIES = [
  { slug: 'events', name: 'Events', description: 'Tents, sound systems, tables and lighting for any event', icon: '🎪' },
  { slug: 'moving', name: 'Moving', description: 'Dollies, trailers, and everything for moving day', icon: '📦' },
  { slug: 'medical', name: 'Medical', description: 'Mobility aids and home-care equipment', icon: '🩺' },
];

async function main() {
  const { data, error } = await supabase
    .from('categories')
    .upsert(NEW_CATEGORIES, { onConflict: 'slug', ignoreDuplicates: true })
    .select();

  if (error) throw error;
  console.log(`Upserted ${data.length} categor${data.length === 1 ? 'y' : 'ies'}.`);

  const { data: all, error: listError } = await supabase
    .from('categories')
    .select('id, slug, name')
    .order('id', { ascending: true });
  if (listError) throw listError;
  console.log('\nAll categories now:');
  all.forEach((c) => console.log(`  ${c.id}. ${c.slug} - ${c.name}`));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
