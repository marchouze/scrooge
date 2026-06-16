// v2-core/fil-models/ir/bond/shared/bond-positions.ts
//
// Typed position interface for the Phase 3c FVTPL fixed-rate vanilla bond
// (asset class `ir`). UNLIKE the Phase 3b money-market instruments (amortised
// cost), a bond is FVTPL and genuinely DISCOUNTS: its value is the present value
// of the remaining contractual cash flows (Σ PV(coupons) + PV(principal)),
// discounted at a market yield. It is the one instrument in the batch that PVs
// future cash flows.
//
// DECIMAL-NATIVE (D-V2-CORE-MONEY-DECIMAL-NATIVE): face value + coupon amounts
// are MAJOR-unit canonical decimal strings, never minor-unit bigints. Time-to-
// cash-flow is always supplied by the caller (`couponTimes` / `maturityYears`) —
// there is NO Date.now() here (wall-clock purity, Engineering Charter cmd 7 /
// the wall-clock ratchet).
//
// FAIL-CLOSED REPORTING CURRENCY (WS-MULTI-BASE-CURRENCY, #1382): a bond values
// in its OWN currency; any cross-currency reporting translation is a view-time
// concern resolved via the #1382 functional-currency resolver, never a hardcoded
// `?? "ZAR"`. The `reporting` field is REQUIRED and fail-closed at construction
// (see `requireReporting`).
//
// Authority: D-V1-REMOVAL-PHASE-3C (CEO-approved 2026-06-16);
//   D-ENGINEERING-INTEGRITY-CHARTER; D-V2-CORE-MONEY-DECIMAL-NATIVE;
//   brief:atlas:v1-removal-phase-3c-bond-accounting-on-v2-fvtpl-:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

/**
 * Direction of a bond position from the BANK's perspective:
 *   long  — the bank holds the bond (asset; receives coupons + principal) →
 *           positive-signed value, the receivable.
 *   short — the bank has sold the bond short (liability; owes the cash flows) →
 *           negative-signed value, mirroring the FX signed-notional convention so
 *           a book sums to the net position.
 */
export type BondDirection = "long" | "short";

/**
 * A scheduled remaining coupon cash flow. `amount` is the coupon PAYMENT in the
 * bond's own currency (face × couponRate / couponsPerYear), a POSITIVE MAJOR-unit
 * decimal string; `timeYears` is the time from the as-of date to the cash flow in
 * years (caller-supplied — no wall-clock here).
 */
export interface BondCashFlow {
  /** Coupon payment amount, POSITIVE MAJOR-unit decimal string, own currency. */
  readonly amount: string;
  /** Time to this cash flow in years (caller-supplied; ACT/365 in practice). */
  readonly timeYears: number;
}

/**
 * A fixed-rate vanilla bond position. The model DISCOUNTS the remaining coupon
 * schedule + the principal redemption at a market yield to a present (fair)
 * value (FVTPL, IFRS 9 §5.7.1).
 */
export interface BondPosition {
  readonly kind: "bond-fixed-rate-vanilla";
  /** ISIN of the bond — the observable key for its market yield. */
  readonly isin: string;
  /** ISO-4217 alpha-3 — the bond's OWN (face/coupon) currency. */
  readonly currency: string;
  /** Face / nominal redeemed at maturity, POSITIVE MAJOR-unit decimal string. */
  readonly faceValue: string;
  /** Annual coupon rate as a decimal (e.g. 0.0850 = 8.50% p.a.). */
  readonly couponRate: number;
  /** Coupon frequency per year (e.g. 2 = semi-annual). Positive integer. */
  readonly couponsPerYear: number;
  /**
   * The remaining contractual coupon schedule (caller-supplied; each carries its
   * own time-to-cash-flow in years). Empty for a zero-coupon / matured-coupon
   * bond — the principal PV still values.
   */
  readonly remainingCoupons: readonly BondCashFlow[];
  /** Time from the as-of date to maturity (principal redemption) in years. */
  readonly maturityYears: number;
  /** long (bank holds) | short (bank sold short). */
  readonly direction: BondDirection;
  /**
   * Days of accrued coupon since the last coupon date (caller-supplied; ACT/365).
   * Drives the Performable `carry` (accrued coupon for the period). Nonnegative.
   */
  readonly accruedDays: number;
  /**
   * A CREDIT-SPREAD-ADJUSTED fallback curve key. When the ISIN-specific yield
   * observable (`bond:<isin>:yield`) is absent, the model falls back to THIS
   * curve key (a `<currency>:govt-curve` + spread observable). Fail-closed: if
   * NEITHER the ISIN key NOR this fallback key resolves, valuation throws — there
   * is NO silent default yield (Engineering Charter cmd 2 + cmd 4).
   */
  readonly fallbackYieldKey: string;
  /**
   * Reporting currency the position values into — for a bond this is the
   * instrument's OWN currency (cross-currency reporting translation is a view-time
   * concern). REQUIRED + fail-closed (no `?? "ZAR"`); resolved at construction via
   * the #1382 functional-currency resolver. ISO-4217.
   */
  readonly reporting: string;
}
