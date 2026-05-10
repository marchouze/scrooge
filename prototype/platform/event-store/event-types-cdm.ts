// platform/event-store/event-types-cdm.ts
//
// CDM substrate event types — separated from the 4960-line god-file
// `event-types.ts` (Vera F-020 finding, Owner Inbox/2026-05-10_vera_
// codebase-quality-review.md). New typed events for the CDM-bindings
// substrate land here; existing CDM payload schemas continue to live
// at `platform/markets/cdm/equity.ts` (those are domain-local to the
// markets surface and are referenced from the registry directly).
//
// Currently registered here:
//   - CdmBindingsRegenerated — emitted by Kai's m1-cdm-typescript-
//     bindings handler after a binding inventory + self-test pass.
//
// Citations: Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md;
// Owner Inbox/2026-05-10_vera_codebase-quality-review.md (F-032, F-020).
//
// Author: Atlas (D-AGENT-RUNTIME-AUTHORIZE — runtime-substrate hygiene).

import { z } from "zod";

import { newEventId } from "../core/types";
import { type Actor, type Event, eventSchema } from "./types";

// ---------------------------------------------------------------------------
// CdmBindingsRegenerated
//
// Recorded after Kai's CDM TypeScript bindings handler tabulates the
// CDM surface and runs the round-trip self-test. Downstream subscribers
// (Anya projections, Bea IFRS classifier) react by re-validating their
// own mappings against the published binding inventory.
//
// Replay rule: `latest-wins-per-key` — the inventory is a point-in-time
// snapshot of the surface; only the latest snapshot per stream is
// load-bearing for downstream projections.
// ---------------------------------------------------------------------------

export const cdmBindingsRegeneratedPayloadSchema = z.object({
  /** Count of CDM primitive types in the surface (Money, Quantity, Price, ...). */
  primitiveCount: z.number().int().nonnegative(),
  /** Count of equity event types tabulated. */
  equityEventTypeCount: z.number().int().nonnegative(),
  /** Stable list of event-type names registered by the CDM module. */
  registeredEventTypes: z.array(z.string().min(1)),
  /** Round-trip self-test outcome — schema parse + factory build + envelope validate. */
  selfTestPassed: z.boolean(),
  /** ScheduledTrigger id that fired this run. */
  runTrigger: z.string().min(1),
});

export type CdmBindingsRegeneratedPayload = z.infer<typeof cdmBindingsRegeneratedPayloadSchema>;

export function makeCdmBindingsRegenerated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CdmBindingsRegeneratedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CdmBindingsRegenerated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: cdmBindingsRegeneratedPayloadSchema.parse(args.payload),
  });
}
