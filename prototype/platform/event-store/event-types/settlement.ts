// platform/event-store/event-types/settlement.ts
//
// Settlement instruction event-payload schemas.
//
// Covers:
//   SettlementInstructionIssued — a contractual settlement outflow issued to
//     a counterparty; feeds the LCR denominator (BA 110 §23 contractual-
//     maturity-within-30-day-stress-horizon bucket). Distinct from
//     TradeBooked settlement (which is trade-originated); this covers
//     non-trade contractual funding outflows (e.g. maturing bonds issued,
//     correspondent-bank obligations, scheduled funding repayments outside
//     the repo/MMD/IBL trade-event stream).
//
// Authority: BA 110 §23; Banks Act Reg 26 (LCR); D-TREASURY-GAPS-WAVE1.
// Author: Ravi (Treasury and ALM engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// SettlementInstructionIssued
// ---------------------------------------------------------------------------

export const settlementInstructionIssuedPayloadSchema = z.object({
  settlementInstructionId: z.string().min(1),
  settlementDate: z.string().min(1),
  outflowAmountZar: z.number().int().nonnegative(),
  counterpartyId: z.string().min(1).optional(),
  description: z.string().optional(),
});

export type SettlementInstructionIssuedPayload = z.infer<
  typeof settlementInstructionIssuedPayloadSchema
>;

export function makeSettlementInstructionIssued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SettlementInstructionIssuedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SettlementInstructionIssued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: settlementInstructionIssuedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const SETTLEMENT_TYPED_EVENT_TYPES = ["SettlementInstructionIssued"] as const;
