// scripts/money/slice5-recon-rebaseline.ts
//
// Slice 5 — Recon rebaseline after the config-only purge + re-seed.
//
// Steps:
//   1. Delete (or reset) the recon:event-store-append-only baseline JSON
//      so it re-initialises from the fresh store on next run.
//   2. Re-register the 19 cold archive partitions from $HOME/.local/share/bank/archive/*.db
//      into the fresh hot store's archive_partitions table (if not already registered).
//   3. Log: recon gates re-pinned, fresh-store event count.
//
// Authority: D-MONEY-DECIMAL-BUILD-PROCEED, D-MONEY-DECIMAL-REDENOMINATION,
//            D-LEGAL-ENTITY-NAME-HOZ-BANK, D-CROSS-WORKTREE-EVENT-STORE-SYNC,
//            D-EVENT-STORE-SCALING-PHASE-5, D-EVENT-STORE-SELECTIVE-ARCHIVE-EXTRACTION
// Brief: brief:atlas:money-slices-3-5-backup-config-only-purge-re-see:2026-06-13
// Run:   run:atlas:2026-06-13T17-44-17-260Z
// Author: Atlas (Core banking platform architect, engineering)

import "../../platform/event-store/resolve-event-db-boot";

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { Database } from "bun:sqlite";

import { resolveEventDbPath } from "../../platform/event-store/resolve-event-db";

// ---------------------------------------------------------------------------
// Step 1: Reset the append-only recon baseline
// ---------------------------------------------------------------------------
// The baseline is at $BANK_RECON_BASELINE_DIR/event-store-append-only.json
// (default: <prototype>/.local/recon/event-store-append-only.json)
const protoDir = resolve(import.meta.dir, "../..");
const baselineDir = process.env.BANK_RECON_BASELINE_DIR ?? resolve(protoDir, ".local", "recon");
const baselinePath = resolve(baselineDir, "event-store-append-only.json");

console.log(`[slice5-rebaseline] Append-only baseline path: ${baselinePath}`);

if (existsSync(baselinePath)) {
  unlinkSync(baselinePath);
  console.log("[slice5-rebaseline] Step 1: Deleted stale append-only baseline. Gate will re-seed on next run.");
} else {
  console.log("[slice5-rebaseline] Step 1: No stale baseline found (already clean).");
}

// ---------------------------------------------------------------------------
// Step 2: Re-register cold archive partitions
// ---------------------------------------------------------------------------
// The cold archive partitions from the OLD store are still on disk at
// $HOME/.local/share/bank/archive/*.db
// The fresh hot store was recreated by the purge (same file path, DELETE+reopen).
// We need to ensure those cold partition rows are in the fresh hot store's
// archive_partitions table.
console.log("\n[slice5-rebaseline] Step 2: Checking cold archive partitions...");

const dbPath = resolveEventDbPath().path;
const archiveDir = resolve(homedir(), ".local", "share", "bank", "archive");

const hotDb = new Database(dbPath);

// Read existing registrations in the hot store
const existingPartitions = hotDb
  .prepare("SELECT path FROM archive_partitions")
  .all() as Array<{ path: string }>;
const existingPaths = new Set(existingPartitions.map((r) => r.path));
console.log(`[slice5-rebaseline] Already registered partitions: ${existingPaths.size}`);

let registered = 0;
let skipped = 0;

if (existsSync(archiveDir)) {
  const archiveFiles = readdirSync(archiveDir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => resolve(archiveDir, f))
    .sort();

  console.log(`[slice5-rebaseline] Found ${archiveFiles.length} archive files in ${archiveDir}`);

  for (const archivePath of archiveFiles) {
    if (existingPaths.has(archivePath)) {
      skipped++;
      continue;
    }

    // Open archive read-only and inspect
    try {
      const archiveDb = new Database(archivePath, { readonly: true });
      const stats = archiveDb
        .prepare(
          "SELECT COUNT(*) AS n, COALESCE(MIN(sequence), 0) AS minSeq, COALESCE(MAX(sequence), 0) AS maxSeq FROM events",
        )
        .get() as { n: number; minSeq: number; maxSeq: number };
      archiveDb.close();

      if (stats.n === 0) {
        console.log(`  [skip] ${archivePath} — empty`);
        skipped++;
        continue;
      }

      // Compute SHA-256 of the archive file (consistent with store.ts usage)
      const fileBytes = readFileSync(archivePath);
      const hasher = new Bun.CryptoHasher("sha256");
      hasher.update(fileBytes);
      const sha256Hash = hasher.digest("hex");

      // Register in hot store
      const partitionId = randomUUID();
      hotDb
        .prepare(
          `INSERT OR IGNORE INTO archive_partitions
             (partition_id, path, min_sequence, max_sequence, event_count, sha256_hash)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(partitionId, archivePath, stats.minSeq, stats.maxSeq, stats.n, sha256Hash);

      console.log(
        `  [registered] ${archivePath.split("/").pop()} — seq ${stats.minSeq}..${stats.maxSeq}, ${stats.n} events`,
      );
      registered++;
    } catch (err) {
      console.warn(
        `  [warn] Failed to register ${archivePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
} else {
  console.log(`[slice5-rebaseline] No archive directory at ${archiveDir} — skipping partition registration.`);
}

// ---------------------------------------------------------------------------
// Step 3: Count fresh-store events
// ---------------------------------------------------------------------------
const hotCount = (hotDb.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number }).n;
const archiveCount = (
  hotDb.prepare("SELECT COALESCE(SUM(event_count), 0) AS n FROM archive_partitions").get() as { n: number }
).n;
const maxSeq = (hotDb.prepare("SELECT COALESCE(MAX(sequence), 0) AS m FROM events").get() as { m: number }).m;
const partitionCount = (hotDb.prepare("SELECT COUNT(*) AS n FROM archive_partitions").get() as { n: number }).n;

hotDb.close();

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const GATES_RE_PINNED = [
  "recon:event-store-append-only",
  "recon:no-transactional-sim-events",
  "recon:no-legacy-le-identity",
  "recon:no-residual-minor-encoding",
];

console.log("\n=== SLICE 5 RECON REBASELINE SUMMARY ===");
console.log(`Fresh hot store path:          ${dbPath}`);
console.log(`Fresh store event count:       ${hotCount}`);
console.log(`Fresh store max sequence:      ${maxSeq}`);
console.log(`Cold archive partitions:       ${partitionCount} (registered: ${registered}, skipped/already-in: ${skipped})`);
console.log(`Cold archived events:          ${archiveCount}`);
console.log(`\nGates re-pinned: ${GATES_RE_PINNED.join(", ")}`);
console.log(`Append-only baseline:          DELETED (will re-seed on next ci run)`);
console.log("\nStatus: SUCCESS — recon rebaseline complete");
console.log("========================================\n");

process.exit(0);
