// scripts/decisions/record-d-treasurer-wave1-substrate.ts
//
// Records D-TREASURER-WAVE1-SUBSTRATE — Marc's in-session approval
// (2026-06-11, "continue with next") of the Wave-1 dispatch set surfaced by
// the Treasurer role-definition review (D-TREASURER-ROLE-DEFINITION-REVIEW,
// PR #1199, docs/2026-06-10_eitan_treasurer-role-definition-and-substrate-plan.md
// Part D).
//
// SCOPE (four items):
//   1. CFP trigger substrate + EWI monitor (Ravi, Treasury/ALM engineer).
//      The 7 typed trigger events named in
//      Policies/liquidity-risk-management-policy-v1.md §5.2
//      (IntradayStressDetected, LcrRatioBreach, NsfrRatioBreach,
//      FundingConcentrationAlertTriggered, RecoveryEarlyWarningTriggered,
//      CriticalSettlementObligationAtRisk, ExternalCreditEventDetected) are
//      absent from the event-type registry; no CFP tier can fire. Build the
//      events + an early-warning-indicator monitor + recon:cfp-trigger-coverage.
//   2. Intraday BCBS 248 seven monitoring metrics computed as register-bound
//      measures (Ravi) — today platform/alm/intraday-stress.ts projects
//      window positions but the seven BCBS 248 metrics are not computed and
//      the intraday floor is a hardcoded ZAR 50m constant.
//   3. appetite:liquidity:intraday RAS line (Helena, Chief Risk Officer —
//      calibration authority; sequenced AFTER item 2 merges so the line binds
//      to a real measurement). Verified absent from
//      platform/risk/ras-appetite-register.ts (16 lines, none intraday).
//   4. Procedure tail: author the three procedures cited by in-force policies
//      but file-absent (ftp-curve-calibration, alm-limit-monitoring,
//      daily-alm-run) + reconcile 6 stale procedure↔policy frontmatter
//      anchors (Ravi). Plus: Owen (Company Secretary, governance) adds a
//      Treasurer category row to the CLAUDE.md decision-authority routing
//      table (currently no Treasurer row; treasury decisions ride CFO/CRO
//      rows indirectly).
//
// Session-delegation: Marc (CEO) approved in-session 2026-06-11; Scrooge is
// the recording instrument (recordedVia: scrooge:session-delegation).
// Category: engineering build decisions → CEO (build phase) per the
// decision-authority routing table.
//
// Idempotent: fixed asOf so re-runs dedup on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument, on
// behalf of Marc (CEO).

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-11T06:30:00.000Z";
const ASOF = "2026-06-11T06:31:00.000Z";

const TITLE =
  "Treasurer Wave-1 substrate — CFP trigger events + EWI monitor, BCBS 248 intraday metrics, intraday RAS appetite line, procedure tail, routing-table Treasurer row";

const CITATIONS = [
  "D-TREASURER-ROLE-DEFINITION-REVIEW",
  "docs/2026-06-10_eitan_treasurer-role-definition-and-substrate-plan.md",
  "Policies/liquidity-risk-management-policy-v1.md",
  "Procedures/by-policy/intraday-liquidity-funding.md",
  "prototype/platform/alm/intraday-stress.ts",
  "prototype/platform/risk/ras-appetite-register.ts",
];

const RECOMMENDATION =
  "Dispatch the Wave-1 build-phase set from the Treasurer role-definition " +
  "review Part D: (1) Ravi (Treasury/ALM engineer) builds the 7 typed CFP " +
  "trigger events named in liquidity-risk-management-policy §5.2 plus an " +
  "early-warning-indicator monitor and a recon:cfp-trigger-coverage gate, so " +
  "the Contingency Funding Plan becomes an executable control instead of " +
  "policy prose; (2) Ravi computes the BCBS 248 seven intraday monitoring " +
  "metrics as register-bound measures on top of the live " +
  "platform/alm/intraday-stress.ts window projections; (3) sequenced after " +
  "(2) merges, Helena (Chief Risk Officer) adds and calibrates the " +
  "appetite:liquidity:intraday RAS line in " +
  "platform/risk/ras-appetite-register.ts, bound to the new measurement and " +
  "replacing the hardcoded ZAR 50m build-phase floor with governed " +
  "calibration; (4) Ravi authors the three procedures cited by in-force " +
  "policies but file-absent (ftp-curve-calibration, alm-limit-monitoring, " +
  "daily-alm-run) and reconciles the 6 stale procedure-to-policy frontmatter " +
  "anchors; and Owen (Company Secretary) adds a Treasurer category row to the " +
  "CLAUDE.md decision-authority routing table. Items 1, 2, 4 run in " +
  "parallel; item 3 is reviewer-free sequential work gated on item 2's merge.";

const RATIONALE =
  "The Treasurer role-definition review (D-TREASURER-ROLE-DEFINITION-REVIEW, " +
  "PR #1199) verified at code level that the Treasurer's settlement-funding " +
  "mandate rests on substrate with three Wave-1 gaps: the CFP can never fire " +
  "(all 7 trigger event types absent from the registry — including " +
  "CriticalSettlementObligationAtRisk, the trigger guarding exactly the " +
  "nostro settlement-funding seam Marc asked about); the BCBS 248 seven " +
  "intraday metrics are not computed; and the RAS register carries no " +
  "intraday-liquidity appetite line, leaving the intraday floor a hardcoded " +
  "constant outside CRO-governed calibration. Three in-force policies also " +
  "cite procedures that do not exist as files, and the routing standard has " +
  "no Treasurer category. Marc approved dispatch in-session 2026-06-11 " +
  "('continue with next').";

requestDecision(
  {
    decisionId: "D-TREASURER-WAVE1-SUBSTRATE",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale: "Wave-1 set surfaced by the role-definition review; opens the decision lifecycle.",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: "D-TREASURER-WAVE1-SUBSTRATE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale: RATIONALE,
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(JSON.stringify({ ok: true, result }, null, 2));
