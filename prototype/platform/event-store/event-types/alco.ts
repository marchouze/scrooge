// platform/event-store/event-types/alco.ts
//
// ALCO pack event-type schema.
//
// Covers:
//   ALCOPackGenerated — emitted each time the ALCO pack generator runs.
//     Carries the pack identity, section coverage, status, and the
//     content-addressed document hash of the serialised pack.
//
//   IntradayHQLAStressProjection — intraday HQLA stress-scenario output.
//     Produced by the intraday-liquidity watch (Ravi + Tomas + Anya).
//     Included here as a typed schema; the generator reads it as an
//     ALCO pack input.
//
// Note: ILAAPSummaryCompleted is defined in ilaap.ts (D-TREASURY-GAPS-WAVE1
// ILAAP engine PR). The ALCO pack generator reads it from the event store
// using the ilaap.ts schema.
//
// Authority: D-TREASURY-GAPS-WAVE1; BA 325; BA 326; BCBS d365;
//   Banks Act 94 of 1990.
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// ALCOPackGenerated
// ---------------------------------------------------------------------------

export const alcoPackGeneratedPayloadSchema = z.object({
  /** Unique pack identifier — e.g. "2026-05-19T00:00:00Z-monthly". */
  packId: z.string().min(1),
  /** ISO 8601 business date the pack was generated for. */
  asOf: z.string().min(1),
  /** Human-readable cycle label — e.g. "2026-05 Monthly". */
  cycleLabel: z.string().min(1),
  /** Names of sections that had data and were included. */
  sectionsIncluded: z.array(z.string().min(1)),
  /** Names of sections that had no data (build phase or substrate gap). */
  sectionsWithNoData: z.array(z.string().min(1)),
  /** Aggregate treasury status for the pack. */
  overallTreasuryStatus: z.enum(["green", "amber", "red", "no-positions"]),
  /** BLAKE3 content-addressed hash of the serialised pack document. */
  documentHash: z.string().min(1),
});

export type ALCOPackGeneratedPayload = z.infer<typeof alcoPackGeneratedPayloadSchema>;

export function makeALCOPackGenerated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ALCOPackGeneratedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ALCOPackGenerated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: alcoPackGeneratedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IntradayHQLAStressProjection
//
// Emitted by the intraday-liquidity watch after running a stress scenario
// over the HQLA buffer and settlement-account position.
// ---------------------------------------------------------------------------

export const intradayHQLAStressProjectionPayloadSchema = z.object({
  /** Unique projection identifier. */
  projectionId: z.string().min(1),
  /** ISO 8601 timestamp the projection was run. */
  asOf: z.string().min(1),
  /** Scenario identifier — e.g. "stress", "base", "severe-stress". */
  scenario: z.string().min(1),
  /** Worst intraday funding window label — e.g. "09:00-11:00". */
  worstWindowLabel: z.string().min(1),
  /** HQLA buffer available during the worst window (ZAR). */
  hqlaBufferZar: z.number().nonnegative(),
  /** Peak intraday gross outflows projected (ZAR). */
  peakGrossOutflowsZar: z.number().nonnegative(),
  /** Status based on buffer vs outflow. */
  status: z.enum(["adequate", "tight", "insufficient"]),
  /** ISO 4217 currency. */
  currency: z.string().min(3).max(3),
});

export type IntradayHQLAStressProjectionPayload = z.infer<
  typeof intradayHQLAStressProjectionPayloadSchema
>;

export function makeIntradayHQLAStressProjection(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IntradayHQLAStressProjectionPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IntradayHQLAStressProjection",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: intradayHQLAStressProjectionPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const ALCO_TYPED_EVENT_TYPES = [
  "ALCOPackGenerated",
  "IntradayHQLAStressProjection",
] as const;
