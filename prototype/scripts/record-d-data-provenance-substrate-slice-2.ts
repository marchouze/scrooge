// scripts/record-d-data-provenance-substrate-slice-2.ts
//
// One-shot: emit a CeoDecision event for D-DATA-PROVENANCE-SUBSTRATE-SLICE-2
// — projection-runtime mode selection + filtering.
//
// Standing authority: D-DATA-PROVENANCE-SUBSTRATE (CEO-approved 2026-05-10).
// This script records the slice sub-authorisation under that standing
// approval per CLAUDE.md "Dispatch discipline" — no new CEO approval
// required.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Anya (Data / analytics engineer, engineering — projection runtime)

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-DATA-PROVENANCE-SUBSTRATE-SLICE-2",
  action: "approve" as const,
  title: "Data-provenance substrate Slice 2 — projection-runtime mode selection + filtering",
  outcome:
    "Anya (Data / analytics engineer, engineering — projection runtime) ships Slice 2 of D-DATA-PROVENANCE-SUBSTRATE: ProvenanceFilter type (mode + scenarios + variants + sourceLineages axes) added at prototype/platform/projections/filter.ts; SnapshotProjectionOpts and ProjectionSnapshotOpts gain optional provenanceFilter (env-derived default from BANK_PHASE — simulated-only during the build phase, production-only at licence-day, no code change at cutover); LocalProjector.projectFromSnapshot and maybeSnapshot apply the filter during fold and isolate snapshot rows by the structural digest of the filter (effectiveStreamKey = baseKey#prov=<digest>) so cross-mode reads never cross-contaminate; Rohan's backtest harness migrated to a production-only default with BANK_BACKTEST_PROVENANCE_MODE override; 22 new tests cover round-trip per mode, snapshot-key isolation across modes, scenario / variant / sourceLineage narrowing, env-derived default flipping, and digest determinism. Backwards-compatible: omitted filter resolves to the env default; existing consumers (Rohan harness, snapshot tests) continue to work. Substrate gaps remaining: Slice 3 watermarking (separate dispatch), Slice 4 ProvenanceAggregate<> combined-mode aggregation primitive (Atlas+Anya).",
  comment: "downstream substrate dispatch from D-DATA-PROVENANCE-SUBSTRATE; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_anya_d-data-provenance-substrate-slice-2.md",
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
      recordedVia: "script:record-d-data-provenance-substrate-slice-2",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
