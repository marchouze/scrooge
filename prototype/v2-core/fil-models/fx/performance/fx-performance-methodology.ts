// v2-core/fil-models/fx/performance/fx-performance-methodology.ts
//
// Pure arithmetic for FX performance metrics: unrealised P&L, carry, theta,
// realised P&L. No facet coupling, no lifecycle input.
//
// computeTheta is a LINEAR APPROXIMATION (≈ −carry) valid for forwards and swaps.
// Phase 2 options will replace this with exact Garman-Kohlhagen theta.
//
// DECIMAL-NATIVE (D-V2-CORE-MONEY-DECIMAL-NATIVE, 2026-06-15): all money is the
// decimal-native `Money` (amount = MAJOR-unit canonical decimal string). Every
// arithmetic step goes through the v2 decimal helper (`fil-core/decimal.ts`),
// never `amount * x` / `amount / x`. Notionals arrive as MAJOR-unit signed
// decimal strings. Value = notional × rate, rounded HALF-UP to the reporting
// currency's display dp (2dp for the anchor book). The carry day-division is a
// decimal divide (`divD(premium, days)`), not a money-divide.
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER; D-V2-CORE-MONEY-DECIMAL-NATIVE;
//   brief:atlas:fil-fx-language-phase-1-linear-otc-models:2026-06-15
// Author: Atlas (Chief Technology Officer / Core banking platform architect).

import {
  type DecimalValue,
  divD,
  mulD,
  negD,
  roundDecimal,
  subD,
  toDecimal,
} from "../../../fil-core/decimal.ts";
import { type Money, moneyFromDecimal } from "../../../fil-core/primitives.ts";

// The anchor FX book is carried at 2dp for byte-parity with the v1 FX book.
const DISPLAY_DP = 2;

/**
 * value = signedNotional (MAJOR) × rate (reporting/CCY), rounded HALF-UP to the
 * reporting currency's display dp. The shared valuation primitive every FX
 * performance metric scales money through (decimal-exact; no float multiply).
 */
function scaleByRate(signedNotional: string, rate: number, currency: string): Money {
  const valued = mulD(toDecimal(signedNotional), toDecimal(String(rate)));
  return moneyFromDecimal(currency, roundDecimal(valued, DISPLAY_DP, "HALF_UP"));
}

/** The reporting-currency display amount of an already-decimal value (HALF-UP, 2dp). */
function roundReporting(d: DecimalValue, currency: string): Money {
  return moneyFromDecimal(currency, roundDecimal(d, DISPLAY_DP, "HALF_UP"));
}

/**
 * The book cost in the reporting currency.
 * = signedNotional × bookedRate (same formula as valueFxPosition at booking time).
 */
export function bookCost(signedNotional: string, bookedRate: number, currency: string): Money {
  return scaleByRate(signedNotional, bookedRate, currency);
}

/**
 * Unrealised P&L = MTM value − book cost (in the reporting currency).
 */
export function computeUnrealisedPnl(mtmValue: Money, bookedCost: Money): Money {
  if (mtmValue.currency !== bookedCost.currency) {
    throw new Error(
      `FX unrealised P&L: currency mismatch — ${mtmValue.currency} vs ${bookedCost.currency} (fail-closed)`,
    );
  }
  return subMoneyDecimal(mtmValue, bookedCost);
}

/** Decimal subtraction returning a 2dp-display reporting Money (same currency). */
function subMoneyDecimal(a: Money, b: Money): Money {
  return roundReporting(subD(toDecimal(a.amount), toDecimal(b.amount)), a.currency);
}

/**
 * Daily carry = (allInForwardRate − spotRate) × notional ÷ remainingDays.
 * For FX swaps: sum carry(nearLeg) + carry(farLeg).
 * For IRD: replace (forward − spot) with (fixedRate − floatRate) × notional / dayCount.
 *
 * The premium-per-day is a DECIMAL divide (`divD(premium, days)`) — the day
 * division is at the rate level, not a money-divide; the single money scaling
 * runs through `scaleByRate` (decimal-exact).
 */
export function computeDailyCarry(
  signedNotional: string,
  spotRate: number,
  forwardRate: number,
  remainingDays: number,
  currency: string,
): Money {
  if (remainingDays <= 0) return moneyFromDecimal(currency, toDecimal("0"));
  // premium per day = (forward − spot) ÷ remaining days, all at the rate level.
  const premium = subD(toDecimal(String(forwardRate)), toDecimal(String(spotRate)));
  const days = Math.max(1, Math.round(remainingDays));
  const dailyPremiumRate = divD(premium, toDecimal(String(days)));
  // daily money = notional × dailyPremiumRate, rounded HALF-UP to display dp.
  const daily = mulD(toDecimal(signedNotional), dailyPremiumRate);
  return roundReporting(daily, currency);
}

/**
 * Linear theta approximation: theta ≈ −carry per day.
 * Accurate for linear instruments (forwards, swaps).
 * Phase 2 options override with exact Garman-Kohlhagen theta.
 */
export function computeTheta(
  signedNotional: string,
  spotRate: number,
  forwardRate: number,
  remainingDays: number,
  currency: string,
): Money {
  const carry = computeDailyCarry(signedNotional, spotRate, forwardRate, remainingDays, currency);
  return moneyFromDecimal(currency, negD(toDecimal(carry.amount)));
}

/**
 * Realised P&L on settlement: (settlementRate − bookedRate) × notional.
 */
export function computeRealisedPnl(
  signedNotional: string,
  settlementRate: number,
  bookedRate: number,
  currency: string,
): Money {
  const rateDelta = subD(toDecimal(String(settlementRate)), toDecimal(String(bookedRate)));
  const pnl = mulD(toDecimal(signedNotional), rateDelta);
  return roundReporting(pnl, currency);
}
