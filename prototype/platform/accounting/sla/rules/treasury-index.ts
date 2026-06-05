// platform/accounting/sla/rules/treasury-index.ts
//
// Treasury money-market family IFRS rule registry (full-retirement Batch 1):
// the deposit (MMD), funding-line, interbank-loan (IBL) and repo lifecycles
// ported to rules-as-data. The interpreter consumes this array directly; the
// registry IS the engine (spec §10.2 — no second hard-coded dispatcher).
//
// Coverage (one rule per posting-producing registry entry + the two memo /
// stub rules):
//   MMD:      PR-MMD-001 / PR-MMD-ACCRUAL / PR-MMD-MAT / PR-MMD-CANCEL
//   Funding:  PR-FUNDING-001 / PR-FUNDING-END
//   IBL:      PR-IBL-001 / PR-IBL-ACCRUAL / PR-IBL-MAT / PR-IBL-RECALL
//   Repo:     PR-REPO-001 / PR-REPO-SETTLE-START / PR-REPO-ACCRUAL /
//             PR-REPO-END / PR-REPO-CANCEL
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 1, CEO-approved
//            2026-06-05).

import type { SlaRule } from "../generated/sla-types";
import { PR_FUNDING_001, PR_FUNDING_END } from "./pr-funding";
import { PR_IBL_001, PR_IBL_ACCRUAL, PR_IBL_MAT, PR_IBL_RECALL } from "./pr-ibl";
import { PR_MMD_001, PR_MMD_ACCRUAL, PR_MMD_CANCEL, PR_MMD_MAT } from "./pr-mmd";
import {
  PR_REPO_001,
  PR_REPO_ACCRUAL,
  PR_REPO_CANCEL,
  PR_REPO_END,
  PR_REPO_SETTLE_START,
} from "./pr-repo";

/** Every treasury money-market IFRS posting rule, in lifecycle order. */
export const TREASURY_IFRS_RULES: readonly SlaRule[] = [
  // MMD / deposit
  PR_MMD_001,
  PR_MMD_ACCRUAL,
  PR_MMD_MAT,
  PR_MMD_CANCEL,
  // Funding line
  PR_FUNDING_001,
  PR_FUNDING_END,
  // Interbank loan
  PR_IBL_001,
  PR_IBL_ACCRUAL,
  PR_IBL_MAT,
  PR_IBL_RECALL,
  // Repo
  PR_REPO_001,
  PR_REPO_SETTLE_START,
  PR_REPO_ACCRUAL,
  PR_REPO_END,
  PR_REPO_CANCEL,
];

export {
  PR_MMD_001,
  PR_MMD_ACCRUAL,
  PR_MMD_MAT,
  PR_MMD_CANCEL,
  PR_FUNDING_001,
  PR_FUNDING_END,
  PR_IBL_001,
  PR_IBL_ACCRUAL,
  PR_IBL_MAT,
  PR_IBL_RECALL,
  PR_REPO_001,
  PR_REPO_SETTLE_START,
  PR_REPO_ACCRUAL,
  PR_REPO_END,
  PR_REPO_CANCEL,
};
