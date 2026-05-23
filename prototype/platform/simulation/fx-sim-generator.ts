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

// ---------------------------------------------------------------------------
// generateSimTrade
// ---------------------------------------------------------------------------

export interface SimTradeOptions {
  /** Seeded RNG (falls back to Math.random when omitted). */
  rng?: () => number;
  /**
   * When provided, trade rates are sourced from this store (production quotes
   * preferred; simulated as fallback) with a ±10 bps variance applied, rather
   * than from the rate-engine random walk. This makes the sim trades coherent
   * with the market data feed visible on the Market Data page.
   */
  marketDataStore?: MarketDataStore;
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

  // 1. Pick a random counterparty, optionally filtered to pairs of interest.
  let eligible = counterparties;
  if (options?.eligiblePairsFilter && options.eligiblePairsFilter.length > 0) {
    const filter = new Set(options.eligiblePairsFilter);
    const filtered = counterparties.filter((c) => c.eligiblePairs.some((p) => filter.has(p)));
    if (filtered.length > 0) eligible = filtered;
  }
  const cp = eligible[Math.floor(rng() * eligible.length)];
  if (!cp) throw new Error("no counterparties available");

  // 2. Pick an eligible pair, restricted to the filter when provided.
  let pairPool = cp.eligiblePairs;
  if (options?.eligiblePairsFilter && options.eligiblePairsFilter.length > 0) {
    const filter = new Set(options.eligiblePairsFilter);
    const filtered = pairPool.filter((p) => filter.has(p));
    if (filtered.length > 0) pairPool = filtered;
  }
  const pair = pairPool[Math.floor(rng() * pairPool.length)];
  if (!pair) throw new Error(`counterparty ${cp.name} has no eligible pairs`);

  // 3. Side — use forcedSide when the risk monitor directs it; otherwise random.
  const side: "buy" | "sell" = options?.forcedSide ?? (rng() < 0.5 ? "buy" : "sell");

  // 4. Pick a random notional within the counterparty's range.
  //    The notional is in the base currency of the pair, in minor units.
  const rangeMinor = cp.maxNotionalMinor - cp.minNotionalMinor;
  const notionalMinor = Math.round(cp.minNotionalMinor + rng() * rangeMinor);

  // 5. Source the rate from the market data store when available so that sim
  //    trades are priced against the live/simulated feed, not a detached walk.
  //    A ±10 bps variance is applied to simulate intraday spread noise.
  //    Falls back to the rate-engine random walk when no market-data tick exists.
  let rate: FxRate;
  if (options?.marketDataStore) {
    const mdQuote =
      lookupQuoteWithInverse(options.marketDataStore, pair, { provenance: "production" }) ??
      lookupQuoteWithInverse(options.marketDataStore, pair, { provenance: "simulated" });
    if (mdQuote) {
      const bpsVariance = (rng() - 0.5) * 0.002; // ±10 bps
      const mid = mdQuote.rate * (1 + bpsVariance);
      const halfBps = pair.endsWith("/ZAR") || pair.startsWith("ZAR/") ? 35 : 12;
      const half = mid * (halfBps / 10_000);
      rate = { mid, bid: mid - half, ask: mid + half };
      // Keep the rate-engine internal state warm so it can serve inverse lookups.
      rateEngine.tick(pair);
    } else {
      rate = rateEngine.tick(pair);
    }
  } else {
    rate = rateEngine.tick(pair);
  }
  const { base: baseCcy, quote: quoteCcy } = parsePair(pair);

  // 6. Derive leg currencies and rate.
  //    Pairs are always major-first (e.g. `USD/ZAR`, `EUR/USD`) per ACI
  //    Model Code §2 — base is the ACI-higher currency. The rate-engine mid
  //    is quote-per-base (e.g. USD/ZAR mid 18.5 = 18.5 ZAR per 1 USD).
  //
  //    Per D-FX-QUOTING-CONVENTION (CEO-approved 2026-05-21) Option A, the
  //    CDM `rate.amount` is ALWAYS quote-per-base regardless of side, and
  //    `rate.currency` equals `currencyPair.quote`. Slice 1 (PR #664)
  //    restated the schema docstring + Zod refinement; this slice (3b)
  //    aligns the sim generator with that convention.
  //
  //    Side dictates pay / receive direction (per clause (v) of the
  //    refinement):
  //      side=buy : bank buys base (receives base), pays quote.
  //        payCurrency = quote, receiveCurrency = base.
  //      side=sell: bank sells base (pays base), receives quote.
  //        payCurrency = base, receiveCurrency = quote.
  //
  //    `legRate = rate.mid` in BOTH branches — there is no invert.
  let payCurrency: string;
  let receiveCurrency: string;

  if (side === "buy") {
    // Bank buys base (receives base), pays quote.
    payCurrency = quoteCcy;
    receiveCurrency = baseCcy;
  } else {
    // Bank sells base (pays base), receives quote.
    payCurrency = baseCcy;
    receiveCurrency = quoteCcy;
  }

  // Rate is quote-per-base regardless of side (D-FX-QUOTING-CONVENTION).
  const legRate = rate.mid;

  // 7. Compute counter-notional.
  //    `notionalMinor` is in pay-currency minor units (the random draw on
  //    line 70 is interpreted as units of `payCurrency`). With `legRate =
  //    quote per base`, the counter-notional in receive-currency units is
  //    derived by direction:
  //
  //      side=buy  : pay=quote, receive=base.
  //        notional (quote-minor) / legRate = counter (base-minor).
  //        e.g. USD/ZAR mid 18.5, notional 18,500,000 ZAR cents
  //          → counter = 18,500,000 / 18.5 = 1,000,000 USD cents.
  //      side=sell : pay=base, receive=quote.
  //        notional (base-minor) × legRate = counter (quote-minor).
  //        e.g. USD/ZAR mid 18.5, notional 1,000,000 USD cents
  //          → counter = 1,000,000 × 18.5 = 18,500,000 ZAR cents.
  //
  //    Minor-unit scaling: all simulated currencies (ZAR, USD, EUR, GBP)
  //    use 2-decimal minor units (cents), so the minor-unit conversion
  //    factor cancels. JPY (0 decimals) is not in the sim pair set.
  const counterNotionalMinor =
    side === "buy" ? Math.round(notionalMinor / legRate) : Math.round(notionalMinor * legRate);

  // 8. Trade ID.
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
    // No-prop attribution (G-3) — simulator emits client-flow trades; if
    // the simulator gains a hedge-programme path later, switch on a flag.
    clientFlowRef: `client-trade:sim-${tradeId}`,
  };

  return payload;
}
