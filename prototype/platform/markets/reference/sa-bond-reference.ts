// platform/markets/reference/sa-bond-reference.ts
//
// Single source of SA benchmark government-bond reference data — ISIN, code,
// coupon, maturity, and build-phase seed price/yield. This is the canonical
// instrument-reference table consumed by:
//   - dashboard/bond-gateway.ts        (UI description metadata)
//   - platform/simulation/bond-sim-*   (seed prices, accrued-interest, coupon/maturity)
//
// It dedupes the formerly-inline BOND_METADATA literal in bond-gateway.ts so the
// three benchmark bonds are described in exactly one place.
//
// Reference values track the JSE Debt Market fixture (seeds/bond-prices.json):
//   R186  — ZAG000030108  10.5%  due 2026-12-21  (short / benchmark)
//   R2030 — ZAG000057547   7.75% due 2030-01-31  (mid-curve)
//   R2040 — ZAG000074989   9.0%  due 2040-01-31  (long end)
//
// SA government bonds pay semi-annual coupons on an ACT/365 day-count
// (JSE-RULES-BONDS). Coupon dates fall on the maturity month/day and six months
// prior.
//
// Authority:
//   D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22) Slice 10
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   JSE-RULES-BONDS — JSE Debt Listings Requirements (ACT/365, semi-annual)
//
// Author: Devon (Chief Operating Officer, engineering)

// ---------------------------------------------------------------------------
// Reference table
// ---------------------------------------------------------------------------

export interface SaBondReference {
  /** Bond ISIN — the MarketDataStore instrument key and `fi:bond:<ISIN>` suffix. */
  readonly isin: string;
  /** Human-readable bond code, e.g. "R186". */
  readonly bondCode: string;
  /** Display description for the trade-booking / blotter UI. */
  readonly description: string;
  /** Annual coupon rate in decimal form, e.g. 0.105 for 10.5%. */
  readonly couponRate: number;
  /** Redemption date (YYYY-MM-DD). */
  readonly maturityDate: string;
  /** Build-phase fallback clean price (% of par) when the store has no tick. */
  readonly seedCleanPrice: number;
  /** Build-phase fallback yield to maturity (decimal). */
  readonly seedYield: number;
}

export const SA_BOND_REFERENCE: Readonly<Record<string, SaBondReference>> = {
  ZAG000030108: {
    isin: "ZAG000030108",
    bondCode: "R186",
    description: "R186 — SA Government Bond 10.5% 2026-12-21",
    couponRate: 0.105,
    maturityDate: "2026-12-21",
    seedCleanPrice: 101.5,
    seedYield: 0.0803,
  },
  ZAG000057547: {
    isin: "ZAG000057547",
    bondCode: "R2030",
    description: "R2030 — SA Government Bond 7.75% 2030-01-31",
    couponRate: 0.0775,
    maturityDate: "2030-01-31",
    seedCleanPrice: 94.9,
    seedYield: 0.0921,
  },
  ZAG000074989: {
    isin: "ZAG000074989",
    bondCode: "R2040",
    description: "R2040 — SA Government Bond 9.0% 2040-01-31",
    couponRate: 0.09,
    maturityDate: "2040-01-31",
    seedCleanPrice: 88.1,
    seedYield: 0.1049,
  },
} as const;

/** All benchmark bond ISINs, in stable declaration order. */
export const SA_BOND_ISINS: readonly string[] = Object.keys(SA_BOND_REFERENCE);

/** Lookup helper — undefined for an unknown ISIN. */
export function bondReference(isin: string): SaBondReference | undefined {
  return SA_BOND_REFERENCE[isin];
}

// ---------------------------------------------------------------------------
// Accrued interest (semi-annual, ACT/365)
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

function toUtcMidnightMs(isoDate: string): number {
  return Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
}

/**
 * Most-recent coupon date on or before `asOf`, derived by stepping back from the
 * redemption date in six-month increments. SA government bonds pay on the
 * maturity month/day and six months prior, so this reconstructs the coupon
 * schedule without storing it. All three benchmark bonds mature on a 21st or
 * 31st, so the six-month step never lands on a short month — exact for this set.
 */
export function lastCouponDate(maturityDate: string, asOf: string): string {
  const ref = new Date(`${asOf.slice(0, 10)}T00:00:00Z`);
  const d = new Date(`${maturityDate.slice(0, 10)}T00:00:00Z`);
  // Walk backwards until the coupon date is on or before the as-of date.
  while (d.getTime() > ref.getTime()) {
    d.setUTCMonth(d.getUTCMonth() - 6);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Accrued interest in ZAR minor units (cents) for `nominalMinor` face value of
 * `isin` as at `asOf`. ACT/365 simple: accrued = face × coupon × daysElapsed/365.
 * Returns 0 for an unknown ISIN.
 */
export function accruedInterestZarMinor(isin: string, nominalMinor: number, asOf: string): number {
  const ref = SA_BOND_REFERENCE[isin];
  if (!ref) return 0;
  const last = lastCouponDate(ref.maturityDate, asOf);
  const daysElapsed = Math.max(
    0,
    Math.floor((toUtcMidnightMs(asOf) - toUtcMidnightMs(last)) / MS_PER_DAY),
  );
  const accruedFraction = (ref.couponRate * daysElapsed) / 365;
  return Math.round(nominalMinor * accruedFraction);
}
