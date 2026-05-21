// scripts/record-d-event-store-scaling-slice-3.ts
//
// One-shot: emit a CeoDecision event for D-EVENT-STORE-SCALING-SLICE-3 —
// the consumer-adoption decision that wires Rohan's backtest harness and
// Anya's projection runtime onto the Slice-2 snapshot APIs.
//
// Standing authority: D-EVENT-STORE-SCALING Slice 3 (consumer adoption,
// CEO-approved 2026-05-10). This script records the slice-3 sub-
// authorisation so the audit trail names it explicitly. Slice 3a (runtime
// cache split) was a separate sub-dispatch under the same standing
// authority and was recorded under D-EVENT-STORE-SCALING-SLICE-3A.
//
// Run once; idempotent (skips ids already recorded).
//
// Authors: Rohan (Risk engineer, engineering — reports to Helena CRO)
//   · Anya (Data / analytics engineer, engineering — reports to Devon COO)

import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-EVENT-STORE-SCALING-SLICE-3",
  action: "approve" as const,
  title: "Event-store scaling Slice 3 — consumer adoption (backtest harness + projection runtime)",
  outcome:
    "Rohan (Risk engineer, engineering — reports to Helena CRO) and Anya (Data / analytics engineer, engineering — reports to Devon COO)'s Slice 3 consumer-adoption changes approved as drafted under standing D-EVENT-STORE-SCALING Slice 3 authority. Track A: rohan-backtest-harness.ts inner per-prediction-point replay loop replaced with a single per-entity credit-critical signal projection built via eventStore.replayFromSnapshot() + snapshot persistence via eventStore.shouldSnapshot()/snapshot(); BANK_BACKTEST_USE_SNAPSHOTS env flag (default true) toggles to the naive single-replay path for byte-identical regression. Stream key per Atlas Q4: <entity>|backtest/risk-raised-credit-critical. Track B: LocalProjector gains projectFromSnapshot() + maybeSnapshot() behind the existing Projector interface; Projection<S, E> gains optional encodeSnapshot/decodeSnapshot codec fields. Equivalence between snapshot-replay and naive-replay asserted on every backtest fixture and on a synthetic widget-counter projection (cold-start equivalence: snapshot → drop in-memory → restore → continue forward = fresh naive). Slice 2 API surface unchanged. M8 cloud lift swaps the EventStore implementation for Cosmos DB Core + Event Hubs change-feed without touching either consumer (Principle 3). Vera recon migration + dashboard projection migration deferred to subsequent Slice-3 consumer dispatches per Atlas Q5 sequencing.",
  comment: "downstream dispatch from D-EVENT-STORE-SCALING Slice 3; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_rohan-anya_d-event-store-scaling-slice-3-consumer-adoption.md",
  asOf: "2026-05-10T10:00:00.000Z",
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
      recordedVia: "script:record-d-event-store-scaling-slice-3",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
