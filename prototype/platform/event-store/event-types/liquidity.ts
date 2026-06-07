// platform/event-store/event-types/liquidity.ts
//
// Typed event schemas for the liquidity projection engine.
//
// Covers:
//   LCRComputed  — result of a single LCR computation run
//   NSFRComputed — result of a single NSFR computation run
//
// These events are emitted by Anya's liquidity-projection handler after
// each computation run. Downstream consumers (Eitan, Helena, Camille,
// Atlas) subscribe to them for ALCO packs, RAS appetite monitoring,
// and ICAAP/ILAAP inputs.
//
// Authority: D-TREASURY-GAPS-WAVE1; BANKS-ACT-94-1990; BA 110; BA 120.
// Author: Anya (Liquidity & projections engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// LCRComputed
// ---------------------------------------------------------------------------

export const lcrComputedPayloadSchema = z.object({
  computationId: z.string().min(1),
  asOf: z.string().min(1),
  projectionHorizonDays: z.number().int().nonnegative(),
  hqlaZar: z.number().nonnegative(),
  netCashOutflowsZar: z.number().nonnegative(),
  lcrRatioPct: z.number().nullable(),
  status: z.enum(["above-minimum", "at-minimum", "below-minimum", "no-positions"]),
  currency: z.string().min(3).max(3),
  regulatoryMinimumPct: z.literal(100),
});

export type LCRComputedPayload = z.infer<typeof lcrComputedPayloadSchema>;

export function makeLCRComputed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LCRComputedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LCRComputed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: lcrComputedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// NSFRComputed
// ---------------------------------------------------------------------------

export const nsfrComputedPayloadSchema = z.object({
  computationId: z.string().min(1),
  asOf: z.string().min(1),
  projectionHorizonDays: z.number().int().nonnegative(),
  asfZar: z.number().nonnegative(),
  rsfZar: z.number().nonnegative(),
  nsfrRatioPct: z.number().nullable(),
  status: z.enum(["above-minimum", "at-minimum", "below-minimum", "no-positions"]),
  currency: z.string().min(3).max(3),
  regulatoryMinimumPct: z.literal(100),
});

export type NSFRComputedPayload = z.infer<typeof nsfrComputedPayloadSchema>;

export function makeNSFRComputed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: NSFRComputedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "NSFRComputed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: nsfrComputedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const LIQUIDITY_TYPED_EVENT_TYPES = ["LCRComputed", "NSFRComputed"] as const;
