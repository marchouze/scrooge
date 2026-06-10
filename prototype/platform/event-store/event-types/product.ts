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

/** Typed product scope — mirror of `productScopeSchema` in
 *  `../../markets/products/types.ts`, re-declared here to avoid a runtime cycle
 *  between event-store and markets (same pattern as `productFamilyForEventSchema`).
 *  Keep the two in sync. Authority: D-FX-OTC-NPA-SCOPE-EXPANSION. */
const productScopeForEventSchema = z.object({
  executionVenue: z.enum(["otc", "exchange"]),
  fxInstrumentVariants: z.array(z.enum(["spot", "forward", "swap", "option"])).min(1),
  currencyPairs: z.union([z.literal("any"), z.array(z.string().min(1)).min(1)]),
  counterpartyEligibility: z.union([
    z.enum(["all", "institutional", "bank-only"]),
    z.array(z.string().min(1)).min(1),
  ]),
});

export type ProductScopeForEvent = z.infer<typeof productScopeForEventSchema>;

// ---------------------------------------------------------------------------
// 1. ProductProposalRegistered
// ---------------------------------------------------------------------------

export const productProposalRegisteredPayloadSchema = z.object({
  productId: z.string().min(1),
  family: productFamilyForEventSchema,
  proposedBy: z.string().min(1),
  asOf: z.string().min(1),
  /** Typed product scope (D-FX-OTC-NPA-SCOPE-EXPANSION). Optional for back-compat
   *  with the 8 pre-existing seeded proposals. */
  scope: productScopeForEventSchema.optional(),
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
  /** Approved scope of record (D-FX-OTC-NPA-SCOPE-EXPANSION). Optional for
   *  back-compat with pre-existing approvals. */
  scope: productScopeForEventSchema.optional(),
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

// ---------------------------------------------------------------------------
// 13. ProductDimensionNarrativeRequested
//
// Marker event: a request has been raised that the responsible agent for a
// given dimension on a given product author a prose narrative answering:
// (1) how does this product impact my domain?
// (2) what do I need to do to support this product?
//
// Authority: NPA Policy v1.0 §5 (dimension owners); D-NEW-PRODUCT-APPROVAL-POLICY.
// ---------------------------------------------------------------------------

export const productDimensionNarrativeRequestedPayloadSchema = z.object({
  productId: z.string().min(1),
  dimension: z.string().min(1),
  /** Agent name expected to author the narrative (e.g. "Bea"). */
  requestedFromAgentName: z.string().min(1),
  /** Agent position (e.g. "Accounting policy engineer"). Pairs name + position per identity discipline. */
  requestedFromAgentPosition: z.string().min(1),
  /** Free-form note from the requester (typically the CEO via the Products page). */
  note: z.string().optional(),
});

export type ProductDimensionNarrativeRequestedPayload = z.infer<
  typeof productDimensionNarrativeRequestedPayloadSchema
>;

export function makeProductDimensionNarrativeRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductDimensionNarrativeRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductDimensionNarrativeRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productDimensionNarrativeRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 14. ProductDimensionNarrativeRecorded
//
// The agent's prose answer to the two narrative questions, recorded as the
// canonical artefact (Principle 1: narrative-as-event, not as a mutable field
// on the Product). Latest-by-asOf wins in the projection.
// ---------------------------------------------------------------------------

export const productDimensionNarrativeRecordedPayloadSchema = z.object({
  productId: z.string().min(1),
  dimension: z.string().min(1),
  /** Name + position pair (identity discipline — name with position on first mention). */
  authorAgentName: z.string().min(1),
  authorAgentPosition: z.string().min(1),
  /** Prose answer to: how does this product impact my domain? what do I need to do to support it? */
  narrative: z.string().min(1),
  /** Principle 2 citation chain anchoring the narrative claims. */
  citationChain: z.array(z.string().min(1)).min(1),
});

export type ProductDimensionNarrativeRecordedPayload = z.infer<
  typeof productDimensionNarrativeRecordedPayloadSchema
>;

export function makeProductDimensionNarrativeRecorded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductDimensionNarrativeRecordedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductDimensionNarrativeRecorded",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productDimensionNarrativeRecordedPayloadSchema.parse(args.payload),
  });
}

export const PRODUCT_TYPED_EVENT_TYPES = [
  "ProductProposalRegistered",
  "ProductConceptualised",
  "ProductDueDiligenceCompleted",
  "ProductDueDiligenceWithheld",
  "ProductDimensionAttested",
  "ProductApproved",
  "ProductWithheld",
  "ProductLaunched",
  "ProductPostImplementationReviewCompleted",
  "ProductReviewCompleted",
  "ProductRetired",
  "ProductVersionPublished",
  "ProductDimensionNarrativeRequested",
  "ProductDimensionNarrativeRecorded",
] as const;
export type ProductEventType = (typeof PRODUCT_TYPED_EVENT_TYPES)[number];
