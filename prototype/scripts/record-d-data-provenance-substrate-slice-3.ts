// scripts/record-d-data-provenance-substrate-slice-3.ts
//
// One-shot: emit a CeoDecision event for D-DATA-PROVENANCE-SUBSTRATE-SLICE-3
// — output watermarking + provenance-badge-coverage recon.
//
// Standing authority: D-DATA-PROVENANCE-SUBSTRATE (CEO-approved 2026-05-10).
// This script records the slice sub-authorisation under that standing
// approval per CLAUDE.md "Dispatch discipline" — no new CEO approval
// required.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Anya (Data / analytics engineer, engineering — projection runtime
//   + watermark layer)

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-DATA-PROVENANCE-SUBSTRATE-SLICE-3",
  action: "approve" as const,
  title: "Data-provenance substrate Slice 3 — output watermarking + recon",
  outcome:
    "Anya (Data / analytics engineer, engineering — projection runtime + watermark layer) ships Slice 3 of D-DATA-PROVENANCE-SUBSTRATE: ProvenanceBadge component (CSS + auto-mounting JS module installing window.provenanceBadge with render / mount / fetch / autoMount / describe / renderError) wired into all 14 dashboard HTML pages with explicit [data-provenance-badge] markers in the page chrome (legacy .meta strip, new .shell-meta, and architecture.html top-right pinned); new GET /api/provenance/mode endpoint surfaces the env-derived ProvenanceFilter from Slice 2 (defaultProvenanceFilter()) as the single source for badge rendering — no new substrate state introduced; recon:provenance-badge-coverage scans prototype/dashboard/public/**/*.html and fails on any page missing CSS / JS / marker (wired into bun run ci); 29 new tests cover the recon (live-tree green + synthetic detection), the badge component (source-shape + pure-function evaluation in fake DOM of describe / render / mount / renderError), and the server endpoint (BANK_PHASE=build vs licence-day env-flip). Substrate gaps remaining: Slice 4 ProvenanceAggregate<> combined-mode aggregation primitive, Slice 5 cross-reference graph-walk recon, Slice 7 user-level toggle UX, PDF / reporting templates per pack §11 (pending Bea+Atlas M2/M3 templates), RMS Correspondence per-record body badge (pending Phase-2 dual-render maturation).",
  comment: "downstream substrate dispatch from D-DATA-PROVENANCE-SUBSTRATE; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_anya_d-data-provenance-substrate-slice-3.md",
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
      recordedVia: "script:record-d-data-provenance-substrate-slice-3",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
