// One-off: backfills the new marketplace-filter fields (power_source,
// delivery_option, deposit_required, cancellation_policy, owner_type,
// accessories_included) on the 30 listings seeded by
// seed-full-marketplace.js, matched by title. Run this AFTER applying the
// schema migration in schema.sql (the `alter table public.listings add
// column ...` block) - Supabase's REST API can't run DDL, so that part has
// to be run once in the Supabase SQL Editor.
//
// Usage: cd backend && node scripts/update-listing-filter-fields.js

import { supabase } from '../src/lib/supabaseClient.js';

const FIELDS_BY_TITLE = {
  // Farming
  'Compact Utility Tractor (25HP, with loader attachment)': { power_source: 'diesel', delivery_option: 'owner_delivers', deposit_required: true, cancellation_policy: 'strict', owner_type: 'business', accessories_included: true },
  'Rotary Tiller / Cultivator': { power_source: 'petrol', delivery_option: 'pickup_only', deposit_required: false, cancellation_policy: 'flexible', owner_type: 'individual', accessories_included: false },
  'Portable Irrigation Pump (Petrol/Diesel)': { power_source: 'diesel', delivery_option: 'either', deposit_required: false, cancellation_policy: 'flexible', owner_type: 'individual', accessories_included: false },
  'Backpack/Boom Sprayer (Pest & Fertilizer)': { power_source: 'manual', delivery_option: 'pickup_only', deposit_required: false, cancellation_policy: 'free', owner_type: 'individual', accessories_included: false },
  'Seed Drill / Planter (2-Row)': { power_source: 'manual', delivery_option: 'owner_delivers', deposit_required: true, cancellation_policy: 'strict', owner_type: 'business', accessories_included: false },

  // Construction
  'Portable Cement Mixer (3.5 cu ft)': { power_source: 'electric', delivery_option: 'either', deposit_required: true, cancellation_policy: 'flexible', owner_type: 'individual', accessories_included: false },
  'Mini Excavator (1-2 Ton)': { power_source: 'diesel', delivery_option: 'owner_delivers', deposit_required: true, cancellation_policy: 'strict', owner_type: 'business', accessories_included: true },
  'Steel Scaffolding Set (20 ft)': { power_source: 'manual', delivery_option: 'owner_delivers', deposit_required: true, cancellation_policy: 'flexible', owner_type: 'business', accessories_included: true },
  '7500W Portable Generator': { power_source: 'petrol', delivery_option: 'pickup_only', deposit_required: false, cancellation_policy: 'flexible', owner_type: 'individual', accessories_included: false },
  'Plate Compactor / Tamper': { power_source: 'petrol', delivery_option: 'pickup_only', deposit_required: false, cancellation_policy: 'flexible', owner_type: 'individual', accessories_included: false },
  'Concrete Vibrator (Electric, 6ft shaft)': { power_source: 'electric', delivery_option: 'pickup_only', deposit_required: false, cancellation_policy: 'free', owner_type: 'individual', accessories_included: false },

  // Household & DIY
  'Heavy-Duty Power Drill Set': { power_source: 'battery', delivery_option: 'pickup_only', deposit_required: false, cancellation_policy: 'free', owner_type: 'individual', accessories_included: true },
  'Pressure Washer (Electric)': { power_source: 'electric', delivery_option: 'pickup_only', deposit_required: false, cancellation_policy: 'flexible', owner_type: 'individual', accessories_included: true },
  'Extension Ladder (20 ft, Aluminum)': { power_source: 'manual', delivery_option: 'pickup_only', deposit_required: false, cancellation_policy: 'free', owner_type: 'individual', accessories_included: false },
  'Lawn Mower (Push/Self-Propelled)': { power_source: 'petrol', delivery_option: 'either', deposit_required: false, cancellation_policy: 'flexible', owner_type: 'individual', accessories_included: false },
  'Wet/Dry Shop Vacuum': { power_source: 'electric', delivery_option: 'pickup_only', deposit_required: false, cancellation_policy: 'free', owner_type: 'individual', accessories_included: true },

  // Events
  'Portable PA/Sound System': { power_source: 'electric', delivery_option: 'either', deposit_required: true, cancellation_policy: 'strict', owner_type: 'business', accessories_included: true },
  'Party Tent / Canopy (20x20 ft)': { power_source: 'manual', delivery_option: 'owner_delivers', deposit_required: true, cancellation_policy: 'strict', owner_type: 'business', accessories_included: true },
  'Folding Tables & Chairs Set (Seats 50)': { power_source: 'manual', delivery_option: 'owner_delivers', deposit_required: false, cancellation_policy: 'flexible', owner_type: 'business', accessories_included: false },
  'LED Stage/Uplighting Kit': { power_source: 'electric', delivery_option: 'either', deposit_required: true, cancellation_policy: 'strict', owner_type: 'business', accessories_included: true },
  'Portable Generator (for Outdoor Power)': { power_source: 'petrol', delivery_option: 'pickup_only', deposit_required: false, cancellation_policy: 'flexible', owner_type: 'individual', accessories_included: false },

  // Moving
  'Moving Dolly / Hand Truck': { power_source: 'manual', delivery_option: 'pickup_only', deposit_required: false, cancellation_policy: 'free', owner_type: 'individual', accessories_included: false },
  'Furniture Moving Straps & Sliders Kit': { power_source: 'manual', delivery_option: 'pickup_only', deposit_required: false, cancellation_policy: 'free', owner_type: 'individual', accessories_included: true },
  'Enclosed Cargo Trailer': { power_source: 'manual', delivery_option: 'owner_delivers', deposit_required: true, cancellation_policy: 'strict', owner_type: 'business', accessories_included: false },
  'Appliance Dolly (Heavy-Duty, Stair-Capable)': { power_source: 'manual', delivery_option: 'pickup_only', deposit_required: false, cancellation_policy: 'flexible', owner_type: 'individual', accessories_included: false },
  'Moving Blankets & Packing Kit (Bulk Set)': { power_source: 'manual', delivery_option: 'either', deposit_required: false, cancellation_policy: 'free', owner_type: 'individual', accessories_included: true },

  // Medical
  'Manual Wheelchair': { power_source: 'manual', delivery_option: 'either', deposit_required: false, cancellation_policy: 'flexible', owner_type: 'individual', accessories_included: false },
  'Hospital Bed (Adjustable, Home-Care)': { power_source: 'electric', delivery_option: 'owner_delivers', deposit_required: true, cancellation_policy: 'strict', owner_type: 'business', accessories_included: false },
  'Oxygen Concentrator': { power_source: 'electric', delivery_option: 'either', deposit_required: true, cancellation_policy: 'strict', owner_type: 'business', accessories_included: false },
  'Knee Walker / Mobility Scooter': { power_source: 'manual', delivery_option: 'pickup_only', deposit_required: false, cancellation_policy: 'flexible', owner_type: 'individual', accessories_included: false },
  'Patient Lift / Transfer Aid': { power_source: 'manual', delivery_option: 'owner_delivers', deposit_required: true, cancellation_policy: 'strict', owner_type: 'business', accessories_included: false },
};

async function main() {
  let updated = 0;
  let missing = 0;

  for (const [title, fields] of Object.entries(FIELDS_BY_TITLE)) {
    const { data, error } = await supabase
      .from('listings')
      .update(fields)
      .eq('title', title)
      .select('id, title');

    if (error) {
      if (error.code === 'PGRST204' || /column/i.test(error.message || '')) {
        console.error(
          '\nThe new columns don\'t exist yet. Run the migration block at the bottom of ' +
            'backend/schema.sql (the "Marketplace filter fields" section) in your Supabase ' +
            'project\'s SQL Editor first, then re-run this script.\n'
        );
        process.exit(1);
      }
      throw error;
    }

    if (!data || data.length === 0) {
      console.log(`  NOT FOUND: "${title}"`);
      missing++;
    } else {
      console.log(`  updated: ${title}`);
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
