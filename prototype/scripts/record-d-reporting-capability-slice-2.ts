// scripts/record-d-reporting-capability-slice-2.ts
//
// One-shot: emit a CeoDecision event for D-REPORTING-CAPABILITY-SLICE-2 —
// the period-close event family + orchestration helper that Slice 3
// (BA 110 LCR generator harness) and downstream BA-form / IFRS-statement
// generators consume.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-
// approved 2026-05-10). This script records the slice-2 sub-authorisation
// so the audit trail names it explicitly. No new CEO approval required
// per CLAUDE.md "Dispatch discipline" no-pause rule.
//
// Run once; idempotent (skips ids already recorded).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; close orchestration owner) · Atlas (Core
//   banking platform architect, engineering — substrate consult).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-REPORTING-CAPABILITY-SLICE-2",
  action: "approve" as const,
  title:
    "Reporting capability Slice 2 — period-close event family + orchestration (@platform/accounting/period-close)",
  outcome:
    "Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO; close orchestration owner) ships the period-close substrate atomically: three new event types (AccountingPeriodOpened / AccountingPeriodClosed / TrialBalanceSnapshotted) with typed Zod payload schemas + make…() constructors + RETENTION_ACCOUNTING_7Y (Companies Act 71/2008 s.24); per-entity orchestration helper at @platform/accounting/period-close (openPeriod / computeTrialBalance / closePeriod / periodCloseStreamKey / periodAuditChain). closePeriod runs a five-step transaction — TB compute over M1 SubLedgerPostingEmitted, optional RMS document-store write (BLAKE3 content-addressed per RMS Slice 1 / PR #142), TrialBalanceSnapshotted append with per-currency balanced-totals enforced (debits = credits per currency at construction; rows-vs-totals invariant asserted), EvSS Slice 2 snapshot under per-entity stream-key `<entity>|accounting-period` (per pack §6 Q2 + D-EVENT-STORE-SCALING Slice 2 Q4), AccountingPeriodClosed referencing the snapshot event_id + optional document hash. Reopen handled per Principle 1 — corrections-after-close append a new AccountingPeriodOpened with reopenOf + reopenReason chain rather than overwriting the prior close (forensic audit chain readable via periodAuditChain). 29 unit tests cover registry coverage, Zod boundary validation (period-date inversion, reopen-without-reason, per-currency unbalanced totals, rows-vs-totals mismatch), openPeriod idempotency + closed-period rejection, closePeriod end-to-end with doc-store hash propagation + per-entity snapshot stream isolation, reopen-then-reclose forensic audit chain, trial-balance window filtering + zero-net row drop. Provenance discipline (D-DATA-PROVENANCE-SUBSTRATE) — orchestrator is provenance-agnostic; callers attach productionTag for production close, simulatedTag for dry-run / scenario close. Substrate gaps surfaced for downstream slices: chart-of-accounts coverage (M1 stub leaf account IDs flow through TB unchanged — Bea M1 substrate-gap §3, target M2; trial-balance row regex relaxed to ACC-[A-Za-z0-9-]+ for forward-compat); IFRS statement renderer (Slice 6+ — TrialBalanceSnapshotted.rows is the input contract); BA 110 / BA-form generators (Slice 3+ on top of EvSS Slice 2 snapshot APIs); concurrency control (single-writer per (entity, periodId) assumed; multi-writer guard is a Vera follow-on recon). M8 Azure mapping: snapshot substrate already lift-compatible via D-EVENT-STORE-SCALING Slice 2 (Cosmos DB Core SQL collection partitioned on streamKey); document-store lift to Azure Blob + Managed-HSM envelope per RMS spec §4.1. No changes to event-store/store.ts (snapshot APIs consumed as-is), permission-gate.ts, runtime/handlers, or dashboard/derive.ts (respect parallel work).",
  comment:
    "downstream dispatch from D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 2; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_bea-atlas_d-reporting-capability-slice-2-period-close.md",
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
      recordedVia: "script:record-d-reporting-capability-slice-2",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
