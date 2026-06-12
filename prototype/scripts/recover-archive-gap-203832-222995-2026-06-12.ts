// scripts/recover-archive-gap-203832-222995-2026-06-12.ts
//
// One-shot Principle-1 integrity recovery.
//
// recon:event-store-append-only failed with archive_partitions:sequence-gap —
// rows 203832–222995 (19,164 events) were in neither the hot store nor any
// registered archive partition. Forensics (2026-06-12):
//
//   • The 7 unregistered "orphan" archive files in ~/.local/share/bank/archives
//     (event-2026-05-24 … 2026-05-28) cover sequences 1–123431 only — NOT the
//     gap.
//   • The gap predates the 2026-06-11 fixture-pollution extraction: the
//     pre-fixture-extraction backup already starts at 222996.
//   • The full 19,164-row range survives intact in two full backups:
//     event.db.bak-20260526-201535 and event.db.bak-20260527-074833.
//   • By 2026-05-29 the range was already gone from hot → the rows were deleted
//     from hot between 2026-05-27 and 2026-05-29 by an extraction that never
//     created/registered a partition (a pre-Phase-5-hardening drop).
//   • The range is 100% `build-phase-fixture` provenance: 19,140
//     InboundMessageReceived + 16 FxSettlementInstructed + 8 FxTradeExecuted.
//     Contiguous, no internal gaps.
//
// Principle 1 (events are the only source of truth) requires the append-only
// chain be restored rather than the loss accepted: this script rebuilds the
// missing cold partition from the 2026-05-27 backup and registers it in the
// hot store's archive_partitions table. It does NOT mutate the events table
// (the rows are not in hot) — it only creates a new cold file and inserts one
// registry row, closing the gap so PartitionedEventStore spans the full
// 1…max sequence range again.
//
// Idempotent: if a partition already covers min_sequence 203832, or the rows
// are already present in hot, it exits without change.
//
// Accountable seat: Atlas (substrate engineer; owns D-EVENT-STORE-SCALING-
// PHASE-5). Authority: CEO (marc@tgv.co.za) via Scrooge session delegation
// 2026-06-12 ("c" — pick up the orphan-archive chip).
//
// How to run (from prototype/):
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/recover-archive-gap-203832-222995-2026-06-12.ts

import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DDL } from "../platform/event-store/store";
import { logger } from "../platform/observability/logger";

const GAP_MIN = 203832;
const GAP_MAX = 222995;
const EXPECTED_ROWS = 19164;

const BANK_HOME = join(homedir(), ".local", "share", "bank");
const HOT_DB = process.env.BANK_EVENT_DB ?? join(BANK_HOME, "event.db");
const SOURCE_BACKUP = join(BANK_HOME, "event.db.bak-20260527-074833");
const ARCHIVE_PATH = join(BANK_HOME, "archives", "event-recovered-fixture-2026-06-12T00-00-00.db");

interface RowShape {
  sequence: number;
  event_id: string;
  type: string;
  as_of: string;
  entity: string;
  actor_type: string;
  actor_id: string;
  citations: string;
  payload: string;
  recorded_at: string;
  provenance: string | null;
  aggregate_id: string | null;
  aggregate_label: string | null;
}

function main(): void {
  if (!existsSync(SOURCE_BACKUP)) {
    logger.warn(
      { SOURCE_BACKUP },
      "recovery: source backup not present — nothing to do (clean store)",
    );
    return;
  }
  const hot = new Database(HOT_DB);

  // Idempotency guards.
  const alreadyInHot = (
    hot
      .prepare("SELECT COUNT(*) AS n FROM events WHERE sequence BETWEEN ? AND ?")
      .get(GAP_MIN, GAP_MAX) as { n: number }
  ).n;
  if (alreadyInHot > 0) {
    logger.info({ alreadyInHot }, "recovery: rows already present in hot store — no action");
    hot.close();
    return;
  }
  const alreadyRegistered = (
    hot
      .prepare(
        "SELECT COUNT(*) AS n FROM archive_partitions WHERE min_sequence <= ? AND max_sequence >= ?",
      )
      .get(GAP_MIN, GAP_MAX) as { n: number }
  ).n;
  if (alreadyRegistered > 0) {
    logger.info("recovery: a partition already covers the gap range — no action");
    hot.close();
    return;
  }
  if (existsSync(ARCHIVE_PATH)) {
    throw new Error(
      `recovery: archive file already exists at "${ARCHIVE_PATH}" — refusing to overwrite`,
    );
  }

  // Step 1 — read the contiguous range from the backup.
  const backup = new Database(SOURCE_BACKUP, { readonly: true });
  const rows = backup
    .prepare("SELECT * FROM events WHERE sequence BETWEEN ? AND ? ORDER BY sequence ASC")
    .all(GAP_MIN, GAP_MAX) as RowShape[];
  backup.close();

  if (rows.length !== EXPECTED_ROWS) {
    throw new Error(`recovery: backup yielded ${rows.length} rows, expected ${EXPECTED_ROWS}`);
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last || first.sequence !== GAP_MIN || last.sequence !== GAP_MAX) {
    throw new Error(`recovery: range bounds mismatch (got ${first?.sequence}..${last?.sequence})`);
  }
  // Contiguity assertion — the cold partition must hold an unbroken run.
  if (last.sequence - first.sequence + 1 !== rows.length) {
    throw new Error("recovery: source range is not contiguous — aborting");
  }

  // Step 2 — build the cold partition file with the canonical DDL.
  mkdirSync(dirname(ARCHIVE_PATH), { recursive: true });
  const archive = new Database(ARCHIVE_PATH);
  archive.exec(DDL);
  try {
    const ins = archive.prepare(
      `INSERT INTO events
         (sequence, event_id, type, as_of, entity, actor_type, actor_id, citations, payload,
          recorded_at, provenance, aggregate_id, aggregate_label)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const tx = archive.transaction((rs: RowShape[]) => {
      for (const r of rs) {
        ins.run(
          r.sequence,
          r.event_id,
          r.type,
          r.as_of,
          r.entity,
          r.actor_type,
          r.actor_id,
          r.citations,
          r.payload,
          r.recorded_at,
          r.provenance ?? null,
          r.aggregate_id ?? null,
          r.aggregate_label ?? null,
        );
      }
    });
    tx(rows);

    const archiveCount = (
      archive.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number }
    ).n;
    if (archiveCount !== EXPECTED_ROWS) {
      throw new Error(`recovery: archive has ${archiveCount} rows, expected ${EXPECTED_ROWS}`);
    }
    archive.close(); // flush before hashing
  } catch (err) {
    try {
      if (existsSync(ARCHIVE_PATH)) unlinkSync(ARCHIVE_PATH);
    } catch {}
    hot.close();
    throw err;
  }

  // Step 3 — SHA-256 of the file (same scheme as archiveEventsOlderThan).
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(readFileSync(ARCHIVE_PATH));
  const sha256Hash = hasher.digest("hex");

  // Step 4 — register the partition in the hot store. No events-table mutation.
  const partitionId = randomUUID();
  hot
    .prepare(
      `INSERT INTO archive_partitions
         (partition_id, path, min_sequence, max_sequence, event_count, sha256_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(partitionId, ARCHIVE_PATH, GAP_MIN, GAP_MAX, EXPECTED_ROWS, sha256Hash);
  hot.close();

  logger.info(
    {
      partitionId,
      path: ARCHIVE_PATH,
      minSeq: GAP_MIN,
      maxSeq: GAP_MAX,
      eventCount: EXPECTED_ROWS,
      sha256Hash,
    },
    `recovery: registered cold partition closing gap ${GAP_MIN}–${GAP_MAX} (${EXPECTED_ROWS} fixture events)`,
  );
}

main();
