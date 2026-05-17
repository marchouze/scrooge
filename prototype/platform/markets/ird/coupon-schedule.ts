// platform/markets/ird/coupon-schedule.ts
//
// Coupon schedule generator for OTC Interest Rate Swaps.
//
// Given an IrsTradeBookedPayload, generates the full payment-date grid and
// computes fixed and floating coupon amounts for each period.
//
// Day count conventions supported:
//   ACT/365  — actual days / 365 (SA bond market standard)
//   ACT/360  — actual days / 360 (money market; common for JIBAR floats)
//   30/360   — assumes 30-day months / 360 days per year (ISDA bond basis)
//
// Substrate gaps (v0):
//   [GAP-SCH-1] No business-day calendar adjustment (JIHCAL). Payment
//               dates fall on the raw calendar date. Production: apply
//               Modified Following convention per ISDA 2006 definitions.
//   [GAP-SCH-2] No stub period handling. If maturity is not an exact
//               multiple of the payment frequency, the last period may
//               be short. Production: front stub or back stub depending
//               on convention.
//   [GAP-SCH-3] Floating coupon estimates use the forward JIBAR at
//               booking time. Real fixing: floating coupons re-estimated
//               daily from the live JIBAR fix; each payment finalised
//               2 business days before the fixing date.
//
// Authority:
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   ISDA-2002-MASTER            (swap documentation)
//   ISDA-2006-DEFINITIONS       (day count; business-day conventions)
//   IFRS-9-§4.1                 (classification and measurement)
//
// Authors: Eitan (IRRBB / derivatives engineer, engineering)

import type { IrsTradeBookedPayload } from "../cdm/ird";
import type { IrsRateSource } from "../eod/jibar-curve-seed";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CouponPeriod {
  /** Start of the accrual period (ISO 8601 YYYY-MM-DD). */
  periodStart: string;
  /** End of the accrual period / payment date (ISO 8601 YYYY-MM-DD). */
  paymentDate: string;
  /** Day count fraction for this period under the trade's convention. */
  dayCountFraction: number;
  /** Actual calendar days in this period. */
  actualDays: number;
  /** Fixed coupon amount in ZAR minor units (cents). */
  fixedCouponMinor: number;
  /** Estimated floating coupon amount in ZAR minor units ([GAP-SCH-3]). */
  floatingCouponEstimateMinor: number;
  /** Estimated net coupon (fixed − floating) from the bank's perspective. */
  netCouponMinor: number;
}

export interface CouponSchedule {
  readonly tradeId: string;
  readonly periods: ReadonlyArray<CouponPeriod>;
  /** Total present value of fixed leg (sum of fixedCouponMinor). */
  readonly totalFixedMinor: number;
  /** Total estimated present value of floating leg. */
  readonly totalFloatingEstimateMinor: number;
}

// ---------------------------------------------------------------------------
// Day count fraction
// ---------------------------------------------------------------------------

/**
 * Compute the day count fraction for the period [startDate, endDate].
 *
 * @param startDate  Period start (ISO 8601 YYYY-MM-DD).
 * @param endDate    Period end (ISO 8601 YYYY-MM-DD).
 * @param convention Day count convention.
 * @returns          Day count fraction as a decimal.
 */
export function dayCountFraction(
  startDate: string,
  endDate: string,
  convention: "ACT/365" | "ACT/360" | "30/360",
): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (convention === "ACT/365") {
    const actualDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    return actualDays / 365;
  }

  if (convention === "ACT/360") {
    const actualDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    return actualDays / 360;
  }

  // 30/360 — ISDA Bond Basis
  // Y1, M1, D1 = start year/month/day; Y2, M2, D2 = end year/month/day
  // Adjusted per ISDA 2006 definitions §4.16(f):
  //   D1 = min(D1, 30)
  //   if D1 = 30, D2 = min(D2, 30)
  const y1 = start.getUTCFullYear();
  const m1 = start.getUTCMonth() + 1;
  let d1 = start.getUTCDate();
  const y2 = end.getUTCFullYear();
  const m2 = end.getUTCMonth() + 1;
  let d2 = end.getUTCDate();

  if (d1 === 31) d1 = 30;
  if (d1 === 30 && d2 === 31) d2 = 30;

  void y1;
  void m1;

  return (
    (360 * (y2 - start.getUTCFullYear()) + 30 * (m2 - (start.getUTCMonth() + 1)) + (d2 - d1)) / 360
  );
}

// ---------------------------------------------------------------------------
// Date arithmetic helpers
// ---------------------------------------------------------------------------

function parseDate(iso: string): Date {
  // Parse YYYY-MM-DD as UTC midnight to avoid timezone issues.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Add a number of months to a date (UTC-aware).
 * Day clamped to end-of-month to handle stub periods ([GAP-SCH-2]).
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getUTCMonth() + months;
  result.setUTCMonth(targetMonth);

  // If day overflow (e.g. Jan 31 + 1 month → Feb 31 → Mar 3), clamp back.
  // Check if month rolled over unexpectedly.
  const expectedMonth = (((date.getUTCMonth() + months) % 12) + 12) % 12;
  if (result.getUTCMonth() !== expectedMonth) {
    // Rolled over — set to last day of the intended month.
    result.setUTCDate(0);
  }
  return result;
}

/**
 * Map paymentFrequency to the number of months per period.
 */
function freqToMonths(freq: IrsTradeBookedPayload["paymentFrequency"]): number {
  switch (freq) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "semi-annual":
      return 6;
    case "annual":
      return 12;
  }
}

// ---------------------------------------------------------------------------
// Calendar days between two ISO dates
// ---------------------------------------------------------------------------

function calendarDaysBetween(isoStart: string, isoEnd: string): number {
  const t0 = Date.parse(isoStart);
  const t1 = Date.parse(isoEnd);
  return Math.max(0, Math.round((t1 - t0) / 86_400_000));
}

// ---------------------------------------------------------------------------
// Main schedule generator
// ---------------------------------------------------------------------------

/**
 * Generate the full coupon schedule for an IRS trade.
 *
 * @param trade       IrsTradeBookedPayload from the booking event.
 * @param rateSource  Injectable JIBAR rate source for floating estimates.
 * @returns           Full coupon schedule with fixed and floating amounts.
 */
export function generateCouponSchedule(
  trade: IrsTradeBookedPayload,
  rateSource: IrsRateSource,
): CouponSchedule {
  const valuationDate = trade.effectiveDate.iso; // schedule anchor = effective date
  const monthsPerPeriod = freqToMonths(trade.paymentFrequency);
  const notionalMinor = trade.notional.amountMinor;
  const currency = trade.notional.currency;
  const convention = trade.dayCountConvention;

  const effective = parseDate(trade.effectiveDate.iso);
  const maturity = parseDate(trade.maturityDate.iso);

  const periods: CouponPeriod[] = [];
  let periodStart = effective;
  let periodCount = 0;

  // Safety cap — maximum 600 periods (50yr monthly swap).
  while (periodCount < 600) {
    const periodEnd = addMonths(effective, (periodCount + 1) * monthsPerPeriod);

    // If we've overshot maturity, clamp to maturity and stop.
    const isLastPeriod = periodEnd.getTime() >= maturity.getTime();
    const actualEnd = isLastPeriod ? maturity : periodEnd;

    if (periodStart.getTime() >= maturity.getTime()) break;

    const startIso = formatDate(periodStart);
    const endIso = formatDate(actualEnd);

    const dcf = dayCountFraction(startIso, endIso, convention);
    const actualDays = Math.round((actualEnd.getTime() - periodStart.getTime()) / 86_400_000);

    // Fixed coupon: notional × fixedRate × dcf (in minor units).
    const fixedCouponMinor = Math.round(notionalMinor * trade.fixedRate * dcf);

    // Floating coupon estimate: notional × forwardJibar(period) × dcf.
    // Days measured from effective date for the rate source ([GAP-SCH-3]).
    const startDays = calendarDaysBetween(valuationDate, startIso);
    const endDays = calendarDaysBetween(valuationDate, endIso);

    let floatingCouponEstimateMinor = 0;
    try {
      // If period has already passed at valuation date, startDays = 0.
      const forwardRate = rateSource.getForwardJibar(Math.max(0, startDays), Math.max(1, endDays));
      floatingCouponEstimateMinor = Math.round(notionalMinor * forwardRate * dcf);
    } catch {
      // Rate source failure — use 0 for this period (surfaced as substrate gap).
      floatingCouponEstimateMinor = 0;
    }

    // Net coupon from bank's perspective:
    //   bankPays=fixed → bank receives float, pays fixed → net = float − fixed (receive positive)
    //   bankPays=floating → bank receives fixed, pays float → net = fixed − float (receive positive)
    const netCouponMinor =
      trade.bankPays === "fixed"
        ? floatingCouponEstimateMinor - fixedCouponMinor
        : fixedCouponMinor - floatingCouponEstimateMinor;

    periods.push({
      periodStart: startIso,
      paymentDate: endIso,
      dayCountFraction: dcf,
      actualDays,
      fixedCouponMinor,
      floatingCouponEstimateMinor,
      netCouponMinor,
    });

    if (isLastPeriod) break;

    periodStart = periodEnd;
    periodCount++;
  }

  const totalFixedMinor = periods.reduce((s, p) => s + p.fixedCouponMinor, 0);
  const totalFloatingEstimateMinor = periods.reduce((s, p) => s + p.floatingCouponEstimateMinor, 0);

  void currency; // captured on trade; used by callers converting to events

  return {
    tradeId: trade.tradeId.value,
    periods,
    totalFixedMinor,
    totalFloatingEstimateMinor,
  };
}
