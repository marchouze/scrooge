// scripts/record-d-data-provenance-substrate-slice-6-1.ts
//
// One-shot: emit a CeoDecision event for D-DATA-PROVENANCE-SUBSTRATE-SLICE-6-1
// — the combined-Slice-6+1 substrate-build decision (backfill + soft-tagger
// + ProvenanceTag envelope + flag-gated append-rejection).
//
// Standing authority: D-DATA-PROVENANCE-SUBSTRATE (CEO-approved 2026-05-10).
// This script records the slice sub-authorisation under that standing
// approval per CLAUDE.md "Dispatch discipline" — no new CEO approval
// required.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Atlas (Core banking platform architect, engineering — substrate)

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-DATA-PROVENANCE-SUBSTRATE-SLICE-6-1",
  action: "approve" as const,
  title:
    "Data-provenance substrate Slices 6+1 (combined) — backfill + ProvenanceTag envelope + flag-gated append-rejection",
  outcome:
    "Atlas (Core banking platform architect, engineering — substrate) ships Slice 6 (soft-tagger at store-open + one-shot `bun run provenance:backfill` script, idempotent) and Slice 1 (typed ProvenanceTag with kind/scenario/variant/sourceLineage/tags axes, Zod cross-axis enforcement, append-time hard-rejection gated by `BANK_PROVENANCE_SUBSTRATE_ACTIVE` flag, source-lineage registry, two new recon pipelines) atomically per the pack's §7 ordering note. Carve-outs adopted: CeoDecision and AgentBriefIssued events tag kind:'production'. Flag default false initially; flips when downstream emitter migration (Slices 2–8) reaches steady state.",
  comment: "downstream substrate dispatch from D-DATA-PROVENANCE-SUBSTRATE; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_atlas_d-data-provenance-substrate-slice-6-1-combined.md",
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
      recordedVia: "script:record-d-data-provenance-substrate-slice-6-1",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
