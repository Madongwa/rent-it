import { supabase } from './supabaseClient.js';
import { computeRentalCharges } from './razorpay.js';

// Shared by the direct post-checkout verification route (rentals.js) and
// the Razorpay webhook (webhooks.js) - same upsert either way, so a payment
// gets recorded exactly once no matter which path notices it first (or if
// both do, racing each other).
export async function recordRentalPayment({ rentalId, razorpayOrderId, razorpayPaymentId }) {
  const { data: rental, error: findError } = await supabase
    .from('rentals')
    .select('id, start_date, end_date, listing:listings(price_per_day, deposit_required, deposit_amount)')
    .eq('id', rentalId)
    .single();
  if (findError || !rental) throw new Error('Rental not found');

  const days = Math.round((new Date(rental.end_date) - new Date(rental.start_date)) / (24 * 60 * 60 * 1000)) + 1;
  const charges = computeRentalCharges({
    pricePerDay: rental.listing.price_per_day,
    days,
    depositAmount: rental.listing.deposit_required ? rental.listing.deposit_amount || 0 : 0,
  });

  const { data, error } = await supabase
    .from('rental_payments')
    .upsert(
      {
        rental_id: rental.id,
        total_amount: charges.totalAmount,
        platform_fee_amount: charges.platformFeeAmount,
        deposit_amount: charges.depositAmount,
        owner_stage1_amount: charges.ownerStage1Amount,
        owner_stage2_amount: charges.ownerStage2Amount,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
      },
      { onConflict: 'rental_id' }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
