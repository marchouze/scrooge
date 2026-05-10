// scripts/record-d-reporting-capability-slice-1.ts
//
// One-shot: emit a CeoDecision event for D-REPORTING-CAPABILITY-SLICE-1 —
// the semantic-layer registry skeleton that Slice 2 (period-close events)
// and Slice 3 (BA 325 LCR generator harness) consume.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-
// approved 2026-05-10). This script records the slice-1 sub-authorisation
// so the audit trail names it explicitly. Slices 2-3 dispatch via their
// own sub-decisions under the same standing authority.
//
// Run once; idempotent (skips ids already recorded).
//
// Authors: Anya (Data / analytics engineer, engineering — reports to Devon
//   COO; semantic-layer + projection-runtime curator)

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-REPORTING-CAPABILITY-SLICE-1",
  action: "approve" as const,
  title: "Reporting capability Slice 1 — semantic-layer registry skeleton (@platform/semantic)",
  outcome:
    "Anya (Data / analytics engineer, engineering — reports to Devon COO; semantic-layer + projection-runtime curator)'s Slice 1 semantic-layer registry approved as drafted under standing D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN authority. New @platform/semantic package lands the typed SemanticEntry shape (id / version / units / dimensions / projection / formula / regulatoryCells / ifrsLines / citations / signers / entityScope / status), an append-only-versioned in-memory SemanticRegistry with structural-invariant enforcement (P2 citation, P5 multi-entity URN, single-in-force-version-per-id, supersession integrity), and three worked entries — Balance (multi-account multi-currency multi-classification), Exposure (counterparty / kind / currency, one TBC placeholder per pack §9 Q1 default), CashAndBalancesAtSARB (pinned to chart-of-accounts ACC-1100-001 with full upward chain to ORG-PR-06 BCBS D295 + ORG-AC-01 IFRS 9 + IAS 1 §54(i), zero placeholders). 27 unit tests cover construction / lookup / versioning / structural invariants / pack §6 Slice 1 acceptance. M8 Azure mapping: registry swaps to Cosmos DB Core with partition-key {entryId} + point-in-time-restore for as-of queries; SemanticEntry shape unchanged (Principle 3 architectural seam mirrors @platform/event-store cloud-lift pattern). Substrate gaps remaining for downstream slices: SemanticEntryRegistered event family (deferred to Slice 2 to batch with period-close A0 freeze cycle), recon:semantic-layer-citation-coverage pipeline (deferred to follow-on dispatch to avoid @platform/recon shared-infrastructure clash per feedback_handlers_metadata_three_way_clash), gl-projection + exposure-projection executable forms (Slice 4-6 M2-M3 substrate). No changes to event-types.ts, registry.ts, projections/runtime.ts, or dashboard/derive.ts (respect parallel work).",
  comment:
    "downstream dispatch from D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 1; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_anya_reporting-capability-m2-m3-slice-1-semantic-layer.md",
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
      recordedVia: "script:record-d-reporting-capability-slice-1",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
