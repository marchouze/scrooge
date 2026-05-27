// seeds/alm/balance-sheet-seed.ts
//
// Build-phase BalanceSheetProjected seed payload.
//
// Represents the bank's balance sheet at the start of build phase: injected
// Tier 1 capital only (already captured by computeCapitalMetrics via
// CapitalEvent). All supplemental BA 326 line items are zero — correct for
// a pre-revenue, pre-licence bank with no retail loans, no encumbered assets,
// no issued wholesale bonds, and no off-balance-sheet commitments.
//
// This seed satisfies the `BalanceSheetProjected` substrate gap so that the
// ALM projection no longer reports the gap message. The NSFR ASF/RSF values
// will populate with real data once Bea's period-close handler emits the event
// following licence-day and commencement of trading.
//
// Authority: BA 326; BCBS D396; D-TREASURY-GAPS-WAVE1.
// Author: Bea (Accounting and financial reporting engineer, engineering)

import type { BalanceSheetProjectedPayload } from "../../platform/event-store/event-types/balance-sheet";

export const BALANCE_SHEET_SEED_AS_OF = "2026-05-27T00:00:00.000Z";

export const BALANCE_SHEET_SEED_CITATIONS: readonly string[] = [
  "BA-326",
  "BCBS-D396",
  "D-TREASURY-GAPS-WAVE1",
];

export const BALANCE_SHEET_SEED_PAYLOAD: BalanceSheetProjectedPayload = {
  projectionId: "BS-SEED-2026-05-27",
  asOf: "2026-05-27",
  // Build phase: no Tier 2 capital, no issued bonds, no wholesale funding GT 1Y
  tier2CapitalZar: 0,
  unsecuredWholesaleFundingGt1yZar: 0,
  coveredBondsIssuedGt6mZar: 0,
  // Build phase: no retail loans, no encumbered assets, no OBS commitments
  unencumberedRetailLoansLt1yZar: 0,
  unencumberedRetailLoansGt1yZar: 0,
  encumberedAssetsZar: 0,
  offBalanceSheetCommitmentsZar: 0,
};
