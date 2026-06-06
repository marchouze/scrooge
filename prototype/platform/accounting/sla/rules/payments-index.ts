// platform/accounting/sla/rules/payments-index.ts
//
// Payment / settlement family IFRS rule registry (full-retirement Batch 4 — the
// LAST family): the payment-in-flight / settlement lifecycle ported to
// rules-as-data. The interpreter consumes this array directly; the registry IS
// the engine (spec §10.2 — no second hard-coded dispatcher).
//
// Coverage (one rule per posting-producing legacy function):
//   PAY: PR-PAY-001 / PR-PAY-002 / PR-SET-001
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 4, CEO-approved
//            2026-06-05).

import type { SlaRule } from "../generated/sla-types";
import { PR_PAY_001, PR_PAY_002, PR_SET_001 } from "./pr-payments";

/** Every payment IFRS posting rule, in lifecycle order. */
export const PAYMENTS_IFRS_RULES: readonly SlaRule[] = [PR_PAY_001, PR_PAY_002, PR_SET_001];

export { PR_PAY_001, PR_PAY_002, PR_SET_001 };
