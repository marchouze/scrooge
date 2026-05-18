// platform/accounting/fx-rate-projection.ts
//
// Derives FX spot rates from FxTradeExecuted events in the event store.
// Used by the GL projection to convert ledger amounts to a reporting currency.
//
// Rate extraction:
//   Each FxLeg carries:
//     payCurrency      — the currency being paid
//     receiveCurrency  — the currency being received
//     rate.amount      — receiveCurrency per 1 payCurrency
//
//   Both directions are stored: from→to at rate.amount, to→from at 1/rate.amount.
//   When multiple FxTradeExecuted events exist for the same pair, the most
//   recent event's rate is used (events are processed in as_of order).
//
// Cross-rate resolution:
//   convertMinor attempts:
//   1. Direct rate (from→to)
//   2. Single-hop cross via any intermediate currency X where from→X and X→to exist
//
// Authority: GL reporting currency substrate.
// Author: Bea (Accounting & financial reporting engineer, engineering)

import type { Event } from "../event-store/types";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Map of from-currency → to-currency → rate (to per 1 from).
 * Access: rateMap.get("USD")?.get("ZAR") = ZAR per 1 USD
 */
export type RateMap = Map<string, Map<string, number>>;

// ---------------------------------------------------------------------------
// buildRateMap
// ---------------------------------------------------------------------------

/**
 * Build a RateMap from all FxTradeExecuted events.
 * Events are processed in as_of order so the most recent rate wins.
 */
export function buildRateMap(events: readonly Event[]): RateMap {
  const rateMap: RateMap = new Map();

  // Sort events by as_of ascending so later events overwrite earlier ones
  const fxEvents = events
    .filter((e) => e.type === "FxTradeExecuted")
    .sort((a, b) => a.as_of.localeCompare(b.as_of));

  for (const event of fxEvents) {
    const payload = event.payload as unknown as FxTradeExecutedPayload;
    if (!payload?.legs) continue;

    for (const leg of payload.legs) {
      const { payCurrency, receiveCurrency, rate } = leg;
      if (!payCurrency || !receiveCurrency || typeof rate?.amount !== "number") continue;
      if (payCurrency === receiveCurrency) continue;

      const rateAmount = rate.amount; // receiveCurrency per 1 payCurrency

      // Store from→to
      if (!rateMap.has(payCurrency)) rateMap.set(payCurrency, new Map());
      // biome-ignore lint/style/noNonNullAssertion: just set above
      rateMap.get(payCurrency)!.set(receiveCurrency, rateAmount);

      // Store to→from (inverse)
      if (!rateMap.has(receiveCurrency)) rateMap.set(receiveCurrency, new Map());
      // biome-ignore lint/style/noNonNullAssertion: just set above
      rateMap.get(receiveCurrency)!.set(payCurrency, 1 / rateAmount);
    }
  }

  return rateMap;
}

// ---------------------------------------------------------------------------
// convertMinor
// ---------------------------------------------------------------------------

/**
 * Convert an amount in minor units from `from` currency to `to` currency.
 *
 * Tries:
 *   1. Direct rate (from→to)
 *   2. Single-hop cross via any intermediate currency X
 *
 * Returns null if no conversion path is available.
 * Always Math.round to produce whole minor units.
 */
export function convertMinor(
  amountMinor: number,
  from: string,
  to: string,
  rates: RateMap,
): number | null {
  if (from === to) return Math.round(amountMinor);

  // 1. Direct
  const direct = rates.get(from)?.get(to);
  if (direct !== undefined) {
    return Math.round(amountMinor * direct);
  }

  // 2. Single-hop cross
  const fromRates = rates.get(from);
  if (fromRates) {
    for (const [intermediate, fromToIntermediate] of fromRates) {
      const intermediateToTarget = rates.get(intermediate)?.get(to);
      if (intermediateToTarget !== undefined) {
        const crossRate = fromToIntermediate * intermediateToTarget;
        return Math.round(amountMinor * crossRate);
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// availableCurrencies
// ---------------------------------------------------------------------------

/**
 * Return a sorted list of all currencies that have at least one rate in the map.
 */
export function availableCurrencies(rates: RateMap): string[] {
  return [...rates.keys()].sort();
}
