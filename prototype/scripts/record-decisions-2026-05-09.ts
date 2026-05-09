// scripts/record-decisions-2026-05-09.ts
//
// One-shot: emit CeoDecision events for D-COMP-FRAMEWORK-SIX-SEATS and
// D-RMS-PHASE-1, both approved by Marc via chat-intake on 2026-05-09.
//
// Run once; idempotent (skips ids already recorded).

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRIES = [
  {
    decisionId: "D-COMP-FRAMEWORK-SIX-SEATS",
    action: "approve" as const,
    title: "Compensation framework — thin-human-layer six seats",
    outcome:
      "Camille (CFO, governance)'s framework approved as drafted. Floor / Mid / Ceiling bands stand across all six seats. Mid-tier annual run-rate R17.45m (5.8% of R300m capital target); year-1 one-time ~R5.5m (R1.2m CRO sign-on + R4.3m search fees). Floor is the walk-away band; Ceiling is the CEO + Camille flex envelope at offer stage. Nolan (Recruiter) applies bands across active search.",
    comment: "approve both — chat-intake 2026-05-09",
    sourceDoc:
      "Owner Inbox/2026-05-09_camille_compensation-framework_thin-human-layer-six-seats.md",
    asOf: "2026-05-09T16:05:00.000Z",
  },
  {
    decisionId: "D-RMS-PHASE-1",
    action: "approve" as const,
    title:
      "Records Management Substrate Phase-1 — retire Owner Inbox / Team Inbox",
    outcome:
      "Owen (Company Secretary, governance) + Atlas (Core banking platform architect)'s Phase 1 spec approved as drafted. Scope: seven typed events (AgentBriefIssued, AgentRunStarted, AgentRunCompleted, DecisionRequested, CeoDecision-extended, Feedback, BriefSuperseded, RecordFiled), BLAKE3-hashed content-addressed document store at prototype/data/documents/, seven registers (Decisions, Correspondence, Records-of-agent-runs, Document, Feedback, Briefs / dispatches, Workstreams), dual-render dashboard. ~5 sessions under the Targeted substrate budget. Owen + Atlas joint authorship for Phase 2-4 specs as they land approved. Phases 2-4 sequenced after Phase 1 acceptance criteria met.",
    comment: "approve both — chat-intake 2026-05-09",
    sourceDoc:
      "Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md",
    asOf: "2026-05-09T16:05:00.000Z",
  },
];

function main(): number {
  const alreadyRecorded = new Set<string>();
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const id = (e.payload as Record<string, unknown>).decisionId;
    if (typeof id === "string") alreadyRecorded.add(id);
  }

  let emitted = 0;
  let skipped = 0;
  for (const entry of ENTRIES) {
    if (alreadyRecorded.has(entry.decisionId)) {
      logger.info({ decisionId: entry.decisionId }, "skipped (event already exists)");
      skipped += 1;
      continue;
    }
    recordCeoDecision(
      {
        decisionId: entry.decisionId,
        action: entry.action,
        title: entry.title,
        outcome: entry.outcome,
        actor: "marc@tgv.co.za",
        comment: entry.comment,
        sourceDoc: entry.sourceDoc,
        recordedVia: "script:record-decisions-2026-05-09",
      },
      entry.asOf,
    );
    logger.info(
      { decisionId: entry.decisionId, action: entry.action },
      "CeoDecision event emitted",
    );
    emitted += 1;
  }

  logger.info({ emitted, skipped, total: ENTRIES.length }, "complete");
  return 0;
}

process.exit(main());
