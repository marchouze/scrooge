// scripts/record-d-event-store-scaling-slice-2.ts
//
// One-shot: emit a CeoDecision event for D-EVENT-STORE-SCALING-SLICE-2 —
// the substrate change that lands the local snapshot APIs (snapshot,
// loadSnapshot, listSnapshots, replayFromSnapshot, shouldSnapshot) on
// the EventStore class plus the additive `snapshots` SQLite table and
// the per-event-type snapshot-cadence registry.
//
// Standing authority: D-EVENT-STORE-SCALING Slice 2 (local snapshot
// substrate, CEO-approved 2026-05-10). This script records the slice-2
// sub-authorisation so the audit trail names it explicitly.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Atlas (Core banking platform architect, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-EVENT-STORE-SCALING-SLICE-2",
  action: "approve" as const,
  title:
    "Event-store scaling Slice 2 — local snapshot substrate (snapshot + replayFromSnapshot APIs)",
  outcome:
    "Atlas (Core banking platform architect, engineering)'s Slice 2 substrate change approved as drafted under standing D-EVENT-STORE-SCALING Slice 2 authority. EventStore class gains snapshot() / loadSnapshot() / listSnapshots() / replayFromSnapshot() / shouldSnapshot() methods backed by an additive `snapshots` SQLite table; per-event-type snapshot cadence (hybrid 1000-events / 1-hour default per Q1) added to registry as an optional EventTypeMetadata field with DEFAULT_SNAPSHOT_CADENCE fall-back. The store does not auto-snapshot inside append() — Slice 3 consumers own projection state and call snapshot() after fold updates. M8 cloud lift swaps the implementation for Cosmos DB Core hot-tier without changing the API surface (Principle 3). 13 new tests cover round-trip + idempotency, replay equivalence with naive path, and cadence-trigger behaviour.",
  comment: "downstream dispatch from D-EVENT-STORE-SCALING Slice 2; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_atlas_d-event-store-scaling-slice-2-snapshot-substrate.md",
  asOf: "2026-05-10T09:00:00.000Z",
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
      recordedVia: "script:record-d-event-store-scaling-slice-2",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
