// platform/event-store/event-types/bond-settlement.ts
//
// JSE bond settlement lifecycle event-payload schemas.
//
// Events (3):
//   BondSettlementInstructed         — bank instructs Standard Bank (custodian)
//                                      to settle a bilaterally agreed trade via
//                                      STRATE (T+3 SA convention).
//   BondCustodianSettlementConfirmed — Standard Bank confirms securities and
//                                      cash legs delivered.
//   BondCustodianSettlementFailed    — Standard Bank reports settlement failure;
//                                      investigation triggered.
//
// Settlement path:
//   BondTradeExecuted  →  BondSettlementInstructed  →
//   BondCustodianSettlementConfirmed | BondCustodianSettlementFailed
//
// Authority:
//   D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
//   D-NPA-SAGB-BOND-INTERNAL-TEST (CEO-approved 2026-05-26)
//   JSE Debt Market Rules; STRATE Settlement Rules (SA T+3 convention).
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// BondSettlementInstructed
//
// Emitted when the bank sends a settlement instruction to Standard Bank
// (custodian) after a bilaterally agreed JSE bond trade. Standard Bank
// handles the STRATE delivery-vs-payment (DvP) instruction on the bank's
// behalf. The bank is not a CSDP.
// ---------------------------------------------------------------------------

export const bondSettlementInstructedPayloadSchema = z.object({
  /** Unique settlement instruction identifier. */
  settlementId: z.string().min(1),
  /** Trade identifier from the originating BondTradeExecuted event. */
  tradeId: z.string().min(1),
  /** JSE ISIN of the bond. */
  isin: z.string().min(1),
  /** Bank's side: buy = securities inflow; sell = securities outflow. */
  side: z.enum(["buy", "sell"]),
  /** Nominal / face value in minor currency units. */
  nominalMinor: z.number().int().positive(),
  /** Dirty consideration in ZAR minor units (nominal × dirty price / 100). */
  dirtyConsiderationZarMinor: z.number().int().positive(),
  /** T+3 settlement date per JSE Debt Market Rules (ISO 8601 date). */
  settlementDate: z.string().min(1),
  /** Custodian handling the STRATE instruction on the bank's behalf. */
  custodian: z.literal("standard-bank"),
  /** Dealing counterparty LEI. */
  counterpartyLei: z.string().min(1),
  /** ISO 8601 timestamp the instruction was sent. */
  instructedAt: z.string().min(1),
});

export type BondSettlementInstructedPayload = z.infer<typeof bondSettlementInstructedPayloadSchema>;

export function makeBondSettlementInstructed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BondSettlementInstructedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("BondSettlementInstructed requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BondSettlementInstructed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bondSettlementInstructedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BondCustodianSettlementConfirmed
//
// Emitted when Standard Bank (custodian) confirms that both legs of the STRATE
// settlement have completed: securities delivered / received AND cash
// consideration paid / received. DvP settled; trade lifecycle closed.
// ---------------------------------------------------------------------------

export const bondCustodianSettlementConfirmedPayloadSchema = z.object({
  /** Settlement instruction identifier from BondSettlementInstructed. */
  settlementId: z.string().min(1),
  /** Trade identifier. */
  tradeId: z.string().min(1),
  /** Standard Bank's own settlement reference. */
  custodianRef: z.string().min(1),
  /** Confirmation that securities leg was delivered per instruction. */
  securitiesLegStatus: z.literal("delivered"),
  /** Actual cash settled in ZAR minor units (should equal dirtyConsiderationZarMinor). */
  cashLegZarMinor: z.number().int().positive(),
  /** ISO 8601 timestamp of Standard Bank confirmation. */
  confirmedAt: z.string().min(1),
});

export type BondCustodianSettlementConfirmedPayload = z.infer<
  typeof bondCustodianSettlementConfirmedPayloadSchema
>;

export function makeBondCustodianSettlementConfirmed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BondCustodianSettlementConfirmedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "BondCustodianSettlementConfirmed requires at least one citation (Principle 2).",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BondCustodianSettlementConfirmed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bondCustodianSettlementConfirmedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BondCustodianSettlementFailed
//
// Emitted when Standard Bank reports that STRATE settlement did not complete
// on the intended settlement date. Triggers investigation and potential
// buy-in / cancellation procedures per JSE Debt Market Rules.
// ---------------------------------------------------------------------------

export const bondCustodianSettlementFailedPayloadSchema = z.object({
  /** Settlement instruction identifier from BondSettlementInstructed. */
  settlementId: z.string().min(1),
  /** Trade identifier. */
  tradeId: z.string().min(1),
  /** Standard Bank's own reference (if assigned). */
  custodianRef: z.string().optional(),
  /** Human-readable failure reason reported by custodian. */
  failReason: z.string().min(1),
  /** ISO 8601 timestamp of failure notification. */
  failedAt: z.string().min(1),
});

export type BondCustodianSettlementFailedPayload = z.infer<
  typeof bondCustodianSettlementFailedPayloadSchema
>;

export function makeBondCustodianSettlementFailed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BondCustodianSettlementFailedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error("BondCustodianSettlementFailed requires at least one citation (Principle 2).");
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BondCustodianSettlementFailed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bondCustodianSettlementFailedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Bond settlement event-type registry helper
// ---------------------------------------------------------------------------

export const BOND_SETTLEMENT_EVENT_TYPES = [
  "BondSettlementInstructed",
  "BondCustodianSettlementConfirmed",
  "BondCustodianSettlementFailed",
] as const;

export type BondSettlementEventType = (typeof BOND_SETTLEMENT_EVENT_TYPES)[number];
