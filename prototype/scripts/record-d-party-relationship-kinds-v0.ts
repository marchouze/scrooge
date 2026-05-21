// scripts/record-d-party-relationship-kinds-v0.ts
//
// One-shot: emit a CeoDecision event for D-PARTY-RELATIONSHIP-KINDS-V0 —
// the closed v0 enum of Party relationship kinds (typed graph edges
// between Parties). Paired with D-PARTY-REGISTER which establishes the
// unified Party event family.
//
// Standing authority: Standing CEO authority over substrate architecture
// (Principles 2 + 6 in CLAUDE.md).
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Scrooge (Chief of Staff / Orchestrator)

import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-PARTY-RELATIONSHIP-KINDS-V0",
  action: "approve" as const,
  title: "Closed v0 enum of Party relationship kinds — typed graph edges between Parties",
  outcome:
    "Approve the v0 closed enum of Party relationship kinds, grouped by semantics not by source-kind because most edges accept either a natural-person or an agent at the source end. New kinds beyond this v0 require a follow-up CEO decision because each encodes regulatory semantics (and therefore citation requirements). The edge schema in `prototype/domains/party/types.ts` enforces source-kind / target-kind constraints at append time via validatePayload; an attempt to assert `director-of` from an agent source, or `parent-of` between two counterparties, is rejected at the boundary. v0 kinds — Authority/representation (source: natural-person OR agent; target: any party): acts-on-behalf-of, signatory-of, authorised-trader-for, key-individual-of, employee-of, contractor-of. Governance/control (source: natural-person; target: legal-entity OR counterparty): director-of, ubo-of. Service/commercial (source: any party; target: any party): sponsor-bank-for, correspondent-bank-for, intermediary-for, external-counsel-to, auditor-of, intra-group-counterparty-of. Org structure (source: legal-entity; target: legal-entity): parent-of. Workforce/oversight (source: agent; target: agent OR natural-person): reports-to, subject-to-oversight-of. Personal network — PEP-relevant (source: natural-person; target: natural-person): spouse-of, parent-of-natural, business-associate-of.",
  comment:
    "Approved as the relationship-kind layer of the unified Party event family — paired with D-PARTY-REGISTER (same chat-intake, 2026-05-11).",
  sourceDoc: "Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-relationship-kinds-v0.md",
  asOf: "2026-05-11T04:16:09.000Z",
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
      recordedVia: "script:record-d-party-relationship-kinds-v0",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
