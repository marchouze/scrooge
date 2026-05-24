// scripts/archive/check-and-archive.ts
//
// One-shot CLI: inspects the hot event store against configured thresholds
// and, when either is breached, evicts the oldest cold-tier events to a
// dated archive file via EventStore.archiveEventsOlderThan().
//
// Thresholds (env-overridable):
//   BANK_ARCHIVE_SIZE_LIMIT_MB   — archive when hot file > this (default: 100)
//   BANK_ARCHIVE_EVENT_LIMIT     — archive when hot count > this  (default: 500000)
//   BANK_ARCHIVE_TARGET_EVENTS   — events to retain in hot store  (default: 250000)
//   BANK_ARCHIVE_DIR             — directory for archive files
//                                  (default: $BANK_EVENT_DB/../archives/ or
//                                   ~/.local/share/bank/archives/)
//
// Depends on EventStore.archiveEventsOlderThan() introduced in PR #778
// (D-EVENT-STORE-SCALING-PHASE-5). When that method is absent (pre-merge),
// the script logs a warning and exits 0 — safe to schedule now; will start
// archiving automatically once PR #778 lands.
//
// Invocation:
//   bun run scripts/archive/check-and-archive.ts
//   bun run archive:check        (package.json script)
//
// Authority: D-EVENT-STORE-SCALING-PHASE-5
// Author: Atlas (Core banking platform architect, engineering)

// D-CROSS-WORKTREE-EVENT-STORE-SYNC — must be first import so
// BANK_EVENT_DB is resolved before composition.ts loads.
import "../dispatch/resolve-event-db-boot";

import { mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";

// ---------------------------------------------------------------------------
// Config from environment
// ---------------------------------------------------------------------------
const SIZE_LIMIT_MB = Number(process.env.BANK_ARCHIVE_SIZE_LIMIT_MB ?? "100");
const EVENT_LIMIT = Number(process.env.BANK_ARCHIVE_EVENT_LIMIT ?? "500000");
const TARGET_EVENTS = Number(process.env.BANK_ARCHIVE_TARGET_EVENTS ?? "250000");

function resolveArchiveDir(): string {
  if (process.env.BANK_ARCHIVE_DIR) return resolve(process.env.BANK_ARCHIVE_DIR);
  // Derive from BANK_EVENT_DB path: sibling archives/ directory
  const dbPath = process.env.BANK_EVENT_DB ?? process.env.BANK_HOME_EVENT_DB;
  if (dbPath) return join(dirname(dbPath), "archives");
  return join(process.env.HOME ?? "~", ".local", "share", "bank", "archives");
}

// ---------------------------------------------------------------------------
// Threshold check
// ---------------------------------------------------------------------------
function hotStoreMetrics(): { sizeMb: number; eventCount: number; highWatermark: number } {
  // File size via statSync on the resolved DB path
  const dbPath = process.env.BANK_EVENT_DB ?? "";
  let sizeMb = 0;
  if (dbPath) {
    try {
      sizeMb = statSync(dbPath).size / (1024 * 1024);
    } catch {
      // DB path not resolvable via stat — skip size check
    }
  }
  const eventCount = eventStore.count();
  const highWatermark = eventStore.highWatermark();
  return { sizeMb, eventCount, highWatermark };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { sizeMb, eventCount, highWatermark } = hotStoreMetrics();

  logger.info({
    msg: "archive:check — hot store metrics",
    sizeMb: sizeMb.toFixed(1),
    eventCount,
    highWatermark,
    thresholds: { sizeLimitMb: SIZE_LIMIT_MB, eventLimit: EVENT_LIMIT },
  });

  const sizeBreached = sizeMb > 0 && sizeMb > SIZE_LIMIT_MB;
  const countBreached = eventCount > EVENT_LIMIT;

  if (!sizeBreached && !countBreached) {
    logger.info({ msg: "archive:check — below thresholds, no archive needed" });
    return;
  }

  logger.info({
    msg: "archive:check — threshold breached, archiving cold events",
    reason: sizeBreached ? "size" : "count",
    sizeMb: sizeMb.toFixed(1),
    eventCount,
  });

  // Check whether archiveEventsOlderThan is available (requires PR #778).
  // When absent, warn and exit cleanly — the daemon will try again next tick.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const archiveFn = (eventStore as any).archiveEventsOlderThan as
    | ((cutoff: number, archivePath: string) => Promise<unknown>)
    | undefined;

  if (typeof archiveFn !== "function") {
    logger.warn({
      msg: "archive:check — archiveEventsOlderThan() not available; upgrade to post-PR-778 and re-run",
    });
    return;
  }

  // Compute cutoff: archive everything older than (highWatermark - TARGET_EVENTS).
  // Minimum cutoff is 1 — never archive zero events.
  const cutoffSequence = Math.max(1, highWatermark - TARGET_EVENTS);

  if (cutoffSequence <= 0) {
    logger.info({
      msg: "archive:check — insufficient events to archive (hot store younger than TARGET_EVENTS)",
      highWatermark,
      targetEvents: TARGET_EVENTS,
    });
    return;
  }

  // Construct archive file path: archives/event-YYYY-MM-DDTHHmmss.db
  const archiveDir = resolveArchiveDir();
  mkdirSync(archiveDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const archivePath = join(archiveDir, `event-${ts}.db`);

  logger.info({
    msg: "archive:check — starting archive",
    cutoffSequence,
    archivePath,
  });

  try {
    const result = await archiveFn.call(eventStore, cutoffSequence, archivePath);
    logger.info({ msg: "archive:check — archive complete", result });
  } catch (err) {
    logger.error({ msg: "archive:check — archive failed", err: String(err) });
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error({ msg: "archive:check — fatal", err: String(err) });
  process.exit(1);
});
