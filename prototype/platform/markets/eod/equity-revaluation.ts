// platform/markets/eod/equity-revaluation.ts
//
// EOD equity position mark-to-market (Bea/Kai brief, 2026-05-17).
//
// Algorithm:
//   1. Replay EquityTradeBooked from the event store to build the set of
//      all equity positions.
//   2. Replay EquitySettlementConfirmed to remove settled positions.
//   3. Replay EquityPositionRevalued to skip positions already revalued today
//      (idempotency gate — prevents duplicate daily emissions).
//   4. For each open, un-revalued position:
//      a. Look up today's JSE closing price from the price source.
//      b. Compute marketValue = closingPrice × quantity.
//      c. Compute unrealisedPnl = marketValue − bookValue.
//      d. Emit EquityPositionRevalued.
//   5. Return a summary (revalued, skipped, asOf).
//
// Open position definition:
//   EquityTradeBooked (buy) that has no matching EquitySettlementConfirmed
//   for the same instrument ISIN.
//
// Idempotency:
//   If EquityPositionRevalued already exists for a (tradeId.value, valuationDate)
//   pair, the position is skipped. The valuationDate is matched by the event
//   as_of field (YYYY-MM-DD prefix).
//
// Authority:
//   - IFRS-9-§4.1 (FVTPL classification for trading book)
//   - IFRS-9-§5.7.1 (changes in fair value through P&L)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - STRATE-RULE-7 (settlement via Strate CSD)
//   - JSE-EQUITIES-RULES (JSE Equity Rules, Rule 11 — trading)
//
// Authors: Kai (Quantitative Markets Architect, engineering)
//          Bea (Finance / accounting engineer, engineering)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { clock } from "../../composition";
import { newEventId } from "../../core/types";
import type { EventStore } from "../../event-store/store";
import {
  type EquityPositionRevaluedPayload,
  type EquitySettlementConfirmedPayload,
  type EquityTradeBookedPayload,
  makeEquityPositionRevalued,
} from "../cdm/equity";

// ---------------------------------------------------------------------------
// Price source abstraction — injectable for tests
// ---------------------------------------------------------------------------

/**
 * Injectable closing-price source interface. Allows tests to provide a static
 * table without touching the filesystem, and allows production to plug in a
 * live JSE feed.
 *
 * @param isin   ISIN of the instrument.
 * @param date   YYYY-MM-DD valuation date.
 * @returns      Closing price in ZAR **major** units (e.g. 4250.00 for NPN).
 *               Throws if the ISIN/date is not available.
 */
export interface EquityRateSource {
  getClosingPriceZAR(isin: string, date: string): number;
}

/**
 * Stub JSON structure as stored in jse-close-prices-stub.json.
 */
interface JseClosePriceStub {
  _comment: string;
  date: string;
  prices: Record<string, { ticker: string; name: string; closePriceZAR: number; unit: string }>;
}

/**
 * Build-phase static price source — reads from
 * platform/markets/regulatory/jse-close-prices-stub.json.
 *
 * Prices in the stub are in ZAR cents (unit: "cents"); this source converts
 * to major units (ZAR) automatically.
 *
 * Production: replace with a JSE MarketConnect or Bloomberg feed per Bea
 * spec §7 rate-feed integration (substrate gap: live-equity-price-feed).
 */
export function makeStaticEquityPriceSource(stubPath?: string): EquityRateSource {
  const resolvedPath =
    stubPath ?? resolve(import.meta.dir, "../../markets/regulatory/jse-close-prices-stub.json");

  let stub: JseClosePriceStub;
  try {
    const raw = readFileSync(resolvedPath, "utf8");
    stub = JSON.parse(raw) as JseClosePriceStub;
  } catch (err) {
    throw new Error(
      `staticEquityPriceSource: could not read jse-close-prices-stub.json at ${resolvedPath}: ${err}`,
    );
  }

  return {
    getClosingPriceZAR(isin: string, date: string): number {
      const entry = stub.prices[isin];
      if (!entry) {
        throw new Error(
          `staticEquityPriceSource: no closing price found for ISIN "${isin}" on date "${date}". ` +
            `Available ISINs: ${Object.keys(stub.prices).join(", ")}`,
        );
      }
      // Stub prices are in cents — convert to major units
      return entry.unit === "cents" ? entry.closePriceZAR / 100 : entry.closePriceZAR;
    },
  };
}

/** Default static price source (reads stub relative to this file). */
export const staticEquityPriceSource: EquityRateSource = makeStaticEquityPriceSource();

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface EodEquityRevaluationResult {
  /** Number of positions where EquityPositionRevalued was emitted. */
  revalued: number;
  /** Number of positions skipped (already revalued today). */
  skipped: number;
  /** ISO 8601 date this run covered. */
  asOf: string;
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const RECON_CITATIONS = [
  "IFRS-9-§4.1",
  "IFRS-9-§5.7.1",
  "D-MARKETS-SCHEMA-FOUNDATION",
  "JSE-EQUITIES-RULES",
  "STRATE-RULE-7",
];

const RECON_ACTOR = {
  type: "service" as const,
  id: "kai:eod-equity-revaluation",
};

const BANK_ENTITY = "BANK-ZA-001";

// ---------------------------------------------------------------------------
// Main revaluation runner
// ---------------------------------------------------------------------------

/**
 * Run the EOD equity position mark-to-market for the given `valuationDate`.
 *
 * - Reads open equity positions from the event store (EquityTradeBooked minus
 *   EquitySettlementConfirmed).
 * - Skips positions already revalued today (idempotency).
 * - Looks up JSE closing prices from `priceSource` (default: jse-close-prices-stub.json).
 * - Emits `EquityPositionRevalued` for each open, un-revalued position.
 * - Returns a summary.
 *
 * @param store          EventStore to replay and append into.
 * @param valuationDate  YYYY-MM-DD valuation date (EOD).
 * @param priceSource    Price source (defaults to staticEquityPriceSource).
 */
export function runEodEquityRevaluation(
  store: EventStore,
  valuationDate: string,
  priceSource: EquityRateSource = staticEquityPriceSource,
): EodEquityRevaluationResult {
  void clock.now(); // timestamp reserved for future EquityPositionRevalued.revaluedAt field

  // Step 1: Collect all equity trade bookings.
  const trades = new Map<string, EquityTradeBookedPayload>();
  for (const e of store.replay({ type: "EquityTradeBooked" })) {
    const p = e.payload as unknown as EquityTradeBookedPayload;
    // Key by tradeId.value; last event wins (amendment pattern)
    trades.set(p.tradeId.value, p);
  }

  // Step 2: Remove settled positions.
  const settledIsins = new Set<string>();
  for (const e of store.replay({ type: "EquitySettlementConfirmed" })) {
    const p = e.payload as unknown as EquitySettlementConfirmedPayload;
    settledIsins.add(p.securitiesLeg.instrument.identifier.value);
  }

  // Step 3: Find positions already revalued today (idempotency).
  const alreadyRevaluedToday = new Set<string>();
  for (const e of store.replay({ type: "EquityPositionRevalued" })) {
    const p = e.payload as unknown as EquityPositionRevaluedPayload;
    if (e.as_of === valuationDate) {
      alreadyRevaluedToday.add(p.tradeId.value);
    }
  }

  let revalued = 0;
  let skipped = 0;

  // Step 4: Process open, un-revalued positions.
  for (const [tradeId, trade] of trades) {
    // Skip sell-side bookings (they reduce positions; buy-side holds the position)
    if (trade.side !== "buy") continue;

    const isin = trade.instrument.identifier.value;

    // Skip settled positions
    if (settledIsins.has(isin)) continue;

    // Skip positions already revalued today
    if (alreadyRevaluedToday.has(tradeId)) {
      skipped++;
      continue;
    }

    // Step 4a: Look up the JSE closing price (throws if not found)
    const closingPriceZAR = priceSource.getClosingPriceZAR(isin, valuationDate);

    // Step 4b: Compute market value
    const qty = trade.quantity.amount;
    const closingPriceMinor = Math.round(closingPriceZAR * 100); // ZAR major → cents
    const marketValueMinor = Math.round(closingPriceMinor * qty);

    // Book value: total consideration as paid
    const bookValueMinor = trade.consideration.amountMinor;

    // Step 4c: Compute unrealised P&L
    const unrealisedPnlMinor = marketValueMinor - bookValueMinor;

    // Step 4d: Emit EquityPositionRevalued
    const payload: EquityPositionRevaluedPayload = {
      tradeId: trade.tradeId,
      instrument: trade.instrument,
      valuationDate,
      closingPrice: { currency: "ZAR", amount: closingPriceZAR },
      quantity: trade.quantity,
      bookValue: { currency: "ZAR", amountMinor: bookValueMinor },
      marketValue: { currency: "ZAR", amountMinor: marketValueMinor },
      unrealisedPnl: { currency: "ZAR", amountMinor: unrealisedPnlMinor },
    };

    store.append(
      makeEquityPositionRevalued({
        asOf: valuationDate,
        entity: BANK_ENTITY,
        actor: RECON_ACTOR,
        citations: RECON_CITATIONS,
        payload,
        eventId: newEventId(),
      }),
    );

    revalued++;
  }

  return { revalued, skipped, asOf: valuationDate };
}
