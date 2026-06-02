// scripts/agents/bond-price-ingest.ts
//
// SA government bond reference-price ingest script — loads the build-phase
// fixture and stores bond end-of-day clean-price + yield ticks in the
// MarketDataStore (SQLite).
//
// This file exposes:
//   - `runBondPriceIngestForDate()` — pure synchronous function; suitable for
//     a Ravi scheduled handler (e.g. `ravi:bond-price-ingest`).
//   - `runBondPriceIngestAllDates()` — seeds all historical dates from the
//     fixture; used for first-boot seeding.
//   - `main()` (CLI shape, run when invoked directly via `bun run ...`) —
//     operator-facing behaviour for manual / ad-hoc runs.
//
// No API key required — fixture data only in the build phase.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//            D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22) Slice 10
//
// Usage:
//   bun run scripts/agents/bond-price-ingest.ts [YYYY-MM-DD]
//   bun run scripts/agents/bond-price-ingest.ts --all

import { resolve } from "node:path";
import { nowUtc } from "../../platform/core/types";
import {
  type BondPriceFixtureShape,
  makeFixtureBondPriceSource,
  runBondPriceIngest,
  runBondPriceIngestAll,
} from "../../platform/market-data/bond-price-ingester";
import { resolveMarketDataDbPath } from "../../platform/market-data/resolve-market-data-db";
import { MarketDataStore } from "../../platform/market-data/store";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface BondPriceIngestOptions {
  /** Path to the MarketDataStore SQLite file. */
  dbPath: string;
  /** ISO 8601 date (YYYY-MM-DD) to ingest. */
  date: string;
  /**
   * Logging sink. Defaults to `console.log`/`console.error`. Pass a no-op to
   * silence; handlers wire their structured logger here.
   */
  log?: (level: "info" | "error", message: string) => void;
}

export interface BondPriceIngestResult {
  /** Number of ticks newly written to the store. */
  readonly ticksAppended: number;
  /** Number of ticks already present (deduped). */
  readonly ticksSkipped: number;
  /** Whether the ingest cycle completed without throwing. */
  readonly ok: boolean;
  /** Error message if `ok` is false. */
  readonly error?: string;
}

export interface BondPriceIngestAllOptions {
  /** Path to the MarketDataStore SQLite file. */
  dbPath: string;
  /** Logging sink. Defaults to `console.log`/`console.error`. */
  log?: (level: "info" | "error", message: string) => void;
}

// ---------------------------------------------------------------------------
// Fixture loader
// ---------------------------------------------------------------------------

function loadFixture(): BondPriceFixtureShape {
  // Resolve relative to this file's directory (prototype/scripts/agents/).
  const fixturePath = resolve(import.meta.dir, "../../seeds/bond-prices.json");
  return require(fixturePath) as BondPriceFixtureShape;
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Ingest SA government bond reference prices for a single date from the
 * build-phase fixture. Synchronous — no network calls in the build phase.
 */
export function runBondPriceIngestForDate(opts: BondPriceIngestOptions): BondPriceIngestResult {
  const log =
    opts.log ?? ((level, msg) => (level === "error" ? console.error(msg) : console.log(msg)));

  let fixture: BondPriceFixtureShape;
  try {
    fixture = loadFixture();
  } catch (err) {
    const msg = `fixture load failed — ${String(err)}`;
    log("error", `[bond-price-ingest] ERROR: ${msg}`);
    return { ticksAppended: 0, ticksSkipped: 0, ok: false, error: msg };
  }

  const store = new MarketDataStore(opts.dbPath);
  try {
    const source = makeFixtureBondPriceSource(fixture);
    const result = runBondPriceIngest({ date: opts.date, source, marketDataStore: store });
    log(
      "info",
      `[bond-price-ingest] date=${opts.date} appended=${result.ticksAppended} skipped=${result.ticksSkippedAsDuplicate}`,
    );
    return {
      ticksAppended: result.ticksAppended,
      ticksSkipped: result.ticksSkippedAsDuplicate,
      ok: true,
    };
  } catch (err) {
    const msg = `ingest failed — ${String(err)}`;
    log("error", `[bond-price-ingest] ERROR: ${msg}`);
    return { ticksAppended: 0, ticksSkipped: 0, ok: false, error: msg };
  } finally {
    store.close();
  }
}

/**
 * Seed all historical SA government bond reference-price dates from the
 * build-phase fixture.
 */
export function runBondPriceIngestAllDates(opts: BondPriceIngestAllOptions): BondPriceIngestResult {
  const log =
    opts.log ?? ((level, msg) => (level === "error" ? console.error(msg) : console.log(msg)));

  let fixture: BondPriceFixtureShape;
  try {
    fixture = loadFixture();
  } catch (err) {
    const msg = `fixture load failed — ${String(err)}`;
    log("error", `[bond-price-ingest] ERROR: ${msg}`);
    return { ticksAppended: 0, ticksSkipped: 0, ok: false, error: msg };
  }

  const store = new MarketDataStore(opts.dbPath);
  try {
    const source = makeFixtureBondPriceSource(fixture);
    const results = runBondPriceIngestAll({ source, marketDataStore: store });
    const totalAppended = results.reduce((sum, r) => sum + r.ticksAppended, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.ticksSkippedAsDuplicate, 0);
    log(
      "info",
      `[bond-price-ingest] all-dates: ${results.length} dates processed, ${totalAppended} appended, ${totalSkipped} skipped`,
    );
    return { ticksAppended: totalAppended, ticksSkipped: totalSkipped, ok: true };
  } catch (err) {
    const msg = `ingest-all failed — ${String(err)}`;
    log("error", `[bond-price-ingest] ERROR: ${msg}`);
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
    const result = runBondPriceIngestAllDates({ dbPath });
    if (!result.ok) process.exit(1);
    return;
  }

  const date = args[0] ?? nowUtc().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(`[bond-price-ingest] ERROR: invalid date "${date}" — expected YYYY-MM-DD`);
    process.exit(1);
  }

  const result = runBondPriceIngestForDate({ dbPath, date });
  if (!result.ok) process.exit(1);
}

// Run as CLI only when invoked directly, not when imported by a handler.
if (import.meta.main) {
  main();
}
