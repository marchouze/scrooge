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
// Kai (Trading Systems Engineer, engineering) per D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).

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
  /**
   * Optional reference to the FinancialInstrument entity for this security.
   * Convention: `"fi:equity:<exchange>:<ticker>"` or `"fi:equity:<ISIN>"`.
   * Absent for legacy events booked before the FinancialInstrument entity landed.
   * When present, must match an existing FinancialInstrumentDefined.instrumentId
   * (actusContractType = "STK").
   * Authority: D-FINANCIAL-INSTRUMENT-ENTITY.
   */
  instrumentId: z.string().min(1).optional(),
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
  /**
   * Optional reference to the FinancialInstrument entity for this security.
   * Convention: `"fi:equity:<exchange>:<ticker>"` or `"fi:equity:<ISIN>"`.
   * Absent for legacy events booked before the FinancialInstrument entity landed.
   * When present, must match an existing FinancialInstrumentDefined.instrumentId
   * (actusContractType = "STK").
   * Authority: D-FINANCIAL-INSTRUMENT-ENTITY.
   */
  instrumentId: z.string().min(1).optional(),
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
  /**
   * Optional reference to the FinancialInstrument entity for this security.
   * Convention: `"fi:equity:<exchange>:<ticker>"` or `"fi:equity:<ISIN>"`.
   * Absent for legacy events booked before the FinancialInstrument entity landed.
   * When present, must match an existing FinancialInstrumentDefined.instrumentId
   * (actusContractType = "STK").
   * Authority: D-FINANCIAL-INSTRUMENT-ENTITY.
   */
  instrumentId: z.string().min(1).optional(),
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
// EquityTradeExecuted — exchange fill event (M3 slice)
// ---------------------------------------------------------------------------

export const equityTradeExecutedPayloadSchema = z.object({
  /** Stable trade identifier — internal trade-id with venue cross-reference. */
  tradeId: identifierSchema,
  /** Order identifier — links to the OrderProposed event upstream. */
  orderId: z.string().min(1),
  /** Equity instrument traded. Class must be "listed-equity" or "etf". */
  instrument: instrumentSchema.refine((i) => i.class === "listed-equity" || i.class === "etf", {
    message: "EquityTradeExecuted requires listed-equity or etf instrument class",
  }),
  /** Side of the trade from the bank's perspective. */
  side: z.enum(["buy", "sell"]),
  /** Quantity of shares executed. */
  quantity: quantitySchema,
  /** Execution price per share. */
  executionPrice: priceSchema,
  /** Total consideration (price × qty, pre-fees). */
  consideration: moneySchema,
  /** ISO 8601 UTC timestamp of execution. */
  executedAt: z.string().min(1),
  /** Trading venue. */
  venue: z.enum(["JSE", "OTC"]),
  /** Book identifier — which trading book / strategy this is allocated to. */
  bookId: z.string().min(1),
  /**
   * Optional reference to the FinancialInstrument entity for this security.
   * Convention: `"fi:equity:<exchange>:<ticker>"` or `"fi:equity:<ISIN>"`.
   * Absent for legacy events booked before the FinancialInstrument entity landed.
   * When present, must match an existing FinancialInstrumentDefined.instrumentId
   * (actusContractType = "STK").
   * Authority: D-FINANCIAL-INSTRUMENT-ENTITY.
   */
  instrumentId: z.string().min(1).optional(),
  /** Counterparty on the other side of the fill. */
  counterparty: partySchema,
  /** Trader reference (FIX SenderCompID equivalent). */
  traderRef: z.string().min(1),
});

export type EquityTradeExecutedPayload = z.infer<typeof equityTradeExecutedPayloadSchema>;

export function makeEquityTradeExecuted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EquityTradeExecutedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "EquityTradeExecuted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: equityTradeExecutedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// EquitySettlementConfirmed — Strate T+3 confirmation (M3 slice)
// ---------------------------------------------------------------------------

export const equitySettlementConfirmedPayloadSchema = z.object({
  /** Trade this confirmation settles. */
  tradeId: identifierSchema,
  /** Date on which settlement is confirmed. */
  settlementDate: cdmDateSchema,
  /** Securities leg detail. */
  securitiesLeg: z.object({
    direction: z.enum(["receive", "deliver"]),
    quantity: quantitySchema,
    instrument: instrumentSchema,
  }),
  /** Cash leg detail. */
  cashLeg: z.object({
    direction: z.enum(["pay", "receive"]),
    amount: moneySchema,
  }),
  /** ISO 8601 UTC timestamp of confirmation. */
  confirmedAt: z.string().min(1),
  /** Strate CSD settlement reference (optional until Strate substrate lands). */
  strateRef: z.string().optional(),
});

export type EquitySettlementConfirmedPayload = z.infer<
  typeof equitySettlementConfirmedPayloadSchema
>;

export function makeEquitySettlementConfirmed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EquitySettlementConfirmedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "EquitySettlementConfirmed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: equitySettlementConfirmedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// EquityPositionRevalued — EOD mark-to-market (M3 slice)
// ---------------------------------------------------------------------------

export const equityPositionRevaluedPayloadSchema = z.object({
  /** Trade that opened this equity position. */
  tradeId: identifierSchema,
  /** Instrument being revalued. */
  instrument: instrumentSchema,
  /** YYYY-MM-DD valuation date (EOD). */
  valuationDate: z.string().min(1),
  /** JSE closing price for the valuation date. */
  closingPrice: priceSchema,
  /** Quantity held in this position. */
  quantity: quantitySchema,
  /** Book value (cost basis) in ZAR. */
  bookValue: moneySchema,
  /** Market value (closing price × qty) in ZAR. */
  marketValue: moneySchema,
  /** Unrealised P&L = marketValue − bookValue. */
  unrealisedPnl: moneySchema,
});

export type EquityPositionRevaluedPayload = z.infer<typeof equityPositionRevaluedPayloadSchema>;

export function makeEquityPositionRevalued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: EquityPositionRevaluedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "EquityPositionRevalued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: equityPositionRevaluedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Equity event-type registry — for runtime registration into the event store.
// ---------------------------------------------------------------------------

export const EQUITY_EVENT_TYPES = [
  "EquityTradeBooked",
  "EquityCorporateActionApplied",
  "EquitySettlementInstructed",
  "EquityTradeExecuted",
  "EquitySettlementConfirmed",
  "EquityPositionRevalued",
] as const;

export type EquityEventType = (typeof EQUITY_EVENT_TYPES)[number];

/** Re-export the date type for downstream consumers (Anya projections). */
export type { CdmDate };
