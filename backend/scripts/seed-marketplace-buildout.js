// Backfills the Marketplace filter/detail-page build-out data onto the 30
// listings from seed-full-marketplace.js, matched by title:
//   - New per-listing fields: deposit_amount, accessories_note,
//     min_rental_period, supported_durations, distance_km (plus a
//     power_source correction for a few mobility-aid items - see below).
//   - 3-8 generated reviews per listing, with realistic mixed ratings.
//   - 2-6 generated rental_history entries per listing.
//   - avg_rating/review_count computed from the generated reviews.
//
// Run this AFTER applying the schema migration at the bottom of
// backend/schema.sql (the "Filter/detail-page build-out fields" block, the
// reviews/rental_history table creation, and the power_source constraint
// widening) in the Supabase SQL Editor - same one-time-DDL constraint as
// update-listing-filter-fields.js.
//
// Safe to re-run: reviews/rental_history for these listings are deleted and
// regenerated fresh each time (ratings/dates will differ run to run, but
// that's fine for seed/demo data).
//
// Usage: cd backend && node scripts/seed-marketplace-buildout.js

import { supabase } from '../src/lib/supabaseClient.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * DAY_MS);
const daysFromNow = (n) => new Date(Date.now() + n * DAY_MS);
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------
// Per-listing detail fields. Keyed by the exact titles from
// seed-full-marketplace.js. `noun` is just a short, natural word for the
// item, used to make generated review text read naturally.
//
// deposit_amount is only set where the listing already has
// deposit_required: true (from update-listing-filter-fields.js); same idea
// for accessories_note and accessories_included.
// ---------------------------------------------------------------------------
const LISTING_DETAILS = {
  // --- Farming ---
  'Compact Utility Tractor (25HP, with loader attachment)': {
    noun: 'tractor', depositAmount: 4500,
    accessoriesNote: "Comes with the front loader bucket attachment and the operator's manual.",
    minRentalPeriod: '1_day', supportedDurations: ['daily', 'weekly'], distanceKm: 12.4,
  },
  'Rotary Tiller / Cultivator': {
    noun: 'tiller', minRentalPeriod: 'no_minimum', supportedDurations: ['hourly', 'daily'], distanceKm: 8.1,
  },
  'Portable Irrigation Pump (Petrol/Diesel)': {
    noun: 'pump', minRentalPeriod: 'no_minimum', supportedDurations: ['hourly', 'daily', 'weekly'], distanceKm: 15.7,
  },
  'Backpack/Boom Sprayer (Pest & Fertilizer)': {
    noun: 'sprayer', minRentalPeriod: 'no_minimum', supportedDurations: ['hourly', 'daily'], distanceKm: 6.3,
  },
  'Seed Drill / Planter (2-Row)': {
    noun: 'seed drill', depositAmount: 1500,
    minRentalPeriod: '1_day', supportedDurations: ['daily', 'weekly'], distanceKm: 22.9,
  },

  // --- Construction ---
  'Portable Cement Mixer (3.5 cu ft)': {
    noun: 'cement mixer', depositAmount: 1200,
    minRentalPeriod: 'no_minimum', supportedDurations: ['daily', 'weekly'], distanceKm: 5.5,
  },
  'Mini Excavator (1-2 Ton)': {
    noun: 'excavator', depositAmount: 10000,
    accessoriesNote: 'Includes the standard digging bucket and an extra hydraulic quick-coupler.',
    minRentalPeriod: '1_day', supportedDurations: ['daily', 'weekly'], distanceKm: 9.2,
  },
  'Steel Scaffolding Set (20 ft)': {
    noun: 'scaffolding', depositAmount: 1000,
    accessoriesNote: 'Includes locking casters and cross braces for the full 20ft run.',
    minRentalPeriod: '3_day', supportedDurations: ['daily', 'weekly'], distanceKm: 3.8,
  },
  '7500W Portable Generator': {
    noun: 'generator', minRentalPeriod: 'no_minimum', supportedDurations: ['hourly', 'daily', 'weekly'], distanceKm: 18.0,
  },
  'Plate Compactor / Tamper': {
    noun: 'compactor', minRentalPeriod: 'no_minimum', supportedDurations: ['hourly', 'daily'], distanceKm: 11.1,
  },

  // --- Household & DIY ---
  'Heavy-Duty Power Drill Set': {
    noun: 'drill set', accessoriesNote: 'Includes two batteries, charger, and a hard case.',
    minRentalPeriod: 'no_minimum', supportedDurations: ['hourly', 'daily', 'weekly'], distanceKm: 2.6,
  },
  'Pressure Washer (Electric)': {
    noun: 'pressure washer', accessoriesNote: 'Comes with 3 nozzle tips and a detergent tank.',
    minRentalPeriod: 'no_minimum', supportedDurations: ['hourly', 'daily'], distanceKm: 4.4,
  },
  'Extension Ladder (20 ft, Aluminum)': {
    noun: 'ladder', minRentalPeriod: 'no_minimum', supportedDurations: ['daily', 'weekly'], distanceKm: 7.0,
  },
  'Lawn Mower (Push/Self-Propelled)': {
    noun: 'mower', minRentalPeriod: 'no_minimum', supportedDurations: ['daily', 'weekly'], distanceKm: 1.9,
  },
  'Wet/Dry Shop Vacuum': {
    noun: 'shop vac', accessoriesNote: 'Includes the hose and standard attachment set.',
    minRentalPeriod: 'no_minimum', supportedDurations: ['hourly', 'daily'], distanceKm: 3.3,
  },

  // --- Events ---
  'Portable PA/Sound System': {
    noun: 'sound system', depositAmount: 2500,
    accessoriesNote: 'Comes with the mixer, two mic cables, and stands.',
    minRentalPeriod: '1_day', supportedDurations: ['daily', 'weekly'], distanceKm: 14.2,
  },
  'Party Tent / Canopy (20x20 ft)': {
    noun: 'tent', depositAmount: 4000,
    accessoriesNote: 'Includes stakes, guy ropes, and the white canopy.',
    minRentalPeriod: '1_day', supportedDurations: ['daily', 'weekly'], distanceKm: 6.9,
  },
  'Folding Tables & Chairs Set (Seats 50)': {
    noun: 'tables and chairs set', minRentalPeriod: '1_day', supportedDurations: ['daily', 'weekly'], distanceKm: 10.5,
  },
  'LED Stage/Uplighting Kit': {
    noun: 'lighting kit', depositAmount: 3000,
    accessoriesNote: 'Includes the truss mounts, DMX cables, and a basic controller.',
    minRentalPeriod: '1_day', supportedDurations: ['daily', 'weekly'], distanceKm: 13.8,
  },
  'Portable Generator (for Outdoor Power)': {
    noun: 'generator', minRentalPeriod: 'no_minimum', supportedDurations: ['hourly', 'daily'], distanceKm: 19.6,
  },

  // --- Moving ---
  'Moving Dolly / Hand Truck': {
    noun: 'hand truck', minRentalPeriod: 'no_minimum', supportedDurations: ['hourly', 'daily'], distanceKm: 2.1,
  },
  'Furniture Moving Straps & Sliders Kit': {
    noun: 'moving straps', accessoriesNote: 'Includes the shoulder straps and a set of furniture sliders.',
    minRentalPeriod: 'no_minimum', supportedDurations: ['hourly', 'daily'], distanceKm: 5.0,
  },
  'Enclosed Cargo Trailer': {
    noun: 'trailer', depositAmount: 5000,
    minRentalPeriod: '1_day', supportedDurations: ['daily', 'weekly'], distanceKm: 16.3,
  },
  'Appliance Dolly (Heavy-Duty, Stair-Capable)': {
    noun: 'appliance dolly', minRentalPeriod: 'no_minimum', supportedDurations: ['hourly', 'daily'], distanceKm: 4.7,
  },
  'Moving Blankets & Packing Kit (Bulk Set)': {
    noun: 'packing kit', accessoriesNote: 'Includes quilted blankets, boxes, and packing tape.',
    minRentalPeriod: 'no_minimum', supportedDurations: ['daily', 'weekly'], distanceKm: 3.5,
  },

  // --- Medical (power_source corrected to 'not_applicable' for the purely
  // manual mobility aids - see backfillPowerSource below) ---
  'Manual Wheelchair': {
    noun: 'wheelchair', powerSource: 'not_applicable',
    minRentalPeriod: 'no_minimum', supportedDurations: ['daily', 'weekly', 'monthly'], distanceKm: 2.8,
  },
  'Hospital Bed (Adjustable, Home-Care)': {
    noun: 'hospital bed', depositAmount: 3000,
    minRentalPeriod: 'weekly', supportedDurations: ['weekly', 'monthly'], distanceKm: 9.9,
  },
  'Oxygen Concentrator': {
    noun: 'oxygen concentrator', depositAmount: 4000,
    minRentalPeriod: '3_day', supportedDurations: ['daily', 'weekly', 'monthly'], distanceKm: 7.4,
  },
  'Knee Walker / Mobility Scooter': {
    noun: 'knee walker', powerSource: 'not_applicable',
    minRentalPeriod: 'no_minimum', supportedDurations: ['daily', 'weekly'], distanceKm: 5.2,
  },
  'Patient Lift / Transfer Aid': {
    noun: 'patient lift', powerSource: 'not_applicable', depositAmount: 3500,
    minRentalPeriod: '3_day', supportedDurations: ['daily', 'weekly', 'monthly'], distanceKm: 11.6,
  },
};

// Titles to deliberately mark as "currently rented" for the Availability
// filter to have something to actually filter out (see schema.sql /
// user's own note: real active bookings don't exist yet, so this is one
// rental_history row per listing whose range is shifted to span today,
// clearly commented below rather than silently faked).
const CURRENTLY_RENTED_TITLES = new Set([
  'Mini Excavator (1-2 Ton)',
  'Party Tent / Canopy (20x20 ft)',
  'Hospital Bed (Adjustable, Home-Care)',
]);

const FIRST_NAMES = [
  'Priya', 'Rahul', 'Ananya', 'Vikram', 'Sneha', 'Arjun', 'Divya', 'Karan', 'Neha', 'Rohan',
  'Pooja', 'Aditya', 'Kavya', 'Siddharth', 'Meera', 'Nikhil', 'Isha', 'Varun', 'Riya', 'Aakash',
  'Tanvi', 'Suresh', 'Deepa', 'Manoj', 'Shreya', 'Vivek', 'Ritu', 'Sanjay', 'Anjali', 'Rajesh',
];
const LAST_NAMES = [
  'Sharma', 'Verma', 'Iyer', 'Reddy', 'Nair', 'Gupta', 'Kapoor', 'Menon', 'Joshi', 'Chawla',
  'Rao', 'Mehta', 'Kulkarni', 'Bansal', 'Pillai', 'Chatterjee', 'Malhotra', 'Desai', 'Agarwal', 'Bhat',
];

function randomFullName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}
function randomDisplayName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES).charAt(0)}.`;
}

// Weighted so most reviews land 4-5 stars, with natural variation into
// 3 (and, occasionally, 2) - then nudged if a listing rolled all-5s or
// rolled mostly-negative, per the "not a broken marketplace" brief.
function generateRatings(count) {
  const ratings = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    if (r < 0.4) ratings.push(5);
    else if (r < 0.75) ratings.push(4);
    else if (r < 0.9) ratings.push(3);
    else if (r < 0.97) ratings.push(2);
    else ratings.push(1);
  }
  if (ratings.every((r) => r === 5)) ratings[randInt(0, ratings.length - 1)] = 4;

  const avg = () => ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const order = [...ratings.keys()].sort((a, b) => ratings[a] - ratings[b]);
  let i = 0;
  while (avg() < 3.4 && i < order.length) {
    ratings[order[i]] = Math.min(5, ratings[order[i]] + 2);
    i++;
  }
  return ratings;
}

const COMMENTS = {
  5: [
    (n) => `${cap(n)} worked perfectly, exactly as described.`,
    (n) => `Great experience renting the ${n}. Would rent again.`,
    () => `Excellent condition, easy pickup, no issues at all.`,
    () => `Exactly what I needed for the job. Highly recommend.`,
    () => `Worked great, easy pickup.`,
    (n) => `The ${n} was in fantastic shape and the owner was super responsive.`,
  ],
  4: [
    (n) => `Great ${n}, ran perfectly, though the owner was a bit late for pickup.`,
    () => `Solid rental. A couple of minor scuffs but performed well.`,
    () => `Did the job well. Communication could've been a little faster.`,
    (n) => `Happy with the ${n} overall, just wish the manual/instructions were included.`,
    () => `Good condition and fair price. Pickup location was a bit hard to find.`,
  ],
  3: [
    (n) => `${cap(n)} worked but showed its age - some wear and tear.`,
    () => `Did the job but not in the best shape. Would still consider renting again.`,
    () => `Average experience overall, had to clean it before use.`,
    () => `It functioned fine but the listing photos oversold the condition slightly.`,
  ],
  2: [
    (n) => `${cap(n)} had a couple of issues that weren't mentioned in the listing.`,
    () => `Not in great shape - had to troubleshoot it myself before it worked properly.`,
    (n) => `Pickup was delayed and the ${n} needed a clean before use.`,
  ],
  1: [
    (n) => `Disappointed - the ${n} needed repair before it was usable.`,
    () => `Not what was described. Had to sort out problems the owner should have flagged.`,
  ],
};

function generateReviews(listingId, noun) {
  const count = randInt(3, 8);
  const ratings = generateRatings(count);
  return ratings.map((rating, i) => ({
    listing_id: listingId,
    reviewer_name: randomFullName(),
    rating,
    comment: pick(COMMENTS[rating])(noun),
    created_at: daysAgo(randInt(3, 260) + i).toISOString(),
  }));
}

function generateRentalHistory(listingId, pricePerDay, supportedDurations, isCurrentlyRented) {
  const count = randInt(2, 6);
  const longRental = supportedDurations.includes('monthly') || supportedDurations.includes('weekly');
  const rows = [];

  for (let i = 0; i < count; i++) {
    const duration = longRental ? randInt(3, 21) : randInt(1, 5);
    const baseDaysAgo = 20 + i * 35 + randInt(0, 15);
    const start = daysAgo(baseDaysAgo + duration);
    const end = daysAgo(baseDaysAgo);
    rows.push({
      listing_id: listingId,
      renter_display_name: randomDisplayName(),
      start_date: isoDate(start),
      end_date: isoDate(end),
      amount_paid: Math.round(pricePerDay * Math.max(1, duration)),
    });
  }

  if (isCurrentlyRented) {
    // Deliberately spans today (start a couple of days ago, end a few days
    // out) rather than being purely historical - see CURRENTLY_RENTED_TITLES
    // above for why: it's the one thing that makes "Available today/this
    // week" filter out something, since there's no real booking system yet.
    const duration = longRental ? randInt(5, 14) : randInt(2, 6);
    const start = daysAgo(2);
    const end = daysFromNow(duration - 2);
    rows.push({
      listing_id: listingId,
      renter_display_name: randomDisplayName(),
      start_date: isoDate(start),
      end_date: isoDate(end),
      amount_paid: Math.round(pricePerDay * duration),
    });
  }

  return rows;
}

async function main() {
  const titles = Object.keys(LISTING_DETAILS);
  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, title, price_per_day')
    .in('title', titles);
  if (error) throw error;

  const byTitle = new Map(listings.map((l) => [l.title, l]));
  const missing = titles.filter((t) => !byTitle.has(t));
  if (missing.length) {
    console.log(`NOT FOUND (${missing.length}): ${missing.join(', ')}`);
  }

  const listingIds = listings.map((l) => l.id);
  console.log(`Clearing existing reviews/rental_history for ${listingIds.length} listing(s)...`);
  if (listingIds.length) {
    await supabase.from('reviews').delete().in('listing_id', listingIds);
    await supabase.from('rental_history').delete().in('listing_id', listingIds);
  }

  let updated = 0;
  let reviewsInserted = 0;
  let historyInserted = 0;

  for (const title of titles) {
    const listing = byTitle.get(title);
    if (!listing) continue;
    const details = LISTING_DETAILS[title];

    const reviews = generateReviews(listing.id, details.noun);
    const avgRating = Math.round((reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) * 10) / 10;

    const fieldUpdate = {
      deposit_amount: details.depositAmount ?? null,
      accessories_note: details.accessoriesNote ?? null,
      min_rental_period: details.minRentalPeriod,
      supported_durations: details.supportedDurations,
      distance_km: details.distanceKm,
      avg_rating: avgRating,
      review_count: reviews.length,
      ...(details.powerSource ? { power_source: details.powerSource } : {}),
    };

    const { error: updateError } = await supabase.from('listings').update(fieldUpdate).eq('id', listing.id);
    if (updateError) throw updateError;
    updated++;

    const { error: reviewsError } = await supabase.from('reviews').insert(reviews);
    if (reviewsError) throw reviewsError;
    reviewsInserted += reviews.length;

    const history = generateRentalHistory(
      listing.id,
      listing.price_per_day,
      details.supportedDurations,
      CURRENTLY_RENTED_TITLES.has(title)
    );
    const { error: historyError } = await supabase.from('rental_history').insert(history);
    if (historyError) throw historyError;
    historyInserted += history.length;

    console.log(`  ${title}: avg_rating=${avgRating} (${reviews.length} reviews), ${history.length} rental_history row(s)`);
  }

  console.log(
    `\nDone. ${updated} listing(s) updated, ${reviewsInserted} review(s) inserted, ${historyInserted} rental_history row(s) inserted.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    if (err?.code === 'PGRST204' || /column|relation .* does not exist/i.test(err?.message || '')) {
      console.error(
        '\nThe new columns/tables don\'t exist yet. Run the migration block(s) added to the bottom ' +
          'of backend/schema.sql in your Supabase project\'s SQL Editor first, then re-run this script.\n'
      );
      process.exit(1);
    }
    console.error('Seed failed:', err);
    process.exit(1);
  });
