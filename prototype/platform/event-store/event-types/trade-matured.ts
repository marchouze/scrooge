// platform/event-store/event-types/trade-matured.ts
//
// TradeMatured — generic lifecycle-terminal event for a settled or matured
// trade across asset classes. Replaces the FX-specific
// `FxSettlementConfirmed` (retired 2026-05-21) as the canonical terminal
// event for FX spot, and is intended to subsume future per-asset terminal
// events (bond maturity, equity settlement, IRS termination) as those
// lifecycles converge on this primitive.
//
// The payload is a discriminated union on `productKind`. The FX-spot variant
// is structurally identical to the previous `FxSettlementConfirmed` payload
// so the FX accounting lifecycle (derecognition + realised-P&L crystallisation
// in product-control/daily-pnl.ts, PR-FX-PRIN / PR-FX-LIFECYCLE-CLOSE in
// posting-rules/fx-spot.ts) preserves its existing semantics.
//
// Authority:
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
//   - brief:bea:tradematured-event-schema-and-retire-fxsettlemen:2026-05-21
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// FX spot variant
//
// T+2 (or T+N for non-spot) cash exchange confirmed by the correspondent
// bank. Derecognises the FX Trading Receivable/Payable (FVTPL) and
// recognises the nostro cash legs (amortised cost). Realised P&L =
// settled cash (ZAR equivalent) - carrying amount of the FVTPL asset.
//
// Per IFRS 9 §3.2.3: derecognise a financial asset when the contractual
// rights to the cash flows expire or are transferred.
// ---------------------------------------------------------------------------

export const tradeMaturedFxSpotPayloadSchema = z.object({
  productKind: z.literal("fx-spot"),
  /** The trade this maturation confirms. */
  tradeId: z.string().min(1),
  /** Currency pair. */
  currencyPair: z.string().min(1),
  /** Which leg of the trade (near / far for swaps; near for spot). */
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
  /** ISO 8601 timestamp when settlement was confirmed by the correspondent. */
  settledAt: z.string().min(1),
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

export type TradeMaturedFxSpotPayload = z.infer<typeof tradeMaturedFxSpotPayloadSchema>;

// ---------------------------------------------------------------------------
// Tagged-union TradeMatured payload — future asset-class variants extend
// here. The discriminant is `productKind`; downstream consumers narrow on
// it before reading variant-specific fields.
// ---------------------------------------------------------------------------

export const tradeMaturedPayloadSchema = z.discriminatedUnion("productKind", [
  tradeMaturedFxSpotPayloadSchema,
]);

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

export const TRADE_MATURED_EVENT_TYPES = ["TradeMatured"] as const;
export type TradeMaturedEventType = (typeof TRADE_MATURED_EVENT_TYPES)[number];
