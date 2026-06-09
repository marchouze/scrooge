// platform/types/basel.ts
//
// Shared Basel / BCBS prudential-reporting type primitives used across
// market-risk, IRRBB, and capital-adequacy event schemas.
//
// Authority: D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (CEO-approved 2026-06-09);
//            BCBS d457 (Basel III finalised standards) — standardised maturity
//            ladder for interest-rate risk; BA 320 / BA 330 (SARB BA returns).

/**
 * BCBS standardised maturity-ladder time bands for interest-rate risk in the
 * banking book (IRRBB) and trading book (FRTB). These 13 buckets map directly
 * onto the SARB BA 320 market-risk duration-bucket grid and the BA 330 IRRBB
 * repricing-gap table.
 *
 * Used as the key type for `dv01ByTenorBucket` on `IrdSwapPositionRevalued`.
 *
 * Authority: BCBS d368 §21 (IRRBB standardised approach tenor bands);
 *            BCBS d457 Table 7 (FRTB standardised approach maturity buckets);
 *            Regulation 28(5)(b) of the Regulations Relating to Banks.
 */
export type BaselMaturityBand =
  | "0-1m"
  | "1-3m"
  | "3-6m"
  | "6-12m"
  | "1-2y"
  | "2-3y"
  | "3-4y"
  | "4-5y"
  | "5-7y"
  | "7-10y"
  | "10-15y"
  | "15-20y"
  | ">20y";

/**
 * The 13 BCBS standardised maturity bands in ascending (shortest → longest)
 * order. Stable enumeration for building / iterating `dv01ByTenorBucket` grids.
 */
export const BASEL_MATURITY_BANDS: readonly BaselMaturityBand[] = [
  "0-1m",
  "1-3m",
  "3-6m",
  "6-12m",
  "1-2y",
  "2-3y",
  "3-4y",
  "4-5y",
  "5-7y",
  "7-10y",
  "10-15y",
  "15-20y",
  ">20y",
];

/**
 * Map a number of calendar days remaining (≥ 0) to the BCBS standardised
 * maturity band that contains it. Upper bounds use 365 days/year and 30.4375
 * days/month (365 / 12) so the year boundaries land on exact day counts.
 *
 * Band semantics: a band `(lo, hi]` contains days `lo < d ≤ hi`; the first
 * band `0-1m` contains `0 ≤ d ≤ ~30`. Anything beyond 20y maps to `>20y`.
 *
 * Authority: BCBS d368 §21 (IRRBB standardised tenor bands);
 *            Regulation 28(5)(b) of the Regulations Relating to Banks.
 */
export function daysToBaselMaturityBand(days: number): BaselMaturityBand {
  const d = Math.max(0, days);
  const M = 365 / 12; // average days per month
  const Y = 365; // days per year
  if (d <= 1 * M) return "0-1m";
  if (d <= 3 * M) return "1-3m";
  if (d <= 6 * M) return "3-6m";
  if (d <= 12 * M) return "6-12m";
  if (d <= 2 * Y) return "1-2y";
  if (d <= 3 * Y) return "2-3y";
  if (d <= 4 * Y) return "3-4y";
  if (d <= 5 * Y) return "4-5y";
  if (d <= 7 * Y) return "5-7y";
  if (d <= 10 * Y) return "7-10y";
  if (d <= 15 * Y) return "10-15y";
  if (d <= 20 * Y) return "15-20y";
  return ">20y";
}
