// platform/semantic-layer/event-type.ts
//
// SemanticLayerQuantityRegistered event-payload schema.
//
// Emitted once per quantity on system boot (idempotent — re-emit is a no-op
// when the quantity code has already been registered in the current boot
// epoch). Consumed by the analytics projection to confirm the full quantity
// vocabulary is present before any quantity-dependent report is generated.
//
// Authority: Anya (Data / analytics engineer, engineering — reports to Devon
//   COO; semantic-layer + projection-runtime curator).
// Principle 1: the event log is the canonical record of which quantities are
//   registered; the in-process `QUANTITY_REGISTRY` is a cache of the same
//   definitions. Both must agree (Vera recon: semantic-layer-registration-
//   coverage — planned Wave-5).
//
// Author: Anya (Data / analytics engineer, engineering)

import { z } from "zod";

import { newEventId } from "../core/types";
import { type Actor, type Event, eventSchema } from "../event-store/types";

// ---------------------------------------------------------------------------
// SemanticLayerQuantityRegistered
// ---------------------------------------------------------------------------

export const semanticLayerQuantityRegisteredPayloadSchema = z.object({
  /** Machine-readable quantity code — matches QuantityDefinition.code. */
  code: z.string().min(1),

  /** Human-readable quantity name — matches QuantityDefinition.name. */
  name: z.string().min(1),

  /** Quantity domain — matches QuantityDefinition.domain. */
  domain: z.enum(["capital", "liquidity", "credit", "market-risk", "pnl", "treasury"]),

  /** ISO-8601 timestamp at which the quantity was registered in this boot epoch. */
  registeredAt: z.string().min(1),
});

export type SemanticLayerQuantityRegisteredPayload = z.infer<
  typeof semanticLayerQuantityRegisteredPayloadSchema
>;

export function makeSemanticLayerQuantityRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SemanticLayerQuantityRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SemanticLayerQuantityRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: semanticLayerQuantityRegisteredPayloadSchema.parse(args.payload),
  });
}
