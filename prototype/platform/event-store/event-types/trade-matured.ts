// platform/event-store/event-types/trade-matured.ts
//
// `TradeMatured` — generic terminal lifecycle event for any tradable
// instrument. The payload uses a discriminated union on `productKind` so
// the same event type can carry asset-class-specific maturity data while
// keeping the envelope uniform.
//
// FX spot is the first product variant; bond maturity / IRD termination /
// equity settlement variants will land as their respective lifecycle
// engines come online.
//
// Why generic, not per-asset:
//   - The previous FX-specific terminal event was retired 2026-05-21.
//     Bond maturity, IRD termination, and equity settlement have their own
//     per-asset events today (BondMatured, IrdSwapTerminated,
//     EquitySettlementConfirmed). The aim of `TradeMatured` is to unify the
//     "trade lifecycle terminal" pattern under one event type so:
//       (a) Product Control's realised-P&L derivation has one place to fold;
//       (b) New asset classes plug in via a new productKind variant rather
//           than a new event type + new posting-rule dispatch arm;
//       (c) Cross-asset recon (e.g. "every executed trade has a terminal
//           event") becomes a single recon pipeline keyed on TradeMatured.
//
//   Per-asset events remain valid where they carry asset-specific richer
//   semantics (e.g. BondMatured carries coupon redemption details that have
//   no analogue in FX). The migration plan unfolds product-by-product:
//   FX spot is the first migration (retiring the legacy FX-specific
//   settlement-confirmed event); bond/IRD/equity remain on their per-asset
//   events until a future slice.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
//   - IFRS 9 §3.2.3 (derecognition on transfer of contractual cash flows)
//   - IAS 21 §28 (settlement-date FX gain/loss recognition)
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// FX-spot variant payload
//
// Mirrors the data the retired legacy FX-specific settlement-confirmed
// payload carried:
// settled cash legs in their respective currencies, nostro account IDs,
// the realised-P&L residual in ZAR minor units, and the correspondent
// reference. The FX-spot lifecycle close (PrincipalPayment for the per-leg
// cash, SettlementConfirmed for the realised-P&L residual) emits the per-
// leg cash GL postings; `TradeMatured{productKind:"FX-spot"}` is the
// terminal projection-feeding event that Product Control reads for the
// realised-P&L aggregation in daily-pnl.ts.
// ---------------------------------------------------------------------------

export const fxSpotMaturityPayloadSchema = z.object({
  productKind: z.literal("FX-spot"),
  /** Currency pair (canonical "BASE/QUOTE", e.g. "USD/ZAR"). */
  currencyPair: z.string().min(1),
  /** Which leg of the trade reached maturity (near for spot; far for swap-far). */
  legKind: z.enum(["near", "far"]),
  /**
   * Settled base-currency amount in minor units (positive = bank received,
   * negative = bank paid).
   */
  settledBaseCurrencyMinor: z.number().int(),
  /**
   * Settled quote-currency amount in minor units (positive = bank received,
   * negative = bank paid).
   */
  settledQuoteCurrencyMinor: z.number().int(),
  /** Chart-of-accounts ID for the nostro account receiving/paying base currency. */
  nostroAccountBase: z.string().regex(/^ACC-[0-9]{4}-[0-9]{3}$/),
  /** Chart-of-accounts ID for the nostro account receiving/paying quote currency. */
  nostroAccountQuote: z.string().regex(/^ACC-[0-9]{4}-[0-9]{3}$/),
  /**
   * Realised P&L in ZAR minor units. Computed as:
   *   (settledZarEquivalent) - (carryingAmountZar at last revaluation).
   * Positive = gain; negative = loss. Zero if revaluations were current
   * to the settlement rate.
   */
  realisedPnlZarMinor: z.number().int(),
  /** Correspondent bank message reference (SWIFT MT300 / pacs.009 reference). */
  correspondentRef: z.string().optional(),
});

export type FxSpotMaturityPayload = z.infer<typeof fxSpotMaturityPayloadSchema>;

// ---------------------------------------------------------------------------
// TradeMatured envelope
//
// Discriminated on `productKind` via the variant payload. New asset
// classes add a new variant schema and extend the union below.
// ---------------------------------------------------------------------------

export const tradeMaturedPayloadSchema = z.object({
  /** Internal trade identifier — links back to the originating *TradeExecuted. */
  tradeId: z.string().min(1),
  /** ISO 8601 timestamp at which the trade reached its terminal state. */
  maturedAt: z.string().min(1),
  /**
   * Product-specific maturity data. Discriminated by `product.productKind`.
   * FX spot is the first variant; bond/IRD/equity follow as their lifecycles
   * migrate.
   */
  product: fxSpotMaturityPayloadSchema,
});

export type TradeMaturedPayload = z.infer<typeof tradeMaturedPayloadSchema>;

export function makeTradeMatured(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TradeMaturedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "TradeMatured requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TradeMatured",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: tradeMaturedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Convenience helpers for consumers — extract the FX-spot variant payload
// from a TradeMatured event in a type-safe way.
// ---------------------------------------------------------------------------

/**
 * Type guard: is this TradeMatured payload the FX-spot variant?
 */
export function isFxSpotMaturity(
  p: TradeMaturedPayload,
): p is TradeMaturedPayload & { product: FxSpotMaturityPayload } {
  return p.product.productKind === "FX-spot";
}
