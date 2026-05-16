// platform/event-store/event-types/analytics.ts
//
// Analytics / semantic-layer event family — canonical home for typed event
// payloads and factories used by the semantic-layer registration substrate.
//
// Today this module defines a single event family:
//
//   SemanticLayerQuantityRegistered — idempotent boot-time event confirming
//     each of the 20 core quantities (capital / liquidity / credit /
//     market-risk / P&L / treasury) is registered in the event store.
//
// Authority: Anya (Data / analytics engineer, engineering — reports to Devon
//   COO; semantic-layer + projection-runtime curator).
//
// History: factory + payload schema were originally authored in
// `platform/semantic-layer/event-type.ts`. Relocated here under F-032 (event-
// type registry coverage recon — Atlas, 2026-05-16) so the factory lives on a
// surface scanned by `platform/recon/event-type-registry-coverage.ts`. The
// original module re-exports from this file for back-compat.
//
// Principle 1: the event log is the canonical record of which quantities are
//   registered; the in-process `QUANTITY_REGISTRY` is a cache of the same
//   definitions. Both must agree.
//
// Author: Anya (Data / analytics engineer, engineering)
// Curated by: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

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

export const ANALYTICS_TYPED_EVENT_TYPES = ["SemanticLayerQuantityRegistered"] as const;
export type AnalyticsEventType = (typeof ANALYTICS_TYPED_EVENT_TYPES)[number];

// Back-compat alias preserving the original constant name used in callers
// that imported from `platform/semantic-layer/event-type`.
export const SEMANTIC_LAYER_TYPED_EVENT_TYPES = ANALYTICS_TYPED_EVENT_TYPES;
export type SemanticLayerEventType = AnalyticsEventType;
