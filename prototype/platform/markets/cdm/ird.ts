// platform/markets/cdm/ird.ts
//
// CDM Interest Rate Derivative (IRD) event types — OTC IRS lifecycle.
//
// Five event shapes covering the full OTC Interest Rate Swap (IRS) lifecycle:
//   - IrsTradeBooked           — swap agreed and recorded; defines fixed/float legs.
//   - IrsCouponScheduleGenerated — full coupon schedule generated at booking.
//   - IrsCouponPaymentInstructed — net coupon instructed to correspondent at payment date.
//   - IrsCouponSettlementConfirmed — correspondent confirms settlement of a coupon.
//   - IrsPositionRevalued      — EOD mark-to-market of the swap position.
//
// Each schema is a Zod object validated at the event-store boundary before
// append. The make<Type> factory wraps payload validation + envelope construction
// following the pattern established in platform/markets/cdm/equity.ts.
//
// Per CLAUDE.md Principle 1 (events as truth) — the typed payload is the
// canonical record of the swap; fixed/float leg PVs, DV01, accruals are
// projections derived from this stream.
//
// Authority:
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   ISDA-2002-MASTER            (swap documentation standard)
//   IFRS-9-§4.1                 (classification and measurement)
//   ORG-PR-11                   (derivatives trading authority)
//
// Authors: Eitan (IRRBB / derivatives engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../../event-store/types";
import {
  cdmDateSchema,
  identifierSchema,
  moneySchema,
  partySchema,
} from "./primitives";

// ---------------------------------------------------------------------------
// IrsTradeBooked
// ---------------------------------------------------------------------------

export const irsTradeBookedPayloadSchema = z.object({
  /** Stable internal trade identifier. */
  tradeId: identifierSchema,
  /** Counterparty (institutional; must have passed FAIS eligibility screening). */
  counterparty: partySchema,
  /** Notional principal amount — denominated in the currency of the fixed leg. */
  notional: moneySchema,
  /** Fixed rate as a decimal (e.g. 0.085 = 8.5%). */
  fixedRate: z.number().positive(),
  /** Floating benchmark index. */
  floatingIndex: z.enum(["JIBAR-3M", "JIBAR-1M", "ZARONIA"]),
  /** Which leg the bank pays. */
  bankPays: z.enum(["fixed", "floating"]),
  /** Trade date (when agreed). */
  tradeDate: cdmDateSchema,
  /** Effective date (when interest starts accruing; typically T+2 for OTC IRS). */
  effectiveDate: cdmDateSchema,
  /** Maturity date (final coupon and notional unwind if any). */
  maturityDate: cdmDateSchema,
  /** Coupon payment frequency. */
  paymentFrequency: z.enum(["monthly", "quarterly", "semi-annual", "annual"]),
  /** Day count convention for interest accrual. */
  dayCountConvention: z.enum(["ACT/365", "ACT/360", "30/360"]),
  /** Trading book identifier. */
  bookId: z.string().min(1),
  /** Trader reference (FIX SenderCompID equivalent). */
  traderRef: z.string().min(1),
});

export type IrsTradeBookedPayload = z.infer<typeof irsTradeBookedPayloadSchema>;

export function makeIrsTradeBooked(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IrsTradeBookedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IrsTradeBooked",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: irsTradeBookedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IrsCouponScheduleGenerated
// ---------------------------------------------------------------------------

export const irsCouponScheduleGeneratedPayloadSchema = z.object({
  /** The trade this schedule was generated for. */
  tradeId: identifierSchema,
  /** Ordered list of payment dates (effectiveDate+freq → maturityDate). */
  paymentDates: z.array(cdmDateSchema),
  /** Fixed coupon amounts per period (minor units). */
  fixedCoupons: z.array(moneySchema),
  /** Estimated floating coupon amounts per period using the current forward curve. */
  floatingCouponEstimates: z.array(moneySchema),
  /** ISO 8601 UTC timestamp when the schedule was generated. */
  generatedAt: z.string().min(1),
});

export type IrsCouponScheduleGeneratedPayload = z.infer<
  typeof irsCouponScheduleGeneratedPayloadSchema
>;

export function makeIrsCouponScheduleGenerated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IrsCouponScheduleGeneratedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IrsCouponScheduleGenerated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: irsCouponScheduleGeneratedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IrsCouponPaymentInstructed
// ---------------------------------------------------------------------------

export const irsCouponPaymentInstructedPayloadSchema = z.object({
  /** The trade this coupon instruction belongs to. */
  tradeId: identifierSchema,
  /** Payment date for this coupon. */
  paymentDate: cdmDateSchema,
  /** Net settlement amount (fixed − floating, or floating − fixed). */
  netSettlementAmount: moneySchema,
  /** Direction from the bank's perspective. */
  paymentDirection: z.enum(["receive", "pay"]),
  /** ISO 8601 UTC timestamp when the instruction was sent. */
  instructedAt: z.string().min(1),
});

export type IrsCouponPaymentInstructedPayload = z.infer<
  typeof irsCouponPaymentInstructedPayloadSchema
>;

export function makeIrsCouponPaymentInstructed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IrsCouponPaymentInstructedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IrsCouponPaymentInstructed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: irsCouponPaymentInstructedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IrsCouponSettlementConfirmed
// ---------------------------------------------------------------------------

export const irsCouponSettlementConfirmedPayloadSchema = z.object({
  /** The trade this settlement confirmation belongs to. */
  tradeId: identifierSchema,
  /** Payment date confirmed settled. */
  paymentDate: cdmDateSchema,
  /** Amount actually settled (should match net instruction; flag any break). */
  settledAmount: moneySchema,
  /** ISO 8601 UTC timestamp of correspondent confirmation. */
  confirmedAt: z.string().min(1),
  /** Correspondent's reference number (SWIFT message ID or similar). */
  correspondentRef: z.string().optional(),
});

export type IrsCouponSettlementConfirmedPayload = z.infer<
  typeof irsCouponSettlementConfirmedPayloadSchema
>;

export function makeIrsCouponSettlementConfirmed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IrsCouponSettlementConfirmedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IrsCouponSettlementConfirmed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: irsCouponSettlementConfirmedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IrsPositionRevalued
// ---------------------------------------------------------------------------

export const irsPositionRevaluedPayloadSchema = z.object({
  /** Trade being revalued. */
  tradeId: identifierSchema,
  /** YYYY-MM-DD valuation date (EOD). */
  valuationDate: z.string().min(1),
  /** Present value of remaining fixed leg cash flows (minor units). */
  fixedLegPv: moneySchema,
  /** Present value of remaining floating leg cash flows (estimated, minor units). */
  floatingLegPv: moneySchema,
  /**
   * Mark-to-market value of the swap from the bank's perspective (minor units).
   * Positive = in-the-money for the bank.
   * MTM = fixedLegPV - floatingLegPV when bankPays=fixed (bank prefers rates rise).
   * MTM = floatingLegPV - fixedLegPV when bankPays=floating.
   */
  markToMarket: moneySchema,
  /**
   * DV01 — dollar-value of a 1bp parallel shift in rates (minor units).
   * Approximation: Σ(0.0001 × notional × dcf_i × df_i) for remaining coupons.
   */
  dv01: moneySchema,
  /** Number of calendar days remaining to maturity at the valuation date. */
  remainingTenorDays: z.number().int().nonnegative(),
});

export type IrsPositionRevaluedPayload = z.infer<typeof irsPositionRevaluedPayloadSchema>;

export function makeIrsPositionRevalued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IrsPositionRevaluedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IrsPositionRevalued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: irsPositionRevaluedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Registry exports
// ---------------------------------------------------------------------------

export const IRS_EVENT_TYPES = [
  "IrsTradeBooked",
  "IrsCouponScheduleGenerated",
  "IrsCouponPaymentInstructed",
  "IrsCouponSettlementConfirmed",
  "IrsPositionRevalued",
] as const;

export type IrsEventType = (typeof IRS_EVENT_TYPES)[number];

export const IRS_EVENT_FAMILIES = {
  booking: "IrsTradeBooked",
  schedule: "IrsCouponScheduleGenerated",
  couponInstruction: "IrsCouponPaymentInstructed",
  couponConfirmation: "IrsCouponSettlementConfirmed",
  revaluation: "IrsPositionRevalued",
} as const;
