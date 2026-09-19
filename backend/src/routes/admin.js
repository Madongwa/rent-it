import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { logAdminAction } from '../lib/adminLog.js';
import { recomputeListingRating } from './reviews.js';

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
  await logAdminAction(req.user.id, 'kyc.approve', 'user', userId);

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
  await logAdminAction(req.user.id, 'kyc.reject', 'user', userId, reason);

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
  await logAdminAction(req.user.id, 'user.role_change', 'user', req.params.id, `role -> ${role}`);
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
  await logAdminAction(req.user.id, 'user.ban', 'user', req.params.id);
  res.json({ id: data.user.id, banned: true });
});

// POST /api/admin/users/:id/unban
router.post('/users/:id/unban', async (req, res) => {
  const { data, error } = await supabase.auth.admin.updateUserById(req.params.id, { ban_duration: 'none' });
  if (error) return res.status(500).json({ error: error.message });
  await logAdminAction(req.user.id, 'user.unban', 'user', req.params.id);
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
  await logAdminAction(req.user.id, 'listing.status_change', 'listing', req.params.id, `status -> ${status}`);
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
// This only records the decision; it does not itself move money. Renter
// payment collection is wired (see rentals.js /checkout, /verify-payment),
// but owner payouts and refunds still happen manually outside the app for
// now - automating those needs RazorpayX Route with each owner KYC'd as a
// linked sub-merchant, which is real compliance infrastructure this app
// doesn't have yet. Staff use the amounts recorded in rental_payments
// (owner_stage1/2_amount, deposit_amount) as the reference for whatever
// they pay/refund outside the platform.
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

  await logAdminAction(req.user.id, 'dispute.resolve', 'rental_dispute', req.params.id, `${outcome}: ${resolution}`);

  res.json(data);
});

// GET /api/admin/overview - top-line counts for the dashboard landing tab.
// Every query here is a `head: true, count: 'exact'` - Postgres can answer
// a row count without ever returning matching rows, so this stays cheap
// even as each table grows well past what the moderation-queue endpoints
// above are willing to return in full.
router.get('/overview', async (req, res) => {
  const countOf = async (table, filters = {}) => {
    let query = supabase.from(table).select('*', { count: 'exact', head: true });
    for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
    const { count, error } = await query;
    if (error) throw error;
    return count;
  };

  try {
    const [
      totalUsers,
      totalListings,
      activeRentals,
      pendingKyc,
      openDisputes,
      flaggedReviews,
      totalReviews,
    ] = await Promise.all([
      countOf('profiles'),
      countOf('listings'),
      countOf('rentals', { status: 'approved' }),
      countOf('kyc_submissions', { status: 'pending' }),
      countOf('rental_disputes', { status: 'open' }),
      countOf('reviews', { flagged: true }),
      countOf('reviews'),
    ]);

    res.json({
      total_users: totalUsers,
      total_listings: totalListings,
      active_rentals: activeRentals,
      pending_kyc: pendingKyc,
      open_disputes: openDisputes,
      flagged_reviews: flaggedReviews,
      total_reviews: totalReviews,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/rentals?status=pending - every rental request regardless
// of status (the renter/owner-facing routes in rentals.js only ever show
// a user their own side of a rental). Read-only visibility for staff;
// unlike Disputes, there's no admin action here - the renter/owner already
// own that workflow, this is oversight, not a takeover.
router.get('/rentals', async (req, res) => {
  const { status } = req.query;
  let query = supabase
    .from('rentals')
    .select(
      'id, start_date, end_date, status, created_at, listing:listings(id, title, owner:profiles(id, full_name)), renter:profiles!rentals_renter_id_fkey(id, full_name)'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/admin/reviews?flagged=true - every review, for the Reviews
// Moderation tab. Capped at 200, same as the other moderation queues above.
router.get('/reviews', async (req, res) => {
  const { flagged } = req.query;
  let query = supabase
    .from('reviews')
    .select('*, listing:listings(id, title), flagged_by_user:profiles!reviews_flagged_by_fkey(id, full_name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (flagged) query = query.eq('flagged', flagged === 'true');

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/admin/reviews/:id/unflag - dismiss a flag without removing the
// review (staff looked at it and it's fine).
router.post('/reviews/:id/unflag', async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .update({ flagged: false, flag_reason: null, flagged_by: null, flagged_at: null })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  await logAdminAction(req.user.id, 'review.unflag', 'review', req.params.id);
  res.json(data);
});

// DELETE /api/admin/reviews/:id - remove a review that violates policy.
// Recomputes the listing's avg_rating/review_count the same way a real
// review submission does, so the listing card/detail page stay in sync.
router.delete('/reviews/:id', async (req, res) => {
  const { data: existing, error: findError } = await supabase
    .from('reviews')
    .select('id, listing_id')
    .eq('id', req.params.id)
    .single();
  if (findError || !existing) return res.status(404).json({ error: 'Review not found' });

  const { error } = await supabase.from('reviews').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  await recomputeListingRating(existing.listing_id);
  await logAdminAction(req.user.id, 'review.delete', 'review', req.params.id);

  res.status(204).send();
});

// GET /api/admin/activity-log?page=1&limit=50 - staff action history, most
// recent first. Same page/hasMore shape as GET /api/listings, for the same
// reason (a real total-count query would need a second round-trip).
router.get('/activity-log', async (req, res) => {
  const limitNum = Math.min(Number(req.query.limit) || 50, 200);
  const pageNum = Math.max(Number(req.query.page) || 1, 1);
  const from = (pageNum - 1) * limitNum;

  const { data, error } = await supabase
    .from('admin_actions_log')
    .select('*, admin:profiles(id, full_name)')
    .order('created_at', { ascending: false })
    .range(from, from + limitNum);

  if (error) return res.status(500).json({ error: error.message });

  const hasMore = data.length > limitNum;
  res.json({ data: data.slice(0, limitNum), page: pageNum, pageSize: limitNum, hasMore });
});

// GET /api/admin/settings - platform-wide flags (currently just maintenance
// mode) shown/toggled from the Overview dashboard's System Status widget.
// Upserts the singleton row on read - the schema.sql seed insert only runs
// once per database, so any environment that missed it (or a fresh one)
// self-heals here instead of 500ing on a missing row.
router.get('/settings', async (req, res) => {
  const { data, error } = await supabase
    .from('platform_settings')
    .upsert({ id: 1 }, { onConflict: 'id' })
    .select('maintenance_mode, updated_at')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/admin/settings - body: { maintenance_mode }
router.patch('/settings', async (req, res) => {
  const { maintenance_mode } = req.body;
  if (typeof maintenance_mode !== 'boolean') {
    return res.status(400).json({ error: 'maintenance_mode must be a boolean' });
  }

  const { data, error } = await supabase
    .from('platform_settings')
    .update({ maintenance_mode, updated_by: req.user.id, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('maintenance_mode, updated_at')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  await logAdminAction(req.user.id, 'settings.maintenance_mode', 'platform_settings', 1, `maintenance_mode -> ${maintenance_mode}`);
  res.json(data);
});

// GET /api/admin/stats/activity - listings + rental requests created over
// the last 5 days, bucketed into 4-hour slots, for the Site Activity
// widget's heatmap. Real counts from `created_at`, no simulated data.
router.get('/stats/activity', async (req, res) => {
  const DAYS = 5;
  const SLOTS_PER_DAY = 6;
  const HOURS_PER_SLOT = 24 / SLOTS_PER_DAY;

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  dayStart.setDate(dayStart.getDate() - (DAYS - 1));

  try {
    const [{ data: listingRows, error: listingsError }, { data: rentalRows, error: rentalsError }] =
      await Promise.all([
        supabase.from('listings').select('created_at').gte('created_at', dayStart.toISOString()),
        supabase.from('rentals').select('created_at').gte('created_at', dayStart.toISOString()),
      ]);
    if (listingsError) throw listingsError;
    if (rentalsError) throw rentalsError;

    const buckets = Array.from({ length: DAYS }, () => new Array(SLOTS_PER_DAY).fill(0));
    const addToBucket = (createdAt) => {
      const t = new Date(createdAt);
      const dayIndex = Math.floor((t - dayStart) / (24 * 60 * 60 * 1000));
      if (dayIndex < 0 || dayIndex >= DAYS) return;
      const slot = Math.min(SLOTS_PER_DAY - 1, Math.floor(t.getHours() / HOURS_PER_SLOT));
      buckets[dayIndex][slot] += 1;
    };
    listingRows.forEach((row) => addToBucket(row.created_at));
    rentalRows.forEach((row) => addToBucket(row.created_at));

    res.json({
      days: DAYS,
      slotsPerDay: SLOTS_PER_DAY,
      buckets,
      today_total: buckets[DAYS - 1].reduce((sum, n) => sum + n, 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/stats/escrow - total currently-held renter deposits (paid
// in, not yet refunded, on a rental that wasn't cancelled), for the Escrow
// Held widget. No day-over-day delta - there's no historical snapshot of
// this balance to compare against, so the widget omits that rather than
// fake it.
router.get('/stats/escrow', async (req, res) => {
  const { data, error } = await supabase
    .from('rental_payments')
    .select('deposit_amount, rental:rentals(status)')
    .is('deposit_refunded_at', null);

  if (error) return res.status(500).json({ error: error.message });

  const held_total = data
    .filter((row) => row.rental?.status !== 'cancelled')
    .reduce((sum, row) => sum + Number(row.deposit_amount), 0);

  res.json({ held_total });
});

// GET /api/admin/stats/requests-by-category - rental request counts grouped
// by the requested listing's category, for the Requests by Category widget.
router.get('/stats/requests-by-category', async (req, res) => {
  const { data, error } = await supabase
    .from('rentals')
    .select('listing:listings(category:categories(name))')
    .limit(2000);

  if (error) return res.status(500).json({ error: error.message });

  const counts = new Map();
  for (const row of data) {
    const name = row.listing?.category?.name || 'Uncategorized';
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  res.json([...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
});

// GET /api/admin/stats/listings-by-category - listing counts and share of
// total, grouped by category, for the Listings by Category widget.
router.get('/stats/listings-by-category', async (req, res) => {
  const { data, error } = await supabase.from('listings').select('category:categories(name)').limit(2000);

  if (error) return res.status(500).json({ error: error.message });

  const counts = new Map();
  for (const row of data) {
    const name = row.category?.name || 'Uncategorized';
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  const total = data.length;
  res.json(
    [...counts.entries()]
      .map(([name, count]) => ({ name, count, share: total ? count / total : 0 }))
      .sort((a, b) => b.count - a.count)
  );
});

export default router;
