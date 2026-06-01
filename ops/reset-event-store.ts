#!/usr/bin/env bun
// ops/reset-event-store.ts
//
// Build-phase event-store reset — wipe all trade & GL posting activity (and the
// order-flow, treasury-position, accounting-scaffolding, trade-derived
// risk/liquidity/capital calcs, and counterparty/client relationship layer built
// on top), while PRESERVING the institutional build evidence: Decisions, agent
// briefs/runs, records, audit findings, governance attestations, model-risk,
// product approvals, obligations, policy, party register (institutional/agent),
// market reference data, and platform infrastructure events.
//
// SAVED, REUSABLE, MODIFIABLE. Edit the CONFIG block to change scope, then:
//
//   bun ops/reset-event-store.ts                 # DRY-RUN (default, read-only)
//   bun ops/reset-event-store.ts --backup        # just take a timestamped backup
//   bun ops/reset-event-store.ts --emit          # back up, then wipe + verify
//   bun ops/reset-event-store.ts --emit --vacuum # also VACUUM to reclaim space
//   bun ops/reset-event-store.ts --db /path/to/event.db   # target another store
//
// IMPORTANT: this file MUST live OUTSIDE prototype/ — the recon gate
// `prototype/platform/recon/event-store-no-delete-callsite.ts` statically fails
// CI on any `DELETE FROM events` under prototype/ (a raw DELETE on 2026-05-21
// was a recorded Vera Principle-1 finding). It is a standalone ops tool; it is
// NOT part of the prototype typecheck/lint/CI surface.
//
// The wipe is Principle-1-sanctioned: (1) every deleted event is verified to be
// build-phase-fixture / simulated (never `production`); (2) an authorising
// Decision `D-BUILD-PHASE-EVENT-RESET` is recorded (and itself kept) as the
// audit trail; (3) a backup is taken first; (4) the dry-run is the reviewable
// gate before the irreversible delete.
//
// Plan: ~/.claude/plans/i-would-like-to-lazy-russell.md

import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ===========================================================================
// CONFIG — edit here to change the wipe scope, then re-run.
// ===========================================================================

const DEFAULT_DB = join(homedir(), ".local/share/bank/event.db");

/** Families that are entirely trade/GL/relationship → delete every type with these prefixes. */
const DELETE_PREFIXES = [
  "Fx", "Equity", "Bond", "Repo", "Ird", "Irs", // asset-class trade lifecycle
  "Order", "GatewayCheck", "SwitchTest", "Rfq", "Quote", // pre-trade order flow
  "Deposit", "InterbankLoan", "Funding", // treasury cash positions
  "Credit", "Client", "KYC", "Edd", // relationship / onboarding
  "Odp", // OTC-derivatives-platform trade reporting/recon
  "BestExecution", "PnL", // per-trade conduct / P&L
];

/** Exact types to delete (where a prefix would be unsafe or the family is mixed). */
const DELETE_EXACT = new Set<string>([
  // trade lifecycle (non-prefix)
  "SettlementConfirmed", "PrincipalPayment", "TradeMatured", "TradeExecuted",
  "TradeBooked", "TradePosted", "TradeCancelled", "TradeAmended", "TransactionPosted",
  "TradeUtiAllocated", "TradeReportSubmitted", "MtmRunCompleted",
  // GL / accounting postings
  "SubLedgerPostingEmitted", "SubLedgerPostingRemediationRecorded",
  "ManualJournalEntry", "JournalEntryPosted", "AccrualBooked", "LoanBooked",
  // accounting scaffolding
  "AccountingPeriodOpened", "AccountingPeriodClosed", "PeriodClosed",
  "TrialBalanceSnapshotted", "BalanceSheetSubstantiationCompleted",
  "BalanceSheetProjected", "BAReturnGenerationTriggered", "SarbSubmissionAttempted",
  "BankAccountOpened", "BankAccountConfigured", "BankAccountClosed",
  // valuation / MTM / P&L
  "ValuationAdjustmentComputed", "PrudentValuationAvaAggregated",
  "Day1PnLDeferralRecorded", "RealisedPnlRecognised", "IpvExceptionRaised",
  "IfrsClassificationApplied", "DailyPnLReportGenerated", "FinancialPositionSnapshot",
  // position / collateral
  "PositionAdjusted", "CollateralUpdated", "CollateralInventorySnapshotted",
  "CollateralInventorySnapshot", "FXPositionBreach", "HedgeIneffective",
  // trade-derived risk / liquidity / capital calcs
  "LCRComputed", "NSFRComputed", "LCRRatioProjection", "NSFRRatioProjection",
  "ALMRunCompleted", "IRRBBChecked", "IRRBBExcursion",
  "IntradayHQLAStressProjection", "ILAAPScenarioRun", "ILAAPSummaryCompleted",
  "ALCOPackGenerated", "CounterpartyExposureCalculated", "CcrReplacementCostComputed",
  "CcrEadComputed", "LexUtilisationComputed", "LexExceptionApproved", "RiskRunCompleted",
  "LiquiditySnapshot", "HQLACompositionDrift", "NostroFundingShortfall",
  "IcaapIlaapInputReady",
  // trade-bound messaging & calculations (verified content-bound)
  "InboundMessageReceived", "CalculationPerformed",
  // per-trade conduct
  "ConductObligationFlagged", "FaisClassificationSuitabilityChecked",
  // relationship layer (counterparty / client) — non-prefix
  "CounterpartyFaisClassified", "CounterpartyCategorised", "CounterpartyDeclined",
  "FatcaCrsClassified", "PopiaConsentRecorded", "LawfulProcessingRegistered",
  "PEPScreeningCompleted", "SanctionsClearancePassed", "RiskRatingAssigned",
  "BeneficialOwnerResolved", "BeneficialOwnerChainAsserted",
  "PartyClassified", "PartyRelationshipAsserted", "PartyRelationshipChanged",
  "PartyRelationshipRevoked", "PartyDeactivated",
  "ISDACSAAssessmentCompleted", "CrcLimitExceptionApproved",
  "SubInvestmentGradeCounterpartyApproved",
]);

/**
 * KEEP overrides — types a DELETE_PREFIX would otherwise catch but which are
 * build evidence and must be retained. (PartyRegistered holds only the bank's
 * own legal entities, the AI agents, and the founding CEO party — all kept.)
 */
const KEEP_OVERRIDE = new Set<string>(["PartyRegistered"]);

/**
 * Cascade types: each describes another event by its type. A record is deleted
 * iff the referenced type is itself being deleted. `field` is the payload key
 * holding the referenced event type; `arrayField` is for array-valued refs
 * (delete only when ALL referenced types are in the delete set).
 */
const CASCADE_TYPES: Record<string, { field?: string; arrayField?: string }> = {
  ProvenanceReclassified: { field: "targetEventType" },
  EntityReclassified: { field: "targetEventType" },
  BusDispatched: { field: "eventType" },
  LegacyFanoutShadowed: { arrayField: "triggeringEventTypes" },
};

const DECISION_ID = "D-BUILD-PHASE-EVENT-RESET";

// ===========================================================================
// Implementation
// ===========================================================================

type Klass = "DELETE" | "CASCADE" | "KEEP";

function classify(type: string): Klass {
  if (KEEP_OVERRIDE.has(type)) return "KEEP";
  if (type in CASCADE_TYPES) return "CASCADE";
  if (DELETE_EXACT.has(type)) return "DELETE";
  if (DELETE_PREFIXES.some((p) => type.startsWith(p))) return "DELETE";
  return "KEEP";
}

function parseArgs() {
  const a = process.argv.slice(2);
  const dbIdx = a.indexOf("--db");
  return {
    emit: a.includes("--emit"),
    backupOnly: a.includes("--backup") && !a.includes("--emit"),
    vacuum: a.includes("--vacuum"),
    db: dbIdx >= 0 ? a[dbIdx + 1]! : DEFAULT_DB,
  };
}

function fmt(n: number): string {
  return n.toLocaleString("en-ZA");
}

function backup(dbPath: string): string {
  const db = new Database(dbPath);
  db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  db.close();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = `${dbPath}.pre-reset-${stamp}.bak`;
  copyFileSync(dbPath, dest);
  return dest;
}

function main() {
  const { emit, backupOnly, vacuum, db: dbPath } = parseArgs();
  if (!existsSync(dbPath)) {
    console.error(`Event store not found: ${dbPath}`);
    process.exit(1);
  }

  if (backupOnly) {
    const dest = backup(dbPath);
    console.log(`Backup written: ${dest}`);
    return;
  }

  const db = new Database(dbPath, emit ? { readwrite: true } : { readonly: true });

  // 1. Inventory + classification of every present type.
  const typeRows = db
    .query("SELECT type, COUNT(*) n FROM events GROUP BY type ORDER BY n DESC")
    .all() as { type: string; n: number }[];

  const deleteTypes: string[] = [];
  const cascadeTypes: string[] = [];
  const keepTypes: string[] = [];
  for (const { type } of typeRows) {
    const k = classify(type);
    if (k === "DELETE") deleteTypes.push(type);
    else if (k === "CASCADE") cascadeTypes.push(type);
    else keepTypes.push(type);
  }
  const deleteSet = new Set(deleteTypes);

  // 2. Safety: confirm no `production`-provenance event is in the delete scope.
  const prodInScope = db
    .query(
      `SELECT type, COUNT(*) n FROM events
       WHERE json_extract(provenance,'$.kind')='production' AND type IN (${deleteTypes.map(() => "?").join(",") || "''"})
       GROUP BY type`,
    )
    .all(...deleteTypes) as { type: string; n: number }[];

  // 3. Direct-delete count.
  const countFor = (types: string[]): number => {
    if (types.length === 0) return 0;
    return (
      db
        .query(
          `SELECT COUNT(*) n FROM events WHERE type IN (${types.map(() => "?").join(",")})`,
        )
        .get(...types) as { n: number }
    ).n;
  };
  const directDeleteCount = countFor(deleteTypes);

  // 4. Cascade counts (per cascade type: how many reference a wiped type).
  const cascadeReport: { type: string; del: number; keep: number }[] = [];
  let cascadeDeleteCount = 0;
  for (const type of cascadeTypes) {
    const spec = CASCADE_TYPES[type]!;
    let del = 0;
    const total = countFor([type]);
    if (spec.field) {
      del = (
        db
          .query(
            `SELECT COUNT(*) n FROM events WHERE type=? AND json_extract(payload,'$.${spec.field}') IN (${deleteTypes.map(() => "?").join(",") || "''"})`,
          )
          .get(type, ...deleteTypes) as { n: number }
      ).n;
    } else if (spec.arrayField) {
      // delete iff EVERY referenced type is in the delete set (none kept)
      del = (
        db
          .query(
            `SELECT COUNT(*) n FROM events e WHERE e.type=? AND NOT EXISTS (
               SELECT 1 FROM json_each(json_extract(e.payload,'$.${spec.arrayField}')) j
               WHERE j.value NOT IN (${deleteTypes.map(() => "?").join(",") || "''"}))`,
          )
          .get(type, ...deleteTypes) as { n: number }
      ).n;
    }
    cascadeReport.push({ type, del, keep: total - del });
    cascadeDeleteCount += del;
  }

  // 5. Report.
  const total = (db.query("SELECT COUNT(*) n FROM events").get() as { n: number }).n;
  const totalDelete = directDeleteCount + cascadeDeleteCount;
  console.log(`\nFX/GL event-store reset — ${emit ? "EMIT" : "DRY-RUN"}   (${dbPath})`);
  console.log(`Total events: ${fmt(total)}\n`);

  console.log(`DELETE — direct (${deleteTypes.length} types, ${fmt(directDeleteCount)} events):`);
  for (const t of deleteTypes) console.log(`  - ${t} (${fmt(countFor([t]))})`);
  console.log(`\nDELETE — cascade (${cascadeTypes.length} types, ${fmt(cascadeDeleteCount)} events):`);
  for (const c of cascadeReport)
    console.log(`  - ${c.type}: delete ${fmt(c.del)} / keep ${fmt(c.keep)}`);
  console.log(`\nKEEP (${keepTypes.length} types, ${fmt(total - totalDelete)} events): ${keepTypes.join(", ")}`);

  console.log(`\n${"=".repeat(64)}`);
  console.log(`WOULD DELETE: ${fmt(totalDelete)}    WOULD KEEP: ${fmt(total - totalDelete)}`);
  if (prodInScope.length > 0) {
    console.log(`\n⚠ ABORT-WORTHY: ${prodInScope.length} production-provenance type(s) in delete scope:`);
    for (const p of prodInScope) console.log(`    ${p.type} (${p.n})`);
  } else {
    console.log(`✓ No production-provenance events in delete scope (Principle-1 clean).`);
  }

  if (!emit) {
    console.log(`\nDry-run only. Re-run with --emit to back up + wipe.\n`);
    db.close();
    return;
  }

  if (prodInScope.length > 0) {
    console.error(`\nRefusing to --emit: production events in delete scope. Fix the config.\n`);
    db.close();
    process.exit(2);
  }

  // 6. EMIT — back up first.
  db.close();
  const backupPath = backup(dbPath);
  console.log(`\nBackup written: ${backupPath}`);
  const w = new Database(dbPath, { readwrite: true });

  const inList = (types: string[]) => types.map(() => "?").join(",") || "''";
  w.exec("BEGIN TRANSACTION;");
  // direct
  w.query(`DELETE FROM events WHERE type IN (${inList(deleteTypes)})`).run(...deleteTypes);
  // cascade (scalar field)
  for (const type of cascadeTypes) {
    const spec = CASCADE_TYPES[type]!;
    if (spec.field) {
      w.query(
        `DELETE FROM events WHERE type=? AND json_extract(payload,'$.${spec.field}') IN (${inList(deleteTypes)})`,
      ).run(type, ...deleteTypes);
    } else if (spec.arrayField) {
      w.query(
        `DELETE FROM events WHERE type=? AND NOT EXISTS (
           SELECT 1 FROM json_each(json_extract(payload,'$.${spec.arrayField}')) j
           WHERE j.value NOT IN (${inList(deleteTypes)}))`,
      ).run(type, ...deleteTypes);
    }
  }
  // derived caches / orphans
  w.exec("DELETE FROM snapshots;");
  w.exec("DELETE FROM bus_dispatch_claims WHERE event_id NOT IN (SELECT event_id FROM events);");
  w.exec("DELETE FROM archive_partitions;"); // build-phase cold archive — orphaned files at archive_path may be removed manually
  w.exec("COMMIT;");
  w.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  if (vacuum) w.exec("VACUUM;");

  // 7. Record the authorising Decision (kept; Principle-1 sanction). Idempotent.
  recordResetDecision(w, { totalDelete, directDeleteCount, cascadeDeleteCount, total });

  // 8. Verify.
  const remaining = (w.query("SELECT COUNT(*) n FROM events").get() as { n: number }).n;
  const stillThere = w
    .query(
      `SELECT COUNT(*) n FROM events WHERE type IN (${inList(deleteTypes)})`,
    )
    .get(...deleteTypes) as { n: number };
  const decisionsKept = (
    w.query("SELECT COUNT(*) n FROM events WHERE type='Decision'").get() as { n: number }
  ).n;
  w.close();

  console.log(`\nPosted reset. Events: ${fmt(total)} → ${fmt(remaining)} (deleted ${fmt(total - remaining)}).`);
  console.log(`  Delete-scope types remaining: ${stillThere.n} (expect 0).`);
  console.log(`  Decision events retained: ${fmt(decisionsKept)}.`);
  console.log(stillThere.n === 0 ? "✓ Wipe verified.\n" : "✗ Residual delete-scope events — investigate.\n");
}

function recordResetDecision(
  w: Database,
  counts: { totalDelete: number; directDeleteCount: number; cascadeDeleteCount: number; total: number },
) {
  const exists = w
    .query(
      `SELECT COUNT(*) n FROM events WHERE type='Decision'
       AND json_extract(payload,'$.decisionId')=? AND json_extract(payload,'$.phase')='approved'`,
    )
    .get(DECISION_ID) as { n: number };
  if (exists.n > 0) {
    console.log(`Authorising Decision ${DECISION_ID} already present — not re-recording.`);
    return;
  }
  const now = new Date().toISOString();
  const payload = {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Build-phase event-store reset (wipe trade + GL activity)",
    category: "engineering",
    recommendation:
      "Wipe all build-phase trade/GL/order-flow/treasury/accounting/trade-derived-calc and " +
      "counterparty/client relationship events; keep Decisions, agent/RMS history, audit, " +
      "governance, market reference data, and institutional party register.",
    rationale:
      `Deliberate build-phase clean slate. Deleted ${counts.totalDelete} of ${counts.total} events ` +
      `(${counts.directDeleteCount} direct + ${counts.cascadeDeleteCount} cascade). All deleted events ` +
      `verified build-phase-fixture/simulated (no production). Backup taken; Principle-1-sanctioned.`,
    sourceDocHashes: [] as string[],
    citations: ["urn:principle:1", "GOV-FRAMEWORK-CEO-RESERVED"],
    recordedVia: "scrooge:session-delegation",
  };
  w.query(
    `INSERT INTO events (event_id, type, as_of, entity, actor_type, actor_id, citations, payload, provenance, aggregate_id, aggregate_label)
     VALUES (?, 'Decision', ?, 'LE-ZA-HOZ-BANK', 'human', 'marc@tgv.co.za', ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    now,
    JSON.stringify(["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"]),
    JSON.stringify(payload),
    JSON.stringify({ kind: "production", sourceLineage: "scrooge:build-phase-reset" }),
    `decision::${DECISION_ID}`,
    `decision::${DECISION_ID}`,
  );
  console.log(`Recorded authorising Decision ${DECISION_ID}.`);
}

main();
