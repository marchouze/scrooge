// scripts/money/slice3-backup.ts
//
// Slice 3 — Pre-purge backup. PRECONDITION TO slice4-purge-reseed.ts.
//
// Steps:
//   1. Resolve the live event-store DB path.
//   2. Compute backup filename: $HOME/.local/share/bank/backups/pre-purge-<timestamp>.db
//   3. VACUUM INTO to take an online, consistent backup (never fs.copyFile).
//   4. Compute BLAKE3 hash of the backup file.
//   5. Verify round-trip: open read-only, PRAGMA integrity_check, count rows.
//   6. Confirm archive files exist (list, do NOT delete).
//   7. File RecordFiled in the LIVE store (title: "Pre-purge backup verified").
//   8. Print summary; exit 0 on success, exit 1 on any failure.
//
// Authority: D-MONEY-DECIMAL-BUILD-PROCEED, D-MONEY-DECIMAL-REDENOMINATION,
//            D-LEGAL-ENTITY-NAME-HOZ-BANK, D-CROSS-WORKTREE-EVENT-STORE-SYNC
// Brief: brief:atlas:money-slices-3-5-backup-config-only-purge-re-see:2026-06-13
// Run:   run:atlas:2026-06-13T17-44-17-260Z
// Author: Atlas (Core banking platform architect, engineering)

import "../../platform/event-store/resolve-event-db-boot";

import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { Database } from "bun:sqlite";

import { hashContent } from "../../platform/document-store/hash";
import { resolveEventDbPath } from "../../platform/event-store/resolve-event-db";
import { recordFiled } from "../../platform/records";

const ACTOR = {
  type: "service" as const,
  id: "agent:atlas:core-banking-platform-architect",
};
const ENTITY = "LE-ZA-HOZ-BANK";
const RECORD_TITLE = "Pre-purge backup verified";
const RECORD_ID = "record:documents:atlas:pre-purge-backup-verified:2026-06-13";

// ---------------------------------------------------------------------------
// Step 1: Resolve DB path
// ---------------------------------------------------------------------------
const dbPath = resolveEventDbPath().path;
console.log(`[slice3-backup] Event store: ${dbPath}`);

if (!existsSync(dbPath)) {
  console.error(`[slice3-backup] ABORT: event store not found at ${dbPath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 2: Backup path
// ---------------------------------------------------------------------------
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = resolve(homedir(), ".local", "share", "bank", "backups");
mkdirSync(backupDir, { recursive: true });
const backupPath = resolve(backupDir, `pre-purge-${timestamp}.db`);
console.log(`[slice3-backup] Backup path: ${backupPath}`);

// ---------------------------------------------------------------------------
// Step 3: VACUUM INTO (online consistent backup — never fs.copyFile)
// ---------------------------------------------------------------------------
console.log("[slice3-backup] Step 3: Taking VACUUM INTO backup...");
try {
  const sourceDb = new Database(dbPath);
  sourceDb.exec(`VACUUM INTO '${backupPath}'`);
  sourceDb.close();
  console.log(`[slice3-backup] VACUUM INTO completed: ${backupPath}`);
} catch (err) {
  console.error(
    `[slice3-backup] ABORT: VACUUM INTO failed: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
}

if (!existsSync(backupPath)) {
  console.error("[slice3-backup] ABORT: backup file not found after VACUUM INTO");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 4: BLAKE3 hash of backup file
// ---------------------------------------------------------------------------
console.log("[slice3-backup] Step 4: Computing BLAKE3 hash of backup...");
const backupBytes = readFileSync(backupPath);
const backupHash = hashContent(backupBytes);
console.log(`[slice3-backup] Backup hash: ${backupHash}`);

// ---------------------------------------------------------------------------
// Step 5: Round-trip verification
// ---------------------------------------------------------------------------
console.log("[slice3-backup] Step 5: Verifying round-trip...");
let backupEventCount = 0;
let backupMaxSequence = 0;
let sourceEventCount = 0;

try {
  const backupDb = new Database(backupPath, { readonly: true });

  // PRAGMA integrity_check
  const integrityRows = backupDb.prepare("PRAGMA integrity_check").all() as Array<{
    integrity_check: string;
  }>;
  const integrityOk = integrityRows.length === 1 && integrityRows[0]?.integrity_check === "ok";
  if (!integrityOk) {
    console.error(
      `[slice3-backup] ABORT: backup integrity_check failed: ${JSON.stringify(integrityRows)}`,
    );
    backupDb.close();
    process.exit(1);
  }
  console.log("[slice3-backup] PRAGMA integrity_check: ok");

  // Count events in backup
  const countRow = backupDb.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number };
  backupEventCount = Number(countRow.n);

  const maxSeqRow = backupDb
    .prepare("SELECT COALESCE(MAX(sequence), 0) AS m FROM events")
    .get() as { m: number };
  backupMaxSequence = Number(maxSeqRow.m);

  backupDb.close();
} catch (err) {
  console.error(
    `[slice3-backup] ABORT: backup round-trip check failed: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
}

// Count events in source (for parity check)
try {
  const sourceDb = new Database(dbPath, { readonly: true });
  const countRow = sourceDb.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number };
  sourceEventCount = Number(countRow.n);
  sourceDb.close();
} catch (err) {
  console.error(
    `[slice3-backup] ABORT: failed to count source events: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
}

if (backupEventCount !== sourceEventCount) {
  console.error(
    `[slice3-backup] ABORT: event count mismatch — backup has ${backupEventCount}, source has ${sourceEventCount}`,
  );
  process.exit(1);
}

console.log(
  `[slice3-backup] Round-trip verified: ${backupEventCount} events, max_sequence=${backupMaxSequence}`,
);

// ---------------------------------------------------------------------------
// Step 6: Confirm archive files exist (list, NOT delete)
// ---------------------------------------------------------------------------
console.log("[slice3-backup] Step 6: Listing archive files...");
const archiveDir = resolve(homedir(), ".local", "share", "bank", "archive");
if (existsSync(archiveDir)) {
  const archiveFiles = readdirSync(archiveDir).filter((f) => f.endsWith(".db"));
  console.log(`[slice3-backup] Archive files found (${archiveFiles.length} total — NOT deleted):`);
  for (const f of archiveFiles) {
    console.log(`  ${f}`);
  }
} else {
  console.log("[slice3-backup] No archive directory found at expected path (non-fatal).");
}

// ---------------------------------------------------------------------------
// Step 7: File RecordFiled in the LIVE store
// ---------------------------------------------------------------------------
console.log("[slice3-backup] Step 7: Filing RecordFiled event in live store...");

// Check idempotency
import { eventStore } from "../../platform/composition";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

let filedEventId: string;

if (alreadyFiled) {
  console.log(`[slice3-backup] RecordFiled ${RECORD_ID} already exists — skipping filing.`);
  // Still retrieve the event ID for reporting
  const existing = [...eventStore.replay({ type: "RecordFiled" })].find(
    (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
  );
  filedEventId = existing?.event_id ?? "(already-filed)";
} else {
  const body = `# Pre-purge backup verified

**Author:** Atlas (Core banking platform architect, engineering)
**Date:** 2026-06-13
**Authority:** D-MONEY-DECIMAL-REDENOMINATION; D-MONEY-DECIMAL-BUILD-PROCEED
**Brief:** brief:atlas:money-slices-3-5-backup-config-only-purge-re-see:2026-06-13

## Backup details

- **Backup path:** \`${backupPath}\`
- **Hash (BLAKE3):** \`${backupHash}\`
- **Event count:** ${backupEventCount}
- **Max sequence:** ${backupMaxSequence}
- **Timestamp:** ${new Date().toISOString()}

## Verification

- PRAGMA integrity_check: ok
- Event count round-trip: source=${sourceEventCount}, backup=${backupEventCount} — MATCH
- Backup taken via VACUUM INTO (online consistent; WAL-safe)

## Status

VERIFIED. This record gates slice4-purge-reseed.ts. The purge MUST NOT run
without this RecordFiled event being present in the live store.

## Archive files

Archive directory: ${archiveDir}
`;

  const result = recordFiled(
    {
      recordId: RECORD_ID,
      registerKey: "documents",
      body,
      classification: "governance-seat",
      retention: {
        citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
        minimumYears: 7,
        archivalTier: "hot" as const,
      },
      citations: [
        "D-MONEY-DECIMAL-BUILD-PROCEED",
        "D-MONEY-DECIMAL-REDENOMINATION",
        "D-LEGAL-ENTITY-NAME-HOZ-BANK",
        "D-EVENT-STORE-SCALING-PHASE-5",
        "D-CROSS-WORKTREE-EVENT-STORE-SYNC",
        "P1-EVENTS-AS-TRUTH",
      ],
      actor: ACTOR,
      entity: ENTITY,
      metadata: {
        title: RECORD_TITLE,
        path: "2026-06-13_atlas_pre-purge-backup-verified.md",
        category: "backup-verification",
        author: "Atlas (Core banking platform architect, engineering)",
        date: "2026-06-13",
      },
    },
    new Date().toISOString(),
  );

  filedEventId = result.eventId;
  console.log(`[slice3-backup] RecordFiled event emitted: ${filedEventId}`);
}

// ---------------------------------------------------------------------------
// Step 8: Print summary
// ---------------------------------------------------------------------------
console.log("\n=== SLICE 3 BACKUP SUMMARY ===");
console.log(`Backup path:        ${backupPath}`);
console.log(`Hash (BLAKE3):      ${backupHash}`);
console.log(`Event count:        ${backupEventCount}`);
console.log(`Max sequence:       ${backupMaxSequence}`);
console.log(`RecordFiled ID:     ${filedEventId}`);
console.log(`Record ID:          ${RECORD_ID}`);
console.log("Status:             SUCCESS — backup verified; slice4 may proceed");
console.log("================================\n");

process.exit(0);
