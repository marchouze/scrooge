// scripts/record-d-party-register-correction.ts
//
// One-shot: emit a CeoDecision correction event for D-PARTY-REGISTER —
// retracts the inaccurate "closes 10 of 14 F-032 event-type registry-
// coverage gaps as a downstream effect" claim from the original
// D-PARTY-REGISTER outcome text. PR 1 (#203) verified by Atlas that the
// 14 outstanding F-032 gaps are unrelated readiness-snapshot events
// (*ReadinessSnapshot, RiskRunCompleted, AuditCommitteePackPrepped,
// CyberResilienceSnapshot, POPIAControlsSnapshot, etc.) emitted by other
// agents — the Party event family adds net-new types that were never
// appended-without-registry-row, so the gap count stays at 14, not 4.
//
// The substrate work in PR 1 is correct as built. Only the F-032
// prediction was wrong — based on a stale baseline of what the gaps
// were. The 14 gaps remain a separate workstream (Atlas's continuation
// from yesterday's S7-Targeted batch).
//
// Standing authority: D-PARTY-REGISTER (CEO-approved 2026-05-11). This
// is a Principle-1 mirror-correction so the event log accurately
// reflects what was actually decided / what landed.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Scrooge (Chief of Staff / Orchestrator)

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-PARTY-REGISTER-CORRECTION",
  action: "modify" as const,
  title: "D-PARTY-REGISTER correction — retract the F-032 'closes 10 of 14 gaps' claim",
  outcome:
    "The original D-PARTY-REGISTER outcome text (CeoDecision emitted 2026-05-11T04:18:54Z; markdown mirror at Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register.md) included the claim 'Closes 10 of the 14 remaining F-032 event-type registry-coverage gaps as a downstream effect.' PR 1 of D-PARTY-REGISTER (https://github.com/marchouze/scrooge/pull/203, merged 2026-05-11T04:41:29Z) revealed this prediction was wrong: the 14 outstanding F-032 gaps are unrelated readiness-snapshot events (*ReadinessSnapshot, RiskRunCompleted, AuditCommitteePackPrepped, CyberResilienceSnapshot, POPIAControlsSnapshot, etc.) emitted by other agents — Party adds net-new event types that were never appended-without-registry-row, so the F-032 gap count stays at 14, not 4. The substrate work in PR 1 is correct as built (10 typed Party event types registered with full metadata, schemas, factories — all gates green). Only the F-032 baseline assumption was bad. Closing the 14 readiness-snapshot gaps remains a separate workstream (Atlas (Core banking platform architect; substrate)'s continuation from yesterday's S7-Targeted batch — readiness-snapshot harmonisation per project_continuation_readiness_snapshot_harmonise memory). All other clauses of D-PARTY-REGISTER stand unchanged.",
  comment:
    "Retract one inaccurate sentence; rest of D-PARTY-REGISTER stands. Marc (CEO) chose option (b) emit-correction-event over option (a) inline-correction-note when the inaccuracy was surfaced (chat-intake 2026-05-11).",
  sourceDoc: "Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register-correction.md",
  asOf: "2026-05-11T04:42:00.000Z",
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
      recordedVia: "script:record-d-party-register-correction",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
