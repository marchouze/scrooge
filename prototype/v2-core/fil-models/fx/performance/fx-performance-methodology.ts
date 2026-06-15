// v2-core/fil-models/fx/performance/fx-performance-methodology.ts
//
// Pure arithmetic for FX performance metrics: unrealised P&L, carry, theta,
// realised P&L. No facet coupling, no lifecycle input.
//
// computeTheta is a LINEAR APPROXIMATION (≈ −carry) valid for forwards and swaps.
// Phase 2 options will replace this with exact Garman-Kohlhagen theta.
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER; brief:atlas:fil-fx-language-phase-1-linear-otc-models:2026-06-15
// Author: Atlas (Core banking platform architect, engineering).

import type { Money } from "../../../fil-core/primitives.ts";
import { scaleMinorByRate } from "../../fx-valuation/methodology.ts";

function minorMoney(minorUnits: bigint, currency: string): Money {
  return { currency, minorUnits };
}

/**
 * The book cost in reporting-currency minor units.
 * = signedNotional × bookedRate (same formula as valueFxPosition at booking time).
 */
export function bookCostMinor(signedNotionalMinor: bigint, bookedRate: number): bigint {
  return scaleMinorByRate(signedNotionalMinor, bookedRate);
}

/**
 * Unrealised P&L = MTM value − book cost (in reporting-currency minor units).
 */
export function computeUnrealisedPnl(
  mtmValueMinor: bigint,
  bookCostMinorVal: bigint,
  currency: string,
): Money {
  return minorMoney(mtmValueMinor - bookCostMinorVal, currency);
}

/**
 * Daily carry = (allInForwardRate − spotRate) × notional / remainingDays.
 * For FX swaps: sum carry(nearLeg) + carry(farLeg).
 * For IRD: replace (forward − spot) with (fixedRate − floatRate) × notional / dayCount.
 */
export function computeDailyCarry(
  signedNotionalMinor: bigint,
  spotRate: number,
  forwardRate: number,
  remainingDays: number,
  currency: string,
): Money {
  if (remainingDays <= 0) return minorMoney(0n, currency);
  const totalPremiumMinor = scaleMinorByRate(signedNotionalMinor, forwardRate - spotRate);
  const dailyMinor = totalPremiumMinor / BigInt(Math.max(1, Math.round(remainingDays)));
  return minorMoney(dailyMinor, currency);
}

/**
 * Linear theta approximation: theta ≈ −carry per day.
 * Accurate for linear instruments (forwards, swaps).
 * Phase 2 options override with exact Garman-Kohlhagen theta.
 */
export function computeTheta(
  signedNotionalMinor: bigint,
  spotRate: number,
  forwardRate: number,
  remainingDays: number,
  currency: string,
): Money {
  const carry = computeDailyCarry(
    signedNotionalMinor,
    spotRate,
    forwardRate,
    remainingDays,
    currency,
  );
  return minorMoney(-carry.minorUnits, currency);
}

/**
 * Realised P&L on settlement: (settlementRate − bookedRate) × notional.
 */
export function computeRealisedPnl(
  signedNotionalMinor: bigint,
  settlementRate: number,
  bookedRate: number,
  currency: string,
): Money {
  const pnlMinor = scaleMinorByRate(signedNotionalMinor, settlementRate - bookedRate);
  return minorMoney(pnlMinor, currency);
}
