// platform/accounting/index.ts
//
// Public barrel for the accounting module.
//
// Downstream consumers import from `@platform/accounting`.
// The primary surface for M2 Slice 2 is the period-close handler:
//   - openPeriod / snapshotTrialBalance / closePeriod
//
// The pure orchestration functions from period-close.ts are also re-exported
// directly for consumers (like tests and Slice 3 BA 325 harness) that need
// the internal helpers (computeTrialBalance, periodAuditChain, etc.).
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// Authors: Bea (Accounting & financial reporting engineer, engineering) +
//          Atlas (Platform Engineer, engineering)

// Handler surface — three top-level functions that Slice 3 imports.
export {
  closePeriod,
  openPeriod,
  snapshotTrialBalance,
} from "./period-close-handler";

export type {
  ClosePeriodArgs,
  ClosePeriodResult,
  OpenPeriodArgs,
  OpenPeriodResult,
  SnapshotTrialBalanceArgs,
  SnapshotTrialBalanceResult,
  TrialBalance,
} from "./period-close-handler";

// Core orchestration helpers — for consumers that need read-side access.
export {
  computeTrialBalance,
  periodAuditChain,
  periodCloseStreamKey,
} from "./period-close";

export type { ComputeTrialBalanceArgs } from "./period-close";

// FX accounting types (existing module).
export type { SubLedgerLeg } from "./fx-accounting-types";

// GL ↔ sub-ledger reconciliation engine — PROC-FIN-BSS-01 steps 3a–3d + 4.
export {
  assertZeroBalance,
  checkAgedItems,
  tracePostingToSourceEvent,
  triageException,
  verifyIfrsClassification,
} from "./gl-subledger-recon";

export type {
  AgedItem,
  AgedItemsResult,
  ChartOfAccountsEntry,
  ClassificationFinding,
  ClassificationResult,
  ReconException,
  TracedPosting,
  TraceResult,
  TriagedExceptionItem,
  TriageResult,
  UntracedPosting,
  ZeroBalanceFinding,
  ZeroBalanceResult,
} from "./gl-subledger-recon";

// MC2 — pre-close unposted-trades check (PROC-FIN-MC-01 §5 MC2).
export { checkUnpostedTrades } from "./unposted-trades-check";
export type {
  UnpostedTrade,
  UnpostedTradeEvent,
  UnpostedTradesResult,
} from "./unposted-trades-check";

// MC3 — pre-close suspense account report (PROC-FIN-MC-01 §5 MC3).
export { generateSuspenseReport } from "./suspense-report";
export type {
  SuspenseAccountFinding,
  SuspenseChartEntry,
  SuspenseReportResult,
} from "./suspense-report";

// MC14 — BA return generation trigger (PROC-FIN-MC-01 §5 MC14).
export { triggerBAReturnGeneration } from "./ba-return-trigger";

// G-4 — HQLA COA classification field + typed COA registry.
// Authority: D-HQLA-COA-CLASSIFICATION (CEO-approved 2026-05-22).
export {
  COA_ACCOUNTS,
  COA_BY_ID,
  CoaAccountEntrySchema,
  coaToHqlaClassifications,
} from "./coa-registry";

export type { CoaAccountEntry } from "./coa-registry";
