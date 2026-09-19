import Razorpay from 'razorpay';

// Optional, same graceful-degradation pattern as GROQ_API_KEY/DIGIO_API_KEY
// elsewhere in this app: if the keys aren't set, `razorpay` is null and
// every route that needs it returns a clear 503 instead of crashing on
// startup. Get test-mode keys instantly at https://dashboard.razorpay.com/
// (no business KYC needed until you switch to live mode).
export const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
    : null;

if (!razorpay) {
  console.warn(
    '[razorpay] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing - payment routes will return 503 until both are set.'
  );
}

// Platform economics - a placeholder policy, not something Razorpay
// dictates. Fee applies only to the rental amount, not the deposit (the
// deposit is a refundable pass-through, not revenue). The owner's net
// share splits into two payout stages per rental_payments' schema (stage 1
// around pickup, stage 2 after a clean return/dispute window) - actually
// *paying out* each stage still has to happen outside this app for now
// (RazorpayX Route/linked accounts, which needs each owner KYC'd as a
// sub-merchant - real infrastructure this project doesn't have yet), so
// these are recorded for staff bookkeeping rather than auto-executed.
export const PLATFORM_FEE_PERCENT = 10;
export const OWNER_STAGE1_PERCENT = 50;

export function computeRentalCharges({ pricePerDay, days, depositAmount }) {
  const rentalAmount = Math.round(pricePerDay * days * 100) / 100;
  const deposit = depositAmount || 0;
  const platformFee = Math.round(rentalAmount * (PLATFORM_FEE_PERCENT / 100) * 100) / 100;
  const ownerNet = Math.round((rentalAmount - platformFee) * 100) / 100;
  const ownerStage1 = Math.round(ownerNet * (OWNER_STAGE1_PERCENT / 100) * 100) / 100;
  const ownerStage2 = Math.round((ownerNet - ownerStage1) * 100) / 100;
  const totalAmount = Math.round((rentalAmount + deposit) * 100) / 100;

  return {
    rentalAmount,
    depositAmount: deposit,
    totalAmount,
    platformFeeAmount: platformFee,
    ownerStage1Amount: ownerStage1,
    ownerStage2Amount: ownerStage2,
  };
}
