import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';
import { notify } from '../lib/notify.js';
import { getOrCreateConversation, postMessage } from '../lib/conversations.js';
import { parseOfferTerms, describeTerms, formatInr, whoseTurn } from '../lib/offers.js';
import { releaseListingIfIdle } from '../lib/listingStatus.js';
import { effectiveDailyRate, rentalDays } from '../lib/rates.js';

// A rental request carries the renter's own per-day price, and the two
// sides bargain in the listing's chat thread: every offer/counter-offer is
// a rental_offers row, shown in chat as a card. Once one side accepts the
// other's open offer, the rental is approved at those terms. No money
// moves through the app - the renter pays the owner directly.
const router = Router();

const OFFERS_SELECT = 'offers:rental_offers(id, proposed_by, price_per_day, start_date, end_date, status, created_at)';
const LISTING_FIELDS = 'id, title, image_url, price_per_day, deposit_required, deposit_amount, owner_id';
const RENTAL_SELECT = `*, listing:listings(${LISTING_FIELDS}, owner:profiles(id, full_name)), ${OFFERS_SELECT}`;
const INCOMING_SELECT = `*, listing:listings(${LISTING_FIELDS}), renter:profiles!rentals_renter_id_fkey(id, full_name), ${OFFERS_SELECT}`;

function loadRental(id) {
  return supabase
    .from('rentals')
    .select(
      'id, listing_id, renter_id, status, start_date, end_date, price_per_day, listed_price_per_day, conversation_id, listing:listings(id, title, owner_id, price_per_day, deposit_required, deposit_amount)'
    )
    .eq('id', id)
    .single();
}

function loadOpenOffer(rentalId) {
  return supabase
    .from('rental_offers')
    .select('id, proposed_by, price_per_day, start_date, end_date')
    .eq('rental_id', rentalId)
    .eq('status', 'open')
    .maybeSingle();
}

async function profileName(userId) {
  const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
  return data?.full_name || 'Someone';
}

// Notifications point at the chat thread where the offer/status line just
// landed. Requests from before offers existed have no thread, so those
// fall back to the Dashboard tab the recipient would find them on.
function threadLink(conversationId, dashboardTab) {
  return conversationId ? `/messages?c=${conversationId}` : `/dashboard?tab=${dashboardTab}`;
}

// Only approved (or disputed) rentals actually block dates - two ranges
// [a,b] and [c,d] overlap iff a<=d and c<=b. This is the friendly early
// check; the rentals_no_overlapping_bookings constraint in schema.sql is
// what guarantees it when two accepts race.
const BOOKED_STATUSES = ['approved', 'disputed'];
const BOOKED_ERROR = 'This item is already booked for part of those dates';

async function hasBookingConflict({ listingId, startDate, endDate, excludeRentalId }) {
  let query = supabase
    .from('rentals')
    .select('id')
    .eq('listing_id', listingId)
    .in('status', BOOKED_STATUSES)
    .lte('start_date', endDate)
    .gte('end_date', startDate)
    .limit(1);
  if (excludeRentalId) query = query.neq('id', excludeRentalId);
  const { data, error } = await query;
  return { conflict: (data || []).length > 0, error };
}

// POST /api/rentals - renter sends a request with their offered price.
// Lands in the (listing, renter) chat thread as an offer card, and the
// owner is notified with both the listed and the offered price.
router.post('/', requireAuth, async (req, res) => {
  const { listing_id } = req.body;
  if (!listing_id) return res.status(400).json({ error: 'listing_id is required' });
  const { terms, error: termsError } = parseOfferTerms(req.body);
  if (termsError) return res.status(400).json({ error: termsError });

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, owner_id, status, title, price_per_day, price_per_week, price_per_month')
    .eq('id', listing_id)
    .single();

  if (listingError || !listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.owner_id === req.user.id) {
    return res.status(400).json({ error: 'You cannot rent your own listing' });
  }
  if (listing.status !== 'available') {
    return res.status(400).json({ error: 'This item is not currently available' });
  }

  // One negotiation at a time per renter per listing - a new price belongs
  // in the existing thread as a counter-offer, not a parallel request.
  const { data: openRequests, error: openError } = await supabase
    .from('rentals')
    .select('id')
    .eq('listing_id', listing_id)
    .eq('renter_id', req.user.id)
    .eq('status', 'pending')
    .limit(1);
  if (openError) return res.status(500).json({ error: openError.message });
  if (openRequests.length > 0) {
    return res.status(409).json({ error: 'You already have an open offer on this item - continue the conversation in Messages.' });
  }

  const { conflict, error: conflictError } = await hasBookingConflict({
    listingId: listing_id,
    startDate: terms.start_date,
    endDate: terms.end_date,
  });
  if (conflictError) return res.status(500).json({ error: conflictError.message });
  if (conflict) return res.status(409).json({ error: BOOKED_ERROR });

  const { data: conversation, error: conversationError } = await getOrCreateConversation({
    listingId: listing_id,
    ownerId: listing.owner_id,
    renterId: req.user.id,
    select: 'id',
  });
  if (conversationError || !conversation) {
    return res.status(500).json({ error: conversationError?.message || 'Could not open a conversation' });
  }

  const { data: rental, error } = await supabase
    .from('rentals')
    .insert({
      listing_id,
      renter_id: req.user.id,
      ...terms,
      // The weekly/monthly rate when the dates are long enough (lib/rates.js).
      listed_price_per_day: effectiveDailyRate(listing, rentalDays(terms.start_date, terms.end_date)).rate,
      conversation_id: conversation.id,
    })
    .select('id')
    .single();
  if (error) return res.status(500).json({ error: error.message });

  const { data: offer, error: offerError } = await supabase
    .from('rental_offers')
    .insert({ rental_id: rental.id, proposed_by: req.user.id, ...terms })
    .select('id')
    .single();
  if (offerError) {
    // Don't leave behind a pending request with no offer on it.
    await supabase.from('rentals').delete().eq('id', rental.id);
    return res.status(500).json({ error: offerError.message });
  }

  const summary = describeTerms(terms, listing.price_per_day);
  await postMessage({
    conversationId: conversation.id,
    senderId: req.user.id,
    body: `Offer: ${summary}`,
    kind: 'offer',
    offerId: offer.id,
  });

  await notify({
    userId: listing.owner_id,
    type: 'rental_request',
    title: `New offer on "${listing.title}"`,
    body: `${await profileName(req.user.id)} offered ${summary}.`,
    link: threadLink(conversation.id, 'incoming'),
  });

  const { data, error: reloadError } = await supabase.from('rentals').select(RENTAL_SELECT).eq('id', rental.id).single();
  if (reloadError) return res.status(500).json({ error: reloadError.message });
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
    .select(INCOMING_SELECT)
    .in('listing_id', listingIds)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/rentals/:id/offers - counter-offer (price and/or dates) on a
// pending request. Only whoever's turn it is can counter; their offer
// replaces the open one and the turn passes to the other side.
router.post('/:id/offers', requireAuth, async (req, res) => {
  const { terms, error: termsError } = parseOfferTerms(req.body);
  if (termsError) return res.status(400).json({ error: termsError });

  const { data: rental, error: findError } = await loadRental(req.params.id);
  if (findError || !rental) return res.status(404).json({ error: 'Rental request not found' });

  const isOwner = rental.listing?.owner_id === req.user.id;
  const isRenter = rental.renter_id === req.user.id;
  if (!isOwner && !isRenter) return res.status(403).json({ error: 'Forbidden' });
  if (rental.status !== 'pending') {
    return res.status(400).json({ error: `This request is already ${rental.status}` });
  }

  const { data: openOffer, error: offerFindError } = await loadOpenOffer(rental.id);
  if (offerFindError) return res.status(500).json({ error: offerFindError.message });
  if (whoseTurn(rental, openOffer) !== (isOwner ? 'owner' : 'renter')) {
    return res.status(409).json({ error: 'Waiting for the other side to respond to your offer.' });
  }

  // Compare-and-set on status, so two quick counters (or a counter racing
  // an accept) can't both win.
  if (openOffer) {
    const { data: replaced, error: replaceError } = await supabase
      .from('rental_offers')
      .update({ status: 'countered' })
      .eq('id', openOffer.id)
      .eq('status', 'open')
      .select('id');
    if (replaceError) return res.status(500).json({ error: replaceError.message });
    if (replaced.length === 0) {
      return res.status(409).json({ error: 'This offer was just answered - refresh to see the latest.' });
    }
  }

  const { data: offer, error: offerError } = await supabase
    .from('rental_offers')
    .insert({ rental_id: rental.id, proposed_by: req.user.id, ...terms })
    .select('id')
    .single();
  if (offerError) {
    if (openOffer) await supabase.from('rental_offers').update({ status: 'open' }).eq('id', openOffer.id);
    return res.status(500).json({ error: offerError.message });
  }

  // Only while still pending - if the other side withdrew or declined in
  // the meantime, this counter never counted, so close it again.
  const { data, error } = await supabase
    .from('rentals')
    .update(terms)
    .eq('id', rental.id)
    .eq('status', 'pending')
    .select(RENTAL_SELECT)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) {
    await supabase.from('rental_offers').update({ status: 'withdrawn' }).eq('id', offer.id).eq('status', 'open');
    return res.status(409).json({ error: 'This request was just closed - refresh to see the latest.' });
  }

  const summary = describeTerms(terms, rental.listed_price_per_day ?? rental.listing.price_per_day);
  await postMessage({
    conversationId: rental.conversation_id,
    senderId: req.user.id,
    body: `Counter-offer: ${summary}`,
    kind: 'offer',
    offerId: offer.id,
  });

  await notify({
    userId: isOwner ? rental.renter_id : rental.listing.owner_id,
    type: 'rental_counter_offer',
    title: `New counter-offer on "${rental.listing.title}"`,
    body: `${await profileName(req.user.id)} countered with ${summary}.`,
    link: threadLink(rental.conversation_id, isOwner ? 'mine' : 'incoming'),
  });

  res.json(data);
});

// POST /api/rentals/:id/accept - accept the other side's open offer. The
// rental is approved at exactly those terms.
router.post('/:id/accept', requireAuth, async (req, res) => {
  const { data: rental, error: findError } = await loadRental(req.params.id);
  if (findError || !rental) return res.status(404).json({ error: 'Rental request not found' });

  const isOwner = rental.listing?.owner_id === req.user.id;
  const isRenter = rental.renter_id === req.user.id;
  if (!isOwner && !isRenter) return res.status(403).json({ error: 'Forbidden' });
  if (rental.status !== 'pending') {
    return res.status(400).json({ error: `This request is already ${rental.status}` });
  }

  const { data: openOffer, error: offerFindError } = await loadOpenOffer(rental.id);
  if (offerFindError) return res.status(500).json({ error: offerFindError.message });
  if (whoseTurn(rental, openOffer) !== (isOwner ? 'owner' : 'renter')) {
    return res.status(409).json({ error: "You can't accept your own offer - wait for the other side to accept or counter it." });
  }

  const terms = openOffer
    ? { price_per_day: openOffer.price_per_day, start_date: openOffer.start_date, end_date: openOffer.end_date }
    : {
        price_per_day: rental.price_per_day ?? rental.listing.price_per_day,
        start_date: rental.start_date,
        end_date: rental.end_date,
      };

  const { conflict, error: conflictError } = await hasBookingConflict({
    listingId: rental.listing_id,
    startDate: terms.start_date,
    endDate: terms.end_date,
    excludeRentalId: rental.id,
  });
  if (conflictError) return res.status(500).json({ error: conflictError.message });
  if (conflict) return res.status(409).json({ error: BOOKED_ERROR });

  // Claim the rental first (compare-and-set on status). A withdraw or
  // decline racing this one does the same on its side, so exactly one of
  // them wins - and the loser changes nothing.
  const { data: claimed, error: claimError } = await supabase
    .from('rentals')
    .update({ status: 'approved', ...terms })
    .eq('id', rental.id)
    .eq('status', 'pending')
    .select('id');
  // 23P01 = exclusion_violation: another offer on overlapping dates was
  // accepted in the instant since the check above.
  if (claimError?.code === '23P01') return res.status(409).json({ error: BOOKED_ERROR });
  if (claimError) return res.status(500).json({ error: claimError.message });
  if (claimed.length === 0) {
    return res.status(409).json({ error: 'This request was just withdrawn or answered - refresh to see the latest.' });
  }

  if (openOffer) {
    const { data: accepted, error: acceptError } = await supabase
      .from('rental_offers')
      .update({ status: 'accepted' })
      .eq('id', openOffer.id)
      .eq('status', 'open')
      .select('id');
    if (acceptError || accepted.length === 0) {
      // The offer changed under us (a counter landed first) - put the
      // rental back the way it was.
      await supabase
        .from('rentals')
        .update({ status: 'pending', price_per_day: rental.price_per_day, start_date: rental.start_date, end_date: rental.end_date })
        .eq('id', rental.id)
        .eq('status', 'approved');
      if (acceptError) return res.status(500).json({ error: acceptError.message });
      return res.status(409).json({ error: 'This offer was just countered - refresh to see the latest.' });
    }
  }

  await supabase.from('listings').update({ status: 'rented' }).eq('id', rental.listing_id);

  const { data, error } = await supabase.from('rentals').select(RENTAL_SELECT).eq('id', rental.id).single();
  if (error) return res.status(500).json({ error: error.message });
  // Cancelled in the instant after it was approved - don't leave the
  // listing marked rented for a booking that no longer exists.
  if (data.status !== 'approved') await releaseListingIfIdle(rental.listing_id);

  const summary = describeTerms(terms, rental.listed_price_per_day ?? rental.listing.price_per_day);
  const deposit = rental.listing.deposit_required
    ? rental.listing.deposit_amount
      ? ` Deposit: ${formatInr(rental.listing.deposit_amount)}, paid to the owner at pickup.`
      : ' A deposit is required - agree the amount with the owner.'
    : '';
  await postMessage({
    conversationId: rental.conversation_id,
    senderId: req.user.id,
    body: `Deal agreed: ${summary}. Pay the owner directly at pickup.${deposit}`,
    kind: 'system',
  });

  await notify({
    userId: isOwner ? rental.renter_id : rental.listing.owner_id,
    type: 'rental_approved',
    title: `Deal agreed on "${rental.listing.title}"`,
    body: `${await profileName(req.user.id)} accepted ${summary}.`,
    link: threadLink(rental.conversation_id, isOwner ? 'mine' : 'incoming'),
  });

  res.json(data);
});

// PATCH /api/rentals/:id - owner declines or marks complete, or either side
// cancels. (Approving happens by accepting an offer - POST /:id/accept.)
router.patch('/:id', requireAuth, async (req, res) => {
  const { status } = req.body;
  const allowed = ['rejected', 'completed', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }

  const { data: rental, error: findError } = await loadRental(req.params.id);
  if (findError || !rental) return res.status(404).json({ error: 'Rental request not found' });

  const isOwner = rental.listing?.owner_id === req.user.id;
  const isRenter = rental.renter_id === req.user.id;

  if (status === 'rejected' && !isOwner) {
    return res.status(403).json({ error: 'Only the item owner can decline a request' });
  }
  if (status === 'completed' && !isOwner) {
    return res.status(403).json({ error: 'Only the item owner can mark a rental complete' });
  }
  if (status === 'cancelled' && !isRenter && !isOwner) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Only sensible from-states per target, so a request can't e.g. jump
  // straight from 'pending' to 'completed', or be re-opened after being
  // declined.
  const validFrom = {
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
    .eq('status', rental.status)
    .select(RENTAL_SELECT)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(409).json({ error: 'This rental just changed - refresh to see the latest.' });

  // Ending a negotiation closes its open offer, so its card stops showing
  // Accept/Counter buttons.
  if (rental.status === 'pending') {
    const { data: openOffer } = await loadOpenOffer(rental.id);
    if (openOffer) {
      await supabase
        .from('rental_offers')
        .update({ status: openOffer.proposed_by === req.user.id ? 'withdrawn' : 'declined' })
        .eq('id', openOffer.id)
        .eq('status', 'open');
    }
  }

  // Only an approved rental ever marked the listing as rented, and the
  // listing stays rented while any other approved rental still holds it.
  if (rental.status === 'approved') {
    await releaseListingIfIdle(rental.listing_id);
  }

  const actorName = await profileName(req.user.id);
  const CHAT_LINE = {
    rejected: `${actorName} declined the request.`,
    completed: `${actorName} marked the rental as complete.`,
    cancelled: rental.status === 'pending' ? `${actorName} withdrew the request.` : `${actorName} cancelled the rental.`,
  };
  await postMessage({ conversationId: rental.conversation_id, senderId: req.user.id, body: CHAT_LINE[status], kind: 'system' });

  // Notify whichever side didn't just take the action.
  const NOTIFY_COPY = {
    rejected: { title: 'Rental request declined', body: `Your request for "${data.listing.title}" was declined.` },
    completed: { title: 'Rental marked complete', body: `Your rental of "${data.listing.title}" is marked complete.` },
    cancelled: { title: 'Rental cancelled', body: `The rental for "${data.listing.title}" was cancelled.` },
  };
  await notify({
    userId: isOwner ? rental.renter_id : data.listing.owner_id,
    type: `rental_${status}`,
    ...NOTIFY_COPY[status],
    link: threadLink(rental.conversation_id, isOwner ? 'mine' : 'incoming'),
  });

  res.json(data);
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
    .select('id, renter_id, status, conversation_id, listing:listings(owner_id)')
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

  await postMessage({
    conversationId: rental.conversation_id,
    senderId: req.user.id,
    body: `${await profileName(req.user.id)} reported a problem with this rental. Rent It staff will review it.`,
    kind: 'system',
  });

  const otherPartyId = req.user.id === rental.renter_id ? rental.listing.owner_id : rental.renter_id;
  await notify({
    userId: otherPartyId,
    type: 'rental_disputed',
    title: 'A problem was reported',
    body: `A dispute was raised on the rental for "${data.listing.title}". Our staff will review it.`,
    link: '/dashboard',
  });

  res.json(data);
});

export default router;
