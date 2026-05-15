// platform/event-store/event-types/intranet.ts
//
// Intranet event-payload schemas — three typed events for intranet operations:
//
//   - IntranetFeatureShipped   — a new intranet feature has been shipped
//                                (PR merged, deployed). Emitted by Noa when a
//                                feature reaches production.
//   - DesignReviewComplete     — a design review has been completed for a
//                                feature or component. Emitted by Noa after
//                                review outcome is recorded.
//   - UXFindingRaised          — a UX finding has been raised against a
//                                component or page. Emitted by Noa or any
//                                agent identifying a UX issue.
//
// Authority: Principle 1 — every significant intranet state change is an
//   event before any other record (events-first authoring per CLAUDE.md
//   §"Events-first authoring").
//
// Author: Noa (Intranet Product Owner & UI Architect, reporting to CEO)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// IntranetFeatureShipped
//
// Emitted when a new intranet feature is shipped — PR merged and deployed.
// Provides a durable record linking the feature to the PR and authoring agent.
// ---------------------------------------------------------------------------

export const intranetFeatureShippedPayloadSchema = z.object({
  /** Feature identifier — e.g. "INTRANET-FEAT-001". */
  featureId: z.string().min(1),

  /** Short human-readable title for the feature. */
  title: z.string().min(1),

  /** Description of what the feature does. */
  description: z.string().min(1),

  /** GitHub PR URL where the feature landed. */
  prUrl: z.string().url(),

  /** Name of the agent that shipped the feature — e.g. "noa". */
  shippedBy: z.string().min(1),

  /** ISO 8601 timestamp when the feature was shipped. */
  shippedAt: z.string().min(1),
});

export type IntranetFeatureShippedPayload = z.infer<typeof intranetFeatureShippedPayloadSchema>;

export function makeIntranetFeatureShipped(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IntranetFeatureShippedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IntranetFeatureShipped",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: intranetFeatureShippedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// DesignReviewComplete
//
// Emitted when a design review is completed for a feature or component.
// Captures the reviewer, outcome, and any review notes.
// ---------------------------------------------------------------------------

export const designReviewCompletePayloadSchema = z.object({
  /** Review identifier — e.g. "DESIGN-REV-001". */
  reviewId: z.string().min(1),

  /** What was reviewed — feature name or component identifier. */
  featureOrComponent: z.string().min(1),

  /** Name of the agent that conducted the review. */
  reviewer: z.string().min(1),

  /** Review outcome. */
  outcome: z.enum(["approved", "approved-with-changes", "rejected"]),

  /** Notes from the review — rationale, required changes, or approval context. */
  notes: z.string().min(1),

  /** ISO 8601 timestamp when the review was completed. */
  completedAt: z.string().min(1),
});

export type DesignReviewCompletePayload = z.infer<typeof designReviewCompletePayloadSchema>;

export function makeDesignReviewComplete(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: DesignReviewCompletePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "DesignReviewComplete",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: designReviewCompletePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// UXFindingRaised
//
// Emitted when a UX finding is identified against a component or page.
// Provides a durable audit trail of UX quality issues.
// ---------------------------------------------------------------------------

export const uxFindingRaisedPayloadSchema = z.object({
  /** Finding identifier — e.g. "UX-FIND-001". */
  findingId: z.string().min(1),

  /** The affected component or page — e.g. "dashboard-home", "fleet-health-card". */
  component: z.string().min(1),

  /** Description of the UX issue identified. */
  description: z.string().min(1),

  /** Severity of the UX finding. */
  severity: z.enum(["low", "medium", "high"]),

  /** Name of the agent that raised the finding. */
  raisedBy: z.string().min(1),

  /** ISO 8601 timestamp when the finding was raised. */
  raisedAt: z.string().min(1),
});

export type UXFindingRaisedPayload = z.infer<typeof uxFindingRaisedPayloadSchema>;

export function makeUXFindingRaised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: UXFindingRaisedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "UXFindingRaised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: uxFindingRaisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Intranet event-type constant array
// ---------------------------------------------------------------------------

export const INTRANET_EVENT_TYPES = [
  "IntranetFeatureShipped",
  "DesignReviewComplete",
  "UXFindingRaised",
] as const;

export type IntranetEventType = (typeof INTRANET_EVENT_TYPES)[number];
