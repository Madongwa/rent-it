// Sample Wanted posts, like the sample Marketplace listings: six requests
// (one per category) from three sample renter accounts (@rentit.test), with
// details, town, dates and a budget, so the Wanted page has something real
// to show. Dates are worked out from today, so they're always upcoming.
//
// Safe to re-run: the sample renters' posts are deleted and inserted fresh.
// Real users' posts are never touched.
//
// Usage: cd backend && node scripts/seed-wanted-posts.js

import { randomUUID } from 'crypto';
import { supabase } from '../src/lib/supabaseClient.js';
import { addDays, indiaToday } from '../src/lib/dates.js';

const SAMPLE_RENTERS = [
  { email: 'seed.renter1@rentit.test', full_name: 'Priya Sharma' },
  { email: 'seed.renter2@rentit.test', full_name: 'Arjun Patil' },
  { email: 'seed.renter3@rentit.test', full_name: 'Meena Iyer' },
];

// renter: index into SAMPLE_RENTERS; from/until: days from today.
const POSTS = [
  {
    renter: 1,
    category: 'construction',
    title: 'JCB or mini excavator for foundation digging',
    details: 'Digging the foundation for a two-room house extension, roughly 40 ft of trench. Operator would be a big help but not required.',
    location: 'Pune, Maharashtra',
    budget: 4500,
    from: 6,
    until: 8,
  },
  {
    renter: 0,
    category: 'medical',
    title: 'Wheelchair for my father for 2 weeks',
    details: "He's coming home after knee surgery. A foldable one that fits in a car boot would be ideal.",
    location: 'Gurugram, Haryana',
    budget: 400,
    from: 2,
    until: 16,
  },
  {
    renter: 2,
    category: 'events',
    title: 'PA sound system and lights for a family wedding',
    details: 'Sangeet night for about 150 guests - two speakers, a mic and some stage lighting. Delivery and setup preferred.',
    location: 'Jaipur, Rajasthan',
    budget: 6000,
    from: 12,
    until: 13,
  },
  {
    renter: 1,
    category: 'farming',
    title: 'Combine harvester for the paddy harvest',
    details: 'About 8 acres of basmati ready to cut. With an operator, ideally - happy to pay for diesel separately.',
    location: 'Karnal, Haryana',
    budget: 9000,
    from: 20,
    until: 27,
  },
  {
    renter: 2,
    category: 'moving',
    title: 'Hand truck and moving blankets for shifting house',
    details: 'Moving a 2BHK to a new flat across town on a Saturday. Need a dolly/hand truck and a set of blankets and straps.',
    location: 'Mumbai, Maharashtra',
    budget: 500,
    from: 4,
    until: 5,
  },
  {
    renter: 0,
    category: 'diy',
    title: 'Pressure washer to clean a terrace and car',
    details: 'Just one day - cleaning moss off a terrace before the monsoon ends, and the car while I have it.',
    location: 'Bengaluru, Karnataka',
    budget: null,
    from: 3,
    until: 3,
  },
];

async function findUserByEmail(email) {
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < 1000) break;
  }
  return null;
}

// A sample account nobody logs in to - its password is random and unused.
async function ensureRenter({ email, full_name }) {
  let user = await findUserByEmail(email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: `${randomUUID()}-Aa1!`,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (error) throw error;
    user = data.user;
    console.log(`  created sample renter ${email}`);
  } else {
    console.log(`  sample renter ${email} already exists`);
  }
  // The profile row is made by a trigger on sign-up; make sure the name is set.
  await supabase.from('profiles').update({ full_name }).eq('id', user.id);
  return user;
}

async function main() {
  console.log('Sample renter accounts...');
  const renters = [];
  for (const spec of SAMPLE_RENTERS) renters.push(await ensureRenter(spec));

  const { data: categories, error: catError } = await supabase.from('categories').select('id, slug');
  if (catError) throw catError;
  const categoryId = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  const ids = renters.map((r) => r.id);
  const { error: delError, count } = await supabase.from('wanted_posts').delete({ count: 'exact' }).in('user_id', ids);
  if (delError) throw delError;
  if (count) console.log(`Removed ${count} earlier sample post(s).`);

  const today = indiaToday();
  const rows = POSTS.map((p) => ({
    user_id: renters[p.renter].id,
    title: p.title,
    details: p.details,
    category_id: categoryId[p.category],
    location: p.location,
    max_price_per_day: p.budget,
    needed_from: addDays(today, p.from),
    needed_until: addDays(today, p.until),
    status: 'open',
  }));
  const { data, error } = await supabase.from('wanted_posts').insert(rows).select('title, location, needed_from, needed_until');
  if (error) throw error;
  console.log(`Added ${data.length} Wanted posts:`);
  for (const p of data) console.log(`  - ${p.title} (${p.location}, ${p.needed_from} to ${p.needed_until})`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
