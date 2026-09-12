import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const RENTAL_SELECT =
  '*, listing:listings(id, title, image_url, price_per_day, owner_id, owner:profiles(id, full_name))';

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
    .select(`*, listing:listings(id, title, image_url, price_per_day), renter:profiles!rentals_renter_id_fkey(id, full_name)`)
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

  res.json(data);
});

export default router;
