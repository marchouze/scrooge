// scripts/decisions/helena-intraday-ras-appetite-approve.ts
//
// Author: Helena (Chief Risk Officer, governance).
//
// CRO-seat ratification of the intraday-liquidity RAS appetite line
// (WS-TREASURER-WAVE1-SUBSTRATE follow-on, gated on PR #1206's BCBS 248
// measurement substrate):
//
//   appetite:liquidity:intraday
//     Peak intraday liquidity usage (BCBS 248 tool 1) as % of available
//     start-of-day liquidity (tool 2) — headline measure
//     `peakUsagePctOfAvailable` from `computeIntradayLiquidityMetrics`
//     (`platform/alm/intraday-liquidity-metrics.ts`). RAS §B3, tier-1.
//     Bands: green <60% / amber 60-80% / red ≥80% / critical ≥100%.
//     Governed intraday HQLA floor R50m (`floorZar`) — promotes the former
//     `INTRADAY_FLOOR_ZAR` build-phase constant in
//     `platform/alm/intraday-stress.ts` into the structured register
//     (value unchanged; build-phase behaviour preserved).
//
// Risk-appetite calibration is CRO authority per the decision-authority
// routing table (CLAUDE.md). The red band introduces no new threshold — it
// promulgates the LRM Policy v1 §4.5 intraday-stress definition ("peak
// intraday usage exceeds 80% of the intraday buffer") into the register;
// amber 60% is the CRO early-warning band; critical 100% encodes the §4.4
// zero-net-intraday-credit objective. The CRO seat self-ratifies.
//
// Idempotent: fixed asOf timestamps so re-runs (home store + CI fresh-store
// backfill) dedup on (decisionId, phase, as_of). NO Date.now() / new Date().
//
// Run once from prototype/, against the shared home store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/decisions/helena-intraday-ras-appetite-approve.ts
//
// Stays in the repo as an audit record.

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const DECISION_ID = "D-INTRADAY-RAS-APPETITE";
const REQUESTED_ASOF = "2026-06-11T07:00:00.000Z";
const APPROVED_ASOF = "2026-06-11T07:01:00.000Z";

const TITLE =
  "Intraday-liquidity RAS appetite line (appetite:liquidity:intraday): BCBS 248 peak-usage bands + governed R50m intraday floor";

const CITATIONS = [
  "D-RAS",
  "D-RAS-STRUCTURED-REGISTER",
  "D-TREASURER-WAVE1-SUBSTRATE",
  "D-TREASURER-ROLE-DEFINITION-REVIEW",
  "BCBS-248",
  "BANKS-REG-26",
  "ORG-PR-08",
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
      "Add the appetite:liquidity:intraday RAS appetite line (RAS §B3, tier-1): " +
      "headline measure peakUsagePctOfAvailable (BCBS 248 tool 1 / tool 2) bound to " +
      "computeIntradayLiquidityMetrics; bands green <60% / amber 60-80% / red ≥80% / " +
      "critical ≥100%; governed intraday HQLA floor R50m promoted from the " +
      "intraday-stress.ts build-phase constant into the structured register.",
    rationale:
      "Treasurer role-definition review (D-TREASURER-ROLE-DEFINITION-REVIEW) found the " +
      "RAS register carries no intraday-liquidity appetite line while the intraday floor " +
      "sits as a hardcoded ZAR 50m constant in platform/alm/intraday-stress.ts. " +
      "PR #1206 (Ravi, Treasury/ALM engineer, engineering) landed the BCBS 248 " +
      "measurement substrate, unblocking the binding. Opens the decision lifecycle.",
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
      "Add the appetite:liquidity:intraday RAS appetite line (RAS §B3, tier-1, category " +
      "liquidity): headline measure peakUsagePctOfAvailable — BCBS 248 tool 1 (daily " +
      "maximum intraday usage) as % of tool 2 (available start-of-day liquidity) — bound " +
      "via measurementBinding computeIntradayLiquidityMetrics " +
      "(platform/alm/intraday-liquidity-metrics.ts, PR #1206). Bands: green <60% / " +
      "amber 60-80% (CRO early-warning) / red ≥80% (the LRM Policy v1 §4.5 " +
      "intraday-stress trigger — 30-minute Eitan (Treasurer, governance) response; " +
      "persistent stress activates CFP Tier 1 and notifies Helena) / critical ≥100% " +
      "(usage exceeds available — reliance on uncovered correspondent intraday credit; " +
      "§4.4 zero-net-intraday-credit objective breached; High-severity event per §9.2). " +
      "Governed intraday HQLA floor: floorZar R50,000,000 on the register line — " +
      "platform/alm/intraday-stress.ts reads INTRADAY_FLOOR_ZAR from the register " +
      "instead of a module-local literal; value unchanged at calibration so build-phase " +
      "behaviour is identical (asserted in test).",
    rationale:
      "Treasurer role-definition review (D-TREASURER-ROLE-DEFINITION-REVIEW) identified " +
      "the missing intraday appetite line and the ungoverned ZAR 50m floor constant; " +
      "Wave-1 substrate (D-TREASURER-WAVE1-SUBSTRATE, PR #1206) landed the BCBS 248 " +
      "seven-tool measurement substrate this line binds to. Calibration anchors: red 80% " +
      "promulgates the LRM Policy v1 §4.5 stress definition (no new regulatory " +
      "threshold); amber 60% gives a 20pp early-warning band, coherent with the §4.3 " +
      "buffer-sizing target (buffer = 120% of 99th-percentile peak ⇒ at-target peak " +
      "usage ≈ 83%); critical 100% encodes the §4.4 zero-net-intraday-credit objective. " +
      "Floor R50m retained unchanged pending ILAAP recalibration from live flow history " +
      "(§4.3 backward-looking 99th-percentile sizing). Settlement failure at the " +
      "correspondent is severe for an indirect NPS participant (D-SAMOS-NON-CLEARING): " +
      "tier-1, consistent with the other RAS §B3 liquidity lines. CRO-ratified " +
      "2026-06-11.",
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
