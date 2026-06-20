// platform/event-store/event-types/fx-trade-confirmation.ts
//
// FX trade-confirmation event family (WS-FX-V2-SIMULATOR, M3). These model the
// COUNTERPARTY's confirmation flow for an FX trade — external-party events the
// simulator emits, gating SUT settlement on affirmation:
//
//   TradeConfirmationSent  — the bank's confirmation reached the counterparty
//   TradeAffirmed          — the counterparty affirmed the trade
//   TradeRejected          — the counterparty rejected the trade (+ reason)
//
// Born V2 (D-V1-REMOVAL-PHASE-1) — never v1-only. THREE-SITE REGISTRATION
// (recurring gotcha — F-032):
//   1. event-types  → this file (schemas + make* + kind list)
//   2. registry     → registry/fx-trade-confirmation.ts (EventTypeMetadata rows)
//   3. provenance   → provenance-category.ts (each kind → category)
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

export const tradeConfirmationPayloadSchema = z.object({
  tradeId: z.string().min(1),
  counterpartyId: z.string().min(1),
  /** Confirmation channel (SWIFT MT300 in a real flow). */
  channel: z.literal("MT300"),
});
export type TradeConfirmationPayload = z.infer<typeof tradeConfirmationPayloadSchema>;

export const tradeRejectedPayloadSchema = tradeConfirmationPayloadSchema.extend({
  reason: z.string().min(1),
});
export type TradeRejectedPayload = z.infer<typeof tradeRejectedPayloadSchema>;

export function makeTradeConfirmationSent(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TradeConfirmationPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TradeConfirmationSent",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: tradeConfirmationPayloadSchema.parse(args.payload),
    ...(args.provenance !== undefined ? { provenance: args.provenance } : {}),
  });
}

export function makeTradeAffirmed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TradeConfirmationPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TradeAffirmed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: tradeConfirmationPayloadSchema.parse(args.payload),
    ...(args.provenance !== undefined ? { provenance: args.provenance } : {}),
  });
}

export function makeTradeRejected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TradeRejectedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TradeRejected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: tradeRejectedPayloadSchema.parse(args.payload),
    ...(args.provenance !== undefined ? { provenance: args.provenance } : {}),
  });
}

export const FX_TRADE_CONFIRMATION_EVENT_TYPES = [
  "TradeConfirmationSent",
  "TradeAffirmed",
  "TradeRejected",
] as const;
export type FxTradeConfirmationEventType = (typeof FX_TRADE_CONFIRMATION_EVENT_TYPES)[number];
