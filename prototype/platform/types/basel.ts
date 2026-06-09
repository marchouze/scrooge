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
