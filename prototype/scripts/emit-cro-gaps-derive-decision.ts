// prototype/scripts/emit-cro-gaps-derive-decision.ts
//
// Records the CEO decision authorising the rework of the CRO
// (Helena, risk-appetite-watch) handler's "Substrate gaps surfaced this run"
// section so that each gap bullet is DERIVED from the event store (and the
// agent's own spec §16) rather than emitted as a static `lines.push("...")`
// string literal. Marc approved in-session (2026-06-08); under the
// session-delegation protocol that approval is the CEO authorisation, recorded
// here as the canonical Decision event (Principle 1).
//
// Context: helena-risk-appetite-watch.ts lines 723–741 push hand-authored gap
// prose. Two bullets are demonstrably stale: the RWA-engine bullet ("uses
// build-phase ICAAP v1 RWA until W2 Slice 3 lands") — live RWA projection
// shipped 2026-05-30 (D-RWA-LIVE-POSITIONS-PROJECTION-V1) and the same report's
// CET1 line already prints "RWA: live positions (84 trade events)"; and the
// model-validation bullet ("not yet staffed — Nolan hire") — Nadia was hired
// 2026-05-09 and ran a full validation cycle (40+ ModelValidationApproved /
// ModelTierClassified events). The report has a split brain: its line-status
// table is derived live while its gap section is frozen prose, so the two
// halves contradict each other within one file. Team/Helena.md §16 (reviewed
// 2026-05-31) is already correct — the handler drifted from its own spec.
//
// Idempotent: skips if already recorded.
// Run once from prototype/: bun run scripts/emit-cro-gaps-derive-decision.ts

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-CRO-GAP-SECTION-DERIVE-FROM-STORE";

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
        "Derive the CRO risk-appetite-watch substrate-gaps section from the event store; retire the static gap prose",
      category: "engineering",
      recommendation:
        "Rework the 'Substrate gaps surfaced this run' section of runtime/agents/helena-risk-appetite-watch.ts so every bullet is computed from a real probe — event-store replay (e.g. presence of live RWA positions via computeRwaFromPositions, presence of Nadia ModelValidationApproved events, presence of a ClimateScenarioRun) and/or the agent's own §16 — instead of unconditional lines.push string literals. A gap is emitted only when its closing condition is actually unmet; closed gaps drop off automatically. Add a co-located regression test asserting that the RWA and model-validation bullets do NOT appear when the store contains live RWA positions and Nadia validation events. Owner: Atlas (substrate engineer).",
      rationale:
        "The handler's gap section is frozen prose decoupled from the store while the rest of the same report is derived live, so the two halves contradict each other: the CET1 line prints 'RWA: live positions (84 trade events)' three lines above a static bullet claiming RWA is 'pending until W2 Slice 3 lands', and §B7 prints green off Nadia's validation events above a static bullet claiming the validation function is 'not yet staffed — Nolan hire'. Team/Helena.md §16 (reviewed 2026-05-31) already records both gaps as closed; the handler simply never re-rendered. Deriving the section from the store enforces Principle 1 (events are truth) and makes the daily CRO report self-correcting, so it cannot keep re-emitting gaps that shipped weeks ago.",
      sourceDocHashes: [],
      citations: [
        "P1-EVENTS-ARE-TRUTH",
        "D-RWA-LIVE-POSITIONS-PROJECTION-V1",
        "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1",
      ],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log(`Recorded ${DECISION_ID} (event ${eventId}).`);
}
