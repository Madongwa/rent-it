import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Every route here is staff-only.
router.use(requireAuth, requireAdmin);

// GET /api/admin/kyc-queue - pending seller verification submissions
router.get('/kyc-queue', async (req, res) => {
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('*, user:profiles!kyc_submissions_user_id_fkey(id, full_name, avatar_url)')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/admin/kyc/:userId/approve
router.post('/kyc/:userId/approve', async (req, res) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from('kyc_submissions')
    .update({
      status: 'approved',
      rejection_reason: null,
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('profiles').update({ seller_status: 'approved' }).eq('id', userId);

  res.json(data);
});

// POST /api/admin/kyc/:userId/reject - body: { reason }
router.post('/kyc/:userId/reject', async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;

  if (!reason) return res.status(400).json({ error: 'reason is required' });

  const { data, error } = await supabase
    .from('kyc_submissions')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('profiles').update({ seller_status: 'rejected' }).eq('id', userId);

  res.json(data);
});

// GET /api/admin/disputes - open disputes awaiting a staff decision
router.get('/disputes', async (req, res) => {
  const { data, error } = await supabase
    .from('rental_disputes')
    .select(
      '*, rental:rentals(id, start_date, end_date, listing:listings(id, title, owner_id, owner:profiles(id, full_name)), renter:profiles!rentals_renter_id_fkey(id, full_name)), raiser:profiles!rental_disputes_raised_by_fkey(id, full_name)'
    )
    .eq('status', 'open')
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/admin/disputes/:id/resolve - body: { resolution, outcome }
// outcome: 'completed' (side with the owner - normal payout proceeds) or
// 'cancelled' (side with the renter - rental fee refunds, no owner payout).
// This only records the decision; it does not itself move money yet, since
// that depends on the still-unwired Razorpay/RazorpayX integration - see
// rental_payments in schema.sql.
router.post('/disputes/:id/resolve', async (req, res) => {
  const { resolution, outcome } = req.body;

  if (!resolution || !['completed', 'cancelled'].includes(outcome)) {
    return res.status(400).json({ error: 'resolution and a valid outcome are required' });
  }

  const { data: dispute, error: findError } = await supabase
    .from('rental_disputes')
    .select('id, rental_id, status')
    .eq('id', req.params.id)
    .single();

  if (findError || !dispute) return res.status(404).json({ error: 'Dispute not found' });
  if (dispute.status !== 'open') return res.status(400).json({ error: 'Dispute already resolved' });

  const { data, error } = await supabase
    .from('rental_disputes')
    .update({
      status: 'resolved',
      resolution,
      outcome,
      resolved_by: req.user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const { data: rental } = await supabase
    .from('rentals')
    .update({ status: outcome })
    .eq('id', dispute.rental_id)
    .select('listing_id')
    .single();

  // Same "free the listing back up" rule as the normal completion path in
  // rentals.js - a disputed rental staying stuck as 'rented' forever would
  // just reintroduce the original stuck-listing bug in a new shape.
  if (rental) {
    await supabase.from('listings').update({ status: 'available' }).eq('id', rental.listing_id);
  }

  res.json(data);
});

export default router;
