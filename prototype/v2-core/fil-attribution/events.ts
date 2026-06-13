// v2-core/fil-attribution/events.ts
//
// FIL ATTRIBUTION — the two new event types (A1 kernel; design spec §1.1, §3.2).
//
//   InstrumentDimensionAssigned — an ORGANISATIONAL dimension value is asserted
//     (or re-asserted) for a FIL instance, effective from an instant. A book
//     transfer / desk move / strategy re-tag is a NEW event, never a mutation
//     (Principle 1). "Which book AS-OF T?" is a latest-covering-event-wins
//     projection over these events.
//
//   SliceDefined — a NAMED / persistent slice (a book, a trader portfolio, a
//     consolidation view) is a STORED PREDICATE, never a stored number. The
//     event carries the dimension predicate + the roll-up target level; the
//     slice's value is re-evaluated against the live event log every time
//     (spec §3.2 — the direct generalisation of the withdrawn book-composite).
//
// THREE-SITE REGISTRATION (F-032): these v2-core schemas are the canonical
// payload grammar. The v1-side event-type definitions
// (platform/event-store/event-types/attribution.ts) re-export these schemas and
// the registry + provenance-category sites complete the registration. v2-core
// never reaches back into v1.
//
// TENANT AXIS: every event carries the tenant the instrument belongs to. The
// tenant is the HARD OUTER PARTITION (spec §3, binding constraint) — it is NOT a
// dimension you can slice across; it scopes every slice. We reuse the S2 tenant
// axis (`../control-plane/tenant`) for the branded `TenantId` rather than
// inventing a parallel string.
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD; D-METRIC-ATTRIBUTION-DIMENSIONAL;
//   D-V2-TENANCY-ARCHITECTURE; Principle 1; Principle 5; Principle 6.
//   F-032 (event-type registration).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";
import { tenantIdSchema } from "../control-plane/tenant";
import { citationRefSchema, instantSchema } from "../fil-core/primitives";
import { filInstanceUrnSchema } from "../fil-core/urn";
import { attributionDimensionKeySchema } from "./dimensions";

// ---------------------------------------------------------------------------
// InstrumentDimensionAssigned
// ---------------------------------------------------------------------------

/**
 * `InstrumentDimensionAssigned` — an organisational dimension value is asserted
 * for a FIL instance, effective from `effectiveFrom`.
 *
 * `tenantId`     — the owning tenant (the hard outer partition; an assignment is
 *                  always within one tenant — a cross-tenant re-book is not a
 *                  thing).
 * `instanceUrn`  — `fil:inst:<tenant>:…` the instrument being (re)tagged.
 * `dimension`    — the dimension key. MUST be organisational (economic dims are
 *                  facet-derived and may not be assigned — enforced by the
 *                  authority check, authority.ts).
 * `value`        — the assigned value (serialised as a string at the event
 *                  boundary; typed at the handler).
 * `effectiveFrom`— book transfers / desk moves are TIME-VERSIONED; a back-dated
 *                  re-book is a new event with an earlier `effectiveFrom`.
 * `assignedBy`   — the agent/seat that emitted the assignment (the authority
 *                  axis — see authority.ts; the booking agent for its OWN desk,
 *                  or a co-signed cross-desk transfer).
 * `cosignedBy`   — present iff this is a CROSS-DESK transfer requiring a
 *                  second-seat co-sign (open question #1, CEO-approved): the
 *                  reviewer→decider sync-primitive's second seat. Absent for an
 *                  own-desk assignment.
 * `citation`     — Principle 2 upward citation (the authorising decision / brief).
 */
export interface InstrumentDimensionAssignedPayload {
  readonly kind: "InstrumentDimensionAssigned";
  readonly tenantId: string;
  readonly instanceUrn: string;
  readonly dimension: string;
  readonly value: string;
  readonly effectiveFrom: string;
  readonly assignedBy: string;
  readonly cosignedBy?: string;
  readonly citation: string;
}

export const instrumentDimensionAssignedPayloadSchema = z
  .object({
    kind: z.literal("InstrumentDimensionAssigned"),
    tenantId: tenantIdSchema,
    instanceUrn: filInstanceUrnSchema,
    dimension: attributionDimensionKeySchema,
    value: z.string().min(1),
    effectiveFrom: instantSchema,
    assignedBy: z.string().min(1),
    cosignedBy: z.string().min(1).optional(),
    citation: citationRefSchema,
  })
  .strict();

// ---------------------------------------------------------------------------
// SliceDefined
// ---------------------------------------------------------------------------

/**
 * The roll-up target level a named slice declares. A dimension key rolls up
 * along that dimension's hierarchy; `"leaf"` means no roll-up (one cell per
 * member); `"group"` means the top of the org hierarchy (the tenant's own
 * LE-tree consolidation root — consolidation TOPS OUT at the tenant, never
 * crosses tenants — spec §3 binding constraint).
 */
export const SLICE_LEVELS = [
  ...["leaf", "group"],
  "bookingAgent",
  "book",
  "desk",
  "legalEntity",
  "counterparty",
  "currency",
  "productType",
  "strategy",
  "maturityBucket",
  "portfolio",
  "jurisdiction",
] as const;

export type SliceLevel = (typeof SLICE_LEVELS)[number];
export const sliceLevelSchema = z.enum(SLICE_LEVELS as unknown as [string, ...string[]]);

/** A single typed dimension predicate — a conjunct of a slice's WHERE clause. */
export const dimensionPredicateSchema = z.discriminatedUnion("op", [
  z.object({ dim: attributionDimensionKeySchema, op: z.literal("eq"), value: z.string().min(1) }),
  z.object({
    dim: attributionDimensionKeySchema,
    op: z.literal("in"),
    values: z.array(z.string().min(1)).min(1),
  }),
  // hierarchy descendant: members whose dimension node is `node` or under it.
  z.object({ dim: attributionDimensionKeySchema, op: z.literal("under"), node: z.string().min(1) }),
]);

export type DimensionPredicate = z.infer<typeof dimensionPredicateSchema>;

/**
 * `SliceDefined` — a named / persistent slice is registered as a STORED
 * PREDICATE. No number is ever stored against a slice; membership is a query
 * (spec §3.2).
 *
 * `tenantId`  — the slice is implicitly tenant-scoped (hard outer partition). A
 *               slice may NEVER select members across tenants; the predicate is
 *               evaluated only within this tenant's scoped store.
 * `sliceId`   — stable slug; convention `slice:<dimension>:<short-slug>`
 *               (e.g. `slice:book:fx-trading`).
 * `where`     — the conjunction of typed dimension predicates.
 * `level`     — the roll-up target level.
 * `citation`  — Principle 2 upward citation.
 */
export interface SliceDefinedPayload {
  readonly kind: "SliceDefined";
  readonly tenantId: string;
  readonly sliceId: string;
  readonly where: readonly DimensionPredicate[];
  readonly level: SliceLevel;
  readonly citation: string;
}

export const sliceDefinedPayloadSchema = z
  .object({
    kind: z.literal("SliceDefined"),
    tenantId: tenantIdSchema,
    sliceId: z.string().min(1),
    where: z.array(dimensionPredicateSchema).min(1),
    level: sliceLevelSchema,
    citation: citationRefSchema,
  })
  .strict();

// ---------------------------------------------------------------------------
// OrgHierarchyEdgeAssigned (A3)
// ---------------------------------------------------------------------------

/**
 * The closed set of org-ladder axes an edge may connect, child-first. Mirrors
 * `hierarchy.ts` `ORG_HIERARCHY_LADDER` (the child axes) plus the synthetic
 * `consolidatedGroup` terminal (a valid PARENT axis only). Keeping the enum here
 * lets the event schema reject an edge that points off the ladder.
 */
export const ORG_LADDER_CHILD_AXES = ["bookingAgent", "book", "desk", "legalEntity"] as const;
export const ORG_LADDER_PARENT_AXES = ["book", "desk", "legalEntity", "consolidatedGroup"] as const;

export const orgLadderChildAxisSchema = z.enum(ORG_LADDER_CHILD_AXES);
export const orgLadderParentAxisSchema = z.enum(ORG_LADDER_PARENT_AXES);

/**
 * `OrgHierarchyEdgeAssigned` (A3) — a child node (book / desk / legalEntity /
 * bookingAgent) is asserted to roll up to a parent node, effective from an
 * instant. A desk move, an LE re-parent, a book re-desk is a NEW edge event,
 * never a mutation (Principle 1). "Which group did this desk roll up to AS-OF
 * T?" is a latest-covering-edge-wins projection over these events (hierarchy.ts).
 *
 * Consolidation tops out at the tenant: the terminal parent axis is
 * `consolidatedGroup` (the tenant's own LE-tree root); there is no edge above it.
 *
 * `tenantId`     — the owning tenant (the hard outer partition; an edge is always
 *                  within one tenant — a cross-tenant roll-up is not a thing).
 * `childAxis`    — the child's org axis. MUST be a ladder child axis.
 * `child`        — the child node id (e.g. a `desk` id).
 * `parentAxis`   — the parent's org axis; MUST be the ladder parent of childAxis.
 * `parent`       — the parent node id (e.g. a `legalEntity` id, or the group root).
 * `effectiveFrom`— time-versioned; a re-parent is a new edge with a later instant.
 * `assignedBy`   — the agent/seat that emitted the edge (the authority axis).
 * `citation`     — Principle 2 upward citation (the authorising decision / brief).
 */
export interface OrgHierarchyEdgeAssignedPayload {
  readonly kind: "OrgHierarchyEdgeAssigned";
  readonly tenantId: string;
  readonly childAxis: string;
  readonly child: string;
  readonly parentAxis: string;
  readonly parent: string;
  readonly effectiveFrom: string;
  readonly assignedBy: string;
  readonly citation: string;
}

export const orgHierarchyEdgeAssignedPayloadSchema = z
  .object({
    kind: z.literal("OrgHierarchyEdgeAssigned"),
    tenantId: tenantIdSchema,
    childAxis: orgLadderChildAxisSchema,
    child: z.string().min(1),
    parentAxis: orgLadderParentAxisSchema,
    parent: z.string().min(1),
    effectiveFrom: instantSchema,
    assignedBy: z.string().min(1),
    citation: citationRefSchema,
  })
  .strict();

// ---------------------------------------------------------------------------
// Discriminated union + kind list (registration helpers)
// ---------------------------------------------------------------------------

export const attributionEventPayloadSchema = z.discriminatedUnion("kind", [
  instrumentDimensionAssignedPayloadSchema,
  sliceDefinedPayloadSchema,
  orgHierarchyEdgeAssignedPayloadSchema,
]);

export type AttributionEventPayload = z.infer<typeof attributionEventPayloadSchema>;

/** The three new event kinds this package contributes (F-032 site list). */
export const ATTRIBUTION_EVENT_KINDS = [
  "InstrumentDimensionAssigned",
  "SliceDefined",
  "OrgHierarchyEdgeAssigned",
] as const;

export type AttributionEventKind = (typeof ATTRIBUTION_EVENT_KINDS)[number];
