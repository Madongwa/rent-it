import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Recomputes and stores avg_rating/review_count on the listing itself -
// mirrors exactly what seed-marketplace-buildout.js does for seed data, so
// a real submitted review updates the same fields the Marketplace filters
// and card badges already read.
export async function recomputeListingRating(listingId) {
  const { data: reviews, error } = await supabase.from('reviews').select('rating').eq('listing_id', listingId);
  if (error) throw error;

  const reviewCount = reviews.length;
  const avgRating = reviewCount === 0 ? 0 : Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10) / 10;

  const { error: updateError } = await supabase
    .from('listings')
    .update({ avg_rating: avgRating, review_count: reviewCount })
    .eq('id', listingId);
  if (updateError) throw updateError;

  return { avgRating, reviewCount };
}

// POST /api/reviews - submit a review for a listing. One per user per
// listing (enforced by a unique index, not just this check, but this gives
// a friendlier error than a raw constraint violation).
router.post('/', requireAuth, async (req, res) => {
  const { listing_id, rating, comment } = req.body;

  if (!listing_id || !rating) {
    return res.status(400).json({ error: 'listing_id and rating are required' });
  }
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'rating must be a whole number from 1 to 5' });
  }

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, owner_id')
    .eq('id', listing_id)
    .single();
  if (listingError || !listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.owner_id === req.user.id) {
    return res.status(400).json({ error: 'You cannot review your own listing' });
  }

  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('listing_id', listing_id)
    .eq('reviewer_id', req.user.id)
    .maybeSingle();
  if (existing) return res.status(409).json({ error: "You've already reviewed this listing" });

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', req.user.id).single();

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      listing_id,
      reviewer_id: req.user.id,
      reviewer_name: profile?.full_name || 'Rent It user',
      rating: ratingNum,
      comment: comment || null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const { avgRating, reviewCount } = await recomputeListingRating(listing_id);
  res.status(201).json({ ...data, listing_avg_rating: avgRating, listing_review_count: reviewCount });
});

// POST /api/reviews/:id/flag - any signed-in user can report a review for
// staff attention (e.g. abusive language, spam) - body: { reason }. Shows
// up in the admin Reviews Moderation tab, and feeds the Dispute Center.
router.post('/:id/flag', requireAuth, async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason is required' });

  const { data, error } = await supabase
    .from('reviews')
    .update({ flagged: true, flag_reason: reason, flagged_by: req.user.id, flagged_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
