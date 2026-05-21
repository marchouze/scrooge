// scripts/record-d-policy-document-home-surface.ts
//
// One-shot: emit a CeoDecision(approve) event for
// D-POLICY-DOCUMENT-HOME-SURFACE — Marc's in-session "y" when asked
// "Should I surface that as a decision card?" during the 2026-05-12 session.
//
// This back-records the meta-decision to surface the policy-document-home
// question as a formal CEO decision card. It does NOT resolve the open
// D-POLICY-DOCUMENT-HOME decision (which option A/B/C to choose) — that
// card remains open in PR #288.
//
// Authority: Marc (CEO) — explicit in-session "y", 2026-05-12.
// Recorded via: scrooge:session-delegation
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Atlas (Core banking platform architect, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordDelegatedDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-POLICY-DOCUMENT-HOME-SURFACE",
  action: "approve" as const,
  title: "Approve surfacing D-POLICY-DOCUMENT-HOME as a CEO decision card",
  outcome:
    "CEO approved surfacing the policy document home question as a formal decision card (PR #288 opened by Owen). The meta-decision — whether to surface the question — is approved. The substantive option choice (A/B/C) remains open as D-POLICY-DOCUMENT-HOME.",
  comment:
    "Marc (CEO): 'y' in-session when Scrooge asked 'Should I surface that as a decision card?' — 2026-05-12 session.",
  sourceDoc: "CLAUDE.md §Session delegation",
  recordedVia: "scrooge:session-delegation",
  asOf: "2026-05-12T00:00:00.000Z",
};

function main(): number {
  const alreadyRecorded = new Set<string>();
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const id = (e.payload as Record<string, unknown>).decisionId;
    if (typeof id === "string") alreadyRecorded.add(id);
  }

  if (alreadyRecorded.has(ENTRY.decisionId)) {
    logger.info({ decisionId: ENTRY.decisionId }, "already recorded — skipping");
    return 0;
  }

  const { eventId } = recordDelegatedDecision(
    {
      decisionId: ENTRY.decisionId,
      action: ENTRY.action,
      title: ENTRY.title,
      outcome: ENTRY.outcome,
      comment: ENTRY.comment,
      sourceDoc: ENTRY.sourceDoc,
      recordedVia: ENTRY.recordedVia,
    },
    ENTRY.asOf,
  );

  logger.info({ decisionId: ENTRY.decisionId, eventId }, "CeoDecision recorded");
  return 0;
}

process.exit(main());
