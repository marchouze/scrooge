// platform/recon/spread-benchmarking.ts
//
// Advisory spread-benchmarking recon.
//
// For each FxTradeExecuted event in the last 30 days, computes the spread
// between the trade rate and the closest MarketDataStore mid-rate tick
// (same pair, closest asOf <= trade time). Aggregates per pair and flags
// individual outlier trades (spreadBps > 3 × pair average).
//
// ADVISORY ONLY — not wired into the CI chain. Run on demand:
//   bun run recon:spread-benchmarking
//
// Environment:
//   BANK_EVENT_DB         path to SQLite event store
//   BANK_MARKET_DATA_DB   path to SQLite market data store
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   - ORG-MK-08 (Currency and Exchanges Manual — Authorised Dealer rules)
//   - EXCON-SARB-CIRC-3-2020 (cross-border FX reporting)
//
// Author: Rohan (Market risk engineer, engineering)

import { EventStore } from "../event-store/store";
import { toCanonicalPair } from "../market-data/canonical-pair";
import { MarketDataStore } from "../market-data/store";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOOKBACK_DAYS = 30;
const OUTLIER_MULTIPLIER = 3; // flag if spreadBps > 3 × pair average

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pairToString(pair: { base: string; quote: string }): string {
  // Wire direction preserved here — used to query the market-data store
  // by instrument. Aggregation keys below are canonicalised separately.
  return `${pair.base}/${pair.quote}`;
}

/** Compute date N days before today as YYYY-MM-DD. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Extract mid rate from a MarketDataStore tick payload. */
function extractMid(payload: Record<string, unknown>): number | undefined {
  if (typeof payload.mid === "number") return payload.mid;
  if (typeof payload.midRate === "number") return payload.midRate;
  if (typeof payload.bid === "number" && typeof payload.ask === "number") {
    return ((payload.bid as number) + (payload.ask as number)) / 2;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface TradeSpreadRow {
  tradeId: string;
  pair: string;
  tradeAsOf: string;
  tradeRate: number;
  midRate: number;
  spread: number;
  spreadBps: number;
  outlier: boolean;
}

interface PairAggregate {
  pair: string;
  tradeCount: number;
  avgSpreadBps: number;
  maxSpreadBps: number;
}

async function main(): Promise<void> {
  const eventDbPath = process.env.BANK_EVENT_DB;
  const marketDbPath = process.env.BANK_MARKET_DATA_DB;

  if (!eventDbPath) {
    console.error("[spread-benchmarking] ERROR: BANK_EVENT_DB not set.");
    process.exit(1);
  }
  if (!marketDbPath) {
    console.error("[spread-benchmarking] ERROR: BANK_MARKET_DATA_DB not set.");
    process.exit(1);
  }

  const store = new EventStore(eventDbPath);
  const mdStore = new MarketDataStore(marketDbPath);

  const fromDate = daysAgo(LOOKBACK_DAYS);
  console.log(`[spread-benchmarking] Analysing FX trades from ${fromDate} to today.`);

  // -------------------------------------------------------------------------
  // Step 1: Collect all FxTradeExecuted events in the lookback window.
  // -------------------------------------------------------------------------
  const rows: Omit<TradeSpreadRow, "outlier">[] = [];

  for (const e of store.replay({
    type: "FxTradeExecuted",
    asOf: new Date().toISOString().slice(0, 10),
  })) {
    if (e.as_of < fromDate) continue;

    const p = e.payload as unknown as FxTradeExecutedPayload;
    const tradeId = p.tradeId.value;
    const pair = pairToString(p.currencyPair);
    const nearLeg = p.legs.find((l) => l.legKind === "near") ?? p.legs[0];
    if (!nearLeg) continue;

    // Determine trade rate (normalised to quote-per-base).
    const legRate = nearLeg.rate.amount;
    const tradeRate = nearLeg.rate.currency === p.currencyPair.quote ? legRate : 1 / legRate;

    // -----------------------------------------------------------------------
    // Step 2: Find closest production MarketDataStore tick (as_of <= trade.as_of).
    // Using provenance: "production" to benchmark against live rates only
    // (provenance filter required — D-MARKETS-SCHEMA-FOUNDATION;
    // Policies/valuation-policy-v1.md §4.3).
    // -----------------------------------------------------------------------
    const ticks = mdStore.query({
      instrument: pair,
      dataType: "fx-quote",
      provenance: "production",
      to: e.as_of,
      limit: 1,
    });

    if (ticks.length === 0 || ticks[0] === undefined) continue;

    const mid = extractMid(ticks[0].payload);
    if (mid === undefined || mid <= 0) continue;

    const spread = Math.abs(tradeRate - mid);
    const spreadBps = (spread / mid) * 10_000;

    rows.push({
      tradeId,
      pair,
      tradeAsOf: e.as_of,
      tradeRate,
      midRate: mid,
      spread,
      spreadBps,
    });
  }

  if (rows.length === 0) {
    console.log(
      "[spread-benchmarking] No FX trades with matching market data found in lookback window.",
    );
    store.close();
    mdStore.close();
    return;
  }

  // -------------------------------------------------------------------------
  // Step 3: Aggregate by **canonical** pair so direct + inverse directions
  // share a single bucket for outlier statistics (Marc, 2026-05-21).
  // -------------------------------------------------------------------------
  const canonicalKeyOf = (pair: string): string => {
    const slash = pair.indexOf("/");
    if (slash <= 0 || slash === pair.length - 1) return pair;
    return toCanonicalPair(pair.slice(0, slash), pair.slice(slash + 1)).pairKey;
  };

  const pairGroups = new Map<string, number[]>();
  for (const row of rows) {
    const k = canonicalKeyOf(row.pair);
    const arr = pairGroups.get(k) ?? [];
    arr.push(row.spreadBps);
    pairGroups.set(k, arr);
  }

  const pairStats = new Map<string, { avg: number; max: number; count: number }>();
  for (const [pair, bpsArr] of pairGroups) {
    const avg = bpsArr.reduce((a, b) => a + b, 0) / bpsArr.length;
    const max = Math.max(...bpsArr);
    pairStats.set(pair, { avg, max, count: bpsArr.length });
  }

  // -------------------------------------------------------------------------
  // Step 4: Flag outliers (lookup against the canonical bucket).
  // -------------------------------------------------------------------------
  const tradeRows: TradeSpreadRow[] = rows.map((row) => {
    const stats = pairStats.get(canonicalKeyOf(row.pair));
    const outlier = stats !== undefined && row.spreadBps > OUTLIER_MULTIPLIER * stats.avg;
    return { ...row, outlier };
  });

  // -------------------------------------------------------------------------
  // Step 5: Print results.
  // -------------------------------------------------------------------------
  console.log("\n─────────────────────────────────────────────────────────────────────");
  console.log("  SPREAD BENCHMARKING — PAIR AGGREGATES");
  console.log("─────────────────────────────────────────────────────────────────────");
  console.log(
    `  ${"Pair".padEnd(12)}  ${"Count".padStart(6)}  ${"Avg Spread (bps)".padStart(18)}  ${"Max Spread (bps)".padStart(18)}`,
  );
  console.log(`  ${"─".repeat(60)}`);

  const aggregates: PairAggregate[] = [...pairStats.entries()].map(([pair, s]) => ({
    pair,
    tradeCount: s.count,
    avgSpreadBps: s.avg,
    maxSpreadBps: s.max,
  }));
  aggregates.sort((a, b) => a.pair.localeCompare(b.pair));

  for (const agg of aggregates) {
    console.log(
      `  ${agg.pair.padEnd(12)}  ${String(agg.tradeCount).padStart(6)}  ${agg.avgSpreadBps.toFixed(2).padStart(18)}  ${agg.maxSpreadBps.toFixed(2).padStart(18)}`,
    );
  }

  const outliers = tradeRows.filter((r) => r.outlier);
  if (outliers.length > 0) {
    console.log("\n─────────────────────────────────────────────────────────────────────");
    console.log(`  OUTLIER TRADES (spreadBps > ${OUTLIER_MULTIPLIER}× pair average)`);
    console.log("─────────────────────────────────────────────────────────────────────");
    console.log(
      `  ${"Trade ID".padEnd(36)}  ${"Pair".padEnd(10)}  ${"Date".padEnd(12)}  ${"Trade Rate".padStart(12)}  ${"Mid Rate".padStart(10)}  ${"Spread (bps)".padStart(14)}`,
    );
    console.log(`  ${"─".repeat(100)}`);
    for (const row of outliers) {
      console.log(
        `  ${row.tradeId.padEnd(36)}  ${row.pair.padEnd(10)}  ${row.tradeAsOf.padEnd(12)}  ${row.tradeRate.toFixed(4).padStart(12)}  ${row.midRate.toFixed(4).padStart(10)}  ${row.spreadBps.toFixed(2).padStart(14)}`,
      );
    }
  } else {
    console.log("\n  No outlier trades found.");
  }

  console.log("\n─────────────────────────────────────────────────────────────────────");
  console.log(
    `\n[spread-benchmarking] Done. ${rows.length} trade(s) analysed; ${outliers.length} outlier(s).`,
  );

  store.close();
  mdStore.close();
}

main().catch((err) => {
  console.error("[spread-benchmarking] FATAL:", err);
  process.exit(1);
});
