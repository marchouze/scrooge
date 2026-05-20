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

import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import type { SimCounterparty } from "./fx-sim-counterparties";
import type { FxRateEngine } from "./fx-sim-rates";

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
 * e.g. "ZAR/USD" → { base: "ZAR", quote: "USD" }
 */
function parsePair(pair: string): { base: string; quote: string } {
  const slash = pair.indexOf("/");
  if (slash === -1) throw new Error(`invalid pair string: ${pair}`);
  return { base: pair.slice(0, slash), quote: pair.slice(slash + 1) };
}

// ---------------------------------------------------------------------------
// generateSimTrade
// ---------------------------------------------------------------------------

export function generateSimTrade(
  rateEngine: FxRateEngine,
  counterparties: SimCounterparty[],
  bookId: string,
): FxTradeExecutedPayload {
  const nowMs = Date.now();

  // 1. Pick a random counterparty.
  const cp = counterparties[Math.floor(Math.random() * counterparties.length)];
  if (!cp) throw new Error("no counterparties available");

  // 2. Pick a random eligible pair.
  const pair = cp.eligiblePairs[Math.floor(Math.random() * cp.eligiblePairs.length)];
  if (!pair) throw new Error(`counterparty ${cp.name} has no eligible pairs`);

  // 3. Pick a random side from the bank's perspective.
  const side: "buy" | "sell" = Math.random() < 0.5 ? "buy" : "sell";

  // 4. Pick a random notional within the counterparty's range.
  //    The notional is in the base currency of the pair, in minor units.
  const rangeMinor = cp.maxNotionalMinor - cp.minNotionalMinor;
  const notionalMinor = Math.round(cp.minNotionalMinor + Math.random() * rangeMinor);

  // 5. Get the rate from the engine (advances the random walk).
  const rate = rateEngine.tick(pair);
  const { base: baseCcy, quote: quoteCcy } = parsePair(pair);

  // 6. Derive leg currencies.
  //    Convention: notional is in base currency (e.g. ZAR for ZAR/USD).
  //    If side=buy: bank receives base, pays quote.
  //      payCurrency = quote, receiveCurrency = base
  //    If side=sell: bank pays base, receives quote.
  //      payCurrency = base, receiveCurrency = quote
  //    The "rate" in the CDM sense is receiveCurrency per pay-unit.
  let payCurrency: string;
  let receiveCurrency: string;
  let legRate: number;

  if (side === "buy") {
    // Bank buys base (receives base), pays quote.
    payCurrency = quoteCcy;
    receiveCurrency = baseCcy;
    // rate in CDM = receiveCurrency per pay-unit = base per quote = 1 / mid
    legRate = 1 / rate.mid;
  } else {
    // Bank sells base (pays base), receives quote.
    payCurrency = baseCcy;
    receiveCurrency = quoteCcy;
    // rate in CDM = receiveCurrency per pay-unit = quote per base = mid
    legRate = rate.mid;
  }

  // 7. Compute counter-notional.
  //    notional is in pay-currency minor units.
  //    counterNotional (minor) = round(notional × legRate × 100) / 100
  //    We keep minor units as integers; legRate maps pay→receive.
  //    For ZAR/USD side=buy: notionalMinor is in quote (USD cents), counterNotional in ZAR cents.
  //    We accept the approximation that minor unit scale is the same for all currencies
  //    (both in "cents" / smallest unit) which is correct for ZAR, USD, EUR, GBP.
  const counterNotionalMinor = Math.round(notionalMinor * legRate);

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
        rate: { currency: receiveCurrency, amount: legRate },
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
