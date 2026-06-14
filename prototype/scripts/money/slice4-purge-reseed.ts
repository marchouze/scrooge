// scripts/money/slice4-purge-reseed.ts
//
// Slice 4 — Config-only purge + re-seed.
//
// HARD GATE: requires a "Pre-purge backup verified" RecordFiled event
// in the live store (produced by slice3-backup.ts).
//
// Steps:
//   A. Gate check — abort if backup RecordFiled not found.
//   B. Determine which event types are transactional (using provenance-category).
//   C. Log counts per type before purge.
//   D. Execute DELETE for transactional types + PRAGMA wal_checkpoint(TRUNCATE).
//   E. Log counts after.
//   F. Re-run CONFIG-ONLY seeds (no trade/position/settlement seeds).
//   G. Verify zero legacy LE identity in fresh store.
//   H. Print summary.
//
// Authority: D-MONEY-DECIMAL-BUILD-PROCEED, D-MONEY-DECIMAL-REDENOMINATION,
//            D-LEGAL-ENTITY-NAME-HOZ-BANK, D-CROSS-WORKTREE-EVENT-STORE-SYNC
// Brief: brief:atlas:money-slices-3-5-backup-config-only-purge-re-see:2026-06-13
// Run:   run:atlas:2026-06-13T17-44-17-260Z
// Author: Atlas (Core banking platform architect, engineering)

import "../../platform/event-store/resolve-event-db-boot";

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { Database } from "bun:sqlite";

import { eventStore } from "../../platform/composition";
import {
  PROVENANCE_CATEGORIES,
  categoryForEventType,
} from "../../platform/event-store/provenance-category";
import { resolveEventDbPath } from "../../platform/event-store/resolve-event-db";
import { findUncategorisedMoneyTypes } from "./money-bearing-detector";

// ---------------------------------------------------------------------------
// HARD GATE — abort if backup not verified
// ---------------------------------------------------------------------------
const BACKUP_RECORD_ID = "record:documents:atlas:pre-purge-backup-verified:2026-06-13";
const BACKUP_RECORD_TITLE = "Pre-purge backup verified";

console.log("[slice4-purge-reseed] HARD GATE: checking for pre-purge backup RecordFiled...");

const backupRecord = [...eventStore.replay({ type: "RecordFiled" })].find(
  (e) =>
    (e.payload as { recordId?: string }).recordId === BACKUP_RECORD_ID ||
    (e.payload as { metadata?: { title?: string } }).metadata?.title === BACKUP_RECORD_TITLE,
);

if (!backupRecord) {
  console.error(
    `[slice4-purge-reseed] ABORT: Pre-purge backup not verified. Run slice3-backup.ts first.\nExpected RecordFiled with recordId="${BACKUP_RECORD_ID}" or title="${BACKUP_RECORD_TITLE}" in the live event store.`,
  );
  process.exit(1);
}

console.log(
  `[slice4-purge-reseed] GATE PASSED: backup record found (event_id=${backupRecord.event_id})`,
);

// ---------------------------------------------------------------------------
// Step B: Identify transactional event types from the live store
// ---------------------------------------------------------------------------
const dbPath = resolveEventDbPath().path;
console.log(`[slice4-purge-reseed] Event store: ${dbPath}`);

// Transactional categories (from provenance-category.ts DEFAULT_CATEGORY_POLICY):
// These are the categories that default to "simulated" under the build-phase policy.
// Governance and build are "production" (retained). The rest are transactional.
const TRANSACTIONAL_CATEGORIES = new Set<string>([
  "trading",
  "accounting",
  "settlement",
  "market-data",
]);
// Note: "counterparty" types include PartyRegistered etc which are CONFIG seeds
// and must be RETAINED. "messaging" is also retained.
// We intentionally exclude "counterparty" from the purge.

// Open live store read-only to get the type list
const rawDb = new Database(dbPath, { readonly: true });

// Get all distinct event types in the store
const allTypesInStore = (
  rawDb.prepare("SELECT DISTINCT type FROM events ORDER BY type ASC").all() as Array<{
    type: string;
  }>
).map((r) => r.type);

// ---------------------------------------------------------------------------
// FAIL-CLOSED GUARD (WS-MONEY-DECIMAL-PURGE-REMEDIATION Wave 1)
//
// The classifier below is an ALLOW-LIST keyed on `categoryForEventType`. If a
// money-bearing transactional type is UNCATEGORISED (returns <none>), the old
// `else` branch silently routed it to `retainedTypes` — that is exactly how the
// slice-4 purge left 496 financial-transaction events in the canonical store
// (PR #1325). A retain-on-unknown allow-list is unsafe for a purge.
//
// We DERIVE "money-bearing" structurally from a sample payload per type (a
// legacy `*Minor` numeric key OR a `__money`/MoneyWire field at any depth). Any
// type that carries money but has NO provenance category ABORTS the purge with
// the offending list, rather than silently retaining (and orphaning) it. The
// detector is shared with the Wave-1 test (money-bearing-detector.ts).
// Authority: D-MONEY-DECIMAL-PURGE-REMEDIATION (be0580ff).
// ---------------------------------------------------------------------------
const uncategorisedMoneyTypes = findUncategorisedMoneyTypes(
  allTypesInStore,
  {
    // Sample a single payload per type — money encoding is per-type structural,
    // so the first event is representative. Cheap (one row), avoids a full scan.
    samplePayload(eventType: string): string | undefined {
      const row = rawDb
        .prepare("SELECT payload FROM events WHERE type = ? LIMIT 1")
        .get(eventType) as { payload?: string } | undefined;
      return row?.payload;
    },
  },
  categoryForEventType,
);

rawDb.close();

if (uncategorisedMoneyTypes.length > 0) {
  const offenderList = uncategorisedMoneyTypes.map((t) => `- ${t}`).join("\n  ");
  console.error(
    `[slice4-purge-reseed] ABORT (fail-closed): the following money-bearing event types carry a money field but have NO provenance category, so the purge allow-list would silently RETAIN (orphan) them. Categorise each in platform/event-store/provenance-category.ts (settlement | accounting | trading | market-data) before re-running the purge.\n  ${offenderList}\nAuthority: D-MONEY-DECIMAL-PURGE-REMEDIATION.`,
  );
  process.exit(1);
}

// Classify each type
const transactionalTypes: string[] = [];
const retainedTypes: string[] = [];

for (const t of allTypesInStore) {
  const cat = categoryForEventType(t);
  if (cat && TRANSACTIONAL_CATEGORIES.has(cat)) {
    transactionalTypes.push(t);
  } else {
    retainedTypes.push(t);
  }
}

console.log("\n[slice4-purge-reseed] Classification summary:");
console.log(`  Total distinct types in store: ${allTypesInStore.length}`);
console.log(`  Transactional (will purge):    ${transactionalTypes.length}`);
console.log(`  Retained (governance/config):  ${retainedTypes.length}`);

// ---------------------------------------------------------------------------
// Step C: Log counts per type before purge
// ---------------------------------------------------------------------------
const db = new Database(dbPath);

// Get counts per transactional type
console.log("\n[slice4-purge-reseed] Step C: Event counts before purge:");
const countsBefore: Record<string, number> = {};
let totalTransactionalBefore = 0;

for (const t of transactionalTypes) {
  const row = db.prepare("SELECT COUNT(*) AS n FROM events WHERE type = ?").get(t) as { n: number };
  const n = Number(row.n);
  countsBefore[t] = n;
  totalTransactionalBefore += n;
  console.log(`  [PURGE] ${t}: ${n} events`);
}

const totalBefore = (db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number }).n;
console.log(`\n  Total events in store (before purge): ${totalBefore}`);
console.log(`  Transactional events to purge:        ${totalTransactionalBefore}`);
console.log(`  Expected retained after purge:        ${totalBefore - totalTransactionalBefore}`);

// ---------------------------------------------------------------------------
// Step D: Execute purge + WAL checkpoint
// ---------------------------------------------------------------------------
console.log("\n[slice4-purge-reseed] Step D: Executing purge...");

if (transactionalTypes.length === 0) {
  console.log("[slice4-purge-reseed] No transactional types found — nothing to purge.");
} else {
  const placeholders = transactionalTypes.map(() => "?").join(", ");
  const purgeStmt = db.prepare(`DELETE FROM events WHERE type IN (${placeholders})`);

  const purgeTx = db.transaction(() => {
    purgeStmt.run(...(transactionalTypes as string[]));
  });

  purgeTx();
  console.log("[slice4-purge-reseed] DELETE executed.");

  // WAL checkpoint + TRUNCATE
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  console.log("[slice4-purge-reseed] WAL checkpoint(TRUNCATE) done.");
}

db.close();

// ---------------------------------------------------------------------------
// Step E: Log counts after deletion
// ---------------------------------------------------------------------------
const dbAfter = new Database(dbPath, { readonly: true });
const totalAfter = (dbAfter.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number }).n;
let residualTransactional = 0;
for (const t of transactionalTypes) {
  const row = dbAfter.prepare("SELECT COUNT(*) AS n FROM events WHERE type = ?").get(t) as {
    n: number;
  };
  residualTransactional += Number(row.n);
}
dbAfter.close();

console.log("\n[slice4-purge-reseed] After purge:");
console.log(`  Total events: ${totalAfter}`);
console.log(`  Residual transactional: ${residualTransactional} (expected: 0)`);

if (residualTransactional > 0) {
  console.error("[slice4-purge-reseed] ABORT: residual transactional events after purge!");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step F: Re-run CONFIG-ONLY seeds
// ---------------------------------------------------------------------------
console.log("\n[slice4-purge-reseed] Step F: Re-running config-only seeds...");

// Config seeds are idempotent scripts from the manifest.
// We run only the identity/config seeds — NOT capital injection, NOT SARB fixings (transactional).
// These seeds use entity "LE-ZA-HOZ-BANK" which is the correct canonical ID per D-LEGAL-ENTITY-NAME-HOZ-BANK.
const CONFIG_SEEDS = [
  "scripts/party-backfill.ts",
  "scripts/register-fleet.ts",
  "scripts/seed-bank-mode-policy.ts",
  "scripts/seed-ras-limits.ts",
  "scripts/seed-mr-1-fx-ras-schedule.ts",
  "scripts/seed-permission-policies.ts",
  "scripts/run-calc-model-seed.ts",
  "scripts/run-model-registry-seed.ts",
  "scripts/seed-financial-instruments.ts",
  "scripts/patch-bank-fx-attributes.ts",
  "scripts/seed-real-banks-kyc.ts",
  "scripts/seed-counterparty-eligibility.ts",
  "scripts/seed-fx-spot-controlled-launch-limits.ts",
];

// These are explicitly EXCLUDED (transactional / position seeds):
// - scripts/emit-capital-injection-sim.ts  (transactional postings)
// - scripts/bootstrap/seed-sarb-fixings.ts (OfficialMarkAdopted = market-data transactional)
// Market-data boot ingesters (zaronia, jibar, etc.) write to MarketDataStore not event store — safe.

const protoDir = resolve(import.meta.dir, "../..");
const bankEventDb = process.env.BANK_EVENT_DB;

for (const seed of CONFIG_SEEDS) {
  console.log(`  [seed] Running: ${seed}`);
  const result = spawnSync("bun", ["run", seed], {
    cwd: protoDir,
    env: { ...process.env, BANK_EVENT_DB: bankEventDb ?? "" },
    stdio: "pipe",
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? "";
    const stdout = result.stdout?.toString() ?? "";
    console.error(`  [seed] FAILED: ${seed}`);
    if (stdout) console.error(`    stdout: ${stdout.slice(0, 500)}`);
    if (stderr) console.error(`    stderr: ${stderr.slice(0, 500)}`);
    console.error("[slice4-purge-reseed] ABORT: seed script failed.");
    process.exit(1);
  }

  const stdout = result.stdout?.toString() ?? "";
  if (stdout.trim()) {
    console.log(`    -> ${stdout.trim().slice(0, 200)}`);
  }
  console.log(`  [seed] OK: ${seed}`);
}

// ---------------------------------------------------------------------------
// Step G: Verify zero legacy LE identity
// ---------------------------------------------------------------------------
console.log("\n[slice4-purge-reseed] Step G: Verifying zero legacy LE identity...");

const dbVerify = new Database(dbPath, { readonly: true });
const legacyRow = dbVerify
  .prepare(
    `SELECT count(*) AS n FROM events WHERE payload LIKE '%LE-BANK-SA%' OR payload LIKE '%BANK-ZA-001%'`,
  )
  .get() as { n: number };
const legacyCount = Number(legacyRow.n);
dbVerify.close();

if (legacyCount > 0) {
  console.error(
    `[slice4-purge-reseed] WARN: ${legacyCount} events in fresh store still reference legacy LE identities (LE-BANK-SA or BANK-ZA-001). These are in payload text — investigate.`,
  );
  // Note: LE-ZA-HOZ-BANK itself is the canonical id; legacy aliases should be zero.
  // This is a warn not abort because some governance prose may reference them historically.
} else {
  console.log("[slice4-purge-reseed] PASS: zero events reference legacy LE identities.");
}

// ---------------------------------------------------------------------------
// Step H: Summary
// ---------------------------------------------------------------------------
const dbFinal = new Database(dbPath, { readonly: true });
const finalCount = (dbFinal.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number }).n;
dbFinal.close();

// Get counts per seed event type (summary)
const seedTypesEmitted: Record<string, number> = {};
const dbSeedCheck = new Database(dbPath, { readonly: true });
for (const t of retainedTypes) {
  const row = dbSeedCheck.prepare("SELECT COUNT(*) AS n FROM events WHERE type = ?").get(t) as {
    n: number;
  };
  const n = Number(row.n);
  if (n > 0) seedTypesEmitted[t] = n;
}
dbSeedCheck.close();

console.log("\n=== SLICE 4 PURGE + RE-SEED SUMMARY ===");
console.log(`Events before purge:       ${totalBefore}`);
console.log(
  `Transactional types purged: ${transactionalTypes.length} types, ${totalTransactionalBefore} events`,
);
console.log(`Events after purge:         ${totalAfter}`);
console.log(`Events after re-seed:       ${finalCount}`);
console.log(`Legacy LE refs in store:    ${legacyCount} (expected: 0)`);
console.log(`\nPurged types (${transactionalTypes.length}):`);
for (const t of transactionalTypes) {
  console.log(`  - ${t}: ${countsBefore[t] ?? 0}`);
}
console.log("\nStatus: SUCCESS");
console.log("========================================\n");

process.exit(0);
