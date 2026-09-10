// Seeds ~5 sample listings per category (Farming, Construction, Household &
// DIY) under two dummy/test owner accounts, so they never mix into a real
// user's dashboard. Safe to re-run: skips any dummy account or listing
// (matched by owner + title) that already exists.
//
// Usage:
//   cd backend
//   node scripts/seed-dummy-listings.js
//
// Requires backend/.env to have SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set
// (same as the running API server).

import { supabase } from '../src/lib/supabaseClient.js';

const DUMMY_PASSWORD = 'RentIt-Seed-2024!';

const DUMMY_OWNERS = [
  { email: 'seed.owner1@rentit.test', full_name: 'Alex Rivera' },
  { email: 'seed.owner2@rentit.test', full_name: 'Jordan Lee' },
];

// Picsum photo IDs are stable, license-free (Unsplash-sourced, no
// attribution required) placeholder images - a fixed seed per listing keeps
// the same photo on every reload instead of a random one.
const img = (seed) => `https://picsum.photos/seed/rentit-${seed}/800/600`;

const LISTINGS_BY_CATEGORY = {
  farming: [
    {
      title: 'Compact Utility Tractor (25HP)',
      description:
        'Diesel 4WD compact tractor with loader bucket attachment. Great for tilling, grading, and moving material around small acreage. Fuel up before return.',
      price_per_day: 120,
      condition: 'Good',
      location: 'Salem, OR',
      image_url: img('farming-tractor'),
    },
    {
      title: 'Rear-Tine Rototiller',
      description:
        'Gas-powered rear-tine tiller, tills up to 8 inches deep. Perfect for breaking new ground or working compost into an existing garden bed.',
      price_per_day: 45,
      condition: 'Like New',
      location: 'Salem, OR',
      image_url: img('farming-tiller'),
    },
    {
      title: 'Gas-Powered Irrigation Pump (2in)',
      description:
        '2-inch centrifugal water pump, self-priming. Moves up to 158 GPM - ideal for draining a field, filling a tank, or seasonal irrigation.',
      price_per_day: 35,
      condition: 'Good',
      location: 'Eugene, OR',
      image_url: img('farming-irrigation-pump'),
    },
    {
      title: 'Tow-Behind Boom Sprayer (25 gal)',
      description:
        '25-gallon ATV/tractor tow-behind sprayer with 7ft boom, adjustable nozzles. Comes with extra hose for spot spraying.',
      price_per_day: 40,
      condition: 'Fair',
      location: 'Eugene, OR',
      image_url: img('farming-sprayer'),
    },
    {
      title: 'Skid Steer Harvester Attachment',
      description:
        'Quick-attach harvester head for skid steers, used for row crop cleanup. Pins and hoses included; ask about compatible skid steer models.',
      price_per_day: 95,
      condition: 'Good',
      location: 'Corvallis, OR',
      image_url: img('farming-harvester-attachment'),
    },
  ],
  construction: [
    {
      title: 'Portable Cement Mixer (3.5 cu ft)',
      description:
        'Electric-start cement mixer, 3.5 cu ft drum. Great for small pours - footings, post holes, patch work. Cleans up easy with the built-in hose bib.',
      price_per_day: 55,
      condition: 'Good',
      location: 'Denver, CO',
      image_url: img('construction-cement-mixer'),
    },
    {
      title: '7500W Gas Generator',
      description:
        '7500-watt portable generator, runs power tools, a small job site, or backup home power. Electric start, half-full tank included.',
      price_per_day: 65,
      condition: 'Like New',
      location: 'Denver, CO',
      image_url: img('construction-generator'),
    },
    {
      title: 'Steel Scaffolding Set (2 frames, 6x5 ft)',
      description:
        'Two 6ft x 5ft scaffold frames with cross braces, guardrails, and locking casters. Good for siding, painting, or roofline work up to ~12ft.',
      price_per_day: 50,
      condition: 'Good',
      location: 'Boulder, CO',
      image_url: img('construction-scaffolding'),
    },
    {
      title: 'Heavy-Duty Power Drill Set (Cordless, 5-piece)',
      description:
        '18V cordless drill/driver, impact driver, reciprocating saw, and circular saw, plus two batteries and a charger, all in a hard case.',
      price_per_day: 25,
      condition: 'Good',
      location: 'Boulder, CO',
      image_url: img('construction-drill-set'),
    },
    {
      title: 'Concrete Vibrator (Electric, 6ft shaft)',
      description:
        'Electric concrete vibrator with 6ft flexible shaft, removes air pockets for a smooth, strong pour. Good for slabs and footings.',
      price_per_day: 40,
      condition: 'Fair',
      location: 'Aurora, CO',
      image_url: img('construction-concrete-vibrator'),
    },
  ],
  diy: [
    {
      title: 'Electric Pressure Washer (2000 PSI)',
      description:
        '2000 PSI electric pressure washer with 3 nozzle tips and a detergent tank. Great for driveways, siding, decks, and patio furniture.',
      price_per_day: 30,
      condition: 'Like New',
      location: 'Austin, TX',
      image_url: img('diy-pressure-washer'),
    },
    {
      title: 'Self-Propelled Lawn Mower',
      description:
        '21-inch self-propelled gas mower with rear bag. Recently serviced with a fresh blade - ready for a weekend of yard work.',
      price_per_day: 28,
      condition: 'Good',
      location: 'Austin, TX',
      image_url: img('diy-lawn-mower'),
    },
    {
      title: 'Aluminum Extension Ladder (24ft)',
      description:
        '24ft aluminum extension ladder, rated 250 lbs. Perfect for gutter cleaning, painting, or roof access. Rope-and-pulley extension.',
      price_per_day: 20,
      condition: 'Good',
      location: 'Round Rock, TX',
      image_url: img('diy-ladder'),
    },
    {
      title: 'Cordless Power Tools Combo Kit (Drill + Saw + Sander)',
      description:
        'Drill/driver, circular saw, and orbital sander on one battery platform, with two batteries and a charger. Great for a weekend project.',
      price_per_day: 32,
      condition: 'Like New',
      location: 'Round Rock, TX',
      image_url: img('diy-power-tools-kit'),
    },
    {
      title: 'Party & Event Tent (20ft x 20ft)',
      description:
        '20x20 pole tent with a white canopy, stakes, and ropes included. Seats up to 40 guests - ideal for backyard parties or small events.',
      price_per_day: 75,
      condition: 'Good',
      location: 'Cedar Park, TX',
      image_url: img('diy-event-tent'),
    },
  ],
};

async function findExistingUserByEmail(email) {
  // No direct "get user by email" in supabase-js v2, so page through admin
  // listUsers. Fine at this project's scale (a handful of accounts).
  const perPage = 1000;
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < perPage) break; // last page
  }
  return null;
}

async function ensureDummyOwner({ email, full_name }) {
  let user = await findExistingUserByEmail(email);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: DUMMY_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (error) throw error;
    user = data.user;
    console.log(`  created dummy account ${email} (${user.id})`);
  } else {
    console.log(`  dummy account ${email} already exists (${user.id})`);
  }

  // The `on_auth_user_created` trigger inserts a matching profiles row
  // automatically; make sure full_name is set in case the profile already
  // existed from an earlier partial run without it.
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name })
    .eq('id', user.id)
    .is('full_name', null);
  if (profileError) throw profileError;

  return user;
}

async function getCategoryIdBySlug(slug) {
  const { data, error } = await supabase.from('categories').select('id').eq('slug', slug).single();
  if (error) throw error;
  return data.id;
}

async function seedListingsForOwner(ownerId, categorySlug, categoryId, listings) {
  const { data: existing, error: existingError } = await supabase
    .from('listings')
    .select('title')
    .eq('owner_id', ownerId)
    .eq('category_id', categoryId);
  if (existingError) throw existingError;
  const existingTitles = new Set(existing.map((l) => l.title));

  const toInsert = listings
    .filter((l) => !existingTitles.has(l.title))
    .map((l) => ({ ...l, owner_id: ownerId, category_id: categoryId, status: 'available' }));

  if (toInsert.length === 0) {
    console.log(`  [${categorySlug}] all ${listings.length} listings already seeded, skipping`);
    return 0;
  }

  const { error: insertError } = await supabase.from('listings').insert(toInsert);
  if (insertError) throw insertError;
  console.log(`  [${categorySlug}] inserted ${toInsert.length} listing(s)`);
  return toInsert.length;
}

async function main() {
  console.log('Ensuring dummy owner accounts...');
  const owners = [];
  for (const spec of DUMMY_OWNERS) {
    owners.push(await ensureDummyOwner(spec));
  }

  console.log('\nSeeding listings...');
  let total = 0;
  const categorySlugs = Object.keys(LISTINGS_BY_CATEGORY);
  for (let i = 0; i < categorySlugs.length; i++) {
    const slug = categorySlugs[i];
    const categoryId = await getCategoryIdBySlug(slug);
    // Alternate owner per category so listings aren't all under one account.
    const owner = owners[i % owners.length];
    total += await seedListingsForOwner(owner.id, slug, categoryId, LISTINGS_BY_CATEGORY[slug]);
  }

  console.log(`\nDone. ${total} new listing(s) inserted.`);
  console.log(
    `Dummy accounts: ${DUMMY_OWNERS.map((o) => o.email).join(', ')} (password: ${DUMMY_PASSWORD})`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
