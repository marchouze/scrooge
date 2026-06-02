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

import { resolve } from "node:path";

import { resolveMarketDataDbPath } from "../platform/market-data/resolve-market-data-db";
import { ingestZaroniaFixtureFromFile } from "../platform/market-data/sarb-zaronia-ingester";
import { MarketDataStore } from "../platform/market-data/store";

const FIXTURE_PATH = resolve(import.meta.dir, "../seeds/zaronia-rates.json");

function main(): number {
  const marketDbPath = resolveMarketDataDbPath().path;
  const marketDataStore = new MarketDataStore(marketDbPath);

  console.log(`[ingest-zaronia-rates] market-data DB: ${marketDbPath}`);

  let result: { ticksAppended: number; ticksSkippedAsDuplicate: number; datesProcessed: number };
  try {
    result = ingestZaroniaFixtureFromFile(marketDataStore, FIXTURE_PATH);
  } catch (err) {
    console.error(`[ingest-zaronia-rates] ERROR: ${String(err)}`);
    marketDataStore.close();
    return 1;
  }

  console.log(
    `[ingest-zaronia-rates] ${result.datesProcessed} dates — ticks: ${result.ticksAppended} appended, ${result.ticksSkippedAsDuplicate} skipped (dup)`,
  );

  marketDataStore.close();
  return 0;
}

process.exit(main());
