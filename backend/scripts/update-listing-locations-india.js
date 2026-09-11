// One-off: converts the 30 seeded listings' locations from US cities to
// Indian cities, to match the site's target market (and the ₹ pricing).
//
// Usage: cd backend && node scripts/update-listing-locations-india.js

import { supabase } from '../src/lib/supabaseClient.js';

const LOCATION_MAP = {
  'Salem, OR': 'Ludhiana, Punjab',
  'Eugene, OR': 'Karnal, Haryana',
  'Corvallis, OR': 'Amritsar, Punjab',
  'Denver, CO': 'Pune, Maharashtra',
  'Boulder, CO': 'Nashik, Maharashtra',
  'Aurora, CO': 'Nagpur, Maharashtra',
  'Austin, TX': 'Bengaluru, Karnataka',
  'Round Rock, TX': 'Mysuru, Karnataka',
  'Cedar Park, TX': 'Mangaluru, Karnataka',
  'Nashville, TN': 'Jaipur, Rajasthan',
  'Franklin, TN': 'Udaipur, Rajasthan',
  'Brentwood, TN': 'Jodhpur, Rajasthan',
  'Charlotte, NC': 'Mumbai, Maharashtra',
  'Concord, NC': 'Thane, Maharashtra',
  'Phoenix, AZ': 'Gurugram, Haryana',
  'Scottsdale, AZ': 'Noida, Uttar Pradesh',
  'Tempe, AZ': 'New Delhi',
};

async function main() {
  let updated = 0;
  for (const [oldLoc, newLoc] of Object.entries(LOCATION_MAP)) {
    const { data, error } = await supabase
      .from('listings')
      .update({ location: newLoc })
      .eq('location', oldLoc)
      .select('id');
    if (error) throw error;
    console.log(`  ${oldLoc} -> ${newLoc} (${data.length} row(s))`);
    updated += data.length;
  }
  console.log(`\nDone. ${updated} row(s) updated.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Update failed:', err);
    process.exit(1);
  });
