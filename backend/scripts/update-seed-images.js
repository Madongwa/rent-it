// One-off fix-up: replaces the random picsum.photos placeholder image_url on
// the 15 listings created by seed-dummy-listings.js with a real, topically
// accurate photo of that specific piece of equipment (sourced from Wikimedia
// Commons - free-licensed, direct hotlinkable file URLs, verified to return
// image/jpeg before being used here). Matches listings by exact title, so
// it's safe to re-run and only ever touches these 15 rows.
//
// Usage:
//   cd backend
//   node scripts/update-seed-images.js

import { supabase } from '../src/lib/supabaseClient.js';

const IMAGE_BY_TITLE = {
  // Farming
  'Compact Utility Tractor (25HP)':
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Kubota_M35GX_tractor_MD1.jpg/960px-Kubota_M35GX_tractor_MD1.jpg',
  'Rear-Tine Rototiller':
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9e/Rotary_tiller_Cedrus_GL03.jpg/960px-Rotary_tiller_Cedrus_GL03.jpg',
  'Gas-Powered Irrigation Pump (2in)':
    'https://upload.wikimedia.org/wikipedia/commons/f/f3/Irrigation_Pump_-_geograph.org.uk_-_831138.jpg',
  'Tow-Behind Boom Sprayer (25 gal)':
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d9/Hardi_Alpha_VariTrack_3000i_crop_sprayer.jpg/960px-Hardi_Alpha_VariTrack_3000i_crop_sprayer.jpg',
  'Skid Steer Harvester Attachment':
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/Corn_head_Olimac_DRAGO_GT.jpg/960px-Corn_head_Olimac_DRAGO_GT.jpg',

  // Construction
  'Portable Cement Mixer (3.5 cu ft)':
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/Cement_mixer2.jpg/960px-Cement_mixer2.jpg',
  '7500W Gas Generator':
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/Firman_WHO3242_Electric_Generator_%2852949706739%29.jpg/960px-Firman_WHO3242_Electric_Generator_%2852949706739%29.jpg',
  'Steel Scaffolding Set (2 frames, 6x5 ft)':
    'https://upload.wikimedia.org/wikipedia/commons/f/fd/Scaffolding_-_geograph.org.uk_-_1283764.jpg',
  'Heavy-Duty Power Drill Set (Cordless, 5-piece)':
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Panasonic_Cordless_Drill_%26_Driver_EY1DD2%2C_Ottobrunn_%2820250410-P1046293%29.jpg/960px-Panasonic_Cordless_Drill_%26_Driver_EY1DD2%2C_Ottobrunn_%2820250410-P1046293%29.jpg',
  'Concrete Vibrator (Electric, 6ft shaft)':
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/13/Concrete_Vib_%289022002%29.jpg/960px-Concrete_Vib_%289022002%29.jpg',

  // Household & DIY
  'Electric Pressure Washer (2000 PSI)':
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2d/Kawasaki_Pressure_Washer_HPW_302.jpg/960px-Kawasaki_Pressure_Washer_HPW_302.jpg',
  'Self-Propelled Lawn Mower':
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Viking_MB_2_R_lawn_mower_01.jpg/960px-Viking_MB_2_R_lawn_mower_01.jpg',
  'Aluminum Extension Ladder (24ft)':
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Extension_ladder_leaning_against_a_garage.JPG/960px-Extension_ladder_leaning_against_a_garage.JPG',
  'Cordless Power Tools Combo Kit (Drill + Saw + Sander)':
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/Palm_sanders.jpg/960px-Palm_sanders.jpg',
  'Party & Event Tent (20ft x 20ft)':
    'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Tents_set_up_for_party_in_the_backyard_around_the_pool.JPG/960px-Tents_set_up_for_party_in_the_backyard_around_the_pool.JPG',
};

async function main() {
  let updated = 0;
  let missing = 0;

  for (const [title, image_url] of Object.entries(IMAGE_BY_TITLE)) {
    const { data, error } = await supabase
      .from('listings')
      .update({ image_url })
      .eq('title', title)
      .select('id, title');

    if (error) throw error;
    if (!data || data.length === 0) {
      console.log(`  NOT FOUND: "${title}"`);
      missing++;
    } else {
      console.log(`  updated (${data.length}): ${title}`);
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
