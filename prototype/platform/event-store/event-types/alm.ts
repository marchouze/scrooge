// platform/event-store/event-types/alm.ts
//
// ALM engine event-type schemas — typed Zod definitions + factory functions.
//
// Covers:
//   ALMRunCompleted — emitted at the end of each daily ALM run; summarises
//     the repricing gap status, worst-case ΔEVE, and worst-case ΔNII.
//   IRRBBChecked    — emitted once per metric/shock combination; records the
//     sensitivity result and whether it is within appetite.
//
// Authority: D-TREASURY-GAPS-WAVE1; BCBS d365 (IRRBB, 2016);
//   Banks Act 94 of 1990, Banks Act Regulations 26 and 27.
// Author: Ravi (Treasury/ALM Engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// ALMRunCompleted
// ---------------------------------------------------------------------------

export const almRunCompletedPayloadSchema = z.object({
  /** Unique run identifier — e.g. "ALM-RUN-2026-05-19". */
  runId: z.string().min(1),
  /** ISO 8601 business date for which the run was computed. */
  asOf: z.string().min(1),
  /** Repricing gap computation status. */
  repricingGapStatus: z.enum(["computed", "zero-positions"]),
  /** Worst-case ΔEVE across all six BCBS d365 shock scenarios (ZAR). */
  eveWorstDeltaZar: z.number(),
  /** Worst-case ΔNII across all four parallel shocks (ZAR). */
  niiWorstDeltaZar: z.number(),
  /** ISO 4217 currency code. */
  currency: z.string().min(3).max(3),
  /** Aggregate traffic-light status for the run. */
  overallStatus: z.enum(["green", "amber", "red"]),
});

export type ALMRunCompletedPayload = z.infer<typeof almRunCompletedPayloadSchema>;

export function makeALMRunCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ALMRunCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ALMRunCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: almRunCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IRRBBChecked
// ---------------------------------------------------------------------------

export const irrbBCheckedPayloadSchema = z.object({
  /** Unique check identifier — e.g. "IRRBB-EVE-parallel+200-2026-05-19". */
  checkId: z.string().min(1),
  /** ISO 8601 business date for which the check was performed. */
  asOf: z.string().min(1),
  /** IRRBB metric type: EVE or NII. */
  metric: z.enum(["EVE", "NII"]),
  /** Shock scenario label as specified in BCBS d365. */
  shockLabel: z.string().min(1),
  /**
   * Sensitivity delta as a percentage of Tier 1 capital.
   * Zero in build phase (Tier 1 capital not yet measured).
   */
  deltaPct: z.number(),
  /**
   * Regulatory / appetite limit as a percentage of Tier 1 capital.
   * BCBS d365 outlier threshold: 15% of Tier 1 for EVE.
   */
  limitPct: z.number(),
  /** Check status: within appetite, warning, or breach. */
  status: z.enum(["within", "warn", "breach"]),
  /** ISO 4217 currency code. */
  currency: z.string().min(3).max(3),
});

export type IRRBBCheckedPayload = z.infer<typeof irrbBCheckedPayloadSchema>;

export function makeIRRBBChecked(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IRRBBCheckedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IRRBBChecked",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: irrbBCheckedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const ALM_TYPED_EVENT_TYPES = ["ALMRunCompleted", "IRRBBChecked"] as const;
