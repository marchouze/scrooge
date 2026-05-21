// scripts/record-d-rms-phase-1-slice-4.ts
//
// One-shot: emit a CeoDecision event for D-RMS-PHASE-1-SLICE-4 — the
// dashboard-render slice that renders the seven RMS register projections
// alongside the legacy Owner Inbox / Team Inbox folder views (Phase 1
// dual-render).
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
//          consult on substrate composition)

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-RMS-PHASE-1-SLICE-4",
  action: "approve" as const,
  title: "RMS Phase 1 Slice 4 — dashboard register render (dual-render)",
  outcome:
    "Anya (Data / analytics engineer, engineering) + Atlas (Core banking platform architect, engineering)'s Slice 4 substrate change approved as drafted under standing D-RMS-PHASE-1 authority. Slice 4 lands the dashboard render layer for the seven RMS registers built in Slice 3: a new `prototype/dashboard/rms-view.ts` projection-runtime consumer folds the EventStore through the seven Slice-3 projections (`decisionsRegisterProjection`, `correspondenceRegisterProjection`, `agentRunsRegisterProjection`, `documentRegisterProjection`, `feedbackRegisterProjection`, `briefsRegisterProjection`, `workstreamsRegisterProjection`) and exports the catalogue + selector surface. Two new server endpoints — `GET /api/rms` (catalogue + counts) and `GET /api/rms/:register` (rows for one register) — surface the views; a register hub at `/rms.html` lands per-register table pages with the typed status taxonomies (Decisions: open/resolved/revision-requested/superseded; Records-of-agent-runs: in-flight/delivered/blocked/withdrawn; Briefs/dispatches: issued/in-flight/delivered/blocked/withdrawn/superseded; Workstreams: active/complete/blocked). Phase 1 dual-render: the new register views render alongside the legacy Owner Inbox feed, the legacy `/index.html` `decisionsOpen`/`decisionsResolved` view, and the existing `/agents.html` runtime-handler view — none of which are touched. The legacy view's existence is the dual-render contract, not a bug; Phase 4 is when the legacy folders archive. Smoke tests in `tests/rms-dashboard-render.test.ts` assert: derivation produces seven register views with correct counts; the catalogue surface matches `RMS_REGISTER_CATALOGUE`; the per-register selector returns the right view; unknown register keys are rejected; the API contract is JSON-serialisable. `bun run citation-gate` green; type-check clean; full `bun run ci` green. Slice 4 substrate: dashboard register render; Slice 5 demonstrates end-to-end round-trip through the substrate (separate dispatch).",
  comment: "downstream dispatch from D-RMS-PHASE-1; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_anya_rms-phase-1-slice-4-dashboard-register-render.md",
  asOf: "2026-05-10T13:00:00.000Z",
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
      recordedVia: "script:record-d-rms-phase-1-slice-4",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
