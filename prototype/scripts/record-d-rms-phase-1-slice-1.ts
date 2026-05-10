// scripts/record-d-rms-phase-1-slice-1.ts
//
// One-shot: emit a CeoDecision event for D-RMS-PHASE-1-SLICE-1 — the
// substrate-adoption slice that lands the content-addressed document store
// + BLAKE3 hashing as the foundation for RMS Phase 1.
//
// Standing authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09). Phase 1 is
// a five-slice build sequenced by Atlas (Core banking platform architect,
// engineering) + Owen (Company Secretary, governance). This script records
// the slice-1 sub-authorisation so the audit trail names it explicitly.
// No new policy decision: per the no-pause rule, downstream slices of an
// approved decision dispatch without per-item CEO confirmation.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Atlas (Core banking platform architect, engineering)
//         + Owen (Company Secretary, governance)

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-RMS-PHASE-1-SLICE-1",
  action: "approve" as const,
  title: "RMS Phase 1 Slice 1 — content-addressed document store + BLAKE3 hashing",
  outcome:
    "Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering)'s Slice 1 substrate change approved as drafted under standing D-RMS-PHASE-1 authority. Content-addressed document store lands at `prototype/platform/document-store/` with BLAKE3 hashing (via @noble/hashes), sharded local-fs layout (`<root>/<algo>/<first-2>/<rest>`), `BANK_DOCUMENT_STORE_PATH` env-var configurable root, integrity-on-read by default, 22 unit tests (298 expectations) passing. Hash strings carry algorithm prefix (`blake3:<64-hex>`) for non-breaking future swaps; SHA-256 fallback reserved in the type system but not implemented (no FIPS-only deployment surface in Phase 1). Interface designed for clean Azure Blob + Managed-HSM-envelope swap at M8. Slice 1 is foundational — no event types, no projections, no dashboard render, no migration — all of those land in Slices 2–5. Closes the foundation gap for the seven RMS event types Slice 2 will register.",
  comment: "downstream dispatch from D-RMS-PHASE-1; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_owen-atlas_rms-phase-1-slice-1-document-store.md",
  asOf: "2026-05-10T08:30:00.000Z",
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
      recordedVia: "script:record-d-rms-phase-1-slice-1",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
