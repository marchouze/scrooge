// v2-core/fil-models/ir/bond/performance/bond-methodology.ts
//
// Pure arithmetic for the FVTPL fixed-rate vanilla bond: present-value
// (discounted) fair valuation, modified duration (first-order rate sensitivity),
// and accrued-coupon carry. No facet coupling, no lifecycle input, no wall-clock.
//
// FVTPL FAIR VALUE (IFRS 9 §5.7.1) — the one DISCOUNTING instrument in the V1-
// removal batch:
//   fairValue = Σ_i  CF_i / (1 + y) ** t_i     (coupons)
//             +       face  / (1 + y) ** T      (principal)
// where `y` is the market yield (annualised, decimal) and `t_i` / `T` are the
// times-to-cash-flow in years. The sign applied follows the position direction:
//   long  → +fairValue (the bank holds the receivable)
//   short → −fairValue (the bank owes; a negative-signed Money mirrors the FX
//                       signed-notional convention so a book sums to the net)
//
// MODIFIED DURATION (first-order rate sensitivity, the RiskMeasurable answer):
//   Macaulay D = ( Σ t_i · PV_i + T · PV_face ) / price
//   modifiedDuration = Macaulay D / (1 + y / couponsPerYear)
// Years; nonnegative for a plain vanilla bond. Drives the BA-320 / IRRBB
// duration-bucket grid (mirrors the V1 BondPositionRevalued.modifiedDuration).
//
// ACCRUED COUPON CARRY (Performable.carry) — the coupon earned over the period,
// ACT/365 day count:
//   carry = face × couponRate × accruedDays / 365    (signed by direction)
//
// DECIMAL-NATIVE (D-V2-CORE-MONEY-DECIMAL-NATIVE): every step goes through the
// v2 decimal helper (`fil-core/decimal.ts`, incl. `powD` for the discount
// factor); never `amount * x` / `amount / x` / `Math.pow`.
//
// Authority: D-V1-REMOVAL-PHASE-3C; D-ENGINEERING-INTEGRITY-CHARTER;
//   D-V2-CORE-MONEY-DECIMAL-NATIVE;
//   brief:atlas:v1-removal-phase-3c-bond-accounting-on-v2-fvtpl-:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

import {
  type DecimalValue,
  ZERO_D,
  addD,
  divD,
  mulD,
  negD,
  powD,
  roundDecimal,
  toDecimal,
} from "../../../../fil-core/decimal.ts";
import { type Money, moneyFromDecimal } from "../../../../fil-core/primitives.ts";
import type { BondCashFlow, BondDirection } from "../shared/bond-positions.ts";

/** Bond fair-value books are carried at 2dp display. */
const DISPLAY_DP = 2;

/** Day-count basis for the build-phase accrued-coupon convention (ACT/365). */
const DAY_COUNT_BASIS = 365;

/** Round a decimal value to the reporting-currency display dp (HALF-UP, 2dp). */
function roundReporting(d: DecimalValue, currency: string): Money {
  return moneyFromDecimal(currency, roundDecimal(d, DISPLAY_DP, "HALF_UP"));
}

/** The discount factor `1 / (1 + y) ** t`, decimal-exact. */
function discountFactor(yieldDecimal: number, timeYears: number): DecimalValue {
  const onePlusY = addD(toDecimal("1"), toDecimal(String(yieldDecimal)));
  const compounded = powD(onePlusY, toDecimal(String(timeYears)));
  return divD(toDecimal("1"), compounded);
}

/** The undiscounted PV-input legs: each coupon CF and the principal. */
function pvLegs(args: {
  readonly faceValue: string;
  readonly remainingCoupons: readonly BondCashFlow[];
  readonly maturityYears: number;
}): ReadonlyArray<{ readonly amount: DecimalValue; readonly timeYears: number }> {
  const legs = args.remainingCoupons.map((cf) => ({
    amount: toDecimal(cf.amount),
    timeYears: cf.timeYears,
  }));
  legs.push({ amount: toDecimal(args.faceValue), timeYears: args.maturityYears });
  return legs;
}

/**
 * FVTPL fair value = Σ PV(remaining coupons) + PV(principal), signed by
 * direction. `faceValue` + each coupon `amount` are POSITIVE MAJOR-unit decimal
 * strings; the sign is applied here, never stored on the inputs.
 */
export function presentValue(args: {
  readonly faceValue: string;
  readonly remainingCoupons: readonly BondCashFlow[];
  readonly maturityYears: number;
  readonly yieldDecimal: number;
  readonly direction: BondDirection;
  readonly currency: string;
}): Money {
  let gross = ZERO_D;
  for (const leg of pvLegs(args)) {
    gross = addD(gross, mulD(leg.amount, discountFactor(args.yieldDecimal, leg.timeYears)));
  }
  const signed = args.direction === "short" ? negD(gross) : gross;
  return roundReporting(signed, args.currency);
}

/**
 * Modified duration (years), the first-order rate sensitivity. ALWAYS
 * nonnegative for a plain vanilla bond and INDEPENDENT of long/short direction
 * (it is a property of the cash-flow schedule, not the book side). Returns 0 when
 * the price is zero (degenerate — avoids a divide-by-zero; surfaces as a flat
 * sensitivity rather than throwing inside a risk read).
 */
export function modifiedDuration(args: {
  readonly faceValue: string;
  readonly remainingCoupons: readonly BondCashFlow[];
  readonly maturityYears: number;
  readonly yieldDecimal: number;
  readonly couponsPerYear: number;
}): number {
  const legs = pvLegs(args);
  let price = ZERO_D;
  let weightedTime = ZERO_D;
  for (const leg of legs) {
    const pv = mulD(leg.amount, discountFactor(args.yieldDecimal, leg.timeYears));
    price = addD(price, pv);
    weightedTime = addD(weightedTime, mulD(toDecimal(String(leg.timeYears)), pv));
  }
  if (price.isZero()) return 0;
  const macaulay = divD(weightedTime, price);
  const periodicYield = divD(
    toDecimal(String(args.yieldDecimal)),
    toDecimal(String(args.couponsPerYear)),
  );
  const modified = divD(macaulay, addD(toDecimal("1"), periodicYield));
  // Return as a JS number (a risk metric, not money) at full carried precision.
  return Number(modified.toFixed());
}

/**
 * Accrued-coupon carry over the period = face × couponRate × accruedDays / 365,
 * signed by direction (long → +income earned; short → −expense owed).
 */
export function accruedCouponCarry(args: {
  readonly faceValue: string;
  readonly couponRate: number;
  readonly accruedDays: number;
  readonly direction: BondDirection;
  readonly currency: string;
}): Money {
  const annualCoupon = mulD(toDecimal(args.faceValue), toDecimal(String(args.couponRate)));
  const dayFraction = divD(toDecimal(String(args.accruedDays)), toDecimal(String(DAY_COUNT_BASIS)));
  const accrued = mulD(annualCoupon, dayFraction);
  const signed = args.direction === "short" ? negD(accrued) : accrued;
  return roundReporting(signed, args.currency);
}

/**
 * Linear theta approximation for an FVTPL bond: theta ≈ −accruedCouponCarry per
 * day (the daily coupon carry is the value the position rolls down as time
 * passes, the same linear convention the FX/MM performance planes use). Per-day,
 * so it scales the annual coupon by 1/365 (accruedDays = 1).
 */
export function theta(args: {
  readonly faceValue: string;
  readonly couponRate: number;
  readonly direction: BondDirection;
  readonly currency: string;
}): Money {
  const perDay = accruedCouponCarry({
    faceValue: args.faceValue,
    couponRate: args.couponRate,
    accruedDays: 1,
    direction: args.direction,
    currency: args.currency,
  });
  return moneyFromDecimal(args.currency, negD(toDecimal(perDay.amount)));
}

/**
 * Unrealised P&L for an FVTPL instrument = fair value − booked cost (both in the
 * reporting currency, same-currency subtraction). When `bookedCost` is a zero-
 * amount Money the caller signals "no book cost supplied" and the unrealised P&L
 * is simply the fair value (the position's mark, against a zero cost basis). This
 * mirrors the FX performance plane's zero-sentinel convention.
 */
export function unrealisedPnl(fairValue: Money, bookedCost: Money): Money {
  const cost = bookedCost.amount;
  return moneyFromDecimal(
    fairValue.currency,
    addD(toDecimal(fairValue.amount), negD(toDecimal(cost))),
  );
}
