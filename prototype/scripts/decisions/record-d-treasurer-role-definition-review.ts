// scripts/decisions/record-d-treasurer-role-definition-review.ts
//
// Records D-TREASURER-ROLE-DEFINITION-REVIEW — Marc's in-session instruction
// (2026-06-10): "consider and define the role of the Treasurer. identify
// policies required, procedures, and plan for what substrate is needed to
// support the role."
//
// CONTEXT. The Treasurer seat already exists: Eitan (Treasurer, governance,
// ALCO chair, reports to CEO) with Ravi (Treasury / ALM engineer, engineering
// bench, reports to Eitan). Both carry full 17-section operating specs
// (Team/Eitan.md, Team/Ravi.md). The instruction is therefore executed as a
// FORMAL ROLE-DEFINITION REVIEW, not a new hire: one consolidated record that
// (a) defines the role and its boundaries against CRO / CFO / Global Markets /
// Ops, (b) maps the required treasury policy universe onto the existing
// Policies/ register and names gaps (e.g. no standalone Contingency Funding
// Plan — referenced from four policies but never authored standalone),
// (c) maps required procedures onto Procedures/by-policy/ and names the
// unauthored pipeline, and (d) lays out the substrate roadmap (live modules
// vs gaps, build-phase vs licence-day).
//
// Routing: Eitan (Treasurer, governance) is the seat-holder and natural owner
// of his own mandate review; Scrooge coordinates the in-session run
// (substrate: scrooge-coordinated-in-session).
//
// Session-delegation: Marc (CEO) instructed in-session 2026-06-10; Scrooge is
// the recording instrument (recordedVia: scrooge:session-delegation).
//
// Idempotent: fixed asOf so re-runs dedup on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument, on
// behalf of Marc (CEO).

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-10T09:00:00.000Z";
const ASOF = "2026-06-10T09:01:00.000Z";

const TITLE =
  "Treasurer role definition review — consolidated role record, policy/procedure map, substrate plan";

const CITATIONS = [
  // The seat-holder's operating spec (the role being defined/reviewed).
  "Team/Eitan.md",
  // The engineering bench under the seat.
  "Team/Ravi.md",
  // Canonical roster (Eitan governance / Ravi engineering split).
  "Team/_team-roster.json",
  // Single-graph discipline — policies/procedures/substrate trace as one chain.
  "Principles/2-single-graph-discipline.md",
  // The seat is a standing autonomous agent.
  "Principles/6-autonomous-by-default.md",
];

const RECOMMENDATION =
  "Execute the CEO's Treasurer role-definition instruction as a formal " +
  "role-definition review of the EXISTING seat (Eitan, Treasurer, governance; " +
  "Ravi, Treasury/ALM engineer, engineering bench), producing one consolidated " +
  "deliverable record that: (a) defines the Treasurer role, mandate, and " +
  "boundaries against CRO (appetite/measurement), CFO (reporting/group " +
  "capital), Head of Global Markets (execution), and Ops (settlement); " +
  "(b) maps the required treasury policy universe onto the existing Policies/ " +
  "register (liquidity-risk-management, asset-liability-management, irrbb, " +
  "funds-transfer-pricing, collateral-management, nostro-correspondent-banking, " +
  "capital-management, hedge-accounting, treasury-investment, " +
  "securities-financing, payments-settlement, excon-compliance) and names " +
  "gaps — explicitly assessing whether a standalone Contingency Funding Plan " +
  "is required (currently embedded by reference in four policies, never " +
  "authored standalone); (c) maps required procedures onto " +
  "Procedures/by-policy/ (PROC-ALM-*, PROC-RISK-ILF/LLM/IRRBB/ILAAP, " +
  "PROC-CAP-CII-01, capital-ratio-monitoring, nostro-management) and names the " +
  "unauthored procedure pipeline; (d) plans the supporting substrate: live " +
  "modules (platform/alm, platform/liquidity, platform/ftp, " +
  "platform/collateral, platform/ilaap, platform/alco, RAS appetite register " +
  "liquidity/capital lines) versus gaps (intraday-liquidity appetite line " +
  "without measurement binding, correspondent settlement interface " +
  "designed-not-built, hedge-accounting posting boundary unwired, BA-return " +
  "submission-layer wiring, CFP trigger monitoring), sequenced into waves with " +
  "an explicit build-phase vs licence-day split. Deliverable filed via " +
  "RecordFiled (RMS Phase 3) + PR; Eitan's spec sections 16/17 corrected if " +
  "the review finds drift. Routed to Eitan as a Scrooge-coordinated in-session " +
  "run under the dispatch discipline.";

const RATIONALE =
  "Marc (CEO) instructed in-session 2026-06-10: 'consider and define the role " +
  "of the Treasurer. identify policies required, procedures, and plan for " +
  "what substrate is needed to support the role.' Exploration confirms the " +
  "seat exists and is substantially operationalised (D-TREASURY-GAPS-WAVE1, " +
  "D-TREASURER-MANDATE-SAMOS-FTP-2026-05-30), so the correct execution is a " +
  "consolidated definition-and-gap review anchored on the existing specs " +
  "rather than a PAX/Nolan new-hire cycle. A single citable record closes the " +
  "gap that the role's definition, policy map, procedure map, and substrate " +
  "plan currently live scattered across specs, policies, procedures, and " +
  "decision history with no consolidated trace (Principle 2).";

requestDecision(
  {
    decisionId: "D-TREASURER-ROLE-DEFINITION-REVIEW",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation: RECOMMENDATION,
    rationale: "CEO instruction received in-session 2026-06-10; opens the decision lifecycle.",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: "D-TREASURER-ROLE-DEFINITION-REVIEW",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation: RECOMMENDATION,
    rationale: RATIONALE,
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(JSON.stringify({ ok: true, result }, null, 2));
