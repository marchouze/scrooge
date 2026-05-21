// scripts/record-d-owner-inbox-auto-archive.ts
//
// One-shot: emit a CeoDecision event for D-OWNER-INBOX-AUTO-ARCHIVE — the
// substrate slice that adds Scrooge's event-driven Owner Inbox auto-archiver
// (closes the half-automated CEO-decision-card lifecycle Marc surfaced
// 2026-05-10).
//
// Standing authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09). This is a
// downstream substrate dispatch under the no-pause rule — no new policy
// decision; the script records the slice-level authorisation so the audit
// trail names it explicitly.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Atlas (Core banking platform architect, engineering) +
//         Owen (Company Secretary, governance)

import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-OWNER-INBOX-AUTO-ARCHIVE",
  action: "approve" as const,
  title:
    "Owner Inbox auto-archive on CeoDecision — Scrooge's event-driven archiver (closes half-automated lifecycle)",
  outcome:
    'Atlas (Core banking platform architect, engineering) + Owen (Company Secretary, governance)\'s `scrooge:owner-inbox-archiver` runtime handler approved as drafted under standing D-RMS-PHASE-1 authority. The handler subscribes to `CeoDecision` events on the event-trigger bus (A2.2) and atomically moves the source `decision-required: true` card from `Owner Inbox/` to `Owner Inbox/actioned/`, emitting a typed `RecordFiled` event (RMS Slice 2, PR #144) per archival with `registerKey: "decisions"`, classification `ceo-only`, retention citing `urn:obligation:bank:org:gv:director-decision-retention:v1`, and recordId `record:decisions:<source-card-slug>:actioned`. Idempotent across three layers — bus dedupe on `(eventId, handlerKey)`, handler-level filesystem check, content-addressed document-store puts. Out-of-scope by design: source files outside `Owner Inbox/`, files without `decision-required: true` frontmatter, files already in `actioned/`. Out of scope for this slice: backfill of historical resolved-but-unmoved cards (~25 items; separate one-shot script if Marc wants it). No new policy decision: per the no-pause rule, downstream slices of an approved decision dispatch without per-item CEO confirmation.',
  comment: "downstream dispatch from D-RMS-PHASE-1; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_atlas-owen_owner-inbox-auto-archive-on-ceo-decision.md",
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
      recordedVia: "script:record-d-owner-inbox-auto-archive",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
