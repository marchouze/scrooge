// scripts/record-d-rms-phase-1-slice-5.ts
//
// One-shot: emit a CeoDecision event for D-RMS-PHASE-1-SLICE-5 — the
// end-to-end round-trip slice that closes RMS Phase 1 acceptance §7.1 #6.
//
// Standing authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09). Per the
// no-pause rule, downstream slices of an approved decision dispatch without
// per-item CEO confirmation.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Anya (Data / analytics engineer, engineering — projection-runtime
//          + dashboard derivation curator)
//          · Owen (Company Secretary, governance — records-lifecycle
//          semantics consult)

import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-RMS-PHASE-1-SLICE-5",
  action: "approve" as const,
  title: "RMS Phase 1 Slice 5 — end-to-end round-trip: Phase 1 substantively complete",
  outcome:
    "Anya (Data / analytics engineer, engineering — projection-runtime + dashboard derivation curator) + Owen (Company Secretary, governance — records-lifecycle semantics consult)'s Slice 5 substrate change approved as drafted under standing D-RMS-PHASE-1 authority. Pure test slice — no production code changes. Lands `prototype/tests/rms-phase-1-e2e.test.ts` (six-step end-to-end round-trip: AgentBriefIssued → AgentRunStarted → AgentRunCompleted → DecisionRequested → CeoDecision → auto-archive RecordFiled) and `prototype/scenarios/04-rms-phase-1-roundtrip.ts` (runnable demo via `bun run scenario:rms-roundtrip`, with isolated event-store DB + isolated document-store root + isolated repo root). Acceptance criterion §7.1 #6 met: the round-trip exercises the full RMS chain through the typed event substrate (RMS Slice 2, PR #144) + content-addressed BLAKE3 document store (RMS Slice 1, PR #142) + seven projection registers (RMS Slice 3, PR #166) + dashboard register render (RMS Slice 4, PR #169) + auto-archive handler (D-OWNER-INBOX-AUTO-ARCHIVE, PR #155) — with zero new markdown files authored at the top level of `Owner Inbox/` or `Team Inbox/` during the run window. Phase 1 substantively complete; Phase 2 (dispatch routing — Team Inbox derived from Briefs register), Phase 3 (deliverable routing — Owner Inbox derived from Document Register), Phase 4 (cutover & archive) sequenced for Owen + Atlas's next dispatch. `bun run citation-gate` green; `bun run ci` green. Substrate gaps surfaced: auto-router for AgentRunCompleted.followOnRoutes → DecisionRequested (Phase 2 / S8); chat-intake → Feedback handler (Phase 2+); RMS-named recon pipelines (Vera Wave-4).",
  comment: "downstream dispatch from D-RMS-PHASE-1; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_anya-owen_rms-phase-1-slice-5-e2e-roundtrip.md",
  asOf: "2026-05-10T15:30:00.000Z",
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
      recordedVia: "script:record-d-rms-phase-1-slice-5",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
