import { Router } from 'express';
import crypto from 'crypto';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';
import { notify } from '../lib/notify.js';
import { razorpay, computeRentalCharges } from '../lib/razorpay.js';
import { recordRentalPayment } from '../lib/recordPayment.js';

const router = Router();

const RENTAL_SELECT =
  '*, listing:listings(id, title, image_url, price_per_day, owner_id, owner:profiles(id, full_name)), payment:rental_payments(total_amount, deposit_amount, platform_fee_amount, razorpay_payment_id, owner_stage1_paid_at, owner_stage2_paid_at, deposit_refunded_at)';

// POST /api/rentals - request to rent a listing
router.post('/', requireAuth, async (req, res) => {
  const { listing_id, start_date, end_date } = req.body;

  if (!listing_id || !start_date || !end_date) {
    return res.status(400).json({ error: 'listing_id, start_date and end_date are required' });
  }

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, owner_id, status')
    .eq('id', listing_id)
    .single();

  if (listingError || !listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.owner_id === req.user.id) {
    return res.status(400).json({ error: 'You cannot rent your own listing' });
  }
  if (listing.status !== 'available') {
    return res.status(400).json({ error: 'This item is not currently available' });
  }
  if (new Date(end_date) < new Date(start_date)) {
    return res.status(400).json({ error: 'End date must be on or after the start date' });
  }

  // Reject requests that overlap an already-approved rental on this listing -
  // two ranges [a,b] and [c,d] overlap iff a<=d and c<=b. Only 'approved'
  // rentals actually block dates; a merely 'pending' one doesn't (nothing
  // stops the owner from approving a different request for the same dates
  // instead).
  const { data: conflicting, error: conflictError } = await supabase
    .from('rentals')
    .select('id')
    .eq('listing_id', listing_id)
    .eq('status', 'approved')
    .lte('start_date', end_date)
    .gte('end_date', start_date)
    .limit(1);

  if (conflictError) return res.status(500).json({ error: conflictError.message });
  if (conflicting && conflicting.length > 0) {
    return res.status(409).json({ error: 'This item is already booked for part of those dates' });
  }

  const { data, error } = await supabase
    .from('rentals')
    .insert({ listing_id, renter_id: req.user.id, start_date, end_date })
    .select(RENTAL_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const { data: renterProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', req.user.id)
    .single();
  notify({
    userId: listing.owner_id,
    type: 'rental_request',
    title: 'New rental request',
    body: `${renterProfile?.full_name || 'Someone'} wants to rent "${data.listing.title}" (${start_date} → ${end_date}).`,
    link: '/dashboard?tab=incoming',
  });

  res.status(201).json(data);
});

// GET /api/rentals/mine - rentals I requested as a renter
router.get('/mine', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('rentals')
    .select(RENTAL_SELECT)
    .eq('renter_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/rentals/incoming - rental requests on listings I own
router.get('/incoming', requireAuth, async (req, res) => {
  const { data: myListings, error: listingsError } = await supabase
    .from('listings')
    .select('id')
    .eq('owner_id', req.user.id);

  if (listingsError) return res.status(500).json({ error: listingsError.message });
  const listingIds = (myListings || []).map((l) => l.id);
  if (listingIds.length === 0) return res.json([]);

  const { data, error } = await supabase
    .from('rentals')
    .select(
      `*, listing:listings(id, title, image_url, price_per_day), renter:profiles!rentals_renter_id_fkey(id, full_name), payment:rental_payments(total_amount, deposit_amount, platform_fee_amount, razorpay_payment_id, owner_stage1_paid_at, owner_stage2_paid_at, deposit_refunded_at)`
    )
    .in('listing_id', listingIds)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/rentals/:id - owner approves/rejects, or renter cancels
router.patch('/:id', requireAuth, async (req, res) => {
  const { status } = req.body;
  const allowed = ['approved', 'rejected', 'completed', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }

  const { data: rental, error: findError } = await supabase
    .from('rentals')
    .select('id, renter_id, status, listing:listings(owner_id)')
    .eq('id', req.params.id)
    .single();

  if (findError || !rental) return res.status(404).json({ error: 'Rental request not found' });

  const isOwner = rental.listing?.owner_id === req.user.id;
  const isRenter = rental.renter_id === req.user.id;

  if (['approved', 'rejected'].includes(status) && !isOwner) {
    return res.status(403).json({ error: 'Only the item owner can approve or reject a request' });
  }
  if (status === 'completed' && !isOwner) {
    return res.status(403).json({ error: 'Only the item owner can mark a rental complete' });
  }
  if (status === 'cancelled' && !isRenter && !isOwner) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Only sensible from-states per target, so a request can't e.g. jump
  // straight from 'pending' to 'completed', or be re-approved after
  // already being rejected.
  const validFrom = {
    approved: ['pending'],
    rejected: ['pending'],
    completed: ['approved'],
    cancelled: ['pending', 'approved'],
  };
  if (!validFrom[status].includes(rental.status)) {
    return res.status(400).json({ error: `Cannot mark a "${rental.status}" rental as "${status}"` });
  }

  const { data, error } = await supabase
    .from('rentals')
    .update({ status })
    .eq('id', req.params.id)
    .select(RENTAL_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // If a request was approved, mark the listing as rented.
  if (status === 'approved') {
    await supabase.from('listings').update({ status: 'rented' }).eq('id', data.listing_id);
  }
  // If a rental completes or is cancelled/rejected, free the listing back up.
  if (['completed', 'cancelled', 'rejected'].includes(status)) {
    await supabase.from('listings').update({ status: 'available' }).eq('id', data.listing_id);
  }

  // Notify whichever side didn't just take the action - the owner acting
  // (approve/reject/completed) tells the renter, the renter cancelling
  // tells the owner.
  const NOTIFY_COPY = {
    approved: { title: 'Rental request approved', body: `Your request for "${data.listing.title}" was approved.` },
    rejected: { title: 'Rental request declined', body: `Your request for "${data.listing.title}" was declined.` },
    completed: { title: 'Rental marked complete', body: `Your rental of "${data.listing.title}" is marked complete.` },
    cancelled: { title: 'Rental cancelled', body: `The rental for "${data.listing.title}" was cancelled.` },
  };
  const copy = NOTIFY_COPY[status];
  if (copy) {
    // Owner acting (approve/reject/completed) notifies the renter, who
    // finds it under "My Rental Requests"; the renter cancelling notifies
    // the owner, who finds it under "Requests on My Items" - different
    // tabs, since each side only ever sees the other's half of Dashboard.
    const recipientId = isOwner ? rental.renter_id : data.listing.owner_id;
    const tab = isOwner ? 'mine' : 'incoming';
    notify({ userId: recipientId, type: `rental_${status}`, ...copy, link: `/dashboard?tab=${tab}` });
  }

  res.json(data);
});

// POST /api/rentals/:id/checkout - renter creates a Razorpay order to pay
// for an approved rental. Only ever called by the renter, only once per
// rental (a second call while unpaid just returns a fresh order for the
// same amount - Razorpay orders don't expire on their own, but re-creating
// is simpler than tracking staleness).
router.post('/:id/checkout', requireAuth, async (req, res) => {
  if (!razorpay) return res.status(503).json({ error: 'Payments are not configured yet.' });

  const { data: rental, error: findError } = await supabase
    .from('rentals')
    .select(
      'id, renter_id, status, start_date, end_date, listing:listings(id, title, price_per_day, deposit_required, deposit_amount)'
    )
    .eq('id', req.params.id)
    .single();

  if (findError || !rental) return res.status(404).json({ error: 'Rental request not found' });
  if (rental.renter_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  if (rental.status !== 'approved') {
    return res.status(400).json({ error: `Cannot pay for a "${rental.status}" rental - it must be approved first.` });
  }

  const { data: existingPayment } = await supabase
    .from('rental_payments')
    .select('rental_id')
    .eq('rental_id', rental.id)
    .maybeSingle();
  if (existingPayment) return res.status(400).json({ error: 'This rental has already been paid for.' });

  const days = Math.round((new Date(rental.end_date) - new Date(rental.start_date)) / (24 * 60 * 60 * 1000)) + 1;
  const charges = computeRentalCharges({
    pricePerDay: rental.listing.price_per_day,
    days,
    depositAmount: rental.listing.deposit_required ? rental.listing.deposit_amount || 0 : 0,
  });

  let order;
  try {
    order = await razorpay.orders.create({
      amount: Math.round(charges.totalAmount * 100), // paise
      currency: 'INR',
      receipt: `rental_${rental.id}`,
      notes: { rental_id: rental.id, renter_id: req.user.id },
    });
  } catch (err) {
    return res.status(502).json({ error: `Could not start payment: ${err.message || 'Razorpay error'}` });
  }

  res.json({
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: process.env.RAZORPAY_KEY_ID,
    listing_title: rental.listing.title,
    charges,
  });
});

// POST /api/rentals/:id/verify-payment - called by the frontend right after
// Razorpay Checkout succeeds, with the three fields it hands back. Verifying
// the signature (rather than trusting the client's "it worked" call) is the
// whole point - anyone can POST a fake success here, only someone who knows
// RAZORPAY_KEY_SECRET can produce a signature that matches.
router.post('/:id/verify-payment', requireAuth, async (req, res) => {
  if (!razorpay) return res.status(503).json({ error: 'Payments are not configured yet.' });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required' });
  }

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  if (expected !== razorpay_signature) {
    return res.status(400).json({ error: 'Payment signature verification failed.' });
  }

  const { data: rental, error: findError } = await supabase
    .from('rentals')
    .select('id, renter_id, status')
    .eq('id', req.params.id)
    .single();

  if (findError || !rental) return res.status(404).json({ error: 'Rental request not found' });
  if (rental.renter_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  try {
    const data = await recordRentalPayment({
      rentalId: rental.id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rentals/:id/photos - record pickup or return condition photos.
// Files are uploaded straight from the browser to the private
// rental-photos bucket first (same pattern as listing images/KYC docs) -
// this just records the resulting URLs. Replaces the stage's whole list
// rather than appending, so re-submitting corrects a mistake cleanly.
router.post('/:id/photos', requireAuth, async (req, res) => {
  const { stage, photo_urls } = req.body;
  if (!['pickup', 'return'].includes(stage) || !Array.isArray(photo_urls)) {
    return res.status(400).json({ error: 'stage ("pickup"|"return") and photo_urls (array) are required' });
  }

  const { data: rental, error: findError } = await supabase
    .from('rentals')
    .select('id, renter_id, listing:listings(owner_id)')
    .eq('id', req.params.id)
    .single();

  if (findError || !rental) return res.status(404).json({ error: 'Rental request not found' });
  const isParticipant = rental.renter_id === req.user.id || rental.listing?.owner_id === req.user.id;
  if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });

  const column = stage === 'pickup' ? 'pickup_photo_urls' : 'return_photo_urls';
  const { data, error } = await supabase
    .from('rentals')
    .update({ [column]: photo_urls })
    .eq('id', req.params.id)
    .select(RENTAL_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/rentals/:id/dispute - flag a problem instead of confirming a
// clean return. Freezes the rental (no further status change until staff
// resolve it - see admin.js) rather than the platform trying to judge the
// equipment claim itself; see the dispute-window discussion in schema.sql.
const DISPUTE_FREEZE_DAYS = 15;

router.post('/:id/dispute', requireAuth, async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason is required' });

  const { data: rental, error: findError } = await supabase
    .from('rentals')
    .select('id, renter_id, status, listing:listings(owner_id)')
    .eq('id', req.params.id)
    .single();

  if (findError || !rental) return res.status(404).json({ error: 'Rental request not found' });
  const isParticipant = rental.renter_id === req.user.id || rental.listing?.owner_id === req.user.id;
  if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });
  if (rental.status !== 'approved') {
    return res.status(400).json({ error: `Cannot dispute a "${rental.status}" rental` });
  }

  const freezeUntil = new Date(Date.now() + DISPUTE_FREEZE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error: disputeError } = await supabase.from('rental_disputes').insert({
    rental_id: req.params.id,
    raised_by: req.user.id,
    reason,
    freeze_until: freezeUntil,
  });
  if (disputeError) return res.status(500).json({ error: disputeError.message });

  const { data, error } = await supabase
    .from('rentals')
    .update({ status: 'disputed' })
    .eq('id', req.params.id)
    .select(RENTAL_SELECT)
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const otherPartyId = req.user.id === rental.renter_id ? rental.listing.owner_id : rental.renter_id;
  notify({
    userId: otherPartyId,
    type: 'rental_disputed',
    title: 'A problem was reported',
    body: `A dispute was raised on the rental for "${data.listing.title}". Our staff will review it.`,
    link: '/dashboard',
  });

  res.json(data);
});

export default router;
