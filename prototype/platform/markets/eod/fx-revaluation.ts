// platform/markets/eod/fx-revaluation.ts
//
// EOD FX position revaluation automation trigger (Anya brief, 2026-05-16).
//
// Algorithm:
//   1. Replay FxTradeExecuted from the event store to build the set of
//      all FX positions.
//   2. Replay FxSettlementConfirmed to remove settled positions.
//   3. Replay FxPositionRevalued to skip positions already revalued today
//      (idempotency gate — prevents duplicate daily emissions).
//   4. For each open, un-revalued position:
//      a. Look up today's closing rate from the rate source.
//      b. Compute the unrealised P&L delta since last revaluation (or
//         book rate if no prior revaluation today/yesterday).
//      c. Emit FxPositionRevalued.
//   5. Return a summary (revalued, skipped, asOf).
//
// Open position definition:
//   FxTradeExecuted that has no matching FxSettlementConfirmed for the
//   same tradeId (any legKind).
//
// Idempotency:
//   If FxPositionRevalued already exists for a (tradeId, valuationDate)
//   pair, the trade is skipped. The valuationDate is matched by the event
//   as_of field (YYYY-MM-DD prefix).
//
// Authority:
//   - IAS-21-§28 (monetary items retranslated at closing rate)
//   - IFRS-9-§5.7.1 (FVTPL: changes in fair value through P&L)
//   - D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved)
//   - EXCON-SARB-CIRC-3-2020 (cross-border FX reporting)
//
// Authors: Anya (Data / analytics engineer, engineering)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { clock } from "../../composition";
import { newEventId } from "../../core/types";
import {
  type FxPositionRevaluedPayload,
  type FxSettlementConfirmedPayload,
  makeFxPositionRevalued,
} from "../../event-store/event-types/fx-accounting";
import type { EventStore } from "../../event-store/store";
import type { FxTradeExecutedPayload } from "../cdm/fx";
import { baseAmountMinor } from "../cdm/fx-helpers";

// ---------------------------------------------------------------------------
// Rate source abstraction — injectable for tests
// ---------------------------------------------------------------------------

/**
 * Injectable rate source interface. Allows tests to provide a static table
 * without touching the filesystem, and allows production to plug in a live
 * feed.
 *
 * @param currencyPair  Canonical pair string, e.g. "ZAR/USD".
 * @param date          YYYY-MM-DD valuation date.
 * @returns             Rate in minor units (× 10^6 for 6dp precision).
 *                      Throws if the pair/date is not available.
 */
export type FxRateSource = {
  getRate(currencyPair: string, date: string): number;
};

/**
 * Build-phase static rate source — reads from prototype/seeds/fx-rates.json.
 * Production: replace with a Reuters WM-Fix or Bloomberg BFIX live feed
 * per Bea spec §7 rate-feed integration (substrate gap: live-rate-feed).
 */
export function makeStaticRateSource(seedPath?: string): FxRateSource {
  const resolvedPath =
    seedPath ??
    resolve(
      // Walk up from this file's directory to find prototype/seeds/fx-rates.json
      import.meta.dir,
      "../../../seeds/fx-rates.json",
    );

  let rateTable: Record<string, Record<string, number>>;
  try {
    const raw = readFileSync(resolvedPath, "utf8");
    rateTable = JSON.parse(raw) as Record<string, Record<string, number>>;
  } catch (err) {
    throw new Error(`staticRateSource: could not read fx-rates.json at ${resolvedPath}: ${err}`);
  }

  return {
    getRate(currencyPair: string, date: string): number {
      const pairRates = rateTable[currencyPair];
      if (!pairRates) {
        throw new Error(
          `staticRateSource: no rates found for pair "${currencyPair}". ` +
            `Available pairs: ${Object.keys(rateTable).join(", ")}`,
        );
      }
      const rate = pairRates[date];
      if (rate === undefined) {
        throw new Error(
          `staticRateSource: no rate for pair "${currencyPair}" on date "${date}". ` +
            `Available dates: ${Object.keys(pairRates).join(", ")}`,
        );
      }
      return rate;
    },
  };
}

/** Default static rate source (reads fx-rates.json relative to this file). */
export const staticRateSource: FxRateSource = makeStaticRateSource();

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type EodRevaluationResult = {
  /** Number of positions where FxPositionRevalued was emitted. */
  revalued: number;
  /** Number of positions skipped (already revalued today). */
  skipped: number;
  /** ISO 8601 date this run covered. */
  asOf: string;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const RECON_CITATIONS = [
  "IAS-21-§28",
  "IFRS-9-§5.7.1",
  "D-MARKETS-CAPITAL-TIME-SHAPE",
  "EXCON-SARB-CIRC-3-2020",
];

const RECON_ACTOR = {
  type: "service" as const,
  id: "anya:eod-fx-revaluation",
};

const BANK_ENTITY = "LE-ZA-HOZ-BANK";

/** Serialize a CurrencyPair object to canonical "BASE/QUOTE" string. */
function pairToString(pair: { base: string; quote: string }): string {
  return `${pair.base}/${pair.quote}`;
}

// ---------------------------------------------------------------------------
// Main revaluation runner
// ---------------------------------------------------------------------------

/**
 * Run the EOD FX position revaluation for the given `valuationDate`.
 *
 * - Reads open FX positions from the event store (FxTradeExecuted minus
 *   FxSettlementConfirmed).
 * - Skips positions already revalued today (idempotency).
 * - Looks up closing rates from `rateSource` (default: seeds/fx-rates.json).
 * - Emits `FxPositionRevalued` for each open, un-revalued position.
 * - Returns a summary.
 *
 * @param store          EventStore to replay and append into.
 * @param valuationDate  YYYY-MM-DD valuation date (EOD).
 * @param rateSource     Rate source (defaults to staticRateSource).
 */
export function runEodFxRevaluation(
  store: EventStore,
  valuationDate: string,
  rateSource: FxRateSource = staticRateSource,
): EodRevaluationResult {
  const revaluedAt = clock.now();

  // Step 1: Collect all FX trades.
  const trades = new Map<string, FxTradeExecutedPayload>();
  for (const e of store.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as unknown as FxTradeExecutedPayload;
    // tradeId is an Identifier { scheme, value } — use .value as map key.
    trades.set(p.tradeId.value, p);
  }

  // Step 2: Remove settled positions. Fold both the CDM lifecycle-close
  // event (`SettlementConfirmed`, 2026-05-20 GL-significant under
  // PR-FX-LIFECYCLE-CLOSE) and the deprecated accounting event
  // (`FxSettlementConfirmed`, retained for back-compat with legacy tests).
  const settled = new Set<string>();
  for (const e of store.replay({ type: "FxSettlementConfirmed" })) {
    const p = e.payload as unknown as FxSettlementConfirmedPayload;
    settled.add(p.tradeId);
  }
  for (const e of store.replay({ type: "SettlementConfirmed" })) {
    const p = e.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string") settled.add(p.tradeId);
  }

  // Step 3: Find positions already revalued today (idempotency).
  const alreadyRevaluedToday = new Set<string>();
  for (const e of store.replay({ type: "FxPositionRevalued" })) {
    const p = e.payload as unknown as FxPositionRevaluedPayload;
    // Check if the event's as_of date matches today's valuation date.
    if (e.as_of === valuationDate) {
      alreadyRevaluedToday.add(p.tradeId);
    }
  }

  let revalued = 0;
  let skipped = 0;

  // Step 4: Process open positions.
  for (const [tradeId, trade] of trades) {
    // Skip settled positions.
    if (settled.has(tradeId)) continue;

    // Skip positions already revalued today.
    if (alreadyRevaluedToday.has(tradeId)) {
      skipped++;
      continue;
    }

    // Get the near leg for this trade.
    const nearLeg = trade.legs.find((l) => l.legKind === "near") ?? trade.legs[0];
    if (!nearLeg) continue;

    const currencyPairStr = pairToString(trade.currencyPair);

    // Step 4a: Look up the closing rate.
    const revalRate = rateSource.getRate(currencyPairStr, valuationDate);

    // Step 4b: Compute the unrealised P&L delta.
    //
    // Post-Slice-1 (D-FX-QUOTING-CONVENTION; PR #664), the CDM leg rate is
    // always quote-per-base (clause (iv) of the Zod refinement —
    // `rate.currency === currencyPair.quote`). The pre-Slice-1 side-dependent
    // invert (`1 / legRate` for the buy branch) is no longer needed and would
    // now be unreachable code; we read `nearLeg.rate.amount` directly as the
    // quote-per-base book rate. The seed reval rate is also quote-per-base
    // × 10^6, so the comparison is dimensionally aligned.
    const bookRate = nearLeg.rate.amount;
    // Resolve base-currency notional via the Slice-2 helper. The legacy line
    // (`nearLeg.notional.amountMinor`) was incorrect for BUY trades on a
    // major-first pair — notional sat on the quote side, so the dimensional
    // product `notional × rateDelta` was ~rate× too large. The helper picks
    // the base-side amount whether it lives on notional or counterNotional.
    const notionalBaseMinor = baseAmountMinor(nearLeg, trade.currencyPair);

    // P&L = notional_base × (revalRate − bookRate), both in quote-per-base decimal.
    // Build-phase simplification: result is in quote-currency minor units, reported as
    // ZAR minor units (accurate when base=ZAR; approximation for cross pairs).
    const revalRateDecimal = revalRate / 1_000_000;
    const unrealisedPnlZarMinor = Math.round(notionalBaseMinor * (revalRateDecimal - bookRate));

    // Step 4c: Emit FxPositionRevalued.
    const payload: FxPositionRevaluedPayload = {
      tradeId,
      currencyPair: currencyPairStr,
      bookRate,
      revalRate: revalRateDecimal,
      notionalBaseMinor,
      unrealisedPnlZarMinor,
      revaluedAt,
      rateSource: "static-seed",
    };

    store.append(
      makeFxPositionRevalued({
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
