// platform/alm/repricing-gap.ts
//
// Repricing gap schedule computation — BCBS 319 standard time buckets.
//
// The repricing gap is the cornerstone of IRRBB measurement under BCBS d365.
// For each bucket it measures:
//   RSA (rate-sensitive assets)  — bonds (fixed-rate) + swap fixed legs
//   RSL (rate-sensitive liabs)   — swap floating legs + repo obligations
//   Gap = RSA − RSL
//   Cumulative gap (running sum from shortest bucket)
//
// Build-phase posture:
//   No real positions exist until commencement-of-trading (CLAUDE.md
//   "build phase vs licence-day"). The engine reads `TradeBooked` /
//   `TradeSettled` events from the event store and classifies each
//   instrument into the relevant repricing bucket. With zero events the
//   output is a zero-gap schedule across all buckets. This is the correct
//   production posture: the gap schedule is query-derived, not stored state
//   (Principle 1 — events are the only source of truth).
//
// BCBS 319 time buckets used:
//   ON (overnight / ≤ 1 day), 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y+
//
// Authority: D-TREASURY-GAPS-WAVE1; BCBS d365 (IRRBB, 2016); Banks Act Reg 26/27.
// Author: Ravi (Treasury/ALM Engineer, engineering)

import type { EventStore } from "../event-store/store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Standard BCBS 319 repricing time buckets. */
export type RepricingBucket =
  | "ON"
  | "1M"
  | "3M"
  | "6M"
  | "1Y"
  | "2Y"
  | "3Y"
  | "5Y"
  | "7Y"
  | "10Y+";

export const REPRICING_BUCKETS: readonly RepricingBucket[] = [
  "ON",
  "1M",
  "3M",
  "6M",
  "1Y",
  "2Y",
  "3Y",
  "5Y",
  "7Y",
  "10Y+",
];

/** Upper bound (days) for each bucket. Anything ≥ 3650 days falls into 10Y+. */
const BUCKET_MAX_DAYS: Record<RepricingBucket, number> = {
  ON: 1,
  "1M": 30,
  "3M": 91,
  "6M": 182,
  "1Y": 365,
  "2Y": 730,
  "3Y": 1095,
  "5Y": 1825,
  "7Y": 2555,
  "10Y+": Number.POSITIVE_INFINITY,
};

/** Per-bucket gap row. All amounts in ZAR (base currency). */
export interface RepricingGapRow {
  bucket: RepricingBucket;
  /** Rate-sensitive assets (ZAR). */
  rsaZar: number;
  /** Rate-sensitive liabilities (ZAR). */
  rslZar: number;
  /** Gap = RSA − RSL (ZAR). */
  gapZar: number;
  /** Running cumulative gap from the ON bucket (ZAR). */
  cumulativeGapZar: number;
}

/** Full repricing gap schedule result. */
export interface RepricingGapSchedule {
  asOf: string;
  rows: RepricingGapRow[];
  /** "computed" when positions exist; "zero-positions" in build phase. */
  status: "computed" | "zero-positions";
  currency: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Classify a days-to-repricing value into a bucket. */
function classifyDays(days: number): RepricingBucket {
  for (const bucket of REPRICING_BUCKETS) {
    const max = BUCKET_MAX_DAYS[bucket];
    if (days <= max) return bucket;
  }
  return "10Y+";
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Compute the BCBS 319 repricing gap schedule from the event store.
 *
 * Reads `TradeBooked` and `TradeSettled` events. In build phase (no trades)
 * returns a zero-gap schedule with `status: "zero-positions"`.
 *
 * Classification logic:
 *   - Fixed-rate bonds (TradeBooked, product "BOND"):
 *       RSA += notional, bucket = days to maturity
 *   - IRS fixed legs (TradeBooked, product "IRS"):
 *       RSA += notional, bucket = next coupon date → repricing date
 *   - IRS floating legs:
 *       RSL += notional, bucket = next reset date (≤ 3M for ZARONIA/JIBAR)
 *   - Repos (TradeBooked, product "REPO"):
 *       RSL += notional, bucket = repo tenor
 *
 * This logic is intentionally simple for the build phase. Production will
 * enrich each leg with actual cashflow schedules per BCBS d365 §4.
 */
export function computeRepricingGap(
  eventStore: EventStore,
  asOf: string,
): RepricingGapSchedule {
  // Initialise zero accumulators for each bucket.
  const rsa: Record<RepricingBucket, number> = {} as Record<RepricingBucket, number>;
  const rsl: Record<RepricingBucket, number> = {} as Record<RepricingBucket, number>;
  for (const b of REPRICING_BUCKETS) {
    rsa[b] = 0;
    rsl[b] = 0;
  }

  // Read all TradeBooked / TradeSettled events from the store.
  const asOfDate = new Date(asOf);
  const bookedEvents = [...eventStore.replay({ type: "TradeBooked", asOf })];
  const settledEvents = [...eventStore.replay({ type: "TradeSettled", asOf })];
  const allEvents = [...bookedEvents, ...settledEvents];

  let hasPositions = false;

  for (const ev of allEvents) {
    const p = ev.payload as Record<string, unknown>;
    const product = typeof p["product"] === "string" ? p["product"].toUpperCase() : "";
    const notional =
      typeof p["notional"] === "number" ? p["notional"] : 0;
    const maturityStr = typeof p["maturityDate"] === "string" ? p["maturityDate"] : "";
    const resetDays =
      typeof p["resetDays"] === "number" ? p["resetDays"] : 90; // default 3M

    if (notional <= 0 || !maturityStr) continue;

    const maturityDate = new Date(maturityStr);
    const daysToMaturity = Math.max(
      0,
      Math.round((maturityDate.getTime() - asOfDate.getTime()) / 86_400_000),
    );

    hasPositions = true;

    if (product === "BOND") {
      // Fixed-rate bond → RSA
      const bucket = classifyDays(daysToMaturity);
      rsa[bucket] = (rsa[bucket] ?? 0) + notional;
    } else if (product === "IRS") {
      // IRS — fixed leg is RSA, floating leg is RSL.
      // Fixed leg reprices at maturity; floating reprices at next reset.
      const fixedBucket = classifyDays(daysToMaturity);
      rsa[fixedBucket] = (rsa[fixedBucket] ?? 0) + notional;

      const floatBucket = classifyDays(resetDays);
      rsl[floatBucket] = (rsl[floatBucket] ?? 0) + notional;
    } else if (product === "REPO") {
      // Repo → RSL (funding obligation)
      const bucket = classifyDays(daysToMaturity);
      rsl[bucket] = (rsl[bucket] ?? 0) + notional;
    }
    // Other products added as the instrument universe grows.
  }

  // Build the gap schedule rows.
  let cumulative = 0;
  const rows: RepricingGapRow[] = [];

  for (const bucket of REPRICING_BUCKETS) {
    const rsaVal = rsa[bucket] ?? 0;
    const rslVal = rsl[bucket] ?? 0;
    const gap = rsaVal - rslVal;
    cumulative += gap;
    rows.push({
      bucket,
      rsaZar: rsaVal,
      rslZar: rslVal,
      gapZar: gap,
      cumulativeGapZar: cumulative,
    });
  }

  return {
    asOf,
    rows,
    status: hasPositions ? "computed" : "zero-positions",
    currency: "ZAR",
  };
}
