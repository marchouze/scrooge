// scripts/mtm-run.ts
//
// MTM (mark-to-market) run orchestrator.
//
// Runs an EOD or intraday MTM cycle:
//   1. Opens EventStore + MarketDataStore from environment paths.
//   2. Resolves open FX positions (FxTradeExecuted minus SettlementConfirmed
//      and FxTradeCancelled).
//   3. For each open position, looks up the current mid rate from
//      MarketDataStore (provenance: "production") and:
//      a. Emits FxPositionRevalued (using the existing FX revaluation maker).
//      b. Runs IPV check: compares to the most-recent tick from a different
//         source in MarketDataStore (cross-source variance); emits
//         IpvExceptionRaised on breach.
//   4. Logs "bond MTM: no JSE price feed connected — skipped".
//   5. Runs EOD IRS mark-to-market revaluation (runEodIrsRevaluation over the
//      open IRS book; static JIBAR curve seed, idempotent per valuationDate).
//   6. Emits MtmRunCompleted.
//   7. Prints a summary table to stdout.
//   8. Exits 0.
//
// CLI args:
//   --type  eod|intraday   (default: eod)
//   --as-of YYYY-MM-DD     (default: today)
//
// Environment:
//   BANK_EVENT_DB         path to SQLite event store
//   BANK_MARKET_DATA_DB   path to SQLite market data store
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
//   - IFRS-9-§5.7.1 (FVTPL: changes in fair value through P&L)
//   - IAS-21-§28 (monetary items retranslated at closing rate)
//   - ORG-MK-08 (Currency and Exchanges Manual — Authorised Dealer rules)
//   - EXCON-SARB-CIRC-3-2020 (cross-border FX reporting)
//
// Author: Rohan (Market risk engineer, engineering)

import { randomUUID } from "node:crypto";

import { clock } from "../platform/composition";
import { moneyWireFromMinor } from "../platform/core/money-codec";
import { newEventId } from "../platform/core/types";
import {
  type FxPositionRevaluedPayload,
  makeFxPositionRevalued,
} from "../platform/event-store/event-types/fx-accounting";
import type { FxTradeCancelledPayload } from "../platform/event-store/event-types/fx-accounting";
import {
  makeIpvExceptionRaised,
  makeMtmRunCompleted,
} from "../platform/event-store/event-types/mtm";
import { EventStore } from "../platform/event-store/store";
import { resolveMarketDataDbPath } from "../platform/market-data/resolve-market-data-db";
import { MarketDataStore, lookupQuoteWithInverse } from "../platform/market-data/store";
import type {
  FxTradeExecutedPayload,
  SettlementConfirmedPayload,
} from "../platform/markets/cdm/fx";
import { baseAmountMinor } from "../platform/markets/cdm/fx-helpers";
import { runEodIrsRevaluation } from "../platform/markets/eod/irs-revaluation";
import { checkIpvTolerance } from "../platform/markets/ipv-tolerance";
import {
  adoptDailyOfficialFxMarks,
  adoptFxMark,
  resolveActivePolicyVersionRef,
} from "../platform/valuation/mark-adoption-engine";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BANK_ENTITY = "LE-ZA-HOZ-BANK";
const ENGINE_ACTOR = {
  type: "service" as const,
  id: "rohan:mtm-run",
};
const CITATIONS = [
  "D-MARKETS-SCHEMA-FOUNDATION",
  "D-FX-SALES-TRADING-FRONTEND",
  "IFRS-9-§5.7.1",
  "IAS-21-§28",
  "ORG-MK-08",
  "EXCON-SARB-CIRC-3-2020",
];

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { runType: "eod" | "intraday"; asOf: string } {
  const args = process.argv.slice(2);
  let runType: "eod" | "intraday" = "eod";
  let asOf = new Date().toISOString().slice(0, 10); // today YYYY-MM-DD

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--type" && args[i + 1]) {
      const t = args[i + 1];
      if (t !== "eod" && t !== "intraday") {
        console.error(`[mtm-run] ERROR: --type must be "eod" or "intraday", got "${t}"`);
        process.exit(1);
      }
      runType = t;
      i++;
    } else if (args[i] === "--as-of" && args[i + 1]) {
      asOf = args[i + 1];
      i++;
    }
  }

  return { runType, asOf };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pairToString(pair: { base: string; quote: string }): string {
  return `${pair.base}/${pair.quote}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { runType, asOf } = parseArgs();
  const runId = randomUUID();

  console.log(`[mtm-run] Starting ${runType.toUpperCase()} MTM run for ${asOf} (runId: ${runId})`);

  // -------------------------------------------------------------------------
  // Open stores
  // -------------------------------------------------------------------------

  const eventDbPath = process.env.BANK_EVENT_DB;
  const marketDbPath = resolveMarketDataDbPath().path;

  if (!eventDbPath) {
    console.error("[mtm-run] ERROR: BANK_EVENT_DB environment variable not set.");
    process.exit(1);
  }

  const store = new EventStore(eventDbPath);
  const mdStore = new MarketDataStore(marketDbPath);

  // -------------------------------------------------------------------------
  // FX positions: collect open trades
  // -------------------------------------------------------------------------

  // Step 1: Collect cancelled trade IDs (graceful — event type may be absent).
  const cancelledIds = new Set<string>();
  try {
    for (const e of store.replay({ type: "FxTradeCancelled" })) {
      const p = e.payload as unknown as FxTradeCancelledPayload;
      if (p.tradeId) cancelledIds.add(p.tradeId);
    }
  } catch {
    // FxTradeCancelled not yet registered in some environments — continue.
  }

  // Step 2: Collect all FX trades.
  const trades = new Map<string, FxTradeExecutedPayload>();
  for (const e of store.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as unknown as FxTradeExecutedPayload;
    const id = p.tradeId.value;
    if (!cancelledIds.has(id)) {
      trades.set(id, p);
    }
  }

  // Step 3: Remove settled positions (CDM SettlementConfirmed).
  const settledIds = new Set<string>();
  for (const e of store.replay({ type: "SettlementConfirmed" })) {
    const p = e.payload as unknown as SettlementConfirmedPayload;
    settledIds.add(p.tradeId);
  }
  // Also handle TradeMatured from the IFRS accounting domain.
  for (const e of store.replay({ type: "TradeMatured" })) {
    const p = e.payload as unknown as { tradeId: string };
    if (p.tradeId) settledIds.add(p.tradeId);
  }

  // -------------------------------------------------------------------------
  // FX MTM loop
  // -------------------------------------------------------------------------

  // Resolve the active valuation policy version once per run (Slice B.1).
  const policyVersionRef = resolveActivePolicyVersionRef(store);
  if (!policyVersionRef) {
    console.warn(
      "[mtm-run] WARN: no active PolicyVersionActivated for domain=valuation in event store. " +
        "OfficialMarkAdopted events will be skipped. Run `bun run backfill:policy-activations` to fix.",
    );
  }

  // Adopt a daily official mark for EVERY pair in the production feed, before
  // the per-position loop — decoupled from position revaluation so a freshly-
  // traded pair already carries a prior-day official mark (Product-Control P&L
  // Attribution otherwise fails "missing marketMoveMarks"). Idempotent.
  if (policyVersionRef) {
    const marks = adoptDailyOfficialFxMarks(store, mdStore, asOf, policyVersionRef);
    console.log(
      `[mtm-run] daily official FX marks — adopted ${marks.adopted.length} (${marks.adopted.join(", ") || "none"}), skipped ${marks.skipped.length} already-marked, ${marks.noRate.length} no-rate`,
    );
  }

  let positionsValued = 0;
  let positionsSkipped = 0;
  const skippedReasons: string[] = [];
  let totalPnlDeltaMinor = 0;
  const revaluedAt = clock.now();

  interface SummaryRow {
    tradeId: string;
    pair: string;
    primaryRate: number;
    bookRate: number;
    pnlDeltaMinor: number;
    ipvStatus: string;
  }
  const summaryRows: SummaryRow[] = [];

  for (const [tradeId, trade] of trades) {
    // Skip settled positions.
    if (settledIds.has(tradeId)) continue;

    const currencyPairStr = pairToString(trade.currencyPair);
    const nearLeg = trade.legs.find((l) => l.legKind === "near") ?? trade.legs[0];
    if (!nearLeg) {
      positionsSkipped++;
      skippedReasons.push(`${tradeId}: no legs`);
      continue;
    }

    // Look up production mid rate from MarketDataStore — direction-aware
    // (handles trades booked in the opposite direction to the upstream feed
    // convention, e.g. trade pair "ZAR/EUR" against stored "EUR/ZAR" tick).
    const directedQuote = lookupQuoteWithInverse(mdStore, currencyPairStr, {
      provenance: "production",
    });

    if (directedQuote === null) {
      // No production rate yet — build phase, skip gracefully.
      positionsSkipped++;
      const reason = `${tradeId} (${currencyPairStr}): no production rate in MarketDataStore (direct or inverse)`;
      console.warn(`[mtm-run] WARN: ${reason}`);
      if (!skippedReasons.includes(`no production rate for ${currencyPairStr}`)) {
        skippedReasons.push(`no production rate for ${currencyPairStr}`);
      }
      continue;
    }

    const tick = directedQuote.tick;
    const primaryRate = directedQuote.rate;

    // Book rate normalisation (same logic as fx-revaluation.ts).
    const legRate = nearLeg.rate.amount;
    const bookRate = nearLeg.rate.currency === trade.currencyPair.quote ? legRate : 1 / legRate;
    // Use baseAmountMinor() so BUY trades (where notional may hold the quote
    // currency amount) are handled correctly.
    const notionalBaseMinor = baseAmountMinor(nearLeg, trade.currencyPair);
    // "sell" = bank is short base: P&L > 0 when midRate < bookRate.
    const sideSign = trade.side === "buy" ? 1 : -1;

    // For cross-currency pairs (quote ≠ ZAR), (primaryRate − bookRate) is in
    // quote-currency units, not ZAR. Resolve per-currency ZAR rates so the
    // result is always in ZAR minor units (same approach as rohan-daily-mtm.ts).
    const quoteCcy = trade.currencyPair.quote;
    const quoteIsZar = quoteCcy === "ZAR";
    function resolveZarRate(ccy: string): number | null {
      if (ccy === "ZAR") return 1;
      const r = lookupQuoteWithInverse(mdStore, `${ccy}/ZAR`, { provenance: "production" });
      return r !== null ? r.rate : null;
    }
    const zarRateBase = resolveZarRate(trade.currencyPair.base);
    if (zarRateBase === null) {
      positionsSkipped++;
      skippedReasons.push(
        `${tradeId} (${currencyPairStr}): no ZAR rate for base ${trade.currencyPair.base}`,
      );
      continue;
    }
    const zarRateBase_book = quoteIsZar ? bookRate : bookRate * (resolveZarRate(quoteCcy) ?? 0);

    // Compute P&L delta.
    const unrealisedPnlZarMinor = Math.round(
      sideSign * notionalBaseMinor * (zarRateBase - zarRateBase_book),
    );

    // Emit OfficialMarkAdopted (Slice B.1) — pin the elected rate to the
    // active valuation policy before emitting the position revaluation.
    adoptFxMark({
      store,
      asOf,
      tick,
      markDecimal: primaryRate.toFixed(6),
      policyVersionRef,
    });

    // Emit FxPositionRevalued.
    const revalPayload: FxPositionRevaluedPayload = {
      tradeId,
      currencyPair: currencyPairStr,
      bookRate,
      revalRate: primaryRate,
      notionalBaseMinor,
      unrealisedPnlZarMinor,
      revaluedAt,
      rateSource: tick.source,
    };

    store.append(
      makeFxPositionRevalued({
        asOf,
        entity: BANK_ENTITY,
        actor: ENGINE_ACTOR,
        citations: CITATIONS,
        payload: revalPayload,
        eventId: newEventId(),
      }),
    );

    totalPnlDeltaMinor += unrealisedPnlZarMinor;
    positionsValued++;

    // -----------------------------------------------------------------------
    // IPV check: look up the most-recent tick from a different source than
    // the primary's, so the variance check is genuinely cross-provider
    // (e.g. open-er-api vs twelve-data). Direction-aware in the same way as
    // the primary lookup — if the secondary feed only stores the inverse
    // direction, the helper inverts the rate before comparison. Falls through
    // to "no-secondary-source" when only one source has data for this pair.
    // -----------------------------------------------------------------------
    let ipvStatus = "no-secondary-source";

    const secondaryQuote = lookupQuoteWithInverse(mdStore, currencyPairStr, {
      provenance: "production",
      excludeSource: tick.source,
    });

    if (secondaryQuote !== null) {
      const secTick = secondaryQuote.tick;
      const secondaryRate = secondaryQuote.rate;

      if (secondaryRate !== undefined && secondaryRate > 0) {
        const ipvResult = checkIpvTolerance(
          primaryRate,
          secondaryRate,
          notionalBaseMinor,
          currencyPairStr,
        );
        if (!ipvResult.pass) {
          // Emit IpvExceptionRaised.
          store.append(
            makeIpvExceptionRaised({
              asOf,
              entity: BANK_ENTITY,
              actor: ENGINE_ACTOR,
              citations: CITATIONS,
              payload: {
                positionId: tradeId,
                instrument: currencyPairStr,
                primaryRate,
                secondaryRateSource: secTick.source,
                secondaryRate,
                divergencePct: ipvResult.divergencePct * 100, // convert to %
                divergenceZar: ipvResult.divergenceZar,
                notional: notionalBaseMinor,
                currency: nearLeg.notional.currency,
              },
              eventId: newEventId(),
            }),
          );
          ipvStatus = `BREACH(${ipvResult.breachThreshold}: ${(ipvResult.divergencePct * 100).toFixed(4)}%)`;
        } else {
          ipvStatus = `OK(${(ipvResult.divergencePct * 100).toFixed(4)}%)`;
        }
      }
    }

    summaryRows.push({
      tradeId,
      pair: currencyPairStr,
      primaryRate,
      bookRate,
      pnlDeltaMinor: unrealisedPnlZarMinor,
      ipvStatus,
    });
  }

  // -------------------------------------------------------------------------
  // Bond MTM — no price feed connected yet
  // -------------------------------------------------------------------------
  const bondSkipReason = "bond MTM: no JSE price feed connected — skipped";
  console.warn(`[mtm-run] WARN: ${bondSkipReason}`);
  skippedReasons.push(bondSkipReason);

  // -------------------------------------------------------------------------
  // IRD MTM — EOD IRS mark-to-market revaluation.
  //
  // Drives runEodIrsRevaluation over the open IRS book, emitting the accounting
  // IrdSwapPositionRevalued per swap (canonical GL + BA 320 revaluation fact per
  // D-IRS-FAMILY-CONVERGE-ACCOUNTING). The valuation uses the documented static
  // JIBAR curve seed ([GAP-IRS-1] in jibar-curve-seed.ts) — the build-phase
  // analogue of a live curve ingest. The engine is idempotent per
  // valuationDate (a swap already revalued today is skipped), so re-running
  // intraday after an EOD run is a no-op. Wiring this into the daily cycle
  // keeps the CVA current-exposure leg (model:cva-exposure-epe-v1, which reads
  // IrdSwapPositionRevalued) fresh after each booking, and lands the GL
  // revaluation posting (PR-IRS-002), rather than relying on a manual reval.
  // Authority: D-IRS-FAMILY-CONVERGE-ACCOUNTING; D-MARKETS-SCHEMA-FOUNDATION; IFRS-9-§4.1.
  const irsReval = runEodIrsRevaluation(store, asOf);
  positionsValued += irsReval.revalued;
  positionsSkipped += irsReval.skipped;
  for (const err of irsReval.errors) skippedReasons.push(`IRS reval: ${err}`);
  console.log(
    `[mtm-run] IRS reval: ${irsReval.revalued} revalued, ${irsReval.skipped} skipped, ` +
      `total MTM ZAR ${(irsReval.totalMtmZar / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  );

  // -------------------------------------------------------------------------
  // Emit MtmRunCompleted
  // -------------------------------------------------------------------------
  store.append(
    makeMtmRunCompleted({
      asOf,
      entity: BANK_ENTITY,
      actor: ENGINE_ACTOR,
      citations: CITATIONS,
      payload: {
        runId,
        runType,
        asOf,
        positionsValued,
        positionsSkipped,
        skippedReasons,
        totalPnlDelta: moneyWireFromMinor(totalPnlDeltaMinor, "ZAR"),
      },
      eventId: newEventId(),
    }),
  );

  // -------------------------------------------------------------------------
  // Print summary table
  // -------------------------------------------------------------------------
  const zarFormatted = (minor: number) =>
    `ZAR ${(minor / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  console.log("\n─────────────────────────────────────────────────────────────────────");
  console.log(`  MTM RUN SUMMARY — ${runType.toUpperCase()} — ${asOf}`);
  console.log("─────────────────────────────────────────────────────────────────────");
  console.log(`  Run ID          : ${runId}`);
  console.log(`  Positions valued: ${positionsValued}`);
  console.log(`  Positions skipped: ${positionsSkipped}`);
  console.log(`  Total P&L delta : ${zarFormatted(totalPnlDeltaMinor)}`);
  console.log("─────────────────────────────────────────────────────────────────────");

  if (summaryRows.length > 0) {
    console.log("\n  Position detail:");
    console.log(
      `  ${"Trade ID".padEnd(36)}  ${"Pair".padEnd(10)}  ${"Book Rate".padStart(10)}  ${"MTM Rate".padStart(10)}  ${"P&L Delta (ZAR)".padStart(18)}  IPV`,
    );
    console.log(`  ${"─".repeat(100)}`);
    for (const row of summaryRows) {
      console.log(
        `  ${row.tradeId.padEnd(36)}  ${row.pair.padEnd(10)}  ${row.bookRate.toFixed(4).padStart(10)}  ${row.primaryRate.toFixed(4).padStart(10)}  ${zarFormatted(row.pnlDeltaMinor).padStart(18)}  ${row.ipvStatus}`,
      );
    }
  }

  if (skippedReasons.length > 0) {
    console.log("\n  Skip reasons:");
    for (const r of skippedReasons) {
      console.log(`    - ${r}`);
    }
  }

  console.log("\n─────────────────────────────────────────────────────────────────────\n");

  // -------------------------------------------------------------------------
  // Close stores
  // -------------------------------------------------------------------------
  store.close();
  mdStore.close();

  console.log("[mtm-run] Done.");
}

main().catch((err) => {
  console.error("[mtm-run] FATAL:", err);
  process.exit(1);
});
