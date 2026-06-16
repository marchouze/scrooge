// v2-core/fil-models/ir/money-market/performance/mm-methodology.ts
//
// Pure arithmetic for money-market amortised-cost valuation + performance.
// No facet coupling, no lifecycle input, no wall-clock.
//
// AMORTISED COST (banking-book IFRS-9, IFRS 9 §4.1.2 / §5.4.1):
//   carrying amount = principal + accrued EIR
// The sign applied to the carrying amount follows the position `direction`:
//   asset     → +carrying  (the bank holds a receivable)
//   liability → −carrying  (the bank owes; a negative-signed Money mirrors the
//                           FX signed-notional convention so a book sums to the
//                           net position)
//
// Daily accrual carry = principal × rate ÷ 365 (ACT/365 simple, the build-phase
// money-market convention; the day-count refinement to ACT/360 for specific
// currencies is a later calibration event, not a methodology change here).
// theta ≈ −carry per day (linear), consistent with the FX performance plane.
//
// DECIMAL-NATIVE (D-V2-CORE-MONEY-DECIMAL-NATIVE): every step goes through the
// v2 decimal helper (`fil-core/decimal.ts`); never `amount * x` / `amount / x`.
//
// Authority: D-V1-REMOVAL-PHASE-3B; D-ENGINEERING-INTEGRITY-CHARTER;
//   D-V2-CORE-MONEY-DECIMAL-NATIVE;
//   brief:atlas:v1-removal-phase-3b-alm-liquidity-on-v2-money-ma:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

import {
  type DecimalValue,
  addD,
  divD,
  mulD,
  negD,
  roundDecimal,
  toDecimal,
} from "../../../../fil-core/decimal.ts";
import { type Money, moneyFromDecimal } from "../../../../fil-core/primitives.ts";
import type { MoneyMarketDirection } from "../shared/mm-positions.ts";

/** Money-market amortised-cost books are carried at 2dp display. */
const DISPLAY_DP = 2;

/** Day-count basis for the build-phase money-market accrual (ACT/365 simple). */
const DAY_COUNT_BASIS = 365;

/** Round a decimal value to the reporting currency display dp (HALF-UP, 2dp). */
function roundReporting(d: DecimalValue, currency: string): Money {
  return moneyFromDecimal(currency, roundDecimal(d, DISPLAY_DP, "HALF_UP"));
}

/**
 * Amortised-cost carrying amount = principal + accrued EIR, signed by direction.
 *   asset     → positive (receivable)
 *   liability → negative (payable)
 *
 * principal + accrued are POSITIVE MAJOR-unit decimal strings; the sign is
 * applied here, never stored on the inputs.
 */
export function amortisedCost(args: {
  readonly principal: string;
  readonly accrued: string;
  readonly direction: MoneyMarketDirection;
  readonly currency: string;
}): Money {
  const gross = addD(toDecimal(args.principal), toDecimal(args.accrued));
  const signed = args.direction === "liability" ? negD(gross) : gross;
  return roundReporting(signed, args.currency);
}

/**
 * Daily accrual carry = principal × rate ÷ 365, signed by direction.
 *   asset     → positive carry (interest income earned)
 *   liability → negative carry (interest expense incurred)
 *
 * The rate ÷ 365 division is a decimal divide at the rate level; the single
 * money scaling (principal × dailyRate) is decimal-exact.
 */
export function dailyCarry(args: {
  readonly principal: string;
  readonly rateDecimal: number;
  readonly direction: MoneyMarketDirection;
  readonly currency: string;
}): Money {
  const dailyRate = divD(toDecimal(String(args.rateDecimal)), toDecimal(String(DAY_COUNT_BASIS)));
  const dailyAmount = mulD(toDecimal(args.principal), dailyRate);
  const signed = args.direction === "liability" ? negD(dailyAmount) : dailyAmount;
  return roundReporting(signed, args.currency);
}

/**
 * Linear theta approximation for an amortised-cost money-market instrument:
 * theta ≈ −carry per day. The amortised-cost carrying amount pulls to par as
 * time passes (accrual unwinds into realised interest), so the per-day value
 * change is the negative of the daily carry — the same linear convention the FX
 * performance plane uses for forwards/swaps.
 */
export function theta(args: {
  readonly principal: string;
  readonly rateDecimal: number;
  readonly direction: MoneyMarketDirection;
  readonly currency: string;
}): Money {
  const carry = dailyCarry(args);
  return moneyFromDecimal(args.currency, negD(toDecimal(carry.amount)));
}

/**
 * Unrealised P&L for an amortised-cost banking-book instrument is STRUCTURALLY
 * ZERO: there is no mark-to-market remeasurement through P&L (the instrument is
 * carried at amortised cost, not fair value). The return is a zero-amount Money
 * in the reporting currency — the honest answer, not an omission. Fair-value
 * P&L is a Phase 3c (FVTPL bond) concern.
 */
export function unrealisedPnl(currency: string): Money {
  return moneyFromDecimal(currency, toDecimal("0"));
}
