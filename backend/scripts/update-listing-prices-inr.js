// One-off: sets the 30 seeded listings' price_per_day to realistic INR
// daily-rental rates (the site is being built for the Indian market - a
// straight USD->INR conversion at market FX rate would've looked far too
// expensive for a daily rental; earlier passes went too cheap, then too
// expensive after a 5x bump, then cut back 50%). Matched by title, same
// set as update-listing-filter-fields.js.
//
// Usage: cd backend && node scripts/update-listing-prices-inr.js

import { supabase } from '../src/lib/supabaseClient.js';

const PRICE_INR_BY_TITLE = {
  // Farming
  'Compact Utility Tractor (25HP, with loader attachment)': 2250,
  'Rotary Tiller / Cultivator': 875,
  'Portable Irrigation Pump (Petrol/Diesel)': 700,
  'Backpack/Boom Sprayer (Pest & Fertilizer)': 375,
  'Seed Drill / Planter (2-Row)': 1125,

  // Construction
  'Portable Cement Mixer (3.5 cu ft)': 1000,
  'Mini Excavator (1-2 Ton)': 4500,
  'Steel Scaffolding Set (20 ft)': 875,
  '7500W Portable Generator': 1250,
  'Plate Compactor / Tamper': 875,

  // Household & DIY
  'Heavy-Duty Power Drill Set': 375,
  'Pressure Washer (Electric)': 500,
  'Extension Ladder (20 ft, Aluminum)': 300,
  'Lawn Mower (Push/Self-Propelled)': 550,
  'Wet/Dry Shop Vacuum': 375,

  // Events
  'Portable PA/Sound System': 1500,
  'Party Tent / Canopy (20x20 ft)': 3000,
  'Folding Tables & Chairs Set (Seats 50)': 2250,
  'LED Stage/Uplighting Kit': 2000,
  'Portable Generator (for Outdoor Power)': 1125,

  // Moving
  'Moving Dolly / Hand Truck': 250,
  'Furniture Moving Straps & Sliders Kit': 300,
  'Enclosed Cargo Trailer': 2500,
  'Appliance Dolly (Heavy-Duty, Stair-Capable)': 625,
  'Moving Blankets & Packing Kit (Bulk Set)': 450,

  // Medical
  'Manual Wheelchair': 375,
  'Hospital Bed (Adjustable, Home-Care)': 1250,
  'Oxygen Concentrator': 1000,
  'Knee Walker / Mobility Scooter': 450,
  'Patient Lift / Transfer Aid': 1500,
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
