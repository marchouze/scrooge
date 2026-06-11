// scripts/archive-extract-fixture-pollution.ts
//
// One-shot operator CLI: selectively extract the 2026-05-26..29 test-
// pollution rows from the canonical shared event store into a cold
// archive partition.
//
// Identification rule (EXACTLY three entity patterns — the residual
// fail set of recon:entity-identity-coherence after Bea (Accounting &
// financial reporting engineer, engineering)'s LE-BANK-SA backfill):
//
//   entity LIKE 'BANK-FIXTURE-%'        (fixture scenario noise)
//   entity LIKE 'TEST-ENTITY-ANYA-M1%'  (Anya M1 CDM test fixtures)
//   entity =    'bank'                  (bare lowercase placeholder)
//
// The rows are MOVED, not deleted: they land in a new SQLite partition
// under <store-dir>/archives/, registered in `archive_partitions`
// (min/max sequence, count, SHA-256), and remain replayable via
// PartitionedEventStore (cold-first ordering). The hot-store delete is
// a single short transaction (launchd agents write concurrently).
//
// Usage (from prototype/):
//   bun run scripts/archive-extract-fixture-pollution.ts --dry-run
//   bun run scripts/archive-extract-fixture-pollution.ts
//   bun run scripts/archive-extract-fixture-pollution.ts --event-db <path>
//   bun run scripts/archive-extract-fixture-pollution.ts --archive-dir <dir>
//
// Resolution of the target store follows the shared dispatch precedence
// (D-CROSS-WORKTREE-EVENT-STORE-SYNC): --event-db flag > BANK_EVENT_DB >
// BANK_HOME_EVENT_DB > $HOME/.local/share/bank/event.db.
//
// Authority: D-EVENT-STORE-SELECTIVE-ARCHIVE-EXTRACTION (CEO-approved
// 2026-06-11); partition model per D-EVENT-STORE-SCALING-PHASE-5.
// Author: Atlas (Core banking platform architect, engineering)

// MUST be first: resolves the shared store and mutates BANK_EVENT_DB
// before anything else reads it.
import { applyDispatchEventDbResolution } from "./dispatch/resolve-event-db";

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { Database } from "bun:sqlite";

import { PartitionedEventStore } from "../platform/event-store/partitioned-store";
import { EventStore, type ExtractionResult } from "../platform/event-store/store";

const DECISION = "D-EVENT-STORE-SELECTIVE-ARCHIVE-EXTRACTION";
const PRECEDENT = "D-EVENT-STORE-SCALING-PHASE-5";

/** The three entity patterns — the EXACT identification rule from the brief. */
export const FIXTURE_POLLUTION_WHERE = "(entity LIKE ? OR entity LIKE ? OR entity = ?)" as const;
export const FIXTURE_POLLUTION_PARAMS = ["BANK-FIXTURE-%", "TEST-ENTITY-ANYA-M1%", "bank"] as const;

/** True when an event entity matches the fixture-pollution rule (JS mirror of the SQL predicate). */
export function isFixturePollutionEntity(entity: string): boolean {
  return (
    entity.startsWith("BANK-FIXTURE-") ||
    entity.startsWith("TEST-ENTITY-ANYA-M1") ||
    entity === "bank"
  );
}

interface PollutionSummary {
  readonly total: number;
  readonly minSequence: number;
  readonly maxSequence: number;
  readonly byType: Readonly<Record<string, number>>;
  readonly byEntity: Readonly<Record<string, number>>;
  readonly hotTotal: number;
}

/** Read-only summary of matching rows in the hot store. */
export function summariseFixturePollution(dbPath: string): PollutionSummary {
  const db = new Database(dbPath, { readonly: true });
  try {
    const agg = db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(MIN(sequence), 0) AS minSeq, COALESCE(MAX(sequence), 0) AS maxSeq
         FROM events WHERE ${FIXTURE_POLLUTION_WHERE}`,
      )
      .get(...FIXTURE_POLLUTION_PARAMS) as { n: number; minSeq: number; maxSeq: number };
    const byType: Record<string, number> = {};
    for (const r of db
      .prepare(
        `SELECT type, COUNT(*) AS n FROM events WHERE ${FIXTURE_POLLUTION_WHERE} GROUP BY type ORDER BY n DESC`,
      )
      .all(...FIXTURE_POLLUTION_PARAMS) as Array<{ type: string; n: number }>) {
      byType[r.type] = r.n;
    }
    const byEntity: Record<string, number> = {};
    for (const r of db
      .prepare(
        `SELECT entity, COUNT(*) AS n FROM events WHERE ${FIXTURE_POLLUTION_WHERE} GROUP BY entity ORDER BY n DESC`,
      )
      .all(...FIXTURE_POLLUTION_PARAMS) as Array<{ entity: string; n: number }>) {
      byEntity[r.entity] = r.n;
    }
    const hotTotal = (db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number }).n;
    return {
      total: agg.n,
      minSequence: agg.minSeq,
      maxSequence: agg.maxSeq,
      byType,
      byEntity,
      hotTotal,
    };
  } finally {
    db.close();
  }
}

function log(level: "info" | "warn" | "error", msg: string, extra: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      level,
      time: new Date().toISOString(),
      service: "bank-prototype",
      component: "archive-extract-fixture-pollution",
      authority: DECISION,
      partitionModel: PRECEDENT,
      msg,
      ...extra,
    }),
  );
}

export interface RunArgs {
  readonly dryRun: boolean;
  readonly archiveDir?: string | undefined;
}

export function parseArgs(argv: readonly string[]): RunArgs {
  let dryRun = false;
  let archiveDir: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") dryRun = true;
    if (argv[i] === "--archive-dir") archiveDir = argv[i + 1];
  }
  return { dryRun, archiveDir };
}

export function runExtraction(
  dbPath: string,
  args: RunArgs,
): { summary: PollutionSummary; result?: ExtractionResult } {
  const summary = summariseFixturePollution(dbPath);
  log("info", `pre-scan: ${summary.total} matching fixture-pollution rows in hot store`, {
    mode: args.dryRun ? "dry-run" : "apply",
    eventDb: dbPath,
    hotTotalBefore: summary.hotTotal,
    matching: summary.total,
    minSequence: summary.minSequence,
    maxSequence: summary.maxSequence,
    byType: summary.byType,
    byEntity: summary.byEntity,
    identificationRule: `${FIXTURE_POLLUTION_WHERE} ← [${FIXTURE_POLLUTION_PARAMS.join(", ")}]`,
  });

  if (summary.total === 0) {
    log("info", "nothing to extract — hot store already clean of fixture pollution");
    return { summary };
  }

  if (args.dryRun) {
    log("info", "dry-run: no rows moved, no partition created", {
      wouldExtract: summary.total,
      hotTotalAfterWouldBe: summary.hotTotal - summary.total,
    });
    return { summary };
  }

  // Live run.
  const archiveDir = args.archiveDir ?? join(dirname(dbPath), "archives");
  mkdirSync(archiveDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const archivePath = join(archiveDir, `event-fixture-pollution-${ts}.db`);

  const store = new EventStore(dbPath);
  try {
    const result = store.extractToArchivePartition(
      {
        predicate: {
          where: FIXTURE_POLLUTION_WHERE,
          params: [...FIXTURE_POLLUTION_PARAMS],
        },
      },
      archivePath,
    );
    log("info", `extracted ${result.eventCount} rows to cold partition`, {
      partitionId: result.partitionId,
      archivePath: result.archivePath,
      minSequence: result.minSeq,
      maxSequence: result.maxSeq,
      eventCount: result.eventCount,
      sha256: result.sha256Hash,
      byType: result.byType,
      byEntity: result.byEntity,
    });

    // Post-run verification.
    const residual = summariseFixturePollution(dbPath);
    const pStore = new PartitionedEventStore(store);
    const integrity = pStore.verifyArchiveIntegrity();
    const newPartitionIntegrity = integrity.find((r) => r.partitionId === result.partitionId);
    let replayMatching = 0;
    let replayTotal = 0;
    for (const e of pStore.replay()) {
      replayTotal++;
      if (isFixturePollutionEntity(e.entity)) replayMatching++;
    }
    const ok =
      residual.total === 0 &&
      newPartitionIntegrity?.ok === true &&
      replayMatching === result.eventCount + residual.total;
    log(ok ? "info" : "error", "post-run verification", {
      residualMatchingHotRows: residual.total,
      hotTotalAfter: residual.hotTotal,
      newPartitionHashVerified: newPartitionIntegrity?.ok ?? false,
      allPartitionsIntegrity: integrity,
      partitionedReplayTotalEvents: replayTotal,
      partitionedReplayMatchingEvents: replayMatching,
      expectedMatchingViaReplay: result.eventCount,
      verified: ok,
    });
    if (!ok) {
      throw new Error(
        "archive-extract-fixture-pollution: post-run verification FAILED — investigate before relying on the extraction (see log line above)",
      );
    }
    return { summary, result };
  } finally {
    // PartitionedEventStore.close() would close `store` too; we only
    // opened cold stores via the verification pStore above, and the
    // EventStore close below covers the hot handle.
    store.close();
  }
}

if (import.meta.main) {
  const resolved = applyDispatchEventDbResolution();
  const args = parseArgs(process.argv.slice(2));
  log("info", "target store resolved", {
    path: resolved.path,
    source: resolved.source,
    shared: resolved.shared,
  });
  try {
    runExtraction(resolved.path, args);
    process.exit(0);
  } catch (err) {
    log("error", `extraction failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
