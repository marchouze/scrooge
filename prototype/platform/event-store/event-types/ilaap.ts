// platform/event-store/event-types/ilaap.ts
//
// Typed event schemas for the ILAAP (Internal Liquidity Adequacy Assessment Process) engine.
//
// Covers:
//   ILAAPScenarioRun    — result of a single stress scenario run
//   ILAAPSummaryCompleted — aggregated worst-case ILAAP assessment
//
// These events are emitted by Atlas's `atlas:ilaap-run` handler quarterly
// (or on-demand). Consumers: Eitan (Treasurer), Helena (CRO), Camille (CFO),
// Atlas (substrate monitoring), Anya (liquidity projections).
//
// Authority: D-TREASURY-GAPS-WAVE1; Banks Act 94/1990; BA 110; PA ILAAP guidance.
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// ILAAPScenarioRun
// ---------------------------------------------------------------------------

export const ilaapScenarioRunPayloadSchema = z.object({
  runId: z.string().min(1),
  asOf: z.string().min(1),
  scenario: z.enum(["idiosyncratic", "market-wide", "combined", "reverse-stress"]),
  survivalHorizonDays: z.number().nonnegative(),
  stressedLCRPct: z.number().nullable(),
  stressedHQLAZar: z.number().nonnegative(),
  status: z.enum(["adequate", "marginal", "inadequate", "no-positions"]),
  currency: z.string().min(3).max(3),
});

export type ILAAPScenarioRunPayload = z.infer<typeof ilaapScenarioRunPayloadSchema>;

export function makeILAAPScenarioRun(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ILAAPScenarioRunPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ILAAPScenarioRun",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: ilaapScenarioRunPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ILAAPSummaryCompleted
// ---------------------------------------------------------------------------

export const ilaapSummaryCompletedPayloadSchema = z.object({
  summaryId: z.string().min(1),
  asOf: z.string().min(1),
  worstCaseSurvivalDays: z.number().nonnegative(),
  worstCaseScenario: z.string().min(1),
  overallStatus: z.enum(["adequate", "marginal", "inadequate", "no-positions"]),
  recommendedAction: z.string().min(1),
  currency: z.string().min(3).max(3),
});

export type ILAAPSummaryCompletedPayload = z.infer<typeof ilaapSummaryCompletedPayloadSchema>;

export function makeILAAPSummaryCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ILAAPSummaryCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ILAAPSummaryCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: ilaapSummaryCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const ILAAP_TYPED_EVENT_TYPES = ["ILAAPScenarioRun", "ILAAPSummaryCompleted"] as const;
