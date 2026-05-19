// scripts/agents/fx-rates-ingest.ts
//
// FX rates ingest agent — fetches live spot rates from open.er-api.com and
// stores new ones in the MarketDataStore (SQLite). Run daily via launchd.
// The API updates once per day; dedup by (pair, updateUtc) prevents storing
// the same day's snapshot more than once.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION
// Author: Devon (Chief Operating Officer, engineering)
//
// Usage:
//   bun run scripts/agents/fx-rates-ingest.ts
//   bun run fx-rates:ingest

import { MarketDataStore } from "../../platform/market-data/store";
import type { FxQuotePayload } from "../../platform/market-data/types";
import { parseFxRatesFromApiResponse } from "./fx-rates-parse";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FX_RATES_URL = "https://open.er-api.com/v6/latest/ZAR";

const DB_PATH = process.env.BANK_MARKET_DATA_DB ?? ".local/market-data.db";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const mdStore = new MarketDataStore(DB_PATH);

  // ---- Fetch ---------------------------------------------------------------
  let responseJson: unknown;
  try {
    const resp = await fetch(FX_RATES_URL, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    }
    responseJson = await resp.json();
  } catch (err) {
    console.error(`[fx-rates-ingest] ERROR: fetch failed — ${String(err)}`);
    process.exit(1);
  }

  // ---- Parse ---------------------------------------------------------------
  let rates: ReturnType<typeof parseFxRatesFromApiResponse>;
  try {
    rates = parseFxRatesFromApiResponse(responseJson);
  } catch (err) {
    console.error(`[fx-rates-ingest] ERROR: parse failed — ${String(err)}`);
    process.exit(1);
  }

  // ---- Dedup ---------------------------------------------------------------
  const existing = mdStore.query({ source: "open-er-api" });
  const existingIds = new Set(existing.map((t) => t.id));

  // ---- Store ---------------------------------------------------------------
  let newCount = 0;
  for (const rate of rates) {
    const { pair, mid, bid, ask, updateUtc } = rate;
    const id = `open-er-api:${pair}:${updateUtc}`;

    if (existingIds.has(id)) {
      // Same day's snapshot already stored — skip silently
      continue;
    }

    const payload: FxQuotePayload = {
      pair,
      mid,
      bid,
      ask,
      source: "open-er-api",
    } satisfies FxQuotePayload;

    mdStore.append({
      id,
      source: "open-er-api",
      instrument: pair,
      dataType: "fx-quote",
      provenance: "production",
      asOf: new Date(updateUtc).toISOString(),
      payload: payload as unknown as Record<string, unknown>,
    });

    console.log(`[fx-rates-ingest] NEW: ${pair} mid=${mid.toFixed(4)} (${updateUtc})`);
    newCount++;
  }

  console.log(`[fx-rates-ingest] fetched ${rates.length} rates, ${newCount} new stored`);

  mdStore.close();
}

main().catch((err: unknown) => {
  console.error(`[fx-rates-ingest] FATAL: ${String(err)}`);
  process.exit(1);
});
