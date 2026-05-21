// scripts/record-d-rms-phase-1-slice-2.ts
//
// One-shot: emit a CeoDecision event for D-RMS-PHASE-1-SLICE-2 — the
// substrate-adoption slice that lands the seven RMS event types + the
// record-helpers module on top of the Slice 1 document store.
//
// Standing authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09). Phase 1 is
// a five-slice build sequenced by Owen (Company Secretary, governance) +
// Atlas (Core banking platform architect, engineering). This script records
// the slice-2 sub-authorisation so the audit trail names it explicitly.
// No new policy decision: per the no-pause rule, downstream slices of an
// approved decision dispatch without per-item CEO confirmation.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Owen (Company Secretary, governance) +
//         Atlas (Core banking platform architect, engineering)

import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-RMS-PHASE-1-SLICE-2",
  action: "approve" as const,
  title: "RMS Phase 1 Slice 2 — seven RMS event types + record-helpers (S8/RMS overlap disposed)",
  outcome:
    "Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering)'s Slice 2 substrate change approved as drafted under standing D-RMS-PHASE-1 authority. Seven typed Zod payload schemas + `make<...>` constructors land in `prototype/platform/event-store/event-types.ts` for the RMS event family — `AgentBriefIssued`, `AgentRunStarted`, `AgentRunCompleted`, `DecisionRequested`, `Feedback`, `BriefSuperseded`, `RecordFiled`. New `RMS_EVENT_TYPES` array in `prototype/platform/event-store/registry.ts` registers the five new types; the two pre-existing envelope-only rows (`AgentRunStarted`, `AgentRunCompleted`) gain typed payloadSchema in-place. Record-helpers module at `prototype/platform/records/` (helpers.ts + index.ts) pairs document-store puts with event appends, modelled on `runtime/decisions/record.ts`. Backwards-compatible `ceoDecisionRmsExtendedPayloadSchema` published with three additive optional fields (`requestEventId`, `recordDocumentHashes`, `modifiedRecommendation`); legacy `recordCeoDecision` callers untouched. Identity-discipline rule enforced at the Zod-payload boundary via `rmsAgentRefSchema` (name+position required). S8/RMS overlap disposition (Scrooge ruling, 2026-05-10): RMS owns the seven records-of-agent-runs types; S8 keeps the runtime primitives (AgentRegistered/AgentRetired/IdentityKeyRotated/PermissionPolicyPublished/AgentDecision/AgentEscalation family). 51 new tests across `tests/rms-event-types.test.ts` (27) + `tests/rms-record-helpers.test.ts` (24); full `bun run ci` green (579/579 tests, all recon harnesses pass with pre-existing warnings unchanged). Slice 2 substrate: typed event surface + record-helpers; Slice 3 lands projection runtime; Slice 4 lands dashboard render; Slice 5 demonstrates end-to-end round-trip with no Owner Inbox / Team Inbox file authored.",
  comment: "downstream dispatch from D-RMS-PHASE-1; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_owen-atlas_rms-phase-1-slice-2-event-types.md",
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
      recordedVia: "script:record-d-rms-phase-1-slice-2",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
