// prototype/scripts/emit-ras-structured-register-decision.ts
//
// Records the CEO decision authorising the structured RAS appetite register —
// the single typed, citation-bound source for the bank's risk-appetite lines,
// replacing the hand-curated `APPETITE_LINES` shadow in
// runtime/agents/helena-risk-appetite-watch.ts. Marc approved in-session
// (2026-06-08) under the session-delegation protocol.
//
// This closes substrate gap #6 surfaced by the CRO risk-appetite-watch review
// (the root cause behind D-CRO-GAP-SECTION-DERIVE-FROM-STORE and
// D-CRO-GAP-REMEDIATION-FOLLOWON): appetite-line definitions + thresholds are
// hand-curated prose duplicated across handlers and re-embedded in render
// logic, so they drift from the RAS and from each other. A typed register with
// structured thresholds + measurement bindings + citations makes the RAS the
// single source the handlers and recon pipelines derive from.
//
// Idempotent: skips if already recorded.
// Run once from prototype/: bun run scripts/emit-ras-structured-register-decision.ts

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-RAS-STRUCTURED-REGISTER";

const reg = buildDecisionsRegister(decisionsSourceFromStore(eventStore));

if (reg.byId.has(DECISION_ID)) {
  console.log(`${DECISION_ID} already recorded — skipping.`);
} else {
  const { eventId } = recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title:
        "Build the structured RAS appetite register — single typed, citation-bound source for risk-appetite lines",
      category: "engineering",
      recommendation:
        "Atlas extracts the 14 hand-curated appetite lines from helena-risk-appetite-watch.ts into a new typed module platform/risk/ras-appetite-register.ts (mirroring the platform/risk/taxonomy.ts + platform/substrate/gap-register.ts precedent). Each line carries structured fields: id, label, rasSection, category, tier, structured thresholds (green/amber/red/critical numeric bounds, replacing the prose summary + the hardcoded threshold strings in render logic), measurementBinding (the projection/event that measures it, or null + owner when unmeasured), and citations (RAS section + D-RAS + any threshold decision e.g. D-RAS-LEVERAGE-RATIO-THRESHOLDS). helena-risk-appetite-watch.ts and helena-goal-loop.ts import the register instead of defining/duplicating lines; the RAS recon pipelines (ras-b2/b6/b7-coverage, liquidity-appetite-snapshot-coverage) read line metadata from the register. Add recon:ras-register-parity asserting (a) every register line cites a RAS section + a Decision, (b) no handler hand-curates a parallel appetite-line array, (c) the RiskAppetiteSnapshot lineStatuses keyset equals the register keyset. NO change to appetite semantics — byte-faithful extraction; the recon gate enforces fidelity.",
      rationale:
        "Gap #6 is the root cause of the whole stale-gap family: because the appetite lines and their thresholds live as hand-curated prose in one handler (and were copied into another, and re-embedded in render strings), every derived report and recon must either duplicate them or drift. A typed, citation-bound register makes the RAS the single source of truth (Principle 1 / Principle 2 single-graph discipline): handlers and recon derive line identity, tier, thresholds, and measurement binding from one place; a parity gate prevents new shadows; and the measurement-binding field turns the 'measurement substrate' gap from prose into a checkable per-line fact. This is a no-semantic-change extraction — the CRO's approved RAS (D-RAS) content is preserved exactly — so it needs no fresh appetite calibration, only the substrate. Parent gap surfaced under D-CRO-GAP-SECTION-DERIVE-FROM-STORE.",
      sourceDocHashes: [],
      citations: [
        "D-RAS",
        "D-CRO-GAP-SECTION-DERIVE-FROM-STORE",
        "P2-SINGLE-GRAPH-DISCIPLINE",
        "P1-EVENTS-ARE-TRUTH",
      ],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log(`Recorded ${DECISION_ID} (event ${eventId}).`);
}
