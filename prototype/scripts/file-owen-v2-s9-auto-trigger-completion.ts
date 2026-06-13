// scripts/file-owen-v2-s9-auto-trigger-completion.ts
//
// One-shot RMS Phase 3 filing for the V2 S9 AUTO-TRIGGER completion — the W8
// loop closed. Records the trigger wiring (event-driven bus subscriber on the
// Decision append path), the candidate-context resolver, the enforcing coverage
// recon flip + merge-window backfill, and the end-to-end pilot proof.
// Idempotent — skips if filed.
//
// Authority: D-W8-DECISION-IMPACT-SWEEP (CEO-approved 2026-06-13);
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-RMS-PHASE-3 (active).
// Author: Owen (Company Secretary, governance), with Atlas (Substrate
//   Architect, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:owen:v2-s9-auto-trigger-completion:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-owen-v2-s9-auto-trigger-completion] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 S9 — auto-trigger: the W8 loop closed

**Author:** Owen (Company Secretary, governance)
**With:** Atlas (Substrate Architect, engineering)
**Date:** 2026-06-13
**Authority:** D-W8-DECISION-IMPACT-SWEEP (CEO-approved 2026-06-13); D-V2-BBAAS-BLUEPRINT-SYNTHESIS
**Status:** Implemented — PR feat(v2-s9): auto-trigger decision-impact sweep on approved Decision — W8 loop closed (WS-V2-BBAAS)

---

## 1. What landed

S9 built the sweep engine + event family + projection + (advisory) coverage gate.
This completes it: the AUTO-TRIGGER. When a \`Decision\` is appended in phase
\`approved\`, an automated sweep now fires WITHOUT a manual seed — closing the loop
the authorising decision states literally ("when a Decision event lands, an
automated sweep computes…").

## 2. The trigger wiring

A new event-driven handler \`owen:decision-impact-sweep\`
(\`runtime/agents/owen-decision-impact-sweep.ts\`), registered in
\`runtime/handlers-metadata.ts\` (via \`runtime/agents/metadata/owen.ts\`) with
\`subscribesTo: ["Decision"]\` and a callable in
\`runtime/agents/callables/owen.ts\`. The canonical dispatcher is the
\`LocalEventTriggerBus\`: \`runAgent\` ticks it over the events a parent run
appended, and the bus fans out to this handler. The handler filters to
\`phase === "approved"\`, resolves the candidate graph, runs the PURE engine, and
emits \`DecisionImpactSweepRequested\` → \`DecisionImpactAssessed\`.

**Structured-first:** the sweep RECOMMENDS (re-validate / re-distill / re-assess);
it never auto-executes an action and never mutates an impacted artefact.

## 3. Replay / migration flood guard

The trigger touches shared runtime wiring, so it is double-guarded:

1. **Bus-level** — the bus claims \`BusDispatched{eventId, handlerKey}\` atomically
   BEFORE invoking; a (Decision-event, handler) pair is dispatched at most once.
   The bus is ticked by \`runAgent\` only over a run's NEW events
   (\`tick(seqBefore + 1, …)\`), never the whole store — so a CI migration / replay
   that re-appends historical Decisions does NOT re-fire the handler.
2. **Sweep-level** — before emitting, the handler checks for an existing
   \`DecisionImpactAssessed\` for the sweepId (\`sweep:<decisionId>:<as-of-date>\`)
   and no-ops if present.

There is no path that produces a sweep storm.

## 4. Candidate-context resolution — what resolves vs stays advisory

\`platform/event-store/decision-impact-candidate-resolver.ts\` assembles the
engine input from the LIVE registers, generic over any decision:

- **POSTURES** (resolvable) — every \`PostureRegistered\` → candidate carrying its
  upward \`citations\` (citation-graph) + \`appliesToScope\` (scope-overlap).
- **FIL-MODELS** (resolvable) — every \`FilModelImplementationDeclared\` →
  candidate carrying its \`cites\`; fil scope patterns mapped to a product-scope
  \`AppliesToScope\` for the overlap dimension.
- **OBLIGATIONS / PROCEDURES** (ADVISORY) — the obligation + procedure registers
  are NOT in v2-core read-scope. They are resolved ONLY via the decision's own
  citation graph: a ref the decision cites shaped like \`urn:reg:…\` (obligation)
  or \`proc:…\` (procedure) is admitted under \`cited-by-decision\`. Coverage of
  these kinds is not asserted; the recon gate reports orphan obligation /
  procedure impacts as \`info\`, never \`fail\` (no false positives on
  cross-register refs).

## 5. Coverage recon — flipped to ENFORCING

\`recon:v2-decision-impact-sweep-coverage\` assertion 4 (orphan post-baseline
approved decision) is now **\`fail\`-severity** — enforcing. It is green across the
post-baseline decision set because:

- The auto-trigger sweeps every approved Decision forward.
- The S9-merge → trigger-landing window was BACKFILLED in this PR via
  \`scripts/backfill-v2-decision-impact-sweeps.ts\`, wired into \`ci:migrate\` so the
  decisions \`ci:migrate\` records (e.g. the two \`D-TREASURER-…-2026-05-30\`
  decisions, stamped at the CI run date) are swept before the gate runs.

Orphan-IMPACT findings (assertion 3) stay \`warn\`/\`info\` (obligation/procedure
refs unresolvable from v2 registers). The pilot-absence note stays \`info\`
(a clean/unseeded CI runner holds no pilot seed).

## 6. Pilot proof — automatic firing + idempotency

\`runtime/agents/owen-decision-impact-sweep.integration.test.ts\` drives the loop
end-to-end against an isolated composition store: append an approved Decision +
a posture that cites it → tick the bus over the REAL handler callable → assert a
\`DecisionImpactAssessed\` lands AUTOMATICALLY (no manual seed) with the posture in
its impact set → tick again → assert NO duplicate (the bus dedups on
(eventId, handlerKey)). Both assertions pass.

## 7. Out of scope (named, not done)

Auto-executing recommended actions; full historical back-sweep before the S9
baseline; bringing obligation/procedure registers into v2-core read-scope;
Decision / S9-event-family schema changes.
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-W8-DECISION-IMPACT-SWEEP",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-RMS-PHASE-3",
      "P1-EVENTS-AS-TRUTH",
      "P2-SINGLE-GRAPH-DISCIPLINE",
      "P6-AUTONOMOUS-BY-DEFAULT",
    ],
    actor: {
      type: "service",
      id: "agent:owen:company-secretary",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "V2 S9 — auto-trigger: the W8 loop closed",
      path: "2026-06-13_owen_v2-s9-auto-trigger-completion.md",
      category: "design-note",
      author: "Owen (Company Secretary, governance)",
      date: "2026-06-13",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
