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
