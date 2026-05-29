// scripts/agents/jibar-fixing-ingest.ts
//
// JIBAR 3M fixing ingest script — loads the build-phase fixture and stores
// JIBAR 3M daily fixing ticks in the MarketDataStore (SQLite).
//
// This file exposes two entry points:
//   - `runJibarFixingIngestForDate()` — pure synchronous function; used by
//     the Ravi scheduled handler `ravi:jibar-fixing-ingest`.
//   - `runJibarFixingIngestAllDates()` — seeds all historical dates from the
//     fixture; used for first-boot seeding.
//   - `main()` (CLI shape, run when invoked directly via `bun run ...`) —
//     operator-facing behaviour for manual / ad-hoc runs.
//
// No API key required — fixture data only in the build phase.
//
// Authority: D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//            D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//
// Usage:
//   bun run scripts/agents/jibar-fixing-ingest.ts [YYYY-MM-DD]
//   bun run scripts/agents/jibar-fixing-ingest.ts --all

import { resolve } from "node:path";
import {
  makeFixtureJibarFixingSource,
  runJibarFixingIngest,
  runJibarFixingIngestAll,
  type JibarFixingFixtureShape,
} from "../../platform/market-data/jibar-fixing-ingester";
import { resolveMarketDataDbPath } from "../../platform/market-data/resolve-market-data-db";
import { MarketDataStore } from "../../platform/market-data/store";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface JibarFixingIngestOptions {
  /** Path to the MarketDataStore SQLite file. */
  dbPath: string;
  /** ISO 8601 date (YYYY-MM-DD) to ingest. */
  date: string;
  /**
   * Logging sink. Defaults to `console.log`/`console.error`. Pass a no-op
   * to silence; handlers wire their structured logger here.
   */
  log?: (level: "info" | "error", message: string) => void;
}

export interface JibarFixingIngestResult {
  /** Number of ticks newly written to the store. */
  readonly ticksAppended: number;
  /** Number of ticks already present (deduped). */
  readonly ticksSkipped: number;
  /** Whether the ingest cycle completed without throwing. */
  readonly ok: boolean;
  /** Error message if `ok` is false. */
  readonly error?: string;
}

export interface JibarFixingIngestAllOptions {
  /** Path to the MarketDataStore SQLite file. */
  dbPath: string;
  /**
   * Logging sink. Defaults to `console.log`/`console.error`.
   */
  log?: (level: "info" | "error", message: string) => void;
}

// ---------------------------------------------------------------------------
// Fixture loader
// ---------------------------------------------------------------------------

function loadFixture(): JibarFixingFixtureShape {
  // Resolve relative to this file's directory (prototype/scripts/agents/).
  const fixturePath = resolve(import.meta.dir, "../../seeds/jibar-fixings.json");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(fixturePath) as JibarFixingFixtureShape;
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Ingest the JIBAR 3M fixing for a single date from the build-phase fixture.
 * Synchronous — no network calls in the build phase.
 */
export function runJibarFixingIngestForDate(
  opts: JibarFixingIngestOptions,
): JibarFixingIngestResult {
  const log =
    opts.log ?? ((level, msg) => (level === "error" ? console.error(msg) : console.log(msg)));

  let fixture: JibarFixingFixtureShape;
  try {
    fixture = loadFixture();
  } catch (err) {
    const msg = `fixture load failed — ${String(err)}`;
    log("error", `[jibar-fixing-ingest] ERROR: ${msg}`);
    return { ticksAppended: 0, ticksSkipped: 0, ok: false, error: msg };
  }

  const store = new MarketDataStore(opts.dbPath);
  try {
    const source = makeFixtureJibarFixingSource(fixture);
    const result = runJibarFixingIngest({ date: opts.date, source, marketDataStore: store });
    log(
      "info",
      `[jibar-fixing-ingest] date=${opts.date} appended=${result.ticksAppended} skipped=${result.ticksSkippedAsDuplicate}`,
    );
    return {
      ticksAppended: result.ticksAppended,
      ticksSkipped: result.ticksSkippedAsDuplicate,
      ok: true,
    };
  } catch (err) {
    const msg = `ingest failed — ${String(err)}`;
    log("error", `[jibar-fixing-ingest] ERROR: ${msg}`);
    return { ticksAppended: 0, ticksSkipped: 0, ok: false, error: msg };
  } finally {
    store.close();
  }
}

/**
 * Seed all historical JIBAR 3M fixing dates from the build-phase fixture.
 */
export function runJibarFixingIngestAllDates(
  opts: JibarFixingIngestAllOptions,
): JibarFixingIngestResult {
  const log =
    opts.log ?? ((level, msg) => (level === "error" ? console.error(msg) : console.log(msg)));

  let fixture: JibarFixingFixtureShape;
  try {
    fixture = loadFixture();
  } catch (err) {
    const msg = `fixture load failed — ${String(err)}`;
    log("error", `[jibar-fixing-ingest] ERROR: ${msg}`);
    return { ticksAppended: 0, ticksSkipped: 0, ok: false, error: msg };
  }

  const store = new MarketDataStore(opts.dbPath);
  try {
    const source = makeFixtureJibarFixingSource(fixture);
    const results = runJibarFixingIngestAll({ source, marketDataStore: store });
    const totalAppended = results.reduce((sum, r) => sum + r.ticksAppended, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.ticksSkippedAsDuplicate, 0);
    log(
      "info",
      `[jibar-fixing-ingest] all-dates: ${results.length} dates processed, ${totalAppended} appended, ${totalSkipped} skipped`,
    );
    return { ticksAppended: totalAppended, ticksSkipped: totalSkipped, ok: true };
  } catch (err) {
    const msg = `ingest-all failed — ${String(err)}`;
    log("error", `[jibar-fixing-ingest] ERROR: ${msg}`);
    return { ticksAppended: 0, ticksSkipped: 0, ok: false, error: msg };
  } finally {
    store.close();
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function main(): void {
  const dbPath = resolveMarketDataDbPath().path;
  const args = process.argv.slice(2);

  if (args[0] === "--all") {
    const result = runJibarFixingIngestAllDates({ dbPath });
    if (!result.ok) process.exit(1);
    return;
  }

  const date = args[0] ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(`[jibar-fixing-ingest] ERROR: invalid date "${date}" — expected YYYY-MM-DD`);
    process.exit(1);
  }

  const result = runJibarFixingIngestForDate({ dbPath, date });
  if (!result.ok) process.exit(1);
}

// Run as CLI only when invoked directly, not when imported by a handler.
if (import.meta.main) {
  main();
}
