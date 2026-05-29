// platform/event-store/event-types/seed-management.ts
//
// Seed-management provenance events. The build-phase event store is bootstrapped
// by a set of idempotent `bootXxx()` seed functions (see `seeds/manifest.ts` for
// the canonical inventory). These two events make the seed layer *controllable*
// from the UI (objective 1 of D-TRUSTED-FIGURES-PROGRAM-V1):
//
//   - `SeedDescoped`            — operator decision to stop a seed from booting.
//                                 `bootDerive()` reads these and skips the named
//                                 seed at next boot. Reversible by absence: there
//                                 is no "re-scope" event; removing the descope
//                                 (or a `SeedPromotedToSimulated` superseding it)
//                                 lets the seed boot again.
//   - `SeedPromotedToSimulated` — records that a boot seed has been replaced by
//                                 author-driven `simulatedTag` events (via the
//                                 trade-book / fx-sim / kyc-simulate authoring
//                                 UIs). Carries the replacement event ids so the
//                                 lineage from removed-seed → real-simulated
//                                 equivalent is auditable.
//
// Both are operator/agent decisions, not derived figures — they carry an Actor
// and citations, and are appended directly (no command handler), like Decision.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (Core banking platform architect, engineering — substrate).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// SeedDescoped
// ---------------------------------------------------------------------------

export const seedDescopedPayloadSchema = z.object({
  /** Stable seed identifier — must match a `seeds/manifest.ts` SEED_MANIFEST entry. */
  seedId: z.string().min(1),
  /** Why the seed is being descoped (operator-supplied). */
  reason: z.string().min(1),
});
export type SeedDescopedPayload = z.infer<typeof seedDescopedPayloadSchema>;

export function makeSeedDescoped(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SeedDescopedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SeedDescoped",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: seedDescopedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SeedPromotedToSimulated
// ---------------------------------------------------------------------------

export const seedPromotedToSimulatedPayloadSchema = z.object({
  /** Stable seed identifier — must match a `seeds/manifest.ts` SEED_MANIFEST entry. */
  seedId: z.string().min(1),
  /** Event ids of the author-driven `simulatedTag` events that replace the seed. */
  replacementEventIds: z.array(z.string().min(1)),
  /** Optional note on how the replacement was authored. */
  note: z.string().optional(),
});
export type SeedPromotedToSimulatedPayload = z.infer<typeof seedPromotedToSimulatedPayloadSchema>;

export function makeSeedPromotedToSimulated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SeedPromotedToSimulatedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SeedPromotedToSimulated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: seedPromotedToSimulatedPayloadSchema.parse(args.payload),
  });
}
