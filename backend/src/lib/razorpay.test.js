import { describe, it, expect } from 'vitest';
import { computeRentalCharges, PLATFORM_FEE_PERCENT, OWNER_STAGE1_PERCENT } from './razorpay.js';

describe('computeRentalCharges', () => {
  it('splits a simple rental into platform fee and owner stages', () => {
    const charges = computeRentalCharges({ pricePerDay: 1000, days: 2, depositAmount: 0 });

    expect(charges.rentalAmount).toBe(2000);
    expect(charges.platformFeeAmount).toBe(200); // 10% of 2000
    expect(charges.ownerStage1Amount + charges.ownerStage2Amount).toBeCloseTo(
      charges.rentalAmount - charges.platformFeeAmount,
      2
    );
    expect(charges.totalAmount).toBe(2000); // no deposit
  });

  it('adds the deposit to totalAmount but excludes it from the platform fee', () => {
    const charges = computeRentalCharges({ pricePerDay: 500, days: 3, depositAmount: 1500 });

    expect(charges.rentalAmount).toBe(1500);
    expect(charges.depositAmount).toBe(1500);
    expect(charges.totalAmount).toBe(3000); // rental + deposit
    // Fee is 10% of the rental amount only, never the deposit.
    expect(charges.platformFeeAmount).toBe(150);
  });

  it('treats a missing/undefined deposit as zero', () => {
    const charges = computeRentalCharges({ pricePerDay: 750, days: 1 });
    expect(charges.depositAmount).toBe(0);
    expect(charges.totalAmount).toBe(charges.rentalAmount);
  });

  it('splits the owner net between stage 1 and stage 2 per OWNER_STAGE1_PERCENT', () => {
    const charges = computeRentalCharges({ pricePerDay: 1000, days: 1, depositAmount: 0 });
    const ownerNet = charges.rentalAmount - charges.platformFeeAmount;

    expect(charges.ownerStage1Amount).toBeCloseTo(ownerNet * (OWNER_STAGE1_PERCENT / 100), 2);
    // Stage 2 gets whatever's left, so the two always sum back to the full net -
    // this is the property that actually matters (no money invented or lost
    // to rounding), not the individual amounts.
    expect(charges.ownerStage1Amount + charges.ownerStage2Amount).toBeCloseTo(ownerNet, 2);
  });

  it('rounds to 2 decimal places instead of accumulating floating-point drift', () => {
    // 33.33 * 3 days = 99.99, an amount picked to be awkward in floating point.
    const charges = computeRentalCharges({ pricePerDay: 33.33, days: 3, depositAmount: 0 });

    for (const value of Object.values(charges)) {
      expect(Number.isInteger(value * 100)).toBe(true);
    }
  });

  it('never lets the fee exceed the rental amount for the standard 10% rate', () => {
    const charges = computeRentalCharges({ pricePerDay: 100, days: 1, depositAmount: 0 });
    expect(PLATFORM_FEE_PERCENT).toBeLessThan(100);
    expect(charges.platformFeeAmount).toBeLessThan(charges.rentalAmount);
  });
});
