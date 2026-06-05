// platform/accounting/sla/rules/index.ts
//
// FX IFRS rule registry — the full Phase-2 FX lifecycle ported to data
// templates. The interpreter (interpreter.ts) consumes this array directly;
// the registry IS the engine (spec §10.2 — no second hard-coded dispatcher to
// drift from).
//
// Coverage (one rule per posting-producing FX lifecycle event + the two memo
// rules):
//   PR-FX-001            FxTradeExecuted        — trade booking
//   PR-FX-002            FxPositionRevalued     — daily FVTPL revaluation
//   PR-FX-PRIN           PrincipalPayment       — per-leg cash derecognition
//   PR-FX-LIFECYCLE-CLOSE SettlementConfirmed   — realised-P&L residual / close
//   PR-FX-005            FxSettlementFailed      — Stage-3 ECL (Herstatt; enrichment)
//   PR-FX-CANCEL         FxTradeCancelled        — full reversal (enrichment, for_each)
//   PR-FX-INSTRUCT       FxSettlementInstructed  — intentional-no-impact memo
//   PR-FX-REGREPORT      TradeReportSubmitted    — intentional-no-impact memo
//
// PR-FX-003 (TradeMatured) is DEPRECATED and deliberately NOT ported — see
// pr-fx-memo.ts for the documented skip rationale.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05).

import type { SlaRule } from "../generated/sla-types";
import { PR_FX_001 } from "./pr-fx-001";
import { PR_FX_002 } from "./pr-fx-002";
import { PR_FX_005 } from "./pr-fx-005";
import { PR_FX_CANCEL } from "./pr-fx-cancel";
import { PR_FX_LIFECYCLE_CLOSE } from "./pr-fx-lifecycle-close";
import { PR_FX_INSTRUCT, PR_FX_REGREPORT } from "./pr-fx-memo";
import { PR_FX_PRIN } from "./pr-fx-prin";

/** Every FX IFRS posting rule, in lifecycle order. */
export const FX_IFRS_RULES: readonly SlaRule[] = [
  PR_FX_001,
  PR_FX_002,
  PR_FX_PRIN,
  PR_FX_LIFECYCLE_CLOSE,
  PR_FX_005,
  PR_FX_CANCEL,
  PR_FX_INSTRUCT,
  PR_FX_REGREPORT,
];

export {
  PR_FX_001,
  PR_FX_002,
  PR_FX_PRIN,
  PR_FX_LIFECYCLE_CLOSE,
  PR_FX_005,
  PR_FX_CANCEL,
  PR_FX_INSTRUCT,
  PR_FX_REGREPORT,
};
