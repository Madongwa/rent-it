// Replaces the earlier dummy seed data with a complete 30-listing set (5
// per category x 6 categories, including the new Events/Moving/Medical
// categories added by add-categories.js). Deletes every listing owned by
// the 2 dummy accounts first, then inserts the full set fresh - this
// avoids ending up with near-duplicate old+new listings (e.g. both a
// "Rear-Tine Rototiller" and a "Rotary Tiller / Cultivator").
//
// Usage:
//   cd backend
//   node scripts/add-categories.js        (run first, if not already)
//   node scripts/seed-full-marketplace.js

import { supabase } from '../src/lib/supabaseClient.js';

const DUMMY_PASSWORD = 'RentIt-Seed-2024!';

const DUMMY_OWNERS = [
  { email: 'seed.owner1@rentit.test', full_name: 'Alex Rivera' },
  { email: 'seed.owner2@rentit.test', full_name: 'Jordan Lee' },
];

// Real, topically-verified photos (Wikimedia Commons, license-free,
// hotlinkable). A few - the enclosed cargo trailer, the LED uplighting
// kit, and the folding tables & chairs set - are the closest real photo
// available rather than an exact match (Commons has no good CC photo of a
// box-style enclosed trailer, a pure uplighting rig, or a tables+chairs
// event setup); noted inline.
const LISTINGS_BY_CATEGORY = {
  farming: [
    {
      title: 'Compact Utility Tractor (25HP, with loader attachment)',
      description:
        'Diesel 4WD compact tractor with front loader bucket. Great for tilling, grading, and moving material around small acreage.',
      price_per_day: 2250,
      condition: 'Good',
      location: 'Ludhiana, Punjab',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Kubota_M35GX_tractor_MD1.jpg/960px-Kubota_M35GX_tractor_MD1.jpg',
    },
    {
      title: 'Rotary Tiller / Cultivator',
      description: 'Gas-powered walk-behind rotary tiller, tills up to 8 inches deep. Ideal for breaking new ground or working in compost.',
      price_per_day: 875,
      condition: 'Like New',
      location: 'Ludhiana, Punjab',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9e/Rotary_tiller_Cedrus_GL03.jpg/960px-Rotary_tiller_Cedrus_GL03.jpg',
    },
    {
      title: 'Portable Irrigation Pump (Petrol/Diesel)',
      description: 'Self-priming centrifugal water pump, moves up to 150+ GPM - ideal for draining a field, filling a tank, or seasonal irrigation.',
      price_per_day: 700,
      condition: 'Good',
      location: 'Karnal, Haryana',
      image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Irrigation_Pump_-_geograph.org.uk_-_831138.jpg',
    },
    {
      title: 'Backpack/Boom Sprayer (Pest & Fertilizer)',
      description: 'Knapsack-style backpack sprayer for pesticide, herbicide, or liquid fertilizer application. Adjustable nozzle, hand-pump pressure.',
      price_per_day: 375,
      condition: 'Good',
      location: 'Karnal, Haryana',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Knapsack_sprayer.jpg/960px-Knapsack_sprayer.jpg',
    },
    {
      title: 'Seed Drill / Planter (2-Row)',
      description: 'Two-row precision seed planter, tractor-mounted. Good for row crops - ask about compatible hitch types.',
      price_per_day: 1125,
      condition: 'Fair',
      location: 'Amritsar, Punjab',
      image_url: 'https://upload.wikimedia.org/wikipedia/commons/3/32/JD_71_Flexi_Planter%2C_2_Row.jpg',
    },
  ],
  construction: [
    {
      title: 'Portable Cement Mixer (3.5 cu ft)',
      description: 'Electric-start cement mixer, 3.5 cu ft drum. Great for small pours - footings, post holes, patch work.',
      price_per_day: 1000,
      condition: 'Good',
      location: 'Pune, Maharashtra',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/Cement_mixer2.jpg/960px-Cement_mixer2.jpg',
    },
    {
      title: 'Mini Excavator (1-2 Ton)',
      description: 'Compact tracked mini excavator, fits through a standard gate. Good for trenching, small demolition, and landscaping.',
      price_per_day: 4500,
      condition: 'Good',
      location: 'Pune, Maharashtra',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fc/IHI_IS_008_Mini_Excavator_front_view.jpg/960px-IHI_IS_008_Mini_Excavator_front_view.jpg',
    },
    {
      title: 'Steel Scaffolding Set (20 ft)',
      description: 'Steel tube-and-frame scaffolding, enough to cover roughly 20 linear feet. Includes braces and locking casters.',
      price_per_day: 875,
      condition: 'Good',
      location: 'Nashik, Maharashtra',
      image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Scaffolding_-_geograph.org.uk_-_1283764.jpg',
    },
    {
      title: '7500W Portable Generator',
      description: '7500-watt portable generator, runs power tools, a small job site, or backup home power. Electric start.',
      price_per_day: 1250,
      condition: 'Like New',
      location: 'Nashik, Maharashtra',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/Firman_WHO3242_Electric_Generator_%2852949706739%29.jpg/960px-Firman_WHO3242_Electric_Generator_%2852949706739%29.jpg',
    },
    {
      title: 'Plate Compactor / Tamper',
      description: 'Gas-powered reversible plate compactor for compacting soil, gravel, or asphalt before a pour or paver install.',
      price_per_day: 875,
      condition: 'Good',
      location: 'Nagpur, Maharashtra',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/Plate_compactor.jpg/960px-Plate_compactor.jpg',
    },
  ],
  diy: [
    {
      title: 'Heavy-Duty Power Drill Set',
      description: 'Cordless drill/driver with two batteries, charger, and a hard case. Plenty of torque for framing and decking.',
      price_per_day: 375,
      condition: 'Good',
      location: 'Bengaluru, Karnataka',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Panasonic_Cordless_Drill_%26_Driver_EY1DD2%2C_Ottobrunn_%2820250410-P1046293%29.jpg/960px-Panasonic_Cordless_Drill_%26_Driver_EY1DD2%2C_Ottobrunn_%2820250410-P1046293%29.jpg',
    },
    {
      title: 'Pressure Washer (Electric)',
      description: '2000 PSI electric pressure washer with 3 nozzle tips and a detergent tank. Great for driveways, siding, and decks.',
      price_per_day: 500,
      condition: 'Like New',
      location: 'Bengaluru, Karnataka',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2d/Kawasaki_Pressure_Washer_HPW_302.jpg/960px-Kawasaki_Pressure_Washer_HPW_302.jpg',
    },
    {
      title: 'Extension Ladder (20 ft, Aluminum)',
      description: '20ft aluminum extension ladder, rated 250 lbs. Good for gutter cleaning, painting, or roof access.',
      price_per_day: 300,
      condition: 'Good',
      location: 'Mysuru, Karnataka',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Extension_ladder_leaning_against_a_garage.JPG/960px-Extension_ladder_leaning_against_a_garage.JPG',
    },
    {
      title: 'Lawn Mower (Push/Self-Propelled)',
      description: 'Self-propelled gas mower with rear bag. Recently serviced with a fresh blade.',
      price_per_day: 550,
      condition: 'Good',
      location: 'Mysuru, Karnataka',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Viking_MB_2_R_lawn_mower_01.jpg/960px-Viking_MB_2_R_lawn_mower_01.jpg',
    },
    {
      title: 'Wet/Dry Shop Vacuum',
      description: '16-gallon wet/dry shop vac with hose and attachments. Handles a flooded basement or a garage full of sawdust.',
      price_per_day: 375,
      condition: 'Good',
      location: 'Mangaluru, Karnataka',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a8/Craftsman_16_Gallon_Wet-Dry_Vac.jpg/960px-Craftsman_16_Gallon_Wet-Dry_Vac.jpg',
    },
  ],
  events: [
    {
      title: 'Portable PA/Sound System',
      description: 'Powered PA speaker column with mixer input - enough for a backyard party, a small wedding, or an outdoor speech.',
      price_per_day: 1500,
      condition: 'Fair',
      location: 'Jaipur, Rajasthan',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/33/Shure_Vocal_Master_PA_speaker.JPG/960px-Shure_Vocal_Master_PA_speaker.JPG',
    },
    {
      title: 'Party Tent / Canopy (20x20 ft)',
      description: '20x20 pole tent with a white canopy, stakes, and ropes included. Seats up to 40 guests.',
      price_per_day: 3000,
      condition: 'Good',
      location: 'Udaipur, Rajasthan',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Tents_set_up_for_party_in_the_backyard_around_the_pool.JPG/960px-Tents_set_up_for_party_in_the_backyard_around_the_pool.JPG',
    },
    {
      title: 'Folding Tables & Chairs Set (Seats 50)',
      description: 'Bulk set of folding chairs and matching tables, seats 50 guests. Delivery and pickup can be arranged with the owner.',
      price_per_day: 2250,
      condition: 'Good',
      location: 'Udaipur, Rajasthan',
      // Closest real photo available: a stack of black folding chairs
      // (Commons doesn't have a good CC photo of a matched tables+chairs set).
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/33/Stacked_Chairs_%288639859973%29.jpg/960px-Stacked_Chairs_%288639859973%29.jpg',
    },
    {
      title: 'LED Stage/Uplighting Kit',
      description: 'LED par lights and truss for stage or wall uplighting at a party, show, or small concert. DMX-controllable.',
      price_per_day: 2000,
      condition: 'Like New',
      location: 'Jaipur, Rajasthan',
      // Closest real photo available: a stage rig with truss-mounted
      // lighting fixtures (no pure "uplighting only" CC photo found).
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/TOKYO_CULTURE_CULTURE_stage.jpg/960px-TOKYO_CULTURE_CULTURE_stage.jpg',
    },
    {
      title: 'Portable Generator (for Outdoor Power)',
      description: 'Compact petrol generator for powering lights, sound, or a food stand at an outdoor event.',
      price_per_day: 1125,
      condition: 'Good',
      location: 'Jodhpur, Rajasthan',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/Navigator_2026-08-12_Navigator_NG2000_02.jpg/960px-Navigator_2026-08-12_Navigator_NG2000_02.jpg',
    },
  ],
  moving: [
    {
      title: 'Moving Dolly / Hand Truck',
      description: 'Folding two-wheel hand truck, rated for heavy boxes and appliances. Compact enough to fit in a trunk.',
      price_per_day: 250,
      condition: 'Good',
      location: 'Mumbai, Maharashtra',
      image_url: 'https://upload.wikimedia.org/wikipedia/commons/0/00/Sackkarre.jpg',
    },
    {
      title: 'Furniture Moving Straps & Sliders Kit',
      description: 'Shoulder-lift moving straps plus a set of furniture sliders - move a dresser or a couch without a second person straining their back.',
      price_per_day: 300,
      condition: 'Like New',
      location: 'Mumbai, Maharashtra',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Shoulder_Dolly_%284600212053%29.jpg/960px-Shoulder_Dolly_%284600212053%29.jpg',
    },
    {
      title: 'Enclosed Cargo Trailer',
      description: 'Tow-behind cargo trailer for a full apartment move or hauling large items. Bring a vehicle with a matching hitch class.',
      price_per_day: 2500,
      condition: 'Good',
      location: 'Thane, Maharashtra',
      // Closest real photo available: an open utility trailer being
      // hitched (no fully-enclosed box-trailer CC photo found).
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Attaching_U-Haul_trailer_to_GMC_pickup_truck_East_Haven_VT_October_2016.jpg/960px-Attaching_U-Haul_trailer_to_GMC_pickup_truck_East_Haven_VT_October_2016.jpg',
    },
    {
      title: 'Appliance Dolly (Heavy-Duty, Stair-Capable)',
      description: 'Stair-climbing hand truck for moving a washer, dryer, or fridge up or down stairs without a team of movers.',
      price_per_day: 625,
      condition: 'Good',
      location: 'Thane, Maharashtra',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/UpCart_Lift_Stair_Climber_Hand_Truck.jpg/960px-UpCart_Lift_Stair_Climber_Hand_Truck.jpg',
    },
    {
      title: 'Moving Blankets & Packing Kit (Bulk Set)',
      description: 'Bulk set of quilted moving blankets plus packing boxes and tape - everything to pad furniture and box up a room.',
      price_per_day: 450,
      condition: 'Good',
      location: 'Mumbai, Maharashtra',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/An_Overview_of_Moving_Companies_and_Their_Use_of_Moving_Boxes.jpg/960px-An_Overview_of_Moving_Companies_and_Their_Use_of_Moving_Boxes.jpg',
    },
  ],
  medical: [
    {
      title: 'Manual Wheelchair',
      description: 'Standard folding manual wheelchair with desk-length arms and swing-away footrests.',
      price_per_day: 375,
      condition: 'Good',
      location: 'Gurugram, Haryana',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/Medline_F-1_manual_wheelchair_1.JPG/960px-Medline_F-1_manual_wheelchair_1.JPG',
    },
    {
      title: 'Hospital Bed (Adjustable, Home-Care)',
      description: 'Fully adjustable home-care hospital bed with side rails. Head and foot positions adjust electrically.',
      price_per_day: 1250,
      condition: 'Good',
      location: 'Gurugram, Haryana',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/Patient_room_with_hospital_bed.jpg/960px-Patient_room_with_hospital_bed.jpg',
    },
    {
      title: 'Oxygen Concentrator',
      description: 'Home oxygen concentrator, continuous flow. Please arrange your own tubing/mask accessories.',
      price_per_day: 1000,
      condition: 'Good',
      location: 'Noida, Uttar Pradesh',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fb/Invacare_Perfecto_2_Oxygen_Concentrator.JPG/960px-Invacare_Perfecto_2_Oxygen_Concentrator.JPG',
    },
    {
      title: 'Knee Walker / Mobility Scooter',
      description: 'Steerable knee walker - an easier alternative to crutches for a lower-leg injury or recovery.',
      price_per_day: 450,
      condition: 'Like New',
      location: 'Noida, Uttar Pradesh',
      image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/KneeScooter.jpg',
    },
    {
      title: 'Patient Lift / Transfer Aid',
      description: 'Manual hydraulic patient lift (Hoyer-style) for safely transferring someone between a bed, chair, or wheelchair.',
      price_per_day: 1500,
      condition: 'Good',
      location: 'New Delhi',
      image_url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8e/Hoyer_lift_front.JPG/960px-Hoyer_lift_front.JPG',
    },
  ],
};

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
  return user;
}

async function getCategoryIdBySlug(slug) {
  const { data, error } = await supabase.from('categories').select('id').eq('slug', slug).single();
  if (error) throw error;
  return data.id;
}

async function main() {
  console.log('Ensuring dummy owner accounts...');
  const owners = [];
  for (const spec of DUMMY_OWNERS) {
    owners.push(await ensureDummyOwner(spec));
  }
  const ownerIds = owners.map((o) => o.id);

  console.log('\nClearing previous seed listings owned by the dummy accounts...');
  const { error: deleteError, count } = await supabase
    .from('listings')
    .delete({ count: 'exact' })
    .in('owner_id', ownerIds);
  if (deleteError) throw deleteError;
  console.log(`  removed ${count ?? 0} old listing(s)`);

  console.log('\nSeeding fresh listings...');
  let total = 0;
  const slugs = Object.keys(LISTINGS_BY_CATEGORY);
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const categoryId = await getCategoryIdBySlug(slug);
    const owner = owners[i % owners.length]; // alternate owners per category
    const rows = LISTINGS_BY_CATEGORY[slug].map((l) => ({
      ...l,
      owner_id: owner.id,
      category_id: categoryId,
      status: 'available',
    }));
    const { error: insertError } = await supabase.from('listings').insert(rows);
    if (insertError) throw insertError;
    console.log(`  [${slug}] inserted ${rows.length} listing(s)`);
    total += rows.length;
  }

  console.log(`\nDone. ${total} listing(s) seeded across ${slugs.length} categories.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
