// runtime/agents/owen-decision-impact-sweep.ts
//
// Owen's event-driven decision-impact-sweep handler — the W8 auto-trigger that
// CLOSES the V2 S9 loop.
//
// THE LOOP (D-W8-DECISION-IMPACT-SWEEP, literally "when a Decision event lands,
// an automated sweep computes which downstream artefacts it affects"):
//
//   approved Decision  ──(event-trigger bus)──▶  this handler
//        │
//        ├─ resolve the candidate artefact graph from the LIVE registers
//        │   (postures + fil-models resolvable; obligations/procedures
//        │    advisory via the decision's own citation graph)
//        ├─ run the PURE engine `computeDecisionImpact` (v2-core)
//        └─ emit  DecisionImpactSweepRequested → DecisionImpactAssessed
//
// STRUCTURED-FIRST (Principle 6 + the decision's own design): the sweep
// RECOMMENDS (re-validate / re-distill / re-assess); it NEVER auto-executes a
// recommended action. Disposing a recommendation is a downstream typed decision
// / agent run, not this handler's job.
//
// HOW IT IS FIRED — and why it cannot flood the store on replay/migration:
//   The handler is registered as an `event-driven` handler subscribing to
//   `Decision` in `runtime/handlers-metadata.ts`. The canonical dispatcher is
//   the `LocalEventTriggerBus`, which `runAgent` ticks ONLY over the events a
//   parent run appended (`tick(seqBefore + 1, …)`) — never the whole store
//   history. So a CI migration/replay that re-appends historical Decisions does
//   NOT re-fire this handler: nothing ticks the bus over those events; the
//   standalone `bus:tick` advances a persisted cursor and never re-walks
//   already-walked sequences.
//
//   TWO INDEPENDENT IDEMPOTENCY GUARDS make a flood structurally impossible:
//     1. BUS-LEVEL — the bus appends `BusDispatched{eventId, handlerKey}` and
//        claims it atomically (UNIQUE) BEFORE invoking; a (Decision-event,
//        handler) pair is dispatched at most once, ever.
//     2. SWEEP-LEVEL (this handler) — before emitting, it checks the store for
//        an existing `DecisionImpactAssessed` for the sweepId
//        (`sweep:<decisionId>:<as-of-date>`). If the decision is already swept,
//        the run is a no-op. This covers re-dispatch across a different
//        triggering event for the same decision (e.g. requested→approved both
//        appended in one run) and manual re-runs / replays.
//
//   So: replay-safe, migration-safe, idempotent. If a single decision somehow
//   fired N triggering events in one dispatch, guard (2) collapses them to one
//   sweep. There is no path that produces a sweep storm.
//
// Authority: D-W8-DECISION-IMPACT-SWEEP (CEO-approved 2026-06-13);
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS. Principle 1 (events are truth) + Principle 2
//   (single-graph discipline) + Principle 6 (autonomous by default).
// Author: Owen (Company Secretary, governance), with Atlas (Substrate
//   Architect, engineering).

import { clock, eventStore, logger } from "../../platform/composition";
import {
  buildCandidates,
  resolveSweptDecision,
} from "../../platform/event-store/decision-impact-candidate-resolver";
import {
  makeDecisionImpactAssessed,
  makeDecisionImpactSweepRequested,
} from "../../platform/event-store/event-types/decision-impact-sweep";
import { provenanceForEmit } from "../../platform/event-store/provenance";
import type { Event } from "../../platform/event-store/types";
import { computeDecisionImpact } from "../../v2-core/decision-impact";
import type { CitationRef, Instant } from "../../v2-core/fil-core/primitives";
import type { AgentRunContext, AgentRunOutput } from "../types";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:owen:decision-impact-sweep" };

/** Base S9 + framework citations every sweep carries (plus the swept decision). */
const BASE_CITATIONS = [
  "D-W8-DECISION-IMPACT-SWEEP",
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

/** Stable sweep id for a decision swept on a given as-of date (YYYY-MM-DD). */
function sweepIdFor(decisionId: string, asOf: string): string {
  return `sweep:${decisionId}:${asOf.slice(0, 10)}`;
}

/**
 * The set of decisionIds that already have an assessed sweep in the store.
 * Read once per run (the handler may process a small batch of triggering
 * Decision events). Keyed by sweepId so an as-of-day change re-sweeps a
 * decision on a later day (intentional: a fresh day = a fresh graph snapshot),
 * but a same-day re-dispatch is a no-op.
 */
function assessedSweepIds(): Set<string> {
  const ids = new Set<string>();
  for (const ev of eventStore.replay({ type: "DecisionImpactAssessed" })) {
    const id = (ev.payload as { sweepId?: string }).sweepId;
    if (id) ids.add(id);
  }
  return ids;
}

/** Emit the Requested → Assessed lifecycle for one decision. Returns event count. */
function sweepDecision(decisionId: string, asOf: string): number {
  const decision = resolveSweptDecision(eventStore, decisionId);
  const candidates = buildCandidates(eventStore, decision);
  const result = computeDecisionImpact(decision, candidates);

  const sweepId = sweepIdFor(decisionId, asOf);
  const citations = [...BASE_CITATIONS, decisionId];

  const batch: Event[] = [
    makeDecisionImpactSweepRequested({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations,
      payload: {
        sweepId,
        decisionId,
        sweptAt: asOf as unknown as Instant,
        triggeredBy: "owen:decision-impact-sweep (auto-trigger, event-driven)",
        citations: citations as unknown as CitationRef[],
      },
    }),
    makeDecisionImpactAssessed({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations,
      payload: {
        sweepId,
        decisionId,
        impacted: result.impacted,
        recommendedActions: result.recommendedActions,
        assessedBy: "Owen (Company Secretary, governance) — auto-trigger",
        assessedAt: asOf as unknown as Instant,
        rationale: result.rationale,
        citations: citations as unknown as CitationRef[],
      },
    }),
  ];

  for (const ev of batch) {
    eventStore.append(ev, { provenance: provenanceForEmit("DecisionImpactSweepRequested") });
  }
  return batch.length;
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];

  // Filter to APPROVED Decisions only. A Decision in `requested` (or any non-
  // approved phase) does not sweep — only an approved decision has authorised
  // downstream impact (the gate's coverage assertion is over approved
  // decisions). Dedup by decisionId within this dispatch (latest phase wins
  // per id is the store's concern; here we only need the id once).
  const approvedDecisionIds = new Set<string>();
  for (const e of triggering) {
    if (e.type !== "Decision") continue;
    const p = (e as { payload: { decisionId?: string; phase?: string } }).payload;
    if (p.phase === "approved" && p.decisionId) approvedDecisionIds.add(p.decisionId);
  }

  if (approvedDecisionIds.size === 0) {
    return {
      eventsEmitted: 0,
      summary:
        "owen:decision-impact-sweep — no approved Decision in trigger set; nothing to sweep.",
      ok: true,
    };
  }

  // Dry-run: never side-effect. Report what WOULD be swept.
  if (ctx.dryRun) {
    return {
      eventsEmitted: 0,
      summary: `owen:decision-impact-sweep (dry-run) — would sweep ${approvedDecisionIds.size} approved decision(s): [${[...approvedDecisionIds].join(", ")}].`,
      ok: true,
    };
  }

  const asOf = ctx.asOf || (clock.now() as unknown as string);
  const alreadyAssessed = assessedSweepIds();

  let eventsEmitted = 0;
  const swept: string[] = [];
  const skipped: string[] = [];
  for (const decisionId of approvedDecisionIds) {
    const sweepId = sweepIdFor(decisionId, asOf);
    if (alreadyAssessed.has(sweepId)) {
      skipped.push(decisionId);
      continue;
    }
    eventsEmitted += sweepDecision(decisionId, asOf);
    alreadyAssessed.add(sweepId); // guard intra-run dup if the same id repeats
    swept.push(decisionId);
  }

  logger.info({ swept, skipped, eventsEmitted }, "owen:decision-impact-sweep — auto-trigger ran");

  const sweptPart = swept.length > 0 ? ` [${swept.join(", ")}]` : "";
  const skippedPart =
    skipped.length > 0
      ? `; ${skipped.length} already-swept (idempotent skip) [${skipped.join(", ")}]`
      : "";
  return {
    eventsEmitted,
    summary: `owen:decision-impact-sweep — swept ${swept.length} approved decision(s)${sweptPart}${skippedPart}. Structured-first: recommendations only, no auto-execution.`,
    ok: true,
  };
};

export default handler;
