// platform/accounting/sla/rules/securities-index.ts
//
// Securities family IFRS rule registry (full-retirement Batch 2): the bond and
// equity lifecycles ported to rules-as-data. The interpreter consumes this array
// directly; the registry IS the engine (spec §10.2 — no second hard-coded
// dispatcher).
//
// Coverage (one rule per posting-producing registry entry + the equity memo):
//   BOND:   PR-BOND-001 / PR-BOND-EIR / PR-BOND-002 / PR-BOND-MAT / PR-BOND-SALE
//   EQUITY: PR-EQ-001 / PR-EQ-002 / PR-EQ-CA / PR-EQ-INSTRUCT / PR-EQ-004
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 2, CEO-approved
//            2026-06-05).

import type { SlaRule } from "../generated/sla-types";
import { PR_BOND_001, PR_BOND_002, PR_BOND_EIR, PR_BOND_MAT, PR_BOND_SALE } from "./pr-bond";
import { PR_EQ_001, PR_EQ_002, PR_EQ_004, PR_EQ_CA, PR_EQ_INSTRUCT } from "./pr-equity";

/** Every securities (bond + equity) IFRS posting rule, in lifecycle order. */
export const SECURITIES_IFRS_RULES: readonly SlaRule[] = [
  // Bond
  PR_BOND_001,
  PR_BOND_EIR,
  PR_BOND_002,
  PR_BOND_MAT,
  PR_BOND_SALE,
  // Equity
  PR_EQ_001,
  PR_EQ_002,
  PR_EQ_CA,
  PR_EQ_INSTRUCT,
  PR_EQ_004,
];

export {
  PR_BOND_001,
  PR_BOND_EIR,
  PR_BOND_002,
  PR_BOND_MAT,
  PR_BOND_SALE,
  PR_EQ_001,
  PR_EQ_002,
  PR_EQ_CA,
  PR_EQ_INSTRUCT,
  PR_EQ_004,
};
