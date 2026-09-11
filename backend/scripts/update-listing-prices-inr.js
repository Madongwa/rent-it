// One-off: converts the 30 seeded listings' price_per_day from USD to
// realistic INR daily-rental rates (the site is being built for the Indian
// market - straight USD->INR conversion at market FX rate would make
// everything look far too expensive for a daily rental). Matched by title,
// same set as update-listing-filter-fields.js.
//
// Usage: cd backend && node scripts/update-listing-prices-inr.js

import { supabase } from '../src/lib/supabaseClient.js';

const PRICE_INR_BY_TITLE = {
  // Farming
  'Compact Utility Tractor (25HP, with loader attachment)': 900,
  'Rotary Tiller / Cultivator': 350,
  'Portable Irrigation Pump (Petrol/Diesel)': 280,
  'Backpack/Boom Sprayer (Pest & Fertilizer)': 150,
  'Seed Drill / Planter (2-Row)': 450,

  // Construction
  'Portable Cement Mixer (3.5 cu ft)': 400,
  'Mini Excavator (1-2 Ton)': 1800,
  'Steel Scaffolding Set (20 ft)': 350,
  '7500W Portable Generator': 500,
  'Plate Compactor / Tamper': 350,

  // Household & DIY
  'Heavy-Duty Power Drill Set': 150,
  'Pressure Washer (Electric)': 200,
  'Extension Ladder (20 ft, Aluminum)': 120,
  'Lawn Mower (Push/Self-Propelled)': 220,
  'Wet/Dry Shop Vacuum': 150,

  // Events
  'Portable PA/Sound System': 600,
  'Party Tent / Canopy (20x20 ft)': 1200,
  'Folding Tables & Chairs Set (Seats 50)': 900,
  'LED Stage/Uplighting Kit': 800,
  'Portable Generator (for Outdoor Power)': 450,

  // Moving
  'Moving Dolly / Hand Truck': 100,
  'Furniture Moving Straps & Sliders Kit': 120,
  'Enclosed Cargo Trailer': 1000,
  'Appliance Dolly (Heavy-Duty, Stair-Capable)': 250,
  'Moving Blankets & Packing Kit (Bulk Set)': 180,

  // Medical
  'Manual Wheelchair': 150,
  'Hospital Bed (Adjustable, Home-Care)': 500,
  'Oxygen Concentrator': 400,
  'Knee Walker / Mobility Scooter': 180,
  'Patient Lift / Transfer Aid': 600,
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
