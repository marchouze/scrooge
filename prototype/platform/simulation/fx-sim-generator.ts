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
  //    Pairs are always major-first (e.g. `USD/ZAR`, `EUR/USD`) per ACI
  //    Model Code §2 — base is the ACI-higher currency. The rate-engine mid
  //    is quote-per-base (e.g. USD/ZAR mid 18.5 = 18.5 ZAR per 1 USD).
  //
  //    If side=buy: bank buys base (receives base), pays quote.
  //      payCurrency = quote, receiveCurrency = base
  //    If side=sell: bank sells base (pays base), receives quote.
  //      payCurrency = base, receiveCurrency = quote
  //
  //    The CDM `rate.amount` is receive-per-pay (the schema docstring at
  //    `platform/markets/cdm/fx.ts` defines this), so:
  //      buy  → rate = base / quote = 1 / mid
  //      sell → rate = quote / base = mid
  //
  //    The broader question of whether `rate = receive/pay` is the right
  //    convention to encode (vs. straight quote-per-base) is open ground
  //    and tracked under a separate decision card; this function follows
  //    the schema as written.
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
  //    counterNotional (minor) = round(notional × legRate).
  //    legRate maps pay→receive (units: receive-per-pay), so
  //    receive_minor = pay_minor × legRate when minor-unit scale matches.
  //    For USD/ZAR side=buy: payCurrency=ZAR, receiveCurrency=USD,
  //    legRate ≈ 1/18.5 ≈ 0.054 USD per ZAR → counterNotional in USD cents.
  //    We accept the approximation that minor unit scale is the same for
  //    all currencies (cents / smallest unit), correct for ZAR, USD, EUR, GBP.
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
