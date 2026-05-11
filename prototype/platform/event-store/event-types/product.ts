// platform/event-store/event-types/product.ts
//
// Product-lifecycle event-payload schemas (12 events).
//
// Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2 (CEO approved 2026-05-10).
// F-020 split from the god-file `../event-types.ts`.
// Authors: Atlas (substrate), Kai (Markets engineer, co-author)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

/** Product family — re-declared here as a small literal to avoid a runtime
 *  cycle between event-store and markets. */
const productFamilyForEventSchema = z.enum([
  "listed-equity",
  "listed-bond",
  "repo",
  "otc-ird",
  "fx",
  "structured",
]);

// ---------------------------------------------------------------------------
// 1. ProductProposalRegistered
// ---------------------------------------------------------------------------

export const productProposalRegisteredPayloadSchema = z.object({
  productId: z.string().min(1),
  family: productFamilyForEventSchema,
  proposedBy: z.string().min(1),
  asOf: z.string().min(1),
});

export type ProductProposalRegisteredPayload = z.infer<
  typeof productProposalRegisteredPayloadSchema
>;

export function makeProductProposalRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductProposalRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductProposalRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productProposalRegisteredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 2. ProductConceptualised
// ---------------------------------------------------------------------------

export const productConceptualisedPayloadSchema = z.object({
  productId: z.string().min(1),
  version: z.string().min(1),
  cdmComposition: z.record(z.unknown()),
  lifecycleEventFamily: z.array(z.string().min(1)),
});

export type ProductConceptualisedPayload = z.infer<typeof productConceptualisedPayloadSchema>;

export function makeProductConceptualised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductConceptualisedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductConceptualised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productConceptualisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 3. ProductDueDiligenceCompleted
// ---------------------------------------------------------------------------

export const productDueDiligenceCompletedPayloadSchema = z.object({
  productId: z.string().min(1),
  gatesCleared: z.array(z.string().min(1)),
  gatesFailed: z.array(z.string().min(1)),
});

export type ProductDueDiligenceCompletedPayload = z.infer<
  typeof productDueDiligenceCompletedPayloadSchema
>;

export function makeProductDueDiligenceCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductDueDiligenceCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductDueDiligenceCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productDueDiligenceCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 4. ProductDueDiligenceWithheld
// ---------------------------------------------------------------------------

export const productDueDiligenceWithheldPayloadSchema = z.object({
  productId: z.string().min(1),
  gatesFailed: z.array(z.string().min(1)).min(1),
  remediation: z.string().min(1),
});

export type ProductDueDiligenceWithheldPayload = z.infer<
  typeof productDueDiligenceWithheldPayloadSchema
>;

export function makeProductDueDiligenceWithheld(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductDueDiligenceWithheldPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductDueDiligenceWithheld",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productDueDiligenceWithheldPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 5. ProductDimensionAttested
// ---------------------------------------------------------------------------

export const productDimensionAttestedResultSchema = z.enum([
  "design-attested",
  "implementation-attested",
  "failed",
]);

export type ProductDimensionAttestedResult = z.infer<typeof productDimensionAttestedResultSchema>;

export const productDimensionAttestedPayloadSchema = z.object({
  productId: z.string().min(1),
  dimension: z.string().min(1),
  result: productDimensionAttestedResultSchema,
  citationChain: z.array(z.string().min(1)).min(1),
});

export type ProductDimensionAttestedPayload = z.infer<typeof productDimensionAttestedPayloadSchema>;

export function makeProductDimensionAttested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductDimensionAttestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductDimensionAttested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productDimensionAttestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 6. ProductApproved
// ---------------------------------------------------------------------------

export const productApprovedPayloadSchema = z.object({
  productId: z.string().min(1),
  version: z.string().min(1),
  conditions: z.array(z.string().min(1)),
  approvedBy: z.string().min(1),
});

export type ProductApprovedPayload = z.infer<typeof productApprovedPayloadSchema>;

export function makeProductApproved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductApprovedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductApproved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productApprovedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 7. ProductWithheld
// ---------------------------------------------------------------------------

export const productWithheldPayloadSchema = z.object({
  productId: z.string().min(1),
  version: z.string().min(1),
  reason: z.string().min(1),
});

export type ProductWithheldPayload = z.infer<typeof productWithheldPayloadSchema>;

export function makeProductWithheld(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductWithheldPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductWithheld",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productWithheldPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 8. ProductLaunched
// ---------------------------------------------------------------------------

export const productLaunchedPayloadSchema = z.object({
  productId: z.string().min(1),
  version: z.string().min(1),
  controlledLaunchLimits: z.record(z.unknown()),
  launchedAt: z.string().min(1),
});

export type ProductLaunchedPayload = z.infer<typeof productLaunchedPayloadSchema>;

export function makeProductLaunched(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductLaunchedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductLaunched",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productLaunchedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 9. ProductPostImplementationReviewCompleted
// ---------------------------------------------------------------------------

export const productPostImplementationReviewCompletedPayloadSchema = z.object({
  productId: z.string().min(1),
  verdict: z.enum(["passed", "passed-with-conditions", "remediation-required", "withdrawn"]),
  amendedConditions: z.array(z.string().min(1)),
});

export type ProductPostImplementationReviewCompletedPayload = z.infer<
  typeof productPostImplementationReviewCompletedPayloadSchema
>;

export function makeProductPostImplementationReviewCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductPostImplementationReviewCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductPostImplementationReviewCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productPostImplementationReviewCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 10. ProductReviewCompleted
// ---------------------------------------------------------------------------

export const productReviewCompletedPayloadSchema = z.object({
  productId: z.string().min(1),
  cycle: z.string().min(1),
  verdict: z.enum(["passed", "passed-with-conditions", "remediation-required", "retire"]),
});

export type ProductReviewCompletedPayload = z.infer<typeof productReviewCompletedPayloadSchema>;

export function makeProductReviewCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductReviewCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductReviewCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productReviewCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 11. ProductRetired
// ---------------------------------------------------------------------------

export const productRetiredPayloadSchema = z.object({
  productId: z.string().min(1),
  reason: z.string().min(1),
  migrationPath: z.string().min(1),
});

export type ProductRetiredPayload = z.infer<typeof productRetiredPayloadSchema>;

export function makeProductRetired(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductRetiredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductRetired",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productRetiredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 12. ProductVersionPublished
// ---------------------------------------------------------------------------

export const productVersionPublishedPayloadSchema = z.object({
  productId: z.string().min(1),
  oldVersion: z.string().min(1),
  newVersion: z.string().min(1),
  materialChanges: z.array(z.string().min(1)).min(1),
});

export type ProductVersionPublishedPayload = z.infer<typeof productVersionPublishedPayloadSchema>;

export function makeProductVersionPublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductVersionPublishedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductVersionPublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productVersionPublishedPayloadSchema.parse(args.payload),
  });
}
