// prototype/scripts/emit-cro-gap-remediation-followon-decision.ts
//
// Records the CEO decision authorising the two follow-on remediations to
// D-CRO-GAP-SECTION-DERIVE-FROM-STORE, both approved by Marc in-session
// (2026-06-08) under the session-delegation protocol:
//
//   (1) rohan-risk-run.ts — replace the hand-copied `helenaAppetiteShadow()`
//       "keep in sync" duplicate of Helena's APPETITE_LINES with a read of
//       Helena's RiskAppetiteSnapshot.lineStatuses straight off the event
//       (the payload now carries lineStatuses), and derive the stale
//       "Independent Validation not yet staffed / Nolan hire" gap strings
//       (~lines 212/323/520) from the store (zero ModelValidationApproved).
//
//   (2) Team/Nadia.md — promote the change-log from v0.1 (draft-stub) to v1.0
//       and reconcile the spec against wired reality: §11 currently lists
//       ModelValidationApproved / ModelTierClassified as "planned, not yet
//       typed" while those events are already in the store. Below-v1.0 status
//       causes PAX's role-research queue to mis-surface Nadia (operational,
//       40+ validation events) as a draft-stub still needing research.
//
// Idempotent: skips if already recorded.
// Run once from prototype/: bun run scripts/emit-cro-gap-remediation-followon-decision.ts

import { clock, eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-CRO-GAP-REMEDIATION-FOLLOWON";

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
        "Follow-on remediation of the stale-static-gap anti-pattern: Rohan risk-run handler + Nadia spec v1.0 promotion",
      category: "engineering",
      recommendation:
        "Two dispatches. (1) Atlas reworks runtime/agents/rohan-risk-run.ts to (a) drop helenaAppetiteShadow() and read Helena's RiskAppetiteSnapshot.lineStatuses directly off the event, and (b) derive the independent-validation staffing gap from the store (emit only when zero ModelValidationApproved events) rather than the static 'not yet staffed / Nolan hire' strings. (2) Nolan promotes Team/Nadia.md change-log v0.1 -> v1.0, reconciling sections 9/11/13 against wired reality (ModelValidationApproved / ModelTierClassified are live, not 'planned'), so PAX's role-research queue stops mis-classifying an operational agent as a draft-stub hire.",
      rationale:
        "Both are the same root defect surfaced by the CRO risk-appetite-watch review: state about reality (appetite lines, validation staffing) held as hand-curated copies that drift from the event store and the maintained specs. Rohan's handler duplicates Helena's appetite shadow with an explicit 'keep in sync' comment and repeats the stale staffing claim that Team/Helena.md and Team/Nadia.md already record as closed. Nadia.md being stuck at draft-stub v0.1 makes PAX re-surface a hired, operational agent as an open hire every cycle. Deriving from the store (Principle 1) and promoting the spec to match wired reality closes both feedback loops. Parent: D-CRO-GAP-SECTION-DERIVE-FROM-STORE.",
      sourceDocHashes: [],
      citations: [
        "D-CRO-GAP-SECTION-DERIVE-FROM-STORE",
        "P1-EVENTS-ARE-TRUTH",
        "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1",
      ],
      recordedVia: "scrooge:session-delegation",
    },
    clock.now(),
  );
  console.log(`Recorded ${DECISION_ID} (event ${eventId}).`);
}
