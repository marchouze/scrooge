// platform/event-store/event-types/obligation-lifecycle.ts
//
// Bank-obligation lifecycle event family (Plane B of the two-plane regulatory
// architecture, D-REGULATORY-ARCHITECTURE-TWO-PLANE).
//
// A regulation is reference data (Plane A). The bank's DECISION to be bound by
// an obligation is an event: `ObligationAdopted`. From there the obligation has
// a lifecycle to completion — policy assigned, control implemented, attested,
// retired — captured as `ObligationLifecycleTransitioned`. The bank-obligation
// register (the ORG-* set) is a PROJECTION over these events
// (platform/obligations/projection.ts); the markdown becomes a render.
//
// `derivesFrom` links a bank obligation to the source obligation(s) it
// implements in the reference graph (the DERIVES_FROM bridge between planes).
//
// Authority: D-REGULATORY-ARCHITECTURE-TWO-PLANE (CEO session-delegation
// 2026-06-04); P1-EVENTS-AS-TRUTH; P2-SINGLE-GRAPH-DISCIPLINE.
// Author: Mira (Compliance / RegTech engineer, engineering).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// ObligationAdopted — the bank accepts an obligation (the bridge / origin).
// ---------------------------------------------------------------------------

export const obligationAdoptedPayloadSchema = z.object({
  /** Bank obligation id, e.g. "ORG-PR-06". */
  obligationId: z.string().min(1),
  /** Canonical URN where populated (urn:obligation:bank:...); "" / "[TBD]" otherwise. */
  urn: z.string(),
  /** Register domain label (free text / letter). */
  domain: z.string(),
  /** Citation text — the regulatory source the obligation cites. */
  citation: z.string(),
  /** Plain-English requirement. */
  requirement: z.string(),
  /** Fulfilment policy reference (free text or URN). */
  fulfilmentPolicy: z.string(),
  /** Owning seat / role. */
  owner: z.string(),
  /** Current status carried at adoption (e.g. "legacy-unreviewed", "active"). */
  status: z.string(),
  /** Source-obligation URN(s) this bank obligation derives from (DERIVES_FROM). */
  derivesFrom: z.array(z.string().min(1)).optional(),
  /**
   * Immutable verbatim snapshot at adoption: provision id → quoted source
   * text. Captured by the tick-to-obligation distill flow so the obligation
   * record carries the exact text in force when the bank adopted it,
   * regardless of later source updates (drift is recon's job, not the
   * record's). Optional — register-era adoptions predate it.
   */
  verbatimSourceText: z.record(z.string()).optional(),
  /** ISO date the bank adopted / recognised the obligation. */
  adoptedAt: z.string().min(1),
});
export type ObligationAdoptedPayload = z.infer<typeof obligationAdoptedPayloadSchema>;

export function makeObligationAdopted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ObligationAdoptedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ObligationAdopted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: obligationAdoptedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ObligationLifecycleTransitioned — a downstream lifecycle step.
// ---------------------------------------------------------------------------

export const obligationLifecycleTransitionSchema = z.enum([
  "policy-assigned",
  "procedure-linked",
  "control-implemented",
  "attested",
  "un-adopted",
  "retired",
  "superseded",
]);
export type ObligationLifecycleTransition = z.infer<typeof obligationLifecycleTransitionSchema>;

export const obligationLifecycleTransitionedPayloadSchema = z.object({
  obligationId: z.string().min(1),
  transition: obligationLifecycleTransitionSchema,
  /** Status before / after the transition (where meaningful). */
  fromStatus: z.string().optional(),
  toStatus: z.string().optional(),
  /** Reference the transition attaches (policy URN, control id, attestation ref). */
  detail: z.string().optional(),
  /** ISO date of the transition. */
  at: z.string().min(1),
});
export type ObligationLifecycleTransitionedPayload = z.infer<
  typeof obligationLifecycleTransitionedPayloadSchema
>;

export function makeObligationLifecycleTransitioned(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ObligationLifecycleTransitionedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ObligationLifecycleTransitioned",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: obligationLifecycleTransitionedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ProvisionScopeAdopted — the bank marks a provision (or scope of provisions)
// as applicable to this entity. One event per tick / untick action.
//
// Resolution rule: for any leaf provision L, collect every event where
// scopeId == L or L is a descendant of scopeId in the structured hierarchy,
// then return the `adopted` value of the most recent (`adoptedAt`) event.
// Specificity (deeper scope wins) is the tiebreaker for same-timestamp events.
//
// `verbatimHash` is a SHA-256 hex of the provision text at tick time — used
// by the drift recon gate to detect when source text has changed since adoption.
// ---------------------------------------------------------------------------

export const provisionScopeAdoptedPayloadSchema = z.object({
  /** Instrument slug, e.g. "banks-act", "bcbs-mar". */
  instrumentSlug: z.string().min(1),
  /**
   * ID of the ticked scope node — chapter.id, section.id, subsection.id, or
   * the instrument slug itself (for a whole-document tick).
   */
  scopeId: z.string().min(1),
  /** true = tick (adopt), false = untick (unadopt). */
  adopted: z.boolean(),
  /** Agent/seat that performed the tick. */
  adoptedBy: z.string(),
  /** ISO date of the tick action. */
  adoptedAt: z.string().min(1),
  /** SHA-256 hex of the verbatim text under this scope at tick time. Drift anchor. */
  verbatimHash: z.string(),
});
export type ProvisionScopeAdoptedPayload = z.infer<typeof provisionScopeAdoptedPayloadSchema>;

export function makeProvisionScopeAdopted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProvisionScopeAdoptedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProvisionScopeAdopted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: provisionScopeAdoptedPayloadSchema.parse(args.payload),
  });
}

export const OBLIGATION_LIFECYCLE_TYPED_EVENT_TYPES = [
  "ObligationAdopted",
  "ObligationLifecycleTransitioned",
  "ProvisionScopeAdopted",
] as const;
export type ObligationLifecycleEventType = (typeof OBLIGATION_LIFECYCLE_TYPED_EVENT_TYPES)[number];
