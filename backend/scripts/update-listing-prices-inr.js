// One-off: sets the 30 seeded listings' price_per_day to realistic INR
// daily-rental rates (the site is being built for the Indian market - a
// straight USD->INR conversion at market FX rate would've looked far too
// expensive for a daily rental, and an early lower pass was judged too
// cheap and bumped 5x). Matched by title, same set as
// update-listing-filter-fields.js.
//
// Usage: cd backend && node scripts/update-listing-prices-inr.js

import { supabase } from '../src/lib/supabaseClient.js';

const PRICE_INR_BY_TITLE = {
  // Farming
  'Compact Utility Tractor (25HP, with loader attachment)': 4500,
  'Rotary Tiller / Cultivator': 1750,
  'Portable Irrigation Pump (Petrol/Diesel)': 1400,
  'Backpack/Boom Sprayer (Pest & Fertilizer)': 750,
  'Seed Drill / Planter (2-Row)': 2250,

  // Construction
  'Portable Cement Mixer (3.5 cu ft)': 2000,
  'Mini Excavator (1-2 Ton)': 9000,
  'Steel Scaffolding Set (20 ft)': 1750,
  '7500W Portable Generator': 2500,
  'Plate Compactor / Tamper': 1750,

  // Household & DIY
  'Heavy-Duty Power Drill Set': 750,
  'Pressure Washer (Electric)': 1000,
  'Extension Ladder (20 ft, Aluminum)': 600,
  'Lawn Mower (Push/Self-Propelled)': 1100,
  'Wet/Dry Shop Vacuum': 750,

  // Events
  'Portable PA/Sound System': 3000,
  'Party Tent / Canopy (20x20 ft)': 6000,
  'Folding Tables & Chairs Set (Seats 50)': 4500,
  'LED Stage/Uplighting Kit': 4000,
  'Portable Generator (for Outdoor Power)': 2250,

  // Moving
  'Moving Dolly / Hand Truck': 500,
  'Furniture Moving Straps & Sliders Kit': 600,
  'Enclosed Cargo Trailer': 5000,
  'Appliance Dolly (Heavy-Duty, Stair-Capable)': 1250,
  'Moving Blankets & Packing Kit (Bulk Set)': 900,

  // Medical
  'Manual Wheelchair': 750,
  'Hospital Bed (Adjustable, Home-Care)': 2500,
  'Oxygen Concentrator': 2000,
  'Knee Walker / Mobility Scooter': 900,
  'Patient Lift / Transfer Aid': 3000,
};

async function main() {
  let updated = 0;
  let missing = 0;

  for (const [title, price_per_day] of Object.entries(PRICE_INR_BY_TITLE)) {
    const { data, error } = await supabase
      .from('listings')
      .update({ price_per_day })
      .eq('title', title)
      .select('id, title');

    if (error) throw error;

    if (!data || data.length === 0) {
      console.log(`  NOT FOUND: "${title}"`);
      missing++;
    } else {
      console.log(`  updated: ${title} -> ₹${price_per_day}/day`);
      updated += data.length;
    }
  }

  console.log(`\nDone. ${updated} row(s) updated, ${missing} title(s) not found.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Update failed:', err);
    process.exit(1);
  });
