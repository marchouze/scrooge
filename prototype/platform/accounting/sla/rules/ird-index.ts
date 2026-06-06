// platform/accounting/sla/rules/ird-index.ts
//
// IRD-swap family IFRS rule registry (full-retirement Batch 3): the OTC
// interest-rate / IRD swap lifecycle ported to rules-as-data. The interpreter
// consumes this array directly; the registry IS the engine (spec §10.2 — no
// second hard-coded dispatcher).
//
// Coverage (one rule per posting-producing registry entry + the two memos):
//   IRD: PR-IRS-001 / PR-IRS-002 / PR-IRS-003 / PR-IRS-TERM
//   memos: PR-IRS-SCHED / PR-IRS-INSTRUCT
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 3, CEO-approved
//            2026-06-05).

import type { SlaRule } from "../generated/sla-types";
import {
  PR_IRS_001,
  PR_IRS_002,
  PR_IRS_003,
  PR_IRS_INSTRUCT,
  PR_IRS_SCHED,
  PR_IRS_TERM,
} from "./pr-ird";

/** Every IRD-swap IFRS posting rule, in lifecycle order. */
export const IRD_IFRS_RULES: readonly SlaRule[] = [
  PR_IRS_001,
  PR_IRS_002,
  PR_IRS_003,
  PR_IRS_TERM,
  PR_IRS_SCHED,
  PR_IRS_INSTRUCT,
];

export { PR_IRS_001, PR_IRS_002, PR_IRS_003, PR_IRS_TERM, PR_IRS_SCHED, PR_IRS_INSTRUCT };
