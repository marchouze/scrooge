// scripts/record-d-rms-phase-1-slice-3.ts
//
// One-shot: emit a CeoDecision event for D-RMS-PHASE-1-SLICE-3 — the
// projection-runtime slice that lands the seven RMS register projections
// on top of the Slice 1 document store + Slice 2 event-types/record-helpers.
//
// Standing authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09). Per the
// no-pause rule, downstream slices of an approved decision dispatch without
// per-item CEO confirmation.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Anya (Data / analytics engineer, engineering — projection-runtime
//          + dashboard derivation curator)
//          · Atlas (Core banking platform architect, engineering — substrate
//          consult on event-store seams)

import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-RMS-PHASE-1-SLICE-3",
  action: "approve" as const,
  title: "RMS Phase 1 Slice 3 — projection runtime + 7 RMS register projections",
  outcome:
    "Anya (Data / analytics engineer, engineering) + Atlas (Core banking platform architect, engineering)'s Slice 3 substrate change approved as drafted under standing D-RMS-PHASE-1 authority. Seven typed `Projection` definitions land in `prototype/platform/rms-registers/` (decisions.ts, correspondence.ts, agent-runs.ts, document.ts, feedback.ts, briefs-dispatches.ts, workstreams.ts) projecting the seven RMS event types (`AgentBriefIssued`, `AgentRunStarted`, `AgentRunCompleted`, `DecisionRequested`, `Feedback`, `BriefSuperseded`, `RecordFiled`) plus the legacy `CeoDecision` type (Decisions register pair-couples Request+CEO action by `decisionId`). Each projection is a pure (state, event) → state reducer with snapshot codecs (`encodeSnapshot` / `decodeSnapshot`) so the EvSS Slice-3 fast path (`Projector.projectFromSnapshot`) restores state without re-reading the full event log. Provenance filter helper at `filter.ts` exposes mode-aware reads (production / simulated / scenario) for the Slice-4 dashboard consumer; projections themselves stay oblivious of provenance per the consumer-time-filter pattern. Determinism, supersession, out-of-order replay, snapshot round-trip, provenance filtering, and registers' typed status taxonomies asserted by 22 new tests in `tests/rms-registers.test.ts` (78 expect() calls, all pass). `bun run citation-gate` green; type-check clean; full `bun run ci` green. Slice 3 substrate: typed register projections; Slice 4 lands the dashboard render (separate dispatch); Slice 5 demonstrates end-to-end round-trip through the substrate.",
  comment: "downstream dispatch from D-RMS-PHASE-1; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_anya_rms-phase-1-slice-3-projection-runtime-registers.md",
  asOf: "2026-05-10T11:00:00.000Z",
};

function main(): number {
  const alreadyRecorded = new Set<string>();
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const id = (e.payload as Record<string, unknown>).decisionId;
    if (typeof id === "string") alreadyRecorded.add(id);
  }

  if (alreadyRecorded.has(ENTRY.decisionId)) {
    logger.info({ decisionId: ENTRY.decisionId }, "skipped (event already exists)");
    return 0;
  }

  recordCeoDecision(
    {
      decisionId: ENTRY.decisionId,
      action: ENTRY.action,
      title: ENTRY.title,
      outcome: ENTRY.outcome,
      actor: "marc@tgv.co.za",
      comment: ENTRY.comment,
      sourceDoc: ENTRY.sourceDoc,
      recordedVia: "script:record-d-rms-phase-1-slice-3",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
