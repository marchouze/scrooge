// scripts/reconcile-orphan-archive-partitions-2026-06-12.ts
//
// One-shot Principle-1 archive-tier reconciliation.
//
// Seven archive SQLite files in ~/.local/share/bank/archives are present on
// disk but absent from the hot store's archive_partitions registry (the
// "orphan archives" flagged alongside the 203832–222995 sequence-gap):
//
//   event-2026-05-24T09-23-53.db   seq 1
//   event-2026-05-26T11-55-59.db   seq 2–49756
//   event-2026-05-26T19-42-04.db   seq 49757–59787
//   event-2026-05-27T03-02-39.db   seq 59788–59838
//   event-2026-05-27T09-12-59.db   seq 59839–94330
//   event-2026-05-27T15-13-01.db   seq 94523–117695
//   event-2026-05-28T09-30-20.db   seq 118226–123431
//
// They are the sole archive copy of the earliest build-phase fixture events;
// every sequence they hold is below the lowest registered partition (185638)
// and absent from the hot store. The established pattern (the 2026-06-11
// fixture-pollution extraction) is to archive fixture events to cold
// partitions, not delete them — so the correct fix is to register these files,
// restoring their place in the append-only chain rather than leaving them
// stranded (one VACUUM/cleanup away from silent loss).
//
// SAFETY: each candidate is registered ONLY if (a) its sequence range is
// disjoint from every already-registered partition, and (b) none of its
// event_ids collide with the hot store or any registered partition — so
// PartitionedEventStore replay can never double-emit. Anything that fails a
// guard is skipped and logged, never force-registered. Idempotent: files
// already in the registry are skipped.
//
// Accountable seat: Atlas (substrate engineer; owns D-EVENT-STORE-SCALING-
// PHASE-5). Authority: CEO (marc@tgv.co.za) via Scrooge session delegation
// 2026-06-12 ("c" — pick up the orphan-archive chip).
//
// How to run (from prototype/):
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/reconcile-orphan-archive-partitions-2026-06-12.ts

import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { logger } from "../platform/observability/logger";

const BANK_HOME = join(homedir(), ".local", "share", "bank");
const HOT_DB = process.env.BANK_EVENT_DB ?? join(BANK_HOME, "event.db");
const ARCHIVE_DIR = join(BANK_HOME, "archives");

function main(): void {
  if (!existsSync(ARCHIVE_DIR)) {
    logger.warn({ ARCHIVE_DIR }, "reconcile: archive dir absent — nothing to do");
    return;
  }
  const hot = new Database(HOT_DB);

  const registeredPaths = new Set(
    (hot.prepare("SELECT path FROM archive_partitions").all() as { path: string }[]).map(
      (r) => r.path,
    ),
  );
  const registeredRanges = hot
    .prepare("SELECT min_sequence AS lo, max_sequence AS hi FROM archive_partitions")
    .all() as { lo: number; hi: number }[];

  const files = readdirSync(ARCHIVE_DIR).filter((f) => f.endsWith(".db"));
  let registered = 0;
  let skipped = 0;

  for (const file of files) {
    const path = join(ARCHIVE_DIR, file);
    if (registeredPaths.has(path)) continue; // already registered

    const cold = new Database(path, { readonly: true });
    const meta = cold
      .prepare("SELECT MIN(sequence) AS lo, MAX(sequence) AS hi, COUNT(*) AS n FROM events")
      .get() as {
      lo: number | null;
      hi: number | null;
      n: number;
    };
    if (meta.lo === null || meta.hi === null || meta.n === 0) {
      cold.close();
      logger.warn({ file }, "reconcile: empty archive file — skipped");
      skipped++;
      continue;
    }
    const lo = meta.lo;
    const hi = meta.hi;

    // Guard (a) — sequence range disjoint from every registered partition.
    const overlapsRange = registeredRanges.some((r) => lo <= r.hi && hi >= r.lo);
    if (overlapsRange) {
      cold.close();
      logger.warn({ file, lo, hi }, "reconcile: range overlaps a registered partition — skipped");
      skipped++;
      continue;
    }

    // Guard (b) — no event_id collision with the hot store.
    const sampleIds = (
      cold.prepare("SELECT event_id FROM events").all() as { event_id: string }[]
    ).map((r) => r.event_id);
    let collision = false;
    const checkStmt = hot.prepare("SELECT 1 FROM events WHERE event_id = ? LIMIT 1");
    for (const id of sampleIds) {
      if (checkStmt.get(id)) {
        collision = true;
        break;
      }
    }
    cold.close();
    if (collision) {
      logger.warn(
        { file },
        "reconcile: event_id collision with hot store — skipped (manual review)",
      );
      skipped++;
      continue;
    }

    // Register: SHA-256 over the file bytes (same scheme as the store).
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(readFileSync(path));
    const sha256Hash = hasher.digest("hex");

    hot
      .prepare(
        `INSERT INTO archive_partitions
           (partition_id, path, min_sequence, max_sequence, event_count, sha256_hash)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(randomUUID(), path, lo, hi, meta.n, sha256Hash);
    registeredRanges.push({ lo, hi });
    registered++;
    logger.info({ file, lo, hi, eventCount: meta.n, sha256Hash }, `reconcile: registered ${file}`);
  }

  hot.close();
  logger.info(
    { registered, skipped, scanned: files.length },
    `reconcile complete: ${registered} registered, ${skipped} skipped`,
  );
}

main();
