// scripts/record-d-t-01-permission-gate-secure-default.ts
//
// One-shot: emit a CeoDecision event for D-T-01-PERMISSION-GATE-SECURE-
// DEFAULT — the substrate change that flips the event-store permission
// gate to secure-by-default (env-var rename + opt-out + legacy backfill
// allow-list per Senna+Rashida threat model T-01 Critical).
//
// Standing authority: S8 agent-runtime substrate + Principle 4 (security
// designed in). Per CLAUDE.md "Dispatch discipline" no-pause rule,
// substrate Critical-mitigation slices route under standing authority
// without per-item CEO approval. This script records the substrate
// change under that umbrella.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Atlas (Core banking platform architect, engineering — substrate
//   change). Threat-model source: Senna (Security & cryptography engineer,
//   engineering) · Rashida (Cloud security & resilience architect,
//   engineering) — Owner Inbox/2026-05-10_senna-rashida_agent-runtime-
//   substrate-threat-model.md T-01.

import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-T-01-PERMISSION-GATE-SECURE-DEFAULT",
  action: "approve" as const,
  title:
    "Permission gate now secure-by-default — BANK_PERMISSION_GATE_DISABLED opt-out + LEGACY_PRE_A1_EVENT_TYPES backfill (D-T-01-PERMISSION-GATE-SECURE-DEFAULT)",
  outcome:
    "Atlas (Core banking platform architect, engineering) closes T-01 critical from the Senna+Rashida agent-runtime substrate threat model: (1) renames BANK_PERMISSION_GATE_ENABLED → BANK_PERMISSION_GATE_DISABLED with semantic flip — gate is now ON by default; opt-out only via explicit BANK_PERMISSION_GATE_DISABLED=true. (2) Adds LEGACY_PRE_A1_EVENT_TYPES — a frozen 2026-05-10 snapshot of every event type emitted across prototype/platform/, prototype/runtime/, prototype/scenarios/, prototype/scripts/, prototype/tests/. The gate bypasses enforcement for actors that have no PermissionPolicyPublished event yet AND whose event type is on this list, emitting a low-severity SubstrateAlert (alertClass: integrity) per (agentUrn, eventType) pair to record each bypass. Once an agent publishes a policy, the policy becomes canonical and out-of-list emit is hard-denied even when the type is on the legacy list. New event types added after 2026-05-10 must NOT be added to the legacy list — they must appear in the emitting agent's eventEmitAllowList from day one (a future Vera recon:permission-gate-default will assert this snapshot is closed-set). (3) Tests updated: 5 new env-var-default tests + 4 new legacy-backfill behaviour tests + decideAppend test split + existing 'flag off' rewired through new forceDisabled config option; full suite 793/793 pass. (4) Composition root composition.ts adopts the new default; no onLegacyBypass override (lets the canonical typed SubstrateAlert emit per Principle 1). T-02..T-12 from the same threat model remain open and tracked in the decision record §6.",
  comment:
    "downstream substrate dispatch from S8 + Principle 4 standing authority; no new policy decision; closes Critical T-01 from Senna+Rashida 2026-05-10 threat model",
  sourceDoc: "Owner Inbox/2026-05-10_atlas_t-01-permission-gate-secure-default.md",
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
      recordedVia: "script:record-d-t-01-permission-gate-secure-default",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
