// platform/markets/cdm/fx-helpers.ts
//
// Helper functions for the FX CDM types — pure, side-effect-free
// resolvers that turn the leg-level (payCurrency / receiveCurrency,
// notional / counterNotional) representation into the
// pair-level (base / quote) representation that downstream
// calculators and posting rules expect.
//
// Authority:
//   - D-FX-QUOTING-CONVENTION (CEO-approved 2026-05-21; Option A)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   - PR #664 (Kai — Slice 1: schema docstring + Zod refinement)
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import type { CurrencyPair } from "./primitives";
import type { FxLeg } from "./fx";

/**
 * Resolve the base-currency notional amount in minor units for an FxLeg,
 * regardless of whether the leg stores it as `notional` (when the leg is
 * on the base side — SELL on a major-first pair, or a swap far leg whose
 * direction is base→quote) or as `counterNotional` (when the leg is on
 * the quote side — BUY on a major-first pair, or a swap far leg whose
 * direction is quote→base).
 *
 * Post-Slice-1, the FX schema (`fxTradeExecutedPayloadSchema`) guarantees
 * that exactly one of `notional.currency` or `counterNotional.currency`
 * equals `pair.base`, so the selector is unambiguous.
 *
 * Why this helper exists:
 *   The legacy calculators read `leg.notional.amountMinor` as if it were
 *   always base-currency minor units. That is only true for SELL trades
 *   on a major-first pair (where payCurrency = base = notional.currency).
 *   For BUY trades the legacy reading was off by the ~ZAR-USD-rate
 *   (e.g. ZAR 92.5m of notional treated as if it were USD 925M, producing
 *   a unrealised-P&L number ~rate× too large). This helper migrates the
 *   three calculator engines to a single, side-correct base-amount
 *   resolver. See D-FX-QUOTING-CONVENTION Slice 2 (Bea, 2026-05-21).
 *
 * @param leg  The FxLeg whose base-currency amount we want.
 * @param pair The currency pair (with `base` and `quote` codes).
 * @returns    Base-currency notional in minor units (cents-equivalent
 *             for the base currency).
 *
 * @throws Never — by Slice-1 schema invariant clauses (ii) and (iii),
 *   one of the two currencies always matches `pair.base`. Defensive code
 *   below falls back to `notional.amountMinor` if both currency fields
 *   somehow fail to match, but that path is unreachable for events that
 *   pass `fxTradeExecutedPayloadSchema.parse(...)`.
 */
export function baseAmountMinor(leg: FxLeg, pair: CurrencyPair): number {
  if (leg.notional.currency === pair.base) {
    return leg.notional.amountMinor;
  }
  if (leg.counterNotional.currency === pair.base) {
    return leg.counterNotional.amountMinor;
  }
  // Unreachable for schema-validated events (Slice-1 clauses (ii)+(iii)
  // guarantee one of the two equals base). Fall back to notional for
  // legacy / unvalidated callers; downstream callers must validate input
  // through the schema if they want the invariant to hold.
  return leg.notional.amountMinor;
}
