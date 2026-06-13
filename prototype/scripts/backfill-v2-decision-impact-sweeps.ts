// scripts/backfill-v2-decision-impact-sweeps.ts
//
// V2 S9 — backfill decision-impact sweeps for the S9-merge → auto-trigger-
// landing window.
//
// The auto-trigger (`runtime/agents/owen-decision-impact-sweep.ts`) fires the
// sweep on every Decision appended FROM THE MOMENT IT LANDS forward. Decisions
// approved BETWEEN the S9 baseline (D-W8-DECISION-IMPACT-SWEEP, 2026-06-13) and
// the auto-trigger landing never crossed the bus, so they carry no sweep. This
// script closes that window so the coverage gate can flip to ENFORCING with no
// known gaps (brief §3): it sweeps EVERY approved Decision on/after the
// baseline that is not already swept, using the SAME generic resolver + pure
// engine the auto-trigger uses — so a backfilled sweep is identical to the one
// the live trigger would have produced.
//
// Idempotent: a decision already carrying an assessed sweep for its as-of day
// is skipped. Safe to re-run; safe on a clean store (no post-baseline decisions
// → no-op).
//
// Run against the shared store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/backfill-v2-decision-impact-sweeps.ts
//
// Authority: D-W8-DECISION-IMPACT-SWEEP (CEO-approved 2026-06-13);
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS. Principle 1 + Principle 2.
// Author: Owen (Company Secretary, governance), with Atlas (Substrate
//   Architect, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import {
  buildCandidates,
  resolveSweptDecision,
} from "../platform/event-store/decision-impact-candidate-resolver";
import {
  makeDecisionImpactAssessed,
  makeDecisionImpactSweepRequested,
} from "../platform/event-store/event-types/decision-impact-sweep";
import { provenanceForEmit } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import { computeDecisionImpact } from "../v2-core/decision-impact";
import type { CitationRef, Instant } from "../v2-core/fil-core/primitives";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:owen:decision-impact-sweep" };

/** Must match the gate's BASELINE_AS_OF. */
const BASELINE_AS_OF = "2026-06-13";

const BASE_CITATIONS = [
  "D-W8-DECISION-IMPACT-SWEEP",
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

function sweepIdFor(decisionId: string, asOf: string): string {
  return `sweep:${decisionId}:${asOf.slice(0, 10)}`;
}

// Latest phase per decisionId; keep the as_of of the approving event.
const latest = new Map<string, { phase: string; asOf: string }>();
for (const ev of eventStore.replay({ type: "Decision" })) {
  const e = ev as { as_of?: string; payload: { decisionId?: string; phase?: string } };
  const id = e.payload.decisionId;
  if (!id) continue;
  latest.set(id, { phase: e.payload.phase ?? "", asOf: e.as_of ?? "" });
}

const assessed = new Set<string>();
for (const ev of eventStore.replay({ type: "DecisionImpactAssessed" })) {
  const id = (ev.payload as { sweepId?: string }).sweepId;
  if (id) assessed.add(id);
}

const toSweep: Array<{ decisionId: string; asOf: string }> = [];
for (const [decisionId, { phase, asOf }] of latest) {
  if (phase !== "approved") continue;
  if (asOf.slice(0, 10) < BASELINE_AS_OF) continue;
  if (assessed.has(sweepIdFor(decisionId, asOf))) continue;
  toSweep.push({ decisionId, asOf });
}
// Deterministic order.
toSweep.sort((a, b) => a.decisionId.localeCompare(b.decisionId));

if (toSweep.length === 0) {
  process.stdout.write(
    "backfill:v2-decision-impact-sweeps — no un-swept post-baseline approved decisions; nothing to do\n",
  );
  process.exit(0);
}

let emitted = 0;
for (const { decisionId, asOf } of toSweep) {
  const sweepAsOf = asOf || (clock.now() as unknown as string);
  const decision = resolveSweptDecision(eventStore, decisionId);
  const candidates = buildCandidates(eventStore, decision);
  const result = computeDecisionImpact(decision, candidates);
  const sweepId = sweepIdFor(decisionId, sweepAsOf);
  const citations = [...BASE_CITATIONS, decisionId];

  const batch: Event[] = [
    makeDecisionImpactSweepRequested({
      asOf: sweepAsOf,
      entity: ENTITY,
      actor: ACTOR,
      citations,
      payload: {
        sweepId,
        decisionId,
        sweptAt: sweepAsOf as unknown as Instant,
        triggeredBy: "backfill:owen:v2-s9-decision-impact-sweep-window",
        citations: citations as unknown as CitationRef[],
      },
    }),
    makeDecisionImpactAssessed({
      asOf: sweepAsOf,
      entity: ENTITY,
      actor: ACTOR,
      citations,
      payload: {
        sweepId,
        decisionId,
        impacted: result.impacted,
        recommendedActions: result.recommendedActions,
        assessedBy: "Owen (Company Secretary, governance) — S9 window backfill",
        assessedAt: sweepAsOf as unknown as Instant,
        rationale: result.rationale,
        citations: citations as unknown as CitationRef[],
      },
    }),
  ];
  for (const ev of batch) {
    eventStore.append(ev, { provenance: provenanceForEmit("DecisionImpactSweepRequested") });
  }
  emitted += batch.length;
  process.stdout.write(
    `  swept ${decisionId} (as_of ${sweepAsOf.slice(0, 10)}) → ${result.impacted.length} impacted; actions [${result.recommendedActions.join(", ")}]\n`,
  );
}

process.stdout.write(
  `backfill:v2-decision-impact-sweeps — emitted ${emitted} events across ${toSweep.length} decision(s)\n`,
);
