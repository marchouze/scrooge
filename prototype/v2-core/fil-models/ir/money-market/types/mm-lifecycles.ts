// v2-core/fil-models/ir/money-market/types/mm-lifecycles.ts
//
// Lifecycle declarations for Phase 3b money-market instruments. Each maps to FIL
// kernel stages over the V2-parallel lifecycle event types:
//   booked → "active" | matured/settled → "matured" | early-close → "terminated"
//
// Interest-accrual events do NOT change the kernel stage (they fold the carrying
// amount; the instance stays "active"). Only a terminal repayment/maturity moves
// to "matured"; an early withdrawal / recall / early termination moves to
// "terminated".
//
// Authority: D-V1-REMOVAL-PHASE-3B; D-ENGINEERING-INTEGRITY-CHARTER;
//   brief:atlas:v1-removal-phase-3b-alm-liquidity-on-v2-money-ma:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

import type { FilEventRef, FilLifecycleDeclaration } from "../../../../fil-core/lifecycle.ts";

function ref(s: string): FilEventRef {
  return s as FilEventRef;
}

// Unsecured (IBL placement OR funding-line drawdown) — one lifecycle, the
// terminal event differs by direction (matured/repaid vs recalled-early).
export const MM_UNSECURED_LIFECYCLE: FilLifecycleDeclaration = {
  initial: "proposed",
  transitions: [
    { from: "proposed", to: "active", via: ref("InterbankLoanPlacedV2") },
    { from: "proposed", to: "active", via: ref("FundingLineDrawnV2") },
    { from: "active", to: "matured", via: ref("InterbankLoanMaturedV2") },
    { from: "active", to: "matured", via: ref("FundingLineRepaidV2") },
    { from: "active", to: "terminated", via: ref("InterbankLoanRecalledEarlyV2") },
  ],
};

// Fixed-term deposit (bank as taker) — liability.
export const MM_DEPOSIT_LIFECYCLE: FilLifecycleDeclaration = {
  initial: "proposed",
  transitions: [
    { from: "proposed", to: "active", via: ref("DepositTakenV2") },
    { from: "active", to: "matured", via: ref("DepositMaturedV2") },
    { from: "active", to: "terminated", via: ref("DepositWithdrawnEarlyV2") },
    // Rollover keeps the instance active under a new term (no stage change).
    { from: "active", to: "active", via: ref("DepositRolledOverV2") },
  ],
};

// Classic repo — secured borrowing/lending.
export const MM_REPO_LIFECYCLE: FilLifecycleDeclaration = {
  initial: "proposed",
  transitions: [
    { from: "proposed", to: "active", via: ref("RepoTradeOpenedV2") },
    { from: "active", to: "matured", via: ref("RepoTradeTerminatedV2") },
    { from: "active", to: "terminated", via: ref("RepoTradeTerminatedEarlyV2") },
  ],
};
