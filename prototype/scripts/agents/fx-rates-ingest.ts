// scripts/agents/fx-rates-ingest.ts
//
// FX rates ingest agent — fetches live spot rates from open.er-api.com and
// stores new ones in the MarketDataStore (SQLite). The API updates once per
// day; dedup by (pair, updateUtc) prevents storing the same day's snapshot
// more than once.
//
// This file exposes two entry points:
//   - `runFxRatesIngest()` — pure function (no process.exit); used by the
//     Devon scheduled handler `devon:fx-rates-ingest`.
//   - `main()` (CLI shape, run when invoked directly via `bun run ...`) —
//     unchanged operator-facing behaviour for manual / ad-hoc runs.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION
// Author: Devon (Chief Operating Officer, engineering)
//
// Usage:
//   bun run scripts/agents/fx-rates-ingest.ts
//   bun run fx-rates:ingest

import { resolveMarketDataDbPath } from "../../platform/market-data/resolve-market-data-db";
import { MarketDataStore } from "../../platform/market-data/store";
import type { FxQuotePayload } from "../../platform/market-data/types";
import { parseFxRatesFromApiResponse } from "./fx-rates-parse";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FX_RATES_URL = "https://open.er-api.com/v6/latest/ZAR";
const SOURCE = "open-er-api";

// ---------------------------------------------------------------------------
// Public function — usable from handlers + tests
// ---------------------------------------------------------------------------

export interface FxRatesIngestOptions {
  /** Path to the MarketDataStore SQLite file. */
  dbPath: string;
  /**
   * Logging sink. Defaults to `console.log`/`console.error`. Pass a no-op
   * to silence; handlers wire their structured logger here.
   */
  log?: (level: "info" | "error", message: string) => void;
}

export interface FxRatesIngestResult {
  readonly fetched: number;
  readonly newStored: number;
  readonly ok: boolean;
  readonly error?: string;
}

export async function runFxRatesIngest(opts: FxRatesIngestOptions): Promise<FxRatesIngestResult> {
  const log =
    opts.log ?? ((level, msg) => (level === "error" ? console.error(msg) : console.log(msg)));

  const mdStore = new MarketDataStore(opts.dbPath);

  let responseJson: unknown;
  try {
    const resp = await fetch(FX_RATES_URL, { signal: AbortSignal.timeout(30_000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    responseJson = await resp.json();
  } catch (err) {
    mdStore.close();
    const msg = `fetch failed — ${String(err)}`;
    log("error", `[fx-rates-ingest] ERROR: ${msg}`);
    return { fetched: 0, newStored: 0, ok: false, error: msg };
  }

  let rates: ReturnType<typeof parseFxRatesFromApiResponse>;
  try {
    rates = parseFxRatesFromApiResponse(responseJson);
  } catch (err) {
    mdStore.close();
    const msg = `parse failed — ${String(err)}`;
    log("error", `[fx-rates-ingest] ERROR: ${msg}`);
    return { fetched: 0, newStored: 0, ok: false, error: msg };
  }

  const existing = mdStore.query({ source: SOURCE });
  const existingIds = new Set(existing.map((t) => t.id));

  let newCount = 0;
  for (const rate of rates) {
    const { pair, mid, bid, ask, updateUtc } = rate;
    const id = `${SOURCE}:${pair}:${updateUtc}`;
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
      asOf: new Date(updateUtc).toISOString(),
      payload: payload as unknown as Record<string, unknown>,
    });

    log("info", `[fx-rates-ingest] NEW: ${pair} mid=${mid.toFixed(4)} (${updateUtc})`);
    newCount++;
  }

  log("info", `[fx-rates-ingest] fetched ${rates.length} rates, ${newCount} new stored`);
  mdStore.close();

  return { fetched: rates.length, newStored: newCount, ok: true };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const dbPath = resolveMarketDataDbPath().path;
  const result = await runFxRatesIngest({ dbPath });
  if (!result.ok) process.exit(1);
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    console.error(`[fx-rates-ingest] FATAL: ${String(err)}`);
    process.exit(1);
  });
}
