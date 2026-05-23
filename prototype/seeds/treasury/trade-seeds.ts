// seeds/treasury/trade-seeds.ts
//
// Representative trade-event seed payloads for 4 treasury positions.
//
// Covers the three treasury product lifecycles introduced in WS1-PR1a:
//   1. 7-day repo (bank as lender):         REPO-001
//   2. 30-day money market deposit (taker): MMD-001
//   3. 1-month IB fixed-term placement:     IBL-001
//   4. Overnight call placement:            IBL-002
//
// All amounts in ZAR minor units (cents). Dates relative to 2026-05-23.
//
// These payloads are exported as typed arrays. They do NOT emit events
// directly — the boot script (or seed runner) calls the factory functions
// from `platform/event-store/event-types/repo-mmd-ibl.ts` with these payloads
// plus the required `asOf`, `entity`, `actor`, and `citations` wrappers.
//
// NPA prerequisites:
//   ProductApproved events for REPO-ZAR-001, MMD-ZAR-001, IBL-FT-ZAR-001,
//   and IBL-CALL-ZAR-001 must exist in the event store before trade events
//   referencing these instruments are emitted (CI permission gate enforces this).
//   The prerequisite seed is in `npa-approvals-seed.ts`.
//
// FinancialInstrumentDefined prerequisites:
//   fi:pam:REPO-7D-001, fi:pam:MMD-30D-001, fi:pam:IBL-1M-001,
//   fi:clm:IBL-CALL-001 must exist. Prerequisites in `instrument-definitions-seed.ts`.
//
// Collateral note:
//   REPO-001 uses R186 (ZAG000109728) as collateral ISIN. The R186 ISIN
//   on the bond market is ZAG000030108; ZAG000109728 is a placeholder for
//   the bond used as repo collateral here (consistent with the brief spec).
//
// Citations:
//   brief:ravi:ws1-pr1b-trade-seeds-booking-ui-repricing-gap-ex:2026-05-23
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   WS1-PR1a — Repo/MMD/IBL event types, lifecycle registry, GL posting rules
//   IFRS 9 §3.1.1, §4.1.1, §5.4.1, §5.7.1
//
// Author: Ravi (Treasury/ALM Engineer, engineering) per
//   brief:ravi:ws1-pr1b-trade-seeds-booking-ui-repricing-gap-ex:2026-05-23.

import type {
  DepositTakenPayload,
  InterbankLoanPlacedPayload,
  RepoTradeOpenedPayload,
} from "../../platform/event-store/event-types/repo-mmd-ibl";

// ---------------------------------------------------------------------------
// Common seed metadata
// ---------------------------------------------------------------------------

export const TRADE_SEEDS_AS_OF = "2026-05-23T08:00:00.000Z";

export const TRADE_SEEDS_CITATIONS: readonly string[] = [
  "brief:ravi:ws1-pr1b-trade-seeds-booking-ui-repricing-gap-ex:2026-05-23",
  "D-MARKETS-SCHEMA-FOUNDATION",
  "WS1-PR1a",
];

// ---------------------------------------------------------------------------
// 1. RepoTradeOpened — REPO-001
//
// Bank lends R10m vs R186 (ZAG000109728) at 8.45% for 7 days.
// From the bank's perspective: secured lending (RSA). Bank transfers
// the collateral to the counterparty, receives cash on the start leg,
// and repurchases the collateral on the end leg.
//
// Repurchase price calculation:
//   R10m × 8.45% × 7/365 = R10m × 0.001617808...
//   Interest = R 16,164 (rounding to nearest cent in major units)
//   Repurchase price = R10,016,164 → 1,001,616,400 cents
//   (brief spec states 1,000,161,644 cents — preserved exactly as specified)
// ---------------------------------------------------------------------------

export const REPO_001_PAYLOAD: RepoTradeOpenedPayload = {
  tradeId: "REPO-001",
  counterpartyLei: "ABSA00000000000000001",
  startLegSettlementDate: "2026-05-23",
  endLegSettlementDate: "2026-05-30",
  startLegCashZar: 1_000_000_000, // R10m in cents (100 cents per Rand, ×10,000,000)
  repurchasePriceZar: 1_000_161_644, // 8.45% × 7/365 × R10m (as specified)
  repoRateDecimal: 0.0845,
  collateralIsin: "ZAG000109728", // R186 collateral
  collateralFaceValue: 1_020_000_000, // R10.2m face value (2% over-collateralisation)
  collateralHaircutPct: 0.02, // 2% haircut
  bookId: "TREASURY",
  traderRef: "TREAS-001",
  instrumentRef: "fi:pam:REPO-7D-001",
};

// ---------------------------------------------------------------------------
// 2. DepositTaken — MMD-001
//
// Bank takes R5m wholesale non-operational deposit from Standard Bank
// at 8.25% for 30 days. From the bank's perspective: liability (RSL).
// ---------------------------------------------------------------------------

export const MMD_001_PAYLOAD: DepositTakenPayload = {
  depositId: "MMD-001",
  counterpartyLei: "SBK000000000000000001",
  principalZar: 500_000_000, // R5m in cents
  interestRateDecimal: 0.0825,
  maturityDate: "2026-06-22",
  depositCategory: "wholesale-non-operational",
  bookId: "TREASURY",
  instrumentRef: "fi:pam:MMD-30D-001",
};

// ---------------------------------------------------------------------------
// 3. InterbankLoanPlaced — IBL-001 (fixed-term)
//
// Bank places R20m with Investec at 8.30% for 1 month (fixed term).
// From the bank's perspective: asset / secured lending (RSA).
// ---------------------------------------------------------------------------

export const IBL_001_PAYLOAD: InterbankLoanPlacedPayload = {
  placementId: "IBL-001",
  counterpartyLei: "INV000000000000000001",
  principalZar: 2_000_000_000, // R20m in cents
  rateDecimal: 0.083,
  startDate: "2026-05-23",
  maturityDate: "2026-06-23",
  placementType: "fixed-term",
  bookId: "TREASURY",
  instrumentRef: "fi:pam:IBL-1M-001",
};

// ---------------------------------------------------------------------------
// 4. InterbankLoanPlaced — IBL-002 (call)
//
// Bank places R8m overnight call with RMB at ZARONIA-linked rate of 8.20%.
// No fixed maturity — callable on demand (CLM product). From the bank's
// perspective: short-dated liquid asset (RSA, ON bucket).
// ---------------------------------------------------------------------------

export const IBL_002_PAYLOAD: InterbankLoanPlacedPayload = {
  placementId: "IBL-002",
  counterpartyLei: "RMB000000000000000001",
  principalZar: 800_000_000, // R8m in cents
  rateDecimal: 0.082,
  startDate: "2026-05-23",
  maturityDate: null, // call — no fixed maturity
  placementType: "call",
  bookId: "TREASURY",
  instrumentRef: "fi:clm:IBL-CALL-001",
};

// ---------------------------------------------------------------------------
// Exported arrays — for use by the boot script / seed runner
// ---------------------------------------------------------------------------

/** All RepoTradeOpened payloads for the treasury trade seed. */
export const TREASURY_REPO_TRADE_PAYLOADS: RepoTradeOpenedPayload[] = [REPO_001_PAYLOAD];

/** All DepositTaken payloads for the treasury trade seed. */
export const TREASURY_DEPOSIT_TAKEN_PAYLOADS: DepositTakenPayload[] = [MMD_001_PAYLOAD];

/** All InterbankLoanPlaced payloads for the treasury trade seed. */
export const TREASURY_IBL_PLACED_PAYLOADS: InterbankLoanPlacedPayload[] = [
  IBL_001_PAYLOAD,
  IBL_002_PAYLOAD,
];
