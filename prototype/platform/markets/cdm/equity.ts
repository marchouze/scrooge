// platform/markets/cdm/equity.ts
//
// CDM equity event types — M1 slice. Three event shapes:
//   - EquityTradeBooked          — a trade has been agreed and recorded.
//   - EquityCorporateActionApplied — a corporate action (dividend / split /
//     consolidation / rights / merger) has been applied to a position.
//   - EquitySettlementInstructed — settlement instruction issued to the
//     clearing/settlement path; pairs with a downstream Tomas-domain event.
//
// Each schema is a Zod object that validates at the event-store boundary
// before append. The make<Type> factory wraps payload validation +
// envelope construction the same way platform/event-store/event-types.ts
// does for AgentEscalation / AgentDecision / WorkstreamRegistered.
//
// Per CLAUDE.md Principle 1 (events as truth) — the typed payload is the
// canonical record of the trade; positions, P&L, sub-ledger postings are
// projections derived from this stream.
//
// Author: Kai · M1 per D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../../event-store/types";
import {
  type CdmDate,
  cdmDateSchema,
  identifierSchema,
  instrumentSchema,
  moneySchema,
  partySchema,
  priceSchema,
  quantitySchema,
} from "./primitives";

// ---------------------------------------------------------------------------
// EquityTradeBooked
// ---------------------------------------------------------------------------

export const equityTradeBookedPayloadSchema = z.object({
  /** Stable trade identifier — internal trade-id with venue-id cross-reference. */
  tradeId: identifierSchema,
  /** Equity instrument traded. Class must be "listed-equity" or "etf". */
  instrument: instrumentSchema.refine((i) => i.class === "listed-equity" || i.class === "etf", {
    message: "EquityTradeBooked requires listed-equity or etf instrument class",
  }),
  /** Side of the trade from the bank's perspective. */
  side: z.enum(["buy", "sell"]),
  /** Quantity traded. Unit must be "share" for listed equities. */
  quantity: quantitySchema,
  /** Execution price per unit. */
  price: priceSchema,
  /** Total consideration in the trade currency (price × quantity, before fees). */
  consideration: moneySchema,
  /** Trade date (when agreed). */
  tradeDate: cdmDateSchema,
  /** Settlement date (when title and cash settle). */
  settlementDate: cdmDateSchema,
  /** Counterparty. */
  counterparty: partySchema,
  /** Trading venue (e.g. "JSE", "OTC"). Captured for surveillance + best-ex review. */
  venue: z.string().min(1),
  /** Trader identifier (FIX SenderCompID equivalent). */
  trader: z.string().min(1),
  /** Book identifier — which trading book / strategy this is allocated to. */
  bookId: z.string().min(1),
});

export type EquityTradeBookedPayload = z.infer<typeof equityTradeBookedPayloadSchema>;

export function makeEquityTradeBooked(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EquityTradeBookedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "EquityTradeBooked",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: equityTradeBookedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// EquityCorporateActionApplied
// ---------------------------------------------------------------------------

export const corporateActionTypeSchema = z.enum([
  "cash-dividend",
  "scrip-dividend",
  "stock-split",
  "stock-consolidation",
  "rights-issue",
  "bonus-issue",
  "merger",
  "spin-off",
  "delisting",
]);

export type CorporateActionType = z.infer<typeof corporateActionTypeSchema>;

export const equityCorporateActionAppliedPayloadSchema = z.object({
  /** Stable corporate-action identifier. */
  actionId: identifierSchema,
  /** Equity instrument the action applies to. */
  instrument: instrumentSchema.refine((i) => i.class === "listed-equity" || i.class === "etf", {
    message: "EquityCorporateActionApplied requires listed-equity or etf instrument class",
  }),
  /** Corporate action type. */
  actionType: corporateActionTypeSchema,
  /** Ex-date — date on or after which a buyer no longer receives the action. */
  exDate: cdmDateSchema,
  /** Record date — date on which holders of record receive the action. */
  recordDate: cdmDateSchema,
  /** Payment / effective date — when the action settles in the position. */
  paymentDate: cdmDateSchema,
  /** Cash amount per share (cash-dividend; null for non-cash actions). */
  cashPerShare: priceSchema.optional(),
  /** Ratio for split / consolidation / scrip / bonus (e.g. {numerator: 3, denominator: 2}). */
  ratio: z
    .object({
      numerator: z.number().positive(),
      denominator: z.number().positive(),
    })
    .optional(),
  /** Position book affected. */
  bookId: z.string().min(1),
  /** Quantity held at record date. */
  positionAtRecord: quantitySchema,
});

export type EquityCorporateActionAppliedPayload = z.infer<
  typeof equityCorporateActionAppliedPayloadSchema
>;

export function makeEquityCorporateActionApplied(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EquityCorporateActionAppliedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "EquityCorporateActionApplied",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: equityCorporateActionAppliedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// EquitySettlementInstructed
// ---------------------------------------------------------------------------

export const equitySettlementInstructedPayloadSchema = z.object({
  /** The trade this settlement instruction settles. */
  tradeId: identifierSchema,
  /** Stable settlement instruction identifier. */
  settlementId: identifierSchema,
  /** Net cash to pay (negative) or receive (positive) at settlement, in the settlement currency. */
  netCash: moneySchema,
  /** Net quantity to deliver (negative) or receive (positive). */
  netQuantity: quantitySchema,
  /** Settlement date. */
  settlementDate: cdmDateSchema,
  /** Settlement venue / CSD identifier (e.g. "STRATE"). */
  settlementVenue: z.string().min(1),
  /** Counterparty settlement details (BIC + account). */
  counterparty: partySchema,
});

export type EquitySettlementInstructedPayload = z.infer<
  typeof equitySettlementInstructedPayloadSchema
>;

export function makeEquitySettlementInstructed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EquitySettlementInstructedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "EquitySettlementInstructed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: equitySettlementInstructedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Equity event-type registry — for runtime registration into the event store.
// ---------------------------------------------------------------------------

export const EQUITY_EVENT_TYPES = [
  "EquityTradeBooked",
  "EquityCorporateActionApplied",
  "EquitySettlementInstructed",
] as const;

export type EquityEventType = (typeof EQUITY_EVENT_TYPES)[number];

/** Re-export the date type for downstream consumers (Anya projections). */
export type { CdmDate };
