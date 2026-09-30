import { supabase } from './supabaseClient.js';
import { translateUiTexts } from './translate.js';
import { rentalDays } from './rates.js';

// The rental agreement page (/rentals/:id/agreement): a record of what the
// renter and owner agreed, in English plus each person's chosen language.
// Only the fixed wording below is translated - through the site's normal
// UI translation cache - never names, prices or anything else about the
// rental, so no personal data reaches an AI for this.

export const AGREEMENT_STATUSES = ['approved', 'completed', 'disputed'];

export const TEXT = {
  title: 'Rental agreement',
  intro: 'A record of the rental the owner and renter below agreed on Rent It.',
  reference: 'Reference',
  owner: 'Owner',
  renter: 'Renter',
  item: 'Item',
  location: 'Location',
  period: 'Rental period',
  days: 'days',
  pricePerDay: 'Agreed price per day',
  total: 'Total rent',
  deposit: 'Deposit',
  noDeposit: 'No deposit',
  cancellation: 'Cancellation policy',
  photos: 'Condition photos',
  pickupPhotos: 'taken at pickup',
  returnPhotos: 'taken at return',
  status: 'Status',
  statusApproved: 'Agreed',
  statusCompleted: 'Completed',
  statusDisputed: 'A problem was reported',
  termsHeading: 'What both people agreed to',
  term1: 'The renter pays the rent and any deposit to the owner directly, in person at pickup. Nothing is paid in advance, and Rent It never handles the money.',
  term2: 'The owner and renter check the item together at pickup and at return, and take photos each time.',
  term3: 'The renter looks after the item from pickup until it is returned, uses it safely and only for its normal purpose, and pays for loss or damage beyond normal wear.',
  term4: 'The owner gives back the deposit when the item is returned in the condition it left in, less any damage costs both people agree on.',
  term5: 'If something goes wrong, either person can report a problem on Rent It within the rental.',
  footer: 'Rent It is a marketplace and is not a party to this rental. The full Terms of Service apply.',
  free: 'Free cancellation',
  flexible: 'Flexible',
  strict: 'Strict',
};

const KEYS = Object.keys(TEXT);

// The fixed wording in `lang`, falling back to English for any line the
// translator couldn't do this time.
export async function agreementText(lang, { translate = translateUiTexts } = {}) {
  if (!lang || lang === 'en') return TEXT;
  const translations = await translate(KEYS.map((k) => TEXT[k]), lang);
  return Object.fromEntries(KEYS.map((k) => [k, translations?.[TEXT[k]] || TEXT[k]]));
}

// The agreement for one rental, for one of its two people. { error, status }
// when it doesn't exist, isn't theirs, or isn't agreed yet.
export async function buildAgreement(rentalId, userId, { db = supabase, textFor = agreementText } = {}) {
  const { data: r, error } = await db
    .from('rentals')
    .select(
      'id, renter_id, status, start_date, end_date, price_per_day, created_at, pickup_photo_urls, return_photo_urls, listing:listings!inner(id, title, owner_id, location, condition, deposit_required, deposit_amount, cancellation_policy)'
    )
    .eq('id', rentalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!r) return { error: 'Rental not found', status: 404 };
  if (userId !== r.renter_id && userId !== r.listing.owner_id) return { error: 'Forbidden', status: 403 };
  if (!AGREEMENT_STATUSES.includes(r.status)) {
    return { error: 'The agreement is ready once both of you have agreed the deal.', status: 409 };
  }

  const { data: people, error: peopleError } = await db
    .from('profiles')
    .select('id, full_name, preferred_language')
    .in('id', [r.renter_id, r.listing.owner_id]);
  if (peopleError) throw new Error(peopleError.message);
  const owner = people.find((p) => p.id === r.listing.owner_id) || {};
  const renter = people.find((p) => p.id === r.renter_id) || {};

  // English first, then each person's language (once, if they differ).
  const langs = ['en', ...new Set([owner.preferred_language, renter.preferred_language].filter((l) => l && l !== 'en'))];
  const texts = {};
  for (const lang of langs) {
    try {
      texts[lang] = await textFor(lang);
    } catch (err) {
      console.error('[agreement] translation failed:', lang, err.message);
    }
  }

  const days = rentalDays(r.start_date, r.end_date);
  const price = Number(r.price_per_day);
  return {
    agreement: {
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      owner_name: owner.full_name || 'Owner',
      renter_name: renter.full_name || 'Renter',
      item: r.listing.title,
      listing_id: r.listing.id,
      location: r.listing.location,
      condition: r.listing.condition,
      start_date: r.start_date,
      end_date: r.end_date,
      days,
      price_per_day: price,
      total: Math.round(price * days * 100) / 100,
      deposit: r.listing.deposit_required ? Number(r.listing.deposit_amount) || 0 : null,
      cancellation_policy: r.listing.cancellation_policy,
      pickup_photos: (r.pickup_photo_urls || []).length,
      return_photos: (r.return_photo_urls || []).length,
    },
    languages: Object.keys(texts),
    text: texts,
  };
}
