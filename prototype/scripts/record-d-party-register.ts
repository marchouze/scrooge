// scripts/record-d-party-register.ts
//
// One-shot: emit a CeoDecision event for D-PARTY-REGISTER — the unified
// Party event family covering all four actor kinds (natural-person,
// legal-entity, counterparty, agent) under a single discriminated
// PartyRegistered event with kind-specific kindAttributes.
//
// Standing authority: Standing CEO authority over substrate architecture
// (Principles 1, 2, 5, 6 in CLAUDE.md). Closes the Principle 6 orphan that
// natural-person free-string references currently create.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Scrooge (Chief of Staff / Orchestrator)

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-PARTY-REGISTER",
  action: "approve" as const,
  title:
    "Unified Party event family — single identity axis across natural persons, legal entities, counterparties, and agents",
  outcome:
    "Establish a unified Party event family in `prototype/domains/party/` covering all four actor kinds (natural-person, legal-entity, counterparty, agent) under a single discriminated PartyRegistered event with kind-specific kindAttributes. Identity-axis events (registration, attribute change, classification, screening, deactivation) are unified; kind-specific business events (KYC tier, intra-group arrangement, mandate, agent dispatch) stay in their existing domains and reference Party URNs as foreign keys. Existing registration event types (LegalEntityRegistered, CounterpartySoundingOpened, CounterpartyProspectRegistered, agentRegistered, AuthorisedSignatoryAdded/Removed, CounterpartyActivated, CounterpartyOffboarded) are deprecated; legacy events keep replaying; idempotent boot-time backfill emits PartyRegistered shadow events keyed to source-event IDs (per feedback_phase0_record_to_event_backfill.md). PII discipline: PII-grade fields (DOB, ID number, residential address, ID-doc scan, source-of-funds) live in the BLAKE3 doc store with the event holding only the doc hash (Principle 4 + POPIA s.19–22). The intrinsic kind vs relational role distinction is binding: kind describes what the actor is and is stable; signatory-of / acts-on-behalf-of / director-of / ubo-of are typed PartyRelationshipAsserted edges. Build-phase data scope: substrate is built now; only Marc (CEO seat), directors as fit-and-proper clears, signatories on counterparties past KYC, and the licence-day statutory-minimum humans get registered as data before licence-day. Sade's HR slice and Niko's customer onboarding stay paused per their buildPhaseStatus.",
  comment:
    'AskUserQuestion 2026-05-11: "Unified Party event family" + "Include as Party (Recommended)"; plan exited approved with one user edit clarifying the worked example for counterparty-acting-through-humans-plus-external-agent.',
  sourceDoc:
    "Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register.md",
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
      recordedVia: "script:record-d-party-register",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
