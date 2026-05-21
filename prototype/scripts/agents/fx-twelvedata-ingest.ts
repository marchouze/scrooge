// scripts/agents/fx-twelvedata-ingest.ts
//
// FX rates ingest agent (secondary source) — fetches live spot quotes from
// Twelve Data (https://api.twelvedata.com) and stores new ticks in the
// MarketDataStore (SQLite).
//
// This is the **second** free FX source, run alongside fx-rates-ingest
// (open.er-api.com). Twelve Data updates intraday on the free tier (delayed
// — typically EOD-ish but not daily-only), giving the tape actual motion
// and enabling two-source IPV cross-checks in mtm-run.ts.
//
// Free-tier quotas: 800 req/day, 8 req/min. Batched 6-symbol /quote counts
// as a single request, so the suggested hourly cadence costs ~24 req/day —
// comfortably within budget.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION
//
// Scheduler integration is a follow-on item — same posture as
// fx-rates-ingest, which is also designed-for-cron but invoked manually
// until the scheduling harness lands.
//
// Usage:
//   BANK_TWELVEDATA_API_KEY=<key> bun run scripts/agents/fx-twelvedata-ingest.ts
//   BANK_TWELVEDATA_API_KEY=<key> bun run twelve-data:ingest

import { MarketDataStore } from "../../platform/market-data/store";
import type { FxQuotePayload } from "../../platform/market-data/types";
import { TWELVE_DATA_TARGET_PAIRS, parseTwelveDataQuoteResponse } from "./fx-twelvedata-parse";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TWELVE_DATA_BASE = "https://api.twelvedata.com/quote";
const SOURCE = "twelve-data";

const DB_PATH = process.env.BANK_MARKET_DATA_DB ?? ".local/market-data.db";
const API_KEY = process.env.BANK_TWELVEDATA_API_KEY;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!API_KEY) {
    console.error(
      "[fx-twelvedata-ingest] ERROR: BANK_TWELVEDATA_API_KEY env var not set — skipping. Register a free key at https://twelvedata.com/register.",
    );
    process.exit(1);
  }

  const mdStore = new MarketDataStore(DB_PATH);

  const url = new URL(TWELVE_DATA_BASE);
  url.searchParams.set("symbol", TWELVE_DATA_TARGET_PAIRS.join(","));
  url.searchParams.set("apikey", API_KEY);

  // ---- Fetch ---------------------------------------------------------------
  let responseJson: unknown;
  try {
    const resp = await fetch(url.toString(), {
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    }
    responseJson = await resp.json();
  } catch (err) {
    console.error(`[fx-twelvedata-ingest] ERROR: fetch failed — ${String(err)}`);
    process.exit(1);
  }

  // ---- Parse ---------------------------------------------------------------
  let quotes: ReturnType<typeof parseTwelveDataQuoteResponse>;
  try {
    quotes = parseTwelveDataQuoteResponse(responseJson);
  } catch (err) {
    console.error(`[fx-twelvedata-ingest] ERROR: parse failed — ${String(err)}`);
    process.exit(1);
  }

  // ---- Dedup ---------------------------------------------------------------
  const existing = mdStore.query({ source: SOURCE });
  const existingIds = new Set(existing.map((t) => t.id));

  // ---- Store ---------------------------------------------------------------
  let newCount = 0;
  for (const quote of quotes) {
    const { pair, mid, bid, ask, timestamp, asOf } = quote;
    const id = `${SOURCE}:${pair}:${timestamp}`;

    if (existingIds.has(id)) continue;

    const payload: FxQuotePayload = {
      pair,
      mid,
      bid,
      ask,
      source: SOURCE,
    } satisfies FxQuotePayload;

    mdStore.append({
      id,
      source: SOURCE,
      instrument: pair,
      dataType: "fx-quote",
      provenance: "production",
      asOf,
      payload: payload as unknown as Record<string, unknown>,
    });

    console.log(`[fx-twelvedata-ingest] NEW: ${pair} mid=${mid.toFixed(4)} (${asOf})`);
    newCount++;
  }

  console.log(`[fx-twelvedata-ingest] fetched ${quotes.length} quotes, ${newCount} new stored`);

  mdStore.close();
}

main().catch((err: unknown) => {
  console.error(`[fx-twelvedata-ingest] FATAL: ${String(err)}`);
  process.exit(1);
});
