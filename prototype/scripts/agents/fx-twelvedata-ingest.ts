// scripts/agents/fx-twelvedata-ingest.ts
//
// FX rates ingest agent (secondary source) — fetches live spot quotes from
// Twelve Data (https://api.twelvedata.com) and stores new ticks in the
// MarketDataStore (SQLite).
//
// This file exposes two entry points:
//   - `runTwelveDataIngest()` — pure function (no process.exit); used by
//     the Devon scheduled handler `devon:fx-twelvedata-ingest`.
//   - `main()` (CLI shape, run when invoked directly via `bun run ...`) —
//     unchanged operator-facing behaviour for manual / ad-hoc runs.
//
// This is the **second** free FX source, run alongside fx-rates-ingest
// (open.er-api.com). Twelve Data updates intraday on the free tier (delayed
// — typically EOD-ish but not daily-only), giving the tape actual motion
// and enabling two-source IPV cross-checks in mtm-run.ts.
//
// Free-tier quotas: 800 req/day, 8 req/min. The batched 6-symbol /quote
// counts as 6 credits (one per symbol), so the hourly cadence wired in
// `devon:fx-twelvedata-ingest` costs ~144 req/day, well under the daily
// cap.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION
//
// Usage:
//   BANK_TWELVEDATA_API_KEY=<key> bun run scripts/agents/fx-twelvedata-ingest.ts
//   BANK_TWELVEDATA_API_KEY=<key> bun run twelve-data:ingest

import { resolveMarketDataDbPath } from "../../platform/market-data/resolve-market-data-db";
import { MarketDataStore } from "../../platform/market-data/store";
import type { FxQuotePayload } from "../../platform/market-data/types";
import { TWELVE_DATA_TARGET_PAIRS, parseTwelveDataQuoteResponse } from "./fx-twelvedata-parse";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TWELVE_DATA_BASE = "https://api.twelvedata.com/quote";
const SOURCE = "twelve-data";

// ---------------------------------------------------------------------------
// Public function — usable from handlers + tests
// ---------------------------------------------------------------------------

export interface TwelveDataIngestOptions {
  /** Path to the MarketDataStore SQLite file. */
  dbPath: string;
  /** Twelve Data API key. */
  apiKey: string;
  /**
   * Logging sink. Defaults to `console.log`/`console.error`. Pass a no-op
   * to silence; handlers wire their structured logger here.
   */
  log?: (level: "info" | "error", message: string) => void;
}

export interface TwelveDataIngestResult {
  /** Number of quotes returned by the parser. */
  readonly fetched: number;
  /** Number of ticks newly written to the store. */
  readonly newStored: number;
  /** Whether the fetch + parse + store cycle completed without throwing. */
  readonly ok: boolean;
  /** Error message if `ok` is false. */
  readonly error?: string;
}

export async function runTwelveDataIngest(
  opts: TwelveDataIngestOptions,
): Promise<TwelveDataIngestResult> {
  const log =
    opts.log ?? ((level, msg) => (level === "error" ? console.error(msg) : console.log(msg)));

  const mdStore = new MarketDataStore(opts.dbPath);

  const url = new URL(TWELVE_DATA_BASE);
  url.searchParams.set("symbol", TWELVE_DATA_TARGET_PAIRS.join(","));
  url.searchParams.set("apikey", opts.apiKey);

  let responseJson: unknown;
  try {
    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(30_000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    responseJson = await resp.json();
  } catch (err) {
    mdStore.close();
    const msg = `fetch failed — ${String(err)}`;
    log("error", `[fx-twelvedata-ingest] ERROR: ${msg}`);
    return { fetched: 0, newStored: 0, ok: false, error: msg };
  }

  let quotes: ReturnType<typeof parseTwelveDataQuoteResponse>;
  try {
    quotes = parseTwelveDataQuoteResponse(responseJson);
  } catch (err) {
    mdStore.close();
    const msg = `parse failed — ${String(err)}`;
    log("error", `[fx-twelvedata-ingest] ERROR: ${msg}`);
    return { fetched: 0, newStored: 0, ok: false, error: msg };
  }

  const existing = mdStore.query({ source: SOURCE });
  const existingIds = new Set(existing.map((t) => t.id));

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

    log("info", `[fx-twelvedata-ingest] NEW: ${pair} mid=${mid.toFixed(4)} (${asOf})`);
    newCount++;
  }

  log("info", `[fx-twelvedata-ingest] fetched ${quotes.length} quotes, ${newCount} new stored`);
  mdStore.close();

  return { fetched: quotes.length, newStored: newCount, ok: true };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const dbPath = resolveMarketDataDbPath().path;
  const apiKey = process.env.BANK_TWELVEDATA_API_KEY;

  if (!apiKey) {
    console.error(
      "[fx-twelvedata-ingest] ERROR: BANK_TWELVEDATA_API_KEY env var not set — skipping. Register a free key at https://twelvedata.com/register.",
    );
    process.exit(1);
  }

  const result = await runTwelveDataIngest({ dbPath, apiKey });
  if (!result.ok) process.exit(1);
}

// Run as CLI only when invoked directly, not when imported by a handler.
if (import.meta.main) {
  main().catch((err: unknown) => {
    console.error(`[fx-twelvedata-ingest] FATAL: ${String(err)}`);
    process.exit(1);
  });
}
