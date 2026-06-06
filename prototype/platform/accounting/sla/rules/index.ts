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
import { PR_FX_001_BA } from "./pr-fx-001-ba";
import { PR_FX_001_BA_V1_CLOSED, PR_FX_001_BA_V2 } from "./pr-fx-001-ba-v2";
import { PR_FX_002 } from "./pr-fx-002";
import { PR_FX_005 } from "./pr-fx-005";
import {
  PR_FX_002_BA,
  PR_FX_005_BA,
  PR_FX_CANCEL_BA,
  PR_FX_CLOSE_BA,
  PR_FX_INSTRUCT_BA,
  PR_FX_PRIN_BA,
  PR_FX_REGREPORT_BA,
} from "./pr-fx-ba-lifecycle";
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

/**
 * Every FX SARB-BA-RETURN posting rule (the first SECONDARY representation —
 * D-SLA-FIRST-REPRESENTATION-SARB-BA), in lifecycle order. Booking opens the
 * NOP memo (PR-FX-001-BA); cancellation unwinds it (PR-FX-CANCEL-BA); every
 * other FX-lifecycle event is NOP-neutral (intentional-no-impact).
 *
 * VERSIONED (Phase 4b, spec §6): PR-FX-001-BA carries TWO versions — v1
 * (receive-leg NOP, effective [2026-01-01, 2026-07-01)) superseded by v2
 * (pay-leg NOP, effective [2026-07-01, ∞)) on a regulator's BA-350
 * reclassification date. The two windows abut exactly (no gap/overlap); the
 * interpreter's effective-date selection picks the version in force at the
 * event's `as_of`. `PR_FX_001_BA_V1_CLOSED` (not the open-ended v1) is the
 * registry entry so the lineage is window-complete.
 *
 * ACTIVATED IN PRODUCTION (SARB activation Round 3 — the flip): the production
 * GL posting engine now evaluates `["IFRS","SARB-BA-RETURN"]` (the activated
 * `PRODUCTION_REPRESENTATIONS`), so every FX-lifecycle event posts both bases in
 * parallel. The CFO+CoSec joint activation Decisions and a four-eyes approval for
 * every rule version are on the log (recon:sla-approval-workflow). See
 * pr-fx-001-ba.ts.
 */
export const FX_SARB_BA_RULES: readonly SlaRule[] = [
  PR_FX_001_BA_V1_CLOSED,
  PR_FX_001_BA_V2,
  PR_FX_002_BA,
  PR_FX_PRIN_BA,
  PR_FX_CLOSE_BA,
  PR_FX_005_BA,
  PR_FX_CANCEL_BA,
  PR_FX_INSTRUCT_BA,
  PR_FX_REGREPORT_BA,
];

/**
 * The full FX rule set across ALL representations — fed to the interpreter when
 * the dry-run / preview fans an FX event out over `["IFRS", "SARB-BA-RETURN"]`.
 * The interpreter partitions by `representation` internally (spec §2.2), so the
 * IFRS and SARB rules never cross-contaminate. The production path uses
 * `FX_IFRS_RULES` + `["IFRS"]` exclusively.
 */
export const FX_ALL_REPRESENTATION_RULES: readonly SlaRule[] = [
  ...FX_IFRS_RULES,
  ...FX_SARB_BA_RULES,
];

export {
  PR_FX_001,
  PR_FX_001_BA,
  PR_FX_001_BA_V1_CLOSED,
  PR_FX_001_BA_V2,
  PR_FX_002,
  PR_FX_002_BA,
  PR_FX_PRIN,
  PR_FX_PRIN_BA,
  PR_FX_LIFECYCLE_CLOSE,
  PR_FX_CLOSE_BA,
  PR_FX_005,
  PR_FX_005_BA,
  PR_FX_CANCEL,
  PR_FX_CANCEL_BA,
  PR_FX_INSTRUCT,
  PR_FX_INSTRUCT_BA,
  PR_FX_REGREPORT,
  PR_FX_REGREPORT_BA,
};
