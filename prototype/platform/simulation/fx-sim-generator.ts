// platform/simulation/fx-sim-generator.ts
//
// Trade payload builder for the FX market-making simulation engine.
// Generates valid FxTradeExecutedPayload events by selecting a random
// counterparty, pair, side, and notional, then calling the rate engine.
//
// Authority: D-FX-SALES-TRADING-FRONTEND; D-FX-BOOK-BOUNDARY;
//   D-MARKETS-SCHEMA-FOUNDATION.
// Author: Devon (Chief Operating Officer, engineering)

import { randomUUID } from "node:crypto";

import { type MarketDataStore, lookupQuoteWithInverse } from "../market-data/store";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import type { SimCounterparty } from "./fx-sim-counterparties";
import type { FxRate, FxRateEngine } from "./fx-sim-rates";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** T+2 settlement date as ISO date string (YYYY-MM-DD). */
function settlementDateT2(fromMs: number): string {
  const d = new Date(fromMs);
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

/** Today's ISO date string (YYYY-MM-DD). */
function todayIso(fromMs: number): string {
  return new Date(fromMs).toISOString().slice(0, 10);
}

/**
 * Split "BASE/QUOTE" pair string into { base, quote }.
 * Pairs are always major-first per ACI hierarchy
 * (EUR > GBP > AUD > NZD > USD > CAD > CHF > JPY > others).
 * e.g. "USD/ZAR" → { base: "USD", quote: "ZAR" }.
 */
function parsePair(pair: string): { base: string; quote: string } {
  const slash = pair.indexOf("/");
  if (slash === -1) throw new Error(`invalid pair string: ${pair}`);
  return { base: pair.slice(0, slash), quote: pair.slice(slash + 1) };
}

/**
 * Convert a USD amount to major units of `targetCcy` using market data.
 * Uses lookupQuoteWithInverse so both direct and inverse stored ticks work.
 * Falls back to 1:1 when no rate is available (should not happen in practice
 * when market data sim is running).
 */
function usdToMajor(
  usdAmount: number,
  targetCcy: string,
  store: MarketDataStore,
  rng: () => number,
  rateEngine: FxRateEngine,
): number {
  if (targetCcy === "USD") return usdAmount;
  // lookupQuoteWithInverse(store, "EUR/USD").rate = USD per EUR → EUR = USD / rate
  const q = lookupQuoteWithInverse(store, `${targetCcy}/USD`, { provenance: "simulated" })
    ?? lookupQuoteWithInverse(store, `${targetCcy}/USD`, { provenance: "production" });
  if (q && q.rate > 0) return usdAmount / q.rate;
  // Fallback: try via ZAR cross (USD → ZAR → targetCcy)
  const usdZar = lookupQuoteWithInverse(store, "USD/ZAR", { provenance: "all" as "simulated" });
  if (usdZar && usdZar.rate > 0) {
    const zarAmount = usdAmount * usdZar.rate;
    const zarToCcy = lookupQuoteWithInverse(store, `ZAR/${targetCcy}`, { provenance: "all" as "simulated" })
      ?? lookupQuoteWithInverse(store, `${targetCcy}/ZAR`, { provenance: "all" as "simulated" });
    if (zarToCcy && zarToCcy.rate > 0) {
      const pairStr = `ZAR/${targetCcy}`;
      const slash = pairStr.indexOf("/");
      const base = pairStr.slice(0, slash);
      const isZarBase = base === "ZAR";
      // If stored as ZAR/CCY: rate = CCY per ZAR → CCY = ZAR × rate
      // If stored as CCY/ZAR (inverse): rate returned is ZAR per CCY → CCY = ZAR / rate
      if (isZarBase) return zarAmount * zarToCcy.rate;
      return zarAmount / zarToCcy.rate;
    }
  }
  // Last resort: use rate engine
  void rng; void rateEngine;
  return usdAmount;
}

// ---------------------------------------------------------------------------
// generateSimTrade
// ---------------------------------------------------------------------------

export interface SimTradeOptions {
  /** Seeded RNG (falls back to Math.random when omitted). */
  rng?: () => number;
  /**
   * Market data store. When provided, rates are sourced from bid/ask ±1%
   * (buy uses ask, sell uses bid). Also used for USD-notional conversion.
   * Falls back to the rate-engine random walk when absent or when no tick exists.
   */
  marketDataStore?: MarketDataStore;
  /**
   * Override pair selection: pick randomly from this set instead of from the
   * counterparty's eligiblePairs. Intended for the hub sim loop where pairs
   * come from whatever is live in the market data store.
   */
  availablePairs?: readonly string[];
  /**
   * Minimum notional in USD major units (e.g. 500_000 = $500k).
   * Converted to the trade's pay-currency notional via market data.
   * When omitted the legacy per-counterparty minNotionalMinor is used.
   */
  notionalUsdMin?: number;
  /**
   * Maximum notional in USD major units (e.g. 5_000_000 = $5M).
   * When omitted the legacy per-counterparty maxNotionalMinor is used.
   */
  notionalUsdMax?: number;
  /**
   * Force a specific trade side. Used by the risk monitor to direct trades
   * toward position reduction when B3 is amber or red.
   */
  forcedSide?: "buy" | "sell";
  /**
   * Restrict pair selection to this set. Used by the risk monitor to target
   * the currency pair that most reduces the open position.
   */
  eligiblePairsFilter?: readonly string[];
}

export function generateSimTrade(
  rateEngine: FxRateEngine,
  counterparties: SimCounterparty[],
  bookId: string,
  options?: SimTradeOptions,
): FxTradeExecutedPayload {
  const rng = options?.rng ?? Math.random;
  const nowMs = Date.now();

  // 1. Determine the pair pool.
  //    When `availablePairs` is provided (hub sim loop) we pick from those.
  //    Otherwise fall back to the legacy counterparty-eligiblePairs path.
  let pairPool: readonly string[];
  if (options?.availablePairs && options.availablePairs.length > 0) {
    pairPool = options.availablePairs;
    if (options.eligiblePairsFilter && options.eligiblePairsFilter.length > 0) {
      const filter = new Set(options.eligiblePairsFilter);
      const filtered = pairPool.filter((p) => filter.has(p));
      if (filtered.length > 0) pairPool = filtered;
    }
  } else {
    // Legacy path: pick counterparty first, then pair from its eligible set.
    let eligible = counterparties;
    if (options?.eligiblePairsFilter && options.eligiblePairsFilter.length > 0) {
      const filter = new Set(options.eligiblePairsFilter);
      const filtered = counterparties.filter((c) => c.eligiblePairs.some((p) => filter.has(p)));
      if (filtered.length > 0) eligible = filtered;
    }
    const legacyCp = eligible[Math.floor(rng() * eligible.length)];
    if (!legacyCp) throw new Error("no counterparties available");
    pairPool = legacyCp.eligiblePairs;
    if (options?.eligiblePairsFilter && options.eligiblePairsFilter.length > 0) {
      const filter = new Set(options.eligiblePairsFilter);
      const filtered = pairPool.filter((p) => filter.has(p));
      if (filtered.length > 0) pairPool = filtered;
    }
  }

  const pair = pairPool[Math.floor(rng() * pairPool.length)];
  if (!pair) throw new Error("no pairs available");

  // 2. Pick a random counterparty from the full list (decoupled from pair when availablePairs used).
  const cp = counterparties[Math.floor(rng() * counterparties.length)];
  if (!cp) throw new Error("no counterparties available");

  // 3. Side — use forcedSide when the risk monitor directs it; otherwise random.
  const side: "buy" | "sell" = options?.forcedSide ?? (rng() < 0.5 ? "buy" : "sell");

  const { base: baseCcy, quote: quoteCcy } = parsePair(pair);

  // 4. Source the rate from the market data store.
  //    buy → use ask ±1%; sell → use bid ±1%.
  //    Falls back to the rate-engine random walk when no tick exists.
  let rate: FxRate;
  if (options?.marketDataStore) {
    const ticks = options.marketDataStore.query({
      instrument: pair,
      dataType: "fx-quote",
      provenance: "all",
      limit: 1,
    });
    const tick = ticks[0];
    if (tick) {
      const bid = typeof tick.payload.bid === "number" ? tick.payload.bid : 0;
      const ask = typeof tick.payload.ask === "number" ? tick.payload.ask : 0;
      if (bid > 0 && ask > 0) {
        // Execution rate: ±1% uniform noise around bid (sell) or ask (buy).
        const baseRate = side === "buy" ? ask : bid;
        const executionRate = baseRate * (1 + (rng() - 0.5) * 0.02);
        rate = { mid: executionRate, bid, ask };
        // Keep the rate-engine state warm for inverse lookups.
        rateEngine.tick(pair, rng);
      } else {
        rate = rateEngine.tick(pair, rng);
      }
    } else {
      rate = rateEngine.tick(pair, rng);
    }
  } else {
    rate = rateEngine.tick(pair, rng);
  }

  // 5. Compute notional in pay-currency minor units.
  //    When notionalUsdMin/Max are provided: convert USD to pay-currency major units → minor.
  //    Otherwise fall back to per-counterparty legacy minor-unit range.
  const payCurrency = side === "buy" ? quoteCcy : baseCcy;
  const receiveCurrency = side === "buy" ? baseCcy : quoteCcy;

  let notionalMinor: number;
  if (
    options?.notionalUsdMin !== undefined &&
    options.notionalUsdMax !== undefined &&
    options.marketDataStore
  ) {
    const usdAmount =
      options.notionalUsdMin + rng() * (options.notionalUsdMax - options.notionalUsdMin);
    const payMajor = usdToMajor(usdAmount, payCurrency, options.marketDataStore, rng, rateEngine);
    notionalMinor = Math.round(payMajor * 1_000_000);
  } else {
    const rangeMinor = cp.maxNotionalMinor - cp.minNotionalMinor;
    notionalMinor = Math.round(cp.minNotionalMinor + rng() * rangeMinor);
  }

  // 6. Compute counter-notional.
  //    rate.mid is quote-per-base (D-FX-QUOTING-CONVENTION).
  //    notionalMinor is in the pay currency.
  //
  //      side=buy  : pay=quote, receive=base.
  //        notional (quote-minor) / rate = counter (base-minor).
  //      side=sell : pay=base, receive=quote.
  //        notional (base-minor) × rate = counter (quote-minor).
  const legRate = rate.mid;
  const counterNotionalMinor =
    side === "buy" ? Math.round(notionalMinor / legRate) : Math.round(notionalMinor * legRate);

  // 7. Trade ID.
  const tradeId = `SIM-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

  const settlement = settlementDateT2(nowMs);
  const tradeDate = todayIso(nowMs);

  const payload: FxTradeExecutedPayload = {
    tradeId: { scheme: "internal-sim", value: tradeId },
    productTaxonomy: "FX-spot",
    currencyPair: { base: baseCcy, quote: quoteCcy },
    side,
    legs: [
      {
        legKind: "near",
        payCurrency,
        receiveCurrency,
        notional: { currency: payCurrency, amountMinor: notionalMinor },
        counterNotional: { currency: receiveCurrency, amountMinor: counterNotionalMinor },
        rate: { currency: quoteCcy, amount: legRate },
        settlementDate: { iso: settlement, calendar: "JIHCAL" },
      },
    ],
    tradeDate: { iso: tradeDate, calendar: "JIHCAL" },
    counterparty: {
      partyId: cp.partyId,
      name: cp.name,
      role: "counterparty",
      jurisdiction: cp.jurisdiction,
    },
    venue: "OTC-SIM",
    trader: "agent:devon:fx-sim-engine",
    bookId,
    bookType: "trading",
    settlementForm: "physical",
    settlementPath: "correspondent",
    finsurvCategory: "SIM",
    clientFlowRef: `client-trade:sim-${tradeId}`,
  };

  return payload;
}
