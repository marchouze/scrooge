// scripts/distill-decisions-w1.ts
//
// WS-V2-BBAAS W1 — idempotent emission pass: one `DecisionDistilled` event
// per entry in the authored classification dataset
// (`platform/governance/decision-distillation/classifications.ts`).
//
// Idempotency: an entry is SKIPPED when the latest existing
// `DecisionDistilled` for that decisionId already carries the same
// class + rationale (re-running the script after a partial pass, or with
// an unchanged dataset, appends nothing). A changed class or rationale is
// a genuine re-classification and appends a new event (latest wins, P1).
//
// Run against the shared store (Scrooge does this post-merge):
//   bun run distill:decisions-w1
//
// Authority: D-V2-BBAAS-W1-DECISION-DISTILLATION (CEO session-delegation
// 2026-06-12); P1-EVENTS-AS-TRUTH.
// Author: Owen (Company Secretary, governance).
import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { deterministicAggregateId, makeAggregateLabel } from "../platform/event-store/aggregate";
import {
  type DecisionDistilledPayload,
  makeDecisionDistilled,
} from "../platform/event-store/event-types/decision-distillation";
import { provenanceForEmit } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import {
  DECISION_CLASSIFICATIONS,
  DISTILLATION_WORKSTREAM,
  DISTILLED_BY,
} from "../platform/governance/decision-distillation/classifications";

const EVENT_CITATIONS = [
  "D-V2-BBAAS-W1-DECISION-DISTILLATION",
  "D-V2-BBAAS-ANALYSIS-LAUNCH",
  "P1-EVENTS-AS-TRUTH",
];

// Latest existing DecisionDistilled per decisionId (as_of order).
const latest = new Map<string, DecisionDistilledPayload>();
for (const ev of [...eventStore.replay({ type: "DecisionDistilled" })].sort((a, b) =>
  a.as_of < b.as_of ? -1 : a.as_of > b.as_of ? 1 : 0,
)) {
  const p = ev.payload as DecisionDistilledPayload;
  latest.set(p.decisionId, p);
}

let emitted = 0;
let skipped = 0;
const now = clock.now();

for (const entry of DECISION_CLASSIFICATIONS) {
  const existing = latest.get(entry.decisionId);
  if (existing && existing.class === entry.class && existing.rationale === entry.rationale) {
    skipped += 1;
    continue;
  }

  const event = makeDecisionDistilled({
    asOf: now,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:owen:company-secretary" },
    citations: EVENT_CITATIONS,
    payload: {
      decisionId: entry.decisionId,
      class: entry.class,
      rationale: entry.rationale,
      citations: entry.citations ?? [],
      distilledBy: DISTILLED_BY,
      workstream: DISTILLATION_WORKSTREAM,
    },
  });
  const aggregateLabel = makeAggregateLabel("decision", entry.decisionId);
  const withProvenance: Event = {
    ...event,
    provenance: provenanceForEmit("DecisionDistilled"),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  };
  eventStore.append(withProvenance);
  emitted += 1;
}

console.log(
  JSON.stringify({ emitted, skipped, total: DECISION_CLASSIFICATIONS.length, asOf: now }, null, 2),
);
