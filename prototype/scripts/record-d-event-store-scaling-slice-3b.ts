// scripts/record-d-event-store-scaling-slice-3b.ts
//
// One-shot: emit a CeoDecision event for D-EVENT-STORE-SCALING-SLICE-3B —
// the substrate-adoption decision that removes the committed dashboard
// cache from the commit graph and refactors the dashboard-derivation,
// decision-event, and decision-recommendation recons to derive at recon
// time rather than compare against a stored cache.
//
// Standing authority: D-EVENT-STORE-SCALING Slice 3 (consumer adoption,
// CEO-approved). This script records the slice-3b sub-authorisation so the
// audit trail names it explicitly. Natural follow-on from Slice 3a (PR
// #138, recorded morning of 2026-05-10).
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-EVENT-STORE-SCALING-SLICE-3B",
  action: "approve" as const,
  title:
    "Event-store scaling Slice 3b — remove dashboard-state.json from commit graph; recon derives from sources directly",
  outcome:
    "Atlas (Core banking platform architect, engineering)'s Slice 3b substrate change approved as drafted under standing D-EVENT-STORE-SCALING Slice 3 authority. The committed `prototype/seeds/dashboard-state.json` baseline is removed from the commit graph (gitignored; `git rm --cached`). The dashboard-derivation recon now derives state from canonical sources at recon time and asserts internal-consistency invariants (every `decisionsOpen[].id` reachable; every ISO-timestamped `decisionsResolved[]` matched by a `CeoDecision` event; principles count matches; etc.) — no comparison against a stored cache. The decision-event-recon and decision-recommendation-recon are refactored to derive on the fly from canonical sources + the live event store. Closes the cross-PR cache-drift friction surfaced by today's multi-PR cache-regen episode (PR #150 / #151 / #152). Honours Principle 1 (events/sources are truth; projections are queries) explicitly.",
  comment: "downstream dispatch from D-EVENT-STORE-SCALING Slice 3; no new policy decision",
  sourceDoc:
    "Owner Inbox/2026-05-10_atlas_d-event-store-scaling-slice-3b-cache-from-commit-graph.md",
  asOf: "2026-05-10T12:00:00.000Z",
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
      recordedVia: "script:record-d-event-store-scaling-slice-3b",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
