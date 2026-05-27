// scripts/ingest-zaronia-rates.ts
//
// Ingests the full ZARONIA fixture into MarketDataStore.
//
// What this does
// --------------
// Loads `seeds/zaronia-rates.json`, constructs a fixture-backed
// `SarbZaroniaSource`, and runs the ingester (`runSarbZaroniaIngestAll`)
// for every date in the fixture. Idempotent — re-running produces zero
// new ticks.
//
// Usage
// -----
// bun run scripts/ingest-zaronia-rates.ts
// bun run ingest:zaronia
//
// Override paths via env vars:
//   BANK_MARKET_DATA_DB=<path>  — market-data DB (default: centralized config store)
//
// Authority
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 7 (ZARONIA feed blocker for IRS model)
//   - Policies/market-risk-policy-v1.md
//   - Team/Ravi.md (ZARONIA conventions)
//
// Author: Ravi (Treasury / ALM engineer)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { resolveMarketDataDbPath } from "../platform/market-data/resolve-market-data-db";
import {
  type SarbZaroniaFixtureShape,
  makeFixtureSarbZaroniaSource,
  runSarbZaroniaIngestAll,
} from "../platform/market-data/sarb-zaronia-ingester";
import { MarketDataStore } from "../platform/market-data/store";

const FIXTURE_PATH = resolve(import.meta.dir, "../seeds/zaronia-rates.json");

function main(): number {
  const marketDbPath = resolveMarketDataDbPath().path;

  // ---- Load fixture --------------------------------------------------------
  let fixture: SarbZaroniaFixtureShape;
  try {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    fixture = JSON.parse(raw) as SarbZaroniaFixtureShape;
  } catch (err) {
    console.error(`[ingest-zaronia-rates] ERROR: failed to load fixture — ${String(err)}`);
    return 1;
  }

  if (!fixture.instrument || !fixture.fixings || Object.keys(fixture.fixings).length === 0) {
    console.error(
      "[ingest-zaronia-rates] ERROR: fixture is malformed (missing instrument / fixings)",
    );
    return 1;
  }

  // ---- Open store ----------------------------------------------------------
  const marketDataStore = new MarketDataStore(marketDbPath);

  const source = makeFixtureSarbZaroniaSource(fixture);

  console.log(
    `[ingest-zaronia-rates] seeding SARB ZARONIA rates — ${source.allDates().length} dates`,
  );
  console.log(`[ingest-zaronia-rates] market-data DB: ${marketDbPath}`);

  // ---- Run -----------------------------------------------------------------
  const results = runSarbZaroniaIngestAll({
    source,
    marketDataStore,
  });

  // ---- Summary -------------------------------------------------------------
  let totalTicksAppended = 0;
  let totalTicksSkipped = 0;
  for (const r of results) {
    totalTicksAppended += r.ticksAppended;
    totalTicksSkipped += r.ticksSkippedAsDuplicate;
  }

  console.log(
    `[ingest-zaronia-rates] ticks: ${totalTicksAppended} appended, ${totalTicksSkipped} skipped (dup)`,
  );

  marketDataStore.close();
  return 0;
}

process.exit(main());
