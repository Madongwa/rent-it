import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Every route here is staff-only.
router.use(requireAuth, requireAdmin);

// GET /api/admin/kyc-queue - seller verification submissions awaiting a
// staff decision. Includes both 'pending' (nothing has looked at it yet -
// today's only case, since automated verification isn't wired up) and
// 'manual_review' (the automated vendor checked it and flagged it for a
// human) - both need the same staff action.
router.get('/kyc-queue', async (req, res) => {
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('*, user:profiles!kyc_submissions_user_id_fkey(id, full_name, avatar_url)')
    .in('status', ['pending', 'manual_review'])
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

// GET /api/admin/users - every account, for the staff user-management tab.
// Email/ban status live on Supabase's own auth.users, not our `profiles`
// table, so this merges the Admin API's user list with our profile rows
// instead of a single query - there's no public.* view joining the two.
// listUsers() paginates at up to 1000/page; fine for now, would need real
// pagination past that.
router.get('/users', async (req, res) => {
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authError) return res.status(500).json({ error: authError.message });

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, role, seller_status, created_at');
  if (profileError) return res.status(500).json({ error: profileError.message });

  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const users = authData.users
    .map((u) => ({
      id: u.id,
      email: u.email,
      full_name: profileById[u.id]?.full_name || null,
      role: profileById[u.id]?.role || 'user',
      seller_status: profileById[u.id]?.seller_status || 'not_submitted',
      created_at: profileById[u.id]?.created_at || u.created_at,
      banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json(users);
});

// PATCH /api/admin/users/:id/role - body: { role: 'admin' | 'user' }
router.patch('/users/:id/role', async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: "role must be 'user' or 'admin'" });
  }
  if (req.params.id === req.user.id && role === 'user') {
    return res.status(400).json({ error: "You can't remove your own admin access." });
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', req.params.id)
    .select('id, full_name, role')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/admin/users/:id/ban - blocks sign-in via Supabase Auth's own
// ban_duration (not a column of ours) - ~100 years reads as "indefinite"
// without a magic "forever" sentinel the Admin API doesn't accept.
router.post('/users/:id/ban', async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "You can't ban your own account." });
  }

  const { data, error } = await supabase.auth.admin.updateUserById(req.params.id, { ban_duration: '876000h' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ id: data.user.id, banned: true });
});

// POST /api/admin/users/:id/unban
router.post('/users/:id/unban', async (req, res) => {
  const { data, error } = await supabase.auth.admin.updateUserById(req.params.id, { ban_duration: 'none' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ id: data.user.id, banned: false });
});

// GET /api/admin/listings - every listing regardless of status, for the
// moderation tab (the public /api/listings only ever returns 'available'
// ones). Capped at 200 - a moderation queue, not full pagination.
router.get('/listings', async (req, res) => {
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, status, price_per_day, created_at, owner:profiles(id, full_name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/admin/listings/:id/status - body: { status }. Same
// 'available'/'rented'/'inactive' enum as the owner-facing PATCH
// /api/listings/:id, but bypasses the ownership check - this is the
// takedown/restore action for a listing that violates policy.
router.patch('/listings/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['available', 'inactive'].includes(status)) {
    return res.status(400).json({ error: "status must be 'available' or 'inactive'" });
  }

  const { data, error } = await supabase
    .from('listings')
    .update({ status })
    .eq('id', req.params.id)
    .select('id, title, status')
    .single();

  if (error) return res.status(500).json({ error: error.message });
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
