// scripts/agents/repo-rate-ingest.ts
//
// SARB repo rate and prime rate ingest script — loads the build-phase fixture
// and stores SARB MPC decision ticks in the MarketDataStore (SQLite).
//
// This file exposes two entry points:
//   - `runRepoRateIngestForDate()` — pure synchronous function; used by
//     the Ravi scheduled handler `ravi:repo-rate-ingest`. Resolves the
//     effective MPC decision on the given date and stores it (step-function).
//   - `runRepoRateIngestAllDates()` — seeds all MPC decision dates from the
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
//   bun run scripts/agents/repo-rate-ingest.ts [YYYY-MM-DD]
//   bun run scripts/agents/repo-rate-ingest.ts --all

import { resolve } from "node:path";
import { resolveMarketDataDbPath } from "../../platform/market-data/resolve-market-data-db";
import {
  type SarbRepoFixtureShape,
  makeFixtureSarbRepoPrimeSource,
  runSarbRepoPrimeIngest,
  runSarbRepoPrimeIngestAll,
} from "../../platform/market-data/sarb-repo-prime-ingester";
import { MarketDataStore } from "../../platform/market-data/store";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface RepoRateIngestOptions {
  /** Path to the MarketDataStore SQLite file. */
  dbPath: string;
  /** ISO 8601 date (YYYY-MM-DD) to resolve the effective repo rate for. */
  date: string;
  /**
   * Logging sink. Defaults to `console.log`/`console.error`.
   */
  log?: (level: "info" | "error", message: string) => void;
}

export interface RepoRateIngestResult {
  /** Number of ticks newly written to the store. */
  readonly ticksAppended: number;
  /** Number of ticks already present (deduped). */
  readonly ticksSkipped: number;
  /** Whether the ingest cycle completed without throwing. */
  readonly ok: boolean;
  /** Error message if `ok` is false. */
  readonly error?: string;
}

export interface RepoRateIngestAllOptions {
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

function loadFixture(): SarbRepoFixtureShape {
  const fixturePath = resolve(import.meta.dir, "../../seeds/sarb-repo-rate.json");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(fixturePath) as SarbRepoFixtureShape;
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Resolve and store the effective SARB repo/prime rate for a given date.
 * Uses step-function semantics: the most-recent MPC decision on or before
 * `date` is stored. Synchronous — no network calls in the build phase.
 */
export function runRepoRateIngestForDate(opts: RepoRateIngestOptions): RepoRateIngestResult {
  const log =
    opts.log ?? ((level, msg) => (level === "error" ? console.error(msg) : console.log(msg)));

  let fixture: SarbRepoFixtureShape;
  try {
    fixture = loadFixture();
  } catch (err) {
    const msg = `fixture load failed — ${String(err)}`;
    log("error", `[repo-rate-ingest] ERROR: ${msg}`);
    return { ticksAppended: 0, ticksSkipped: 0, ok: false, error: msg };
  }

  const store = new MarketDataStore(opts.dbPath);
  try {
    const source = makeFixtureSarbRepoPrimeSource(fixture);
    const result = runSarbRepoPrimeIngest({ date: opts.date, source, marketDataStore: store });
    log(
      "info",
      `[repo-rate-ingest] date=${opts.date} effective=${result.effectiveDecisionDate ?? "none"} appended=${result.ticksAppended} skipped=${result.ticksSkippedAsDuplicate}`,
    );
    return {
      ticksAppended: result.ticksAppended,
      ticksSkipped: result.ticksSkippedAsDuplicate,
      ok: true,
    };
  } catch (err) {
    const msg = `ingest failed — ${String(err)}`;
    log("error", `[repo-rate-ingest] ERROR: ${msg}`);
    return { ticksAppended: 0, ticksSkipped: 0, ok: false, error: msg };
  } finally {
    store.close();
  }
}

/**
 * Seed all MPC decision dates from the build-phase fixture.
 * Stores one tick per decision (step-function — decision dates only,
 * not every business day).
 */
export function runRepoRateIngestAllDates(opts: RepoRateIngestAllOptions): RepoRateIngestResult {
  const log =
    opts.log ?? ((level, msg) => (level === "error" ? console.error(msg) : console.log(msg)));

  let fixture: SarbRepoFixtureShape;
  try {
    fixture = loadFixture();
  } catch (err) {
    const msg = `fixture load failed — ${String(err)}`;
    log("error", `[repo-rate-ingest] ERROR: ${msg}`);
    return { ticksAppended: 0, ticksSkipped: 0, ok: false, error: msg };
  }

  const store = new MarketDataStore(opts.dbPath);
  try {
    const source = makeFixtureSarbRepoPrimeSource(fixture);
    const results = runSarbRepoPrimeIngestAll({ source, marketDataStore: store });
    const totalAppended = results.reduce((sum, r) => sum + r.ticksAppended, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.ticksSkippedAsDuplicate, 0);
    log(
      "info",
      `[repo-rate-ingest] all-dates: ${results.length} decisions processed, ${totalAppended} appended, ${totalSkipped} skipped`,
    );
    return { ticksAppended: totalAppended, ticksSkipped: totalSkipped, ok: true };
  } catch (err) {
    const msg = `ingest-all failed — ${String(err)}`;
    log("error", `[repo-rate-ingest] ERROR: ${msg}`);
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
    const result = runRepoRateIngestAllDates({ dbPath });
    if (!result.ok) process.exit(1);
    return;
  }

  const date = args[0] ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(`[repo-rate-ingest] ERROR: invalid date "${date}" — expected YYYY-MM-DD`);
    process.exit(1);
  }

  const result = runRepoRateIngestForDate({ dbPath, date });
  if (!result.ok) process.exit(1);
}

// Run as CLI only when invoked directly, not when imported by a handler.
if (import.meta.main) {
  main();
}
