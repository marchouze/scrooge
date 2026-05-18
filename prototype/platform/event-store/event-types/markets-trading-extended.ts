// platform/event-store/event-types/markets-trading-extended.ts
//
// Trading, markets, positions event-payload schemas.
//
// Covers: TradeExecuted, TradeBooked, TradePosted, TransactionPosted,
//   OrderSubmitted, OrderFilled, OrderRoutingAnomaly, FXPositionBreach,
//   PositionAdjusted, CollateralUpdated, HedgeIneffective, MarketDataOutage,
//   DealerMandateBreach, PreTradeGatewayBlock, SurveillanceAlert,
//   SurveillanceFeedGap, AccrualBooked (skip — in ifrs-accounting-extended),
//   DepositReceived (skip), FundingDrawn (skip), FundingDrawnDown (skip),
//   LoanBooked (skip), PortfolioReclassification (skip)
//
// Authority: F-032 (event-type-registry-coverage recon).
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { deterministicAggregateId, makeAggregateLabel } from "../aggregate";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// TradeExecuted
// ---------------------------------------------------------------------------

export const tradeExecutedPayloadSchema = z
  .object({
    tradeId: z.string().optional(),
    instrument: z.string().optional(),
    side: z.enum(["buy", "sell"]).optional(),
    quantity: z.number().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    counterpartyLei: z.string().optional(),
    venue: z.string().optional(),
    executedAt: z.string().optional(),
    traderRef: z.string().optional(),
    portfolio: z.enum(["trading-book", "banking-book"]).optional(),
  })
  .passthrough();

export type TradeExecutedPayload = z.infer<typeof tradeExecutedPayloadSchema>;

export function makeTradeExecuted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TradeExecutedPayload;
  eventId?: string;
}): Event {
  const tradeId = args.payload.tradeId;
  const aggregateLabel = tradeId ? makeAggregateLabel("trade", tradeId) : undefined;
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TradeExecuted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: tradeExecutedPayloadSchema.parse(args.payload),
    ...(aggregateLabel
      ? { aggregateId: deterministicAggregateId(aggregateLabel), aggregateLabel }
      : {}),
  });
}

// ---------------------------------------------------------------------------
// TradeBooked
// ---------------------------------------------------------------------------

export const tradeBooedPayloadSchema = z
  .object({
    // Emitted by ClimateRisk tests: { counterpartyId, sectorCode, tradeId }
    counterpartyId: z.string().optional(),
    sectorCode: z.string().optional(),
    tradeId: z.string().optional(),
    // Factory fields (alternative shape)
    bookingRef: z.string().optional(),
    instrument: z.string().optional(),
    side: z.enum(["buy", "sell"]).optional(),
    quantity: z.number().optional(),
    bookingPrice: z.number().optional(),
    currency: z.string().optional(),
    bookedAt: z.string().optional(),
    portfolio: z.enum(["trading-book", "banking-book"]).optional(),
    tradeRef: z.string().optional(),
  })
  .passthrough();

export type TradeBookedPayload = z.infer<typeof tradeBooedPayloadSchema>;

export function makeTradeBooked(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TradeBookedPayload;
  eventId?: string;
}): Event {
  const tradeId = args.payload.tradeId;
  const aggregateLabel = tradeId ? makeAggregateLabel("trade", tradeId) : undefined;
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TradeBooked",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: tradeBooedPayloadSchema.parse(args.payload),
    ...(aggregateLabel
      ? { aggregateId: deterministicAggregateId(aggregateLabel), aggregateLabel }
      : {}),
  });
}

// ---------------------------------------------------------------------------
// TradePosted
// ---------------------------------------------------------------------------

export const tradePostedPayloadSchema = z.object({
  tradeId: z.string().min(1),
  postedAt: z.string().min(1),
  glAccount: z.string().optional(),
  subLedgerRef: z.string().optional(),
  postingAmount: z.number(),
  currency: z.string().min(3).max(3),
  postingKind: z.enum(["initial", "settlement", "adjustment", "accrual"]),
});

export type TradePostedPayload = z.infer<typeof tradePostedPayloadSchema>;

export function makeTradePosted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TradePostedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("trade", args.payload.tradeId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TradePosted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: tradePostedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// TransactionPosted
// ---------------------------------------------------------------------------

export const transactionPostedPayloadSchema = z.object({
  transactionId: z.string().min(1),
  transactionKind: z.enum(["trade", "payment", "accrual", "fee", "settlement", "other"]),
  postedAt: z.string().min(1),
  amount: z.number(),
  currency: z.string().min(3).max(3),
  counterpartyRef: z.string().optional(),
  amlScreeningRequired: z.boolean(),
});

export type TransactionPostedPayload = z.infer<typeof transactionPostedPayloadSchema>;

export function makeTransactionPosted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TransactionPostedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TransactionPosted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: transactionPostedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// OrderSubmitted
// ---------------------------------------------------------------------------

export const orderSubmittedPayloadSchema = z.object({
  orderId: z.string().min(1),
  instrument: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  quantity: z.number().positive(),
  orderKind: z.enum(["market", "limit", "stop", "stop-limit", "iceberg", "other"]),
  venue: z.string().min(1),
  submittedAt: z.string().min(1),
  limitPrice: z.number().positive().optional(),
  traderRef: z.string().optional(),
});

export type OrderSubmittedPayload = z.infer<typeof orderSubmittedPayloadSchema>;

export function makeOrderSubmitted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OrderSubmittedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OrderSubmitted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: orderSubmittedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// OrderFilled
// ---------------------------------------------------------------------------

export const orderFilledPayloadSchema = z.object({
  orderId: z.string().min(1),
  fillId: z.string().min(1),
  instrument: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  filledQuantity: z.number().positive(),
  fillPrice: z.number().positive(),
  currency: z.string().min(3).max(3),
  filledAt: z.string().min(1),
  venue: z.string().optional(),
  partialFill: z.boolean(),
});

export type OrderFilledPayload = z.infer<typeof orderFilledPayloadSchema>;

export function makeOrderFilled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OrderFilledPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OrderFilled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: orderFilledPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// OrderRoutingAnomaly
// ---------------------------------------------------------------------------

export const orderRoutingAnomalyPayloadSchema = z.object({
  anomalyId: z.string().min(1),
  orderId: z.string().min(1),
  anomalyKind: z.enum([
    "unexpected-latency",
    "wrong-venue",
    "misrouted",
    "rejected-by-venue",
    "other",
  ]),
  detectedAt: z.string().min(1),
  expectedVenue: z.string().optional(),
  actualVenue: z.string().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  severity: z.enum(["warn", "critical"]),
});

export type OrderRoutingAnomalyPayload = z.infer<typeof orderRoutingAnomalyPayloadSchema>;

export function makeOrderRoutingAnomaly(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OrderRoutingAnomalyPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OrderRoutingAnomaly",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: orderRoutingAnomalyPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FXPositionBreach
// ---------------------------------------------------------------------------

export const fxPositionBreachPayloadSchema = z.object({
  breachId: z.string().min(1),
  currencyPair: z.string().min(1),
  positionAmount: z.number(),
  limitAmount: z.number().positive(),
  breachPct: z.number(),
  detectedAt: z.string().min(1),
  severity: z.enum(["warn", "breach", "critical"]),
  reportingCurrency: z.string().min(3).max(3),
});

export type FXPositionBreachPayload = z.infer<typeof fxPositionBreachPayloadSchema>;

export function makeFXPositionBreach(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FXPositionBreachPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FXPositionBreach",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fxPositionBreachPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PositionAdjusted
// ---------------------------------------------------------------------------

export const positionAdjustedPayloadSchema = z.object({
  adjustmentId: z.string().min(1),
  instrumentId: z.string().min(1),
  adjustmentKind: z.enum(["corporate-action", "trade-correction", "wash", "other"]),
  quantityBefore: z.number(),
  quantityAfter: z.number(),
  adjustedAt: z.string().min(1),
  authorizedBy: z.string().min(1),
  reason: z.string().optional(),
});

export type PositionAdjustedPayload = z.infer<typeof positionAdjustedPayloadSchema>;

export function makePositionAdjusted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PositionAdjustedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PositionAdjusted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: positionAdjustedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CollateralUpdated
// ---------------------------------------------------------------------------

export const collateralUpdatedPayloadSchema = z
  .object({
    // Emitted by climate risk test: { counterpartyId, sectorCode, collateralId }
    counterpartyId: z.string().optional(),
    sectorCode: z.string().optional(),
    collateralId: z.string().optional(),
    // Factory fields (alternative shape)
    updateId: z.string().optional(),
    counterpartyRef: z.string().optional(),
    updateKind: z
      .enum([
        "margin-call",
        "collateral-posted",
        "collateral-received",
        "haircut-reapplied",
        "other",
      ])
      .optional(),
    collateralAmount: z.number().optional(),
    currency: z.string().optional(),
    updatedAt: z.string().optional(),
    exposureAfter: z.number().optional(),
  })
  .passthrough();

export type CollateralUpdatedPayload = z.infer<typeof collateralUpdatedPayloadSchema>;

export function makeCollateralUpdated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CollateralUpdatedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CollateralUpdated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: collateralUpdatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// HedgeIneffective
// ---------------------------------------------------------------------------

export const hedgeIneffectivePayloadSchema = z.object({
  assessmentId: z.string().min(1),
  hedgeId: z.string().min(1),
  hedgeKind: z.enum(["fair-value", "cash-flow", "net-investment"]),
  ifrsSection: z.string().optional(),
  assessedAt: z.string().min(1),
  ineffectivenessAmount: z.number(),
  currency: z.string().min(3).max(3),
  assessedBy: z.string().min(1),
  action: z.enum(["derecognise", "rebalance", "continue-monitor"]),
});

export type HedgeIneffectivePayload = z.infer<typeof hedgeIneffectivePayloadSchema>;

export function makeHedgeIneffective(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: HedgeIneffectivePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "HedgeIneffective",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: hedgeIneffectivePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MarketDataOutage
// ---------------------------------------------------------------------------

export const marketDataOutagePayloadSchema = z.object({
  outageId: z.string().min(1),
  dataVendor: z.string().min(1),
  affectedInstruments: z.array(z.string()).optional(),
  startedAt: z.string().min(1),
  detectedAt: z.string().min(1),
  severity: z.enum(["partial", "full"]),
  impactAssessment: z.string().optional(),
  fallbackAvailable: z.boolean(),
});

export type MarketDataOutagePayload = z.infer<typeof marketDataOutagePayloadSchema>;

export function makeMarketDataOutage(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MarketDataOutagePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MarketDataOutage",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: marketDataOutagePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// DealerMandateBreach
// ---------------------------------------------------------------------------

export const dealerMandateBreachPayloadSchema = z.object({
  breachId: z.string().min(1),
  dealerRef: z.string().min(1),
  breachKind: z.enum([
    "unauthorised-instrument",
    "size-exceeded",
    "unauthorised-counterparty",
    "other",
  ]),
  detectedAt: z.string().min(1),
  tradeRef: z.string().optional(),
  severity: z.enum(["warn", "breach", "critical"]),
  actionRequired: z.string().optional(),
});

export type DealerMandateBreachPayload = z.infer<typeof dealerMandateBreachPayloadSchema>;

export function makeDealerMandateBreach(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DealerMandateBreachPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DealerMandateBreach",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: dealerMandateBreachPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PreTradeGatewayBlock
// ---------------------------------------------------------------------------

export const preTradeGatewayBlockPayloadSchema = z.object({
  blockId: z.string().min(1),
  orderId: z.string().min(1),
  blockReason: z.enum([
    "risk-limit",
    "compliance",
    "sanctions",
    "credit-limit",
    "documentation",
    "other",
  ]),
  blockedAt: z.string().min(1),
  gateRef: z.string().optional(),
  instrument: z.string().optional(),
  traderRef: z.string().optional(),
});

export type PreTradeGatewayBlockPayload = z.infer<typeof preTradeGatewayBlockPayloadSchema>;

export function makePreTradeGatewayBlock(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PreTradeGatewayBlockPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PreTradeGatewayBlock",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: preTradeGatewayBlockPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SurveillanceAlert
// ---------------------------------------------------------------------------

export const surveillanceAlertPayloadSchema = z.object({
  alertId: z.string().min(1),
  alertKind: z.enum([
    "layering",
    "spoofing",
    "front-running",
    "wash-trading",
    "insider-trading",
    "other",
  ]),
  detectedAt: z.string().min(1),
  orderId: z.string().optional(),
  tradeId: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  requiresMlroReview: z.boolean(),
  description: z.string().optional(),
});

export type SurveillanceAlertPayload = z.infer<typeof surveillanceAlertPayloadSchema>;

export function makeSurveillanceAlert(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SurveillanceAlertPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SurveillanceAlert",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: surveillanceAlertPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SurveillanceFeedGap
// ---------------------------------------------------------------------------

export const surveillanceFeedGapPayloadSchema = z.object({
  gapId: z.string().min(1),
  venue: z.string().min(1),
  dataVendor: z.string().optional(),
  gapStartAt: z.string().min(1),
  detectedAt: z.string().min(1),
  missingTickCount: z.number().int().nonnegative().optional(),
  affectedInstruments: z.array(z.string()).optional(),
  severity: z.enum(["warn", "critical"]),
});

export type SurveillanceFeedGapPayload = z.infer<typeof surveillanceFeedGapPayloadSchema>;

export function makeSurveillanceFeedGap(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SurveillanceFeedGapPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SurveillanceFeedGap",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: surveillanceFeedGapPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const MARKETS_TRADING_EXTENDED_TYPED_EVENT_TYPES = [
  "TradeExecuted",
  "TradeBooked",
  "TradePosted",
  "TransactionPosted",
  "OrderSubmitted",
  "OrderFilled",
  "OrderRoutingAnomaly",
  "FXPositionBreach",
  "PositionAdjusted",
  "CollateralUpdated",
  "HedgeIneffective",
  "MarketDataOutage",
  "DealerMandateBreach",
  "PreTradeGatewayBlock",
  "SurveillanceAlert",
  "SurveillanceFeedGap",
] as const;
