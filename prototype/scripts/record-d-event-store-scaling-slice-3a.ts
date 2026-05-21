// scripts/record-d-event-store-scaling-slice-3a.ts
//
// One-shot: emit a CeoDecision event for D-EVENT-STORE-SCALING-SLICE-3A —
// the substrate-adoption decision that splits the runtime dashboard cache
// from the committed seed and documents the shared-event-store env var.
//
// Standing authority: D-EVENT-STORE-SCALING Slice 3 (consumer adoption,
// CEO-approved). This script records the slice-3a sub-authorisation so the
// audit trail names it explicitly.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Atlas (Core banking platform architect, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-EVENT-STORE-SCALING-SLICE-3A",
  action: "approve" as const,
  title:
    "Event-store scaling Slice 3a — split runtime dashboard cache from committed seed; document shared-event-store env var",
  outcome:
    "Atlas (Core banking platform architect, engineering)'s Slice 3a substrate change approved as drafted under standing D-EVENT-STORE-SCALING Slice 3 authority. Dashboard server now writes derived state to a gitignored runtime path (`prototype/.local/dashboard-state.json`, env `BANK_DASHBOARD_RUNTIME_STATE`); the committed seed `prototype/seeds/dashboard-state.json` is read-only baseline for the dashboard-derivation recon. Existing `BANK_EVENT_DB` env var documented as the shared-event-store seam — set to a per-machine absolute path to share decision history across worktrees. Default behaviour unchanged (per-worktree); opt-in only. Closes the two halves of today's stale-decisions intake without prejudging the Azure target (Event Hubs + Cosmos) which lands in later slices.",
  comment: "downstream dispatch from D-EVENT-STORE-SCALING Slice 3; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_atlas_d-event-store-scaling-slice-3a-runtime-cache-split.md",
  asOf: "2026-05-10T08:00:00.000Z",
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
      recordedVia: "script:record-d-event-store-scaling-slice-3a",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
