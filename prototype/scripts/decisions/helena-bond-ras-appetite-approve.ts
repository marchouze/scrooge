// scripts/decisions/helena-bond-ras-appetite-approve.ts
//
// Author: Helena (Chief Risk Officer, governance).
//
// CRO-seat ratification of two new RAS appetite lines for bond trading
// (BND-2 from the 2026-06-08 bond trading functionality review):
//
//   1. appetite:market:bond-inventory-face-value
//      Gross long bond inventory cap at R200m face value (RAS §B4, tier-2).
//      Promotes BondSimEngine.positionCapZarMinor hardcoded constant into
//      the structured governance register.
//
//   2. appetite:irrbb:delta-eve-outlier
//      IRRBB δEVE outlier threshold at 15% of Tier-1 capital per BCBS d365
//      §A-3.4 (RAS §B4, tier-1). Early-warning amber at 10%.
//
// Risk-appetite calibration is CRO authority per the decision-authority
// routing table (CLAUDE.md). Neither line introduces a new regulatory
// threshold — both promulgate existing BCBS d365 supervisory outlier limits
// and build-phase practice into the register. The CRO seat self-ratifies.
//
// Idempotent: fixed asOf timestamps so re-runs (home store + CI fresh-store
// backfill) dedup on (decisionId, phase, as_of). NO Date.now() / new Date().
//
// Run once from prototype/, against the shared home store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/decisions/helena-bond-ras-appetite-approve.ts
//
// Stays in the repo as an audit record.

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const DECISION_ID = "D-BOND-RAS-APPETITE";
const REQUESTED_ASOF = "2026-06-08T14:00:00.000Z";
const APPROVED_ASOF = "2026-06-08T14:01:00.000Z";

const TITLE =
  "Bond trading RAS appetite lines: inventory cap (appetite:market:bond-inventory-face-value) + IRRBB δEVE outlier (appetite:irrbb:delta-eve-outlier)";

const CITATIONS = [
  "D-RAS",
  "D-RAS-STRUCTURED-REGISTER",
  "D-NPA-SAGB-BOND-INTERNAL-TEST",
  "D-MARKETS-SCHEMA-FOUNDATION",
  "BCBS-D365-IRRBB",
  "BANKS-REG-26",
];

// Open the decision lifecycle with a `requested` phase so the
// recon:decision-symmetry gate sees a symmetric chain (requested -> approved).
requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CRO",
    authorityRef: "helena@bank.internal",
    title: TITLE,
    category: "risk",
    recommendation:
      "Add two RAS appetite lines for bond trading: " +
      "(1) gross inventory cap at R200m face value (amber at R140m/70%, red at R200m); " +
      "(2) IRRBB δEVE outlier threshold at 15% of Tier-1 capital per BCBS d365 §A-3.4 " +
      "(amber at 10%, red at 15%). Both lines use RAS §B4. " +
      "Bond inventory line is tier-2; IRRBB δEVE line is tier-1.",
    rationale:
      "Bond trading review 2026-06-08 identified a hardcoded position cap in " +
      "BondSimEngine (positionCapZarMinor = R200m) with no governance register entry, " +
      "and an absent IRRBB appetite line for the BCBS d365 §A-3.4 supervisory " +
      "outlier test. Opens the decision lifecycle.",
    citations: CITATIONS,
    recordedVia: "agent:autonomous",
    actor: { type: "service", id: "agent:helena:governance" },
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CRO",
    authorityRef: "helena@bank.internal",
    title: TITLE,
    category: "risk",
    recommendation:
      "Add two RAS appetite lines for bond trading: " +
      "(1) appetite:market:bond-inventory-face-value — gross long bond inventory cap " +
      "at R200m face value (RAS §B4, tier-2); amber at R140m (70%), red at R200m; " +
      "measurement binding: UnifiedPositionProjection sum(nominalMinor) where " +
      "assetClass='bond' AND side='long' as % of R200m cap; breach action: force reduce " +
      "inventory — BondSimEngine position guard engages at amber/red; CRO review within " +
      "1 business day. " +
      "(2) appetite:irrbb:delta-eve-outlier — IRRBB δEVE outlier threshold at 15% of " +
      "Tier-1 capital per BCBS d365 §A-3.4 (RAS §B4, tier-1); amber at 10%, red at 15%; " +
      "measurement binding: IRRBBChecked max(abs(deltaEveMinor)) / tier1CapitalTargetMinor × 100 " +
      "across all BCBS d365 shock scenarios; breach action: ALCO escalation within 1 " +
      "business day; PA notification pathway per BCBS d365 Principle 5; escalate to CEO " +
      "if breach persists >5 business days.",
    rationale:
      "Bond trading review 2026-06-08 identified: (1) BondSimEngine.positionCapZarMinor " +
      "hardcoded at R200m with no corresponding RAS appetite line — promotes the " +
      "build-phase engineering constant into the structured governance register so the " +
      "cap is CRO-ratified and recon:ras-register-parity enforces it. " +
      "(2) IRRBB δEVE outlier test required by BCBS d365 §A-3.4 and Banks Act Reg 26 " +
      "had no appetite line; supervisory threshold is 15% of Tier-1 capital. " +
      "Build-phase Tier-1 target R300m (licence-day capital plan) used as denominator " +
      "until capital is raised. CRO-ratified 2026-06-08.",
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "agent:autonomous",
    actor: { type: "service", id: "agent:helena:governance" },
  },
  APPROVED_ASOF,
);

console.log(
  JSON.stringify(
    { ok: true, eventId: result.eventId, decisionId: DECISION_ID, phase: "approved" },
    null,
    2,
  ),
);
