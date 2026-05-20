// platform/event-store/event-types/trading.ts
//
// Trading / markets event-payload schemas.
//
// Covers:
//   - Pre-trade gateway family: OrderProposed, GatewayCheckRequested,
//     GatewayCheckCompleted, OrderApprovedAtGateway, OrderRejectedAtGateway,
//     PreTradeLimitChanged
//   - CRM counterparty eligibility: CounterpartyEligibilityScreened,
//     CounterpartyEligibilityRevalidated, CounterpartyEligibilityBreached
//   - FX correspondent routing: SwitchTestActivated, SwitchTestEnded,
//     SwitchTestReport
//
// F-020 split from the god-file `../event-types.ts`.
// Authors: Saskia (Head of trading, governance), Kai (Markets engineer),
//          Niko (Sales / CRM engineer), Tomas (Operations & payments engineer),
//          Atlas (substrate)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Pre-trade gateway family
// ---------------------------------------------------------------------------

export const orderSideSchema = z.enum(["buy", "sell"]);

export const orderProposedPayloadSchema = z.object({
  orderId: z.string().min(1),
  counterpartyLei: z
    .string()
    .min(1)
    .regex(/^[A-Z0-9]{20}$/, { message: "counterpartyLei must be a 20-char ISO 17442 LEI" }),
  instrument: z.string().min(1),
  side: orderSideSchema,
  quantity: z.number().positive(),
  price: z.number().positive(),
  priceCurrency: z
    .string()
    .min(3)
    .regex(/^[A-Z]{3}$/, { message: "priceCurrency must be ISO 4217 (3-char uppercase)" }),
  bookingEntity: z.string().min(1),
  requestedActor: z.string().min(1),
});

export type OrderProposedPayload = z.infer<typeof orderProposedPayloadSchema>;

export function makeOrderProposed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OrderProposedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OrderProposed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: orderProposedPayloadSchema.parse(args.payload),
  });
}

export const gatewayCheckKindSchema = z.enum([
  "identity",
  "sanctions",
  "suitability",
  "surveillance",
  "credit-limit",
  "market-risk",
  "capital-impact",
  "funding",
  "documentation",
  "jurisdiction",
  "counterparty-eligibility",
]);

export const gatewayCheckRequestedPayloadSchema = z.object({
  orderId: z.string().min(1),
  checkKind: gatewayCheckKindSchema,
  sourceOrderEventId: z.string().min(1),
  requestedAt: z.string().min(1),
  timeoutMs: z.number().int().positive().optional(),
});

export type GatewayCheckRequestedPayload = z.infer<typeof gatewayCheckRequestedPayloadSchema>;

export function makeGatewayCheckRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: GatewayCheckRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "GatewayCheckRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: gatewayCheckRequestedPayloadSchema.parse(args.payload),
  });
}

export const gatewayCheckOutcomeSchema = z.enum(["approve", "reject", "timeout"]);

export const gatewayCheckCompletedPayloadSchema = z.object({
  orderId: z.string().min(1),
  checkKind: gatewayCheckKindSchema,
  outcome: gatewayCheckOutcomeSchema,
  sourceCheckRequestEventId: z.string().min(1),
  completedAt: z.string().min(1),
  durationMs: z.number().nonnegative(),
  rejectionReason: z.string().optional(),
  citationToRule: z.string().optional(),
});

export type GatewayCheckCompletedPayload = z.infer<typeof gatewayCheckCompletedPayloadSchema>;

export function makeGatewayCheckCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: GatewayCheckCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "GatewayCheckCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: gatewayCheckCompletedPayloadSchema.parse(args.payload),
  });
}

export const orderApprovedAtGatewayPayloadSchema = z.object({
  orderId: z.string().min(1),
  approvalCitations: z.array(z.string().min(1)),
  passedAt: z.string().min(1),
});

export type OrderApprovedAtGatewayPayload = z.infer<typeof orderApprovedAtGatewayPayloadSchema>;

export function makeOrderApprovedAtGateway(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OrderApprovedAtGatewayPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OrderApprovedAtGateway",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: orderApprovedAtGatewayPayloadSchema.parse(args.payload),
  });
}

export const orderRejectedAtGatewayPayloadSchema = z.object({
  orderId: z.string().min(1),
  rejectionReason: z.string().min(1),
  rejectingCheck: gatewayCheckKindSchema,
  citationToRule: z.string().min(1),
  rejectedAt: z.string().min(1),
});

export type OrderRejectedAtGatewayPayload = z.infer<typeof orderRejectedAtGatewayPayloadSchema>;

export function makeOrderRejectedAtGateway(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OrderRejectedAtGatewayPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OrderRejectedAtGateway",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: orderRejectedAtGatewayPayloadSchema.parse(args.payload),
  });
}

export const preTradeLimitKindSchema = z.enum([
  "credit",
  "market-risk",
  "capital-impact",
  "funding",
  "concentration",
  "instrument-eligibility",
  "counterparty-eligibility",
]);

export const preTradeLimitChangedPayloadSchema = z.object({
  limitId: z.string().min(1),
  limitKind: preTradeLimitKindSchema,
  previousValue: z.number().optional(),
  newValue: z.number().optional(),
  valueCurrency: z
    .string()
    .min(3)
    .regex(/^[A-Z]{3}$/, { message: "valueCurrency must be ISO 4217 (3-char uppercase)" })
    .optional(),
  changedBy: z.string().min(1),
  rasEnvelopeCitation: z.string().min(1),
  rationale: z.string().min(1),
  effectiveFrom: z.string().min(1),
});

export type PreTradeLimitChangedPayload = z.infer<typeof preTradeLimitChangedPayloadSchema>;

export function makePreTradeLimitChanged(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PreTradeLimitChangedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PreTradeLimitChanged",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: preTradeLimitChangedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FX desk Slice 3 — RFQ lifecycle events (Kai, 2026-05-18)
//
// RfqRequested — emitted when the desk receives an RFQ from a counterparty.
// QuoteResponded — emitted when the pricer responds with a bid/offer/mid.
//
// Both events precede FxTradeExecuted in the trade lifecycle and provide
// the audit trail for the quote-to-trade chain required by FIC Act s.22
// and JSE IRC record-retention obligations (7 years per ORG-JSE-IRC-01).
//
// Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
// Authors: Kai (Trading systems engineer, engineering) + Saskia (Head of
//          Global Markets, governance) + Rohan (Risk engineer)
// ---------------------------------------------------------------------------

export const rfqRequestedPayloadSchema = z.object({
  rfqId: z.string().min(1),
  counterpartyId: z.string().min(1),
  currencyPair: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  notional: z.number().positive(),
  valueDate: z.string().min(1),
  requestedAt: z.string().min(1),
});

export type RfqRequestedPayload = z.infer<typeof rfqRequestedPayloadSchema>;

export function makeRfqRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RfqRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RfqRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: rfqRequestedPayloadSchema.parse(args.payload),
  });
}

export const quoteRespondedPayloadSchema = z.object({
  rfqId: z.string().min(1),
  bidRate: z.number(),
  midRate: z.number(),
  offerRate: z.number(),
  halfSpread: z.number().nonnegative(),
  source: z.string().min(1),
  quotedAt: z.string().min(1),
});

export type QuoteRespondedPayload = z.infer<typeof quoteRespondedPayloadSchema>;

export function makeQuoteResponded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: QuoteRespondedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "QuoteResponded",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: quoteRespondedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CRM — counterparty institutional-eligibility screening (Niko, v0)
// ---------------------------------------------------------------------------

export const counterpartyEligibilityOutcomeSchema = z.enum([
  "institutional-eligible",
  "ineligible",
  "indeterminate",
]);

export type CounterpartyEligibilityOutcome = z.infer<typeof counterpartyEligibilityOutcomeSchema>;

export const counterpartyEligibilityScreenedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  screeningId: z.string().min(1),
  criteria: z.array(z.string().min(1)).min(1),
  outcome: counterpartyEligibilityOutcomeSchema,
  evidenceRefs: z.array(z.string().min(1)).min(1),
  asOf: z.string().min(1),
});

export type CounterpartyEligibilityScreenedPayload = z.infer<
  typeof counterpartyEligibilityScreenedPayloadSchema
>;

export function makeCounterpartyEligibilityScreened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartyEligibilityScreenedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartyEligibilityScreened",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartyEligibilityScreenedPayloadSchema.parse(args.payload),
  });
}

export const counterpartyEligibilityRevalidatedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  screeningId: z.string().min(1),
  priorScreeningId: z.string().min(1),
  criteria: z.array(z.string().min(1)).min(1),
  outcome: counterpartyEligibilityOutcomeSchema,
  evidenceRefs: z.array(z.string().min(1)).min(1),
  asOf: z.string().min(1),
});

export type CounterpartyEligibilityRevalidatedPayload = z.infer<
  typeof counterpartyEligibilityRevalidatedPayloadSchema
>;

export function makeCounterpartyEligibilityRevalidated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartyEligibilityRevalidatedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartyEligibilityRevalidated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartyEligibilityRevalidatedPayloadSchema.parse(args.payload),
  });
}

export const counterpartyEligibilityBreachedPayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  priorScreeningId: z.string().min(1),
  breachReason: z.string().min(1),
  recommendedAction: z.enum([
    "suspend-trading-and-rescreen",
    "escalate-to-zara-and-counsel",
    "run-fresh-screening",
    "no-action-monitor",
  ]),
  asOf: z.string().min(1),
});

export type CounterpartyEligibilityBreachedPayload = z.infer<
  typeof counterpartyEligibilityBreachedPayloadSchema
>;

export function makeCounterpartyEligibilityBreached(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CounterpartyEligibilityBreachedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CounterpartyEligibilityBreached",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: counterpartyEligibilityBreachedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Pre-trade risk controls — OrderRejected (Slice 5)
//
// Distinct from `OrderRejectedAtGateway` (which records a gateway-level
// check rejection). `OrderRejected` is the RAS-limit-breach variant:
// emitted when a pre-trade notional / exposure check breaches a hard limit
// registered in the active `RasLimitSchedulePublished` schedule. Records
// the cluster, limit code, and utilisation at the moment of rejection so
// the LimitUtilisationProjection can fold the breach into its RAG status.
//
// Retention: 7 years per ORG-JSE-IRC-01 (JSE Integrated Risk Controls
// record-retention obligation). Authors: Kai (Markets engineer) +
// Helena (Chief Risk Officer, governance) + Rohan (Risk engineer).
// Authority: D-MARKETS-SCHEMA-FOUNDATION, Slice 5.
// ---------------------------------------------------------------------------

export const riskClusterSchema = z.enum(["B1", "B2", "B3", "B4", "B5"]);
export type RiskCluster = z.infer<typeof riskClusterSchema>;

export const orderRejectedPayloadSchema = z.object({
  orderId: z.string().min(1),
  instrumentId: z.string().min(1),
  asset: z.string().min(1),
  notional: z.number().nonnegative(),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, { message: "currency must be ISO 4217 (3-char uppercase)" }),
  limitCode: z.string().min(1),
  utilisationAtRejection: z.number().min(0).max(1),
  riskCluster: riskClusterSchema,
  timestamp: z.string().min(1),
});

export type OrderRejectedPayload = z.infer<typeof orderRejectedPayloadSchema>;

export function makeOrderRejected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OrderRejectedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OrderRejected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: orderRejectedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RasLimitSchedulePublished (Slice 5)
//
// Helena (CRO, governance) publishes the active RAS limit schedule.
// Folds into LimitUtilisationProjection to set the denominator for each
// cluster's utilisation calculation. A new schedule supersedes the prior
// one (latest-wins-per-entity semantics in the projection).
//
// Authors: Helena (Chief Risk Officer, governance) + Rohan (Risk engineer).
// Authority: D-MARKETS-SCHEMA-FOUNDATION, Slice 5.
// ---------------------------------------------------------------------------

export const rasLimitRowSchema = z.object({
  cluster: riskClusterSchema,
  limitName: z.string().min(1),
  limitValue: z.number().positive(),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, { message: "currency must be ISO 4217 (3-char uppercase)" }),
  breachThresholdAmber: z.number().min(0).max(1),
  breachThresholdRed: z.number().min(0).max(1),
});

export type RasLimitRow = z.infer<typeof rasLimitRowSchema>;

export const rasLimitSchedulePublishedPayloadSchema = z.object({
  scheduleId: z.string().min(1),
  publishedBy: z.string().min(1),
  effectiveFrom: z.string().min(1),
  limits: z.array(rasLimitRowSchema).min(1),
});

export type RasLimitSchedulePublishedPayload = z.infer<
  typeof rasLimitSchedulePublishedPayloadSchema
>;

export function makeRasLimitSchedulePublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RasLimitSchedulePublishedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RasLimitSchedulePublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: rasLimitSchedulePublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// FX correspondent-routing — switch-test event family
// ---------------------------------------------------------------------------

export const switchTestActivatedPayloadSchema = z.object({
  windowId: z.string().min(1),
  openedAt: z.string().min(1),
  fraction: z.number().min(0).max(1),
  rationale: z.string().min(1),
  activatedBy: z.string().min(1),
});

export type SwitchTestActivatedPayload = z.infer<typeof switchTestActivatedPayloadSchema>;

export function makeSwitchTestActivated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SwitchTestActivatedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SwitchTestActivated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: switchTestActivatedPayloadSchema.parse(args.payload),
  });
}

export const switchTestEndedPayloadSchema = z.object({
  windowId: z.string().min(1),
  closedAt: z.string().min(1),
  reason: z.string().min(1),
  closedBy: z.string().min(1),
});

export type SwitchTestEndedPayload = z.infer<typeof switchTestEndedPayloadSchema>;

export function makeSwitchTestEnded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SwitchTestEndedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SwitchTestEnded",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: switchTestEndedPayloadSchema.parse(args.payload),
  });
}

export const switchTestReportPayloadSchema = z.object({
  windowId: z.string().min(1),
  primaryIntentCount: z.number().int().nonnegative(),
  routedViaBackupCount: z.number().int().nonnegative(),
  observedFraction: z.number().min(0).max(1),
  configuredFraction: z.number().min(0).max(1),
  appetiteBandBreached: z.boolean(),
  notes: z.string().min(1),
});

export type SwitchTestReportPayload = z.infer<typeof switchTestReportPayloadSchema>;

export function makeSwitchTestReport(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SwitchTestReportPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SwitchTestReport",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: switchTestReportPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// OrderAccepted — counterparty-facing order acceptance.
//
// Emitted by the pre-trade gateway after `OrderApprovedAtGateway` confirms
// gateway clearance and the bank commits to the counterparty that the
// order will be worked. This is the canonical "trade-attracting" event for
// counterparty-credit-risk reconciliations (Vera's
// `recon:credit-limit-no-trade-without-loaded` surfaces here) — the bank
// must have a `CreditLimitLoaded` for the counterparty before any
// `OrderAccepted` is emitted (Credit Risk Policy §7 line 255).
//
// Distinct from `OrderApprovedAtGateway` (the platform-internal gate-pass
// signal) and from `OrderSubmitted` / `OrderFilled` (venue lifecycle in
// markets-trading-extended).
// ---------------------------------------------------------------------------

export const orderAcceptedPayloadSchema = z.object({
  orderId: z.string().min(1),
  counterpartyId: z.string().min(1),
  instrumentId: z.string().min(1),
  side: orderSideSchema,
  /** Notional in minor units (cents) of `currency`. Non-negative integer. */
  notional: z.number().int().nonnegative(),
  /** ISO 4217 currency code of the notional. */
  currency: z
    .string()
    .min(3)
    .regex(/^[A-Z]{3}$/, { message: "currency must be ISO 4217 (3-char uppercase)" }),
  /** ISO 8601 timestamp at which acceptance was committed to the counterparty. */
  acceptedAt: z.string().min(1),
  /** Party register ID / seat of the agent that accepted the order. */
  acceptedBy: z.string().min(1),
});

export type OrderAcceptedPayload = z.infer<typeof orderAcceptedPayloadSchema>;

export function makeOrderAccepted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OrderAcceptedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OrderAccepted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: orderAcceptedPayloadSchema.parse(args.payload),
  });
}

export const TRADING_TYPED_EVENT_TYPES = [
  "OrderProposed",
  "GatewayCheckRequested",
  "GatewayCheckCompleted",
  "OrderApprovedAtGateway",
  "OrderRejectedAtGateway",
  "OrderAccepted",
  "PreTradeLimitChanged",
  "CounterpartyEligibilityScreened",
  "CounterpartyEligibilityRevalidated",
  "CounterpartyEligibilityBreached",
  "SwitchTestActivated",
  "SwitchTestEnded",
  "SwitchTestReport",
  "OrderRejected",
  "RasLimitSchedulePublished",
  "RfqRequested",
  "QuoteResponded",
] as const;
export type TradingEventType = (typeof TRADING_TYPED_EVENT_TYPES)[number];
