// v2-core/fil-attribution/dimensions.ts
//
// FIL ATTRIBUTION — dimension model (A1 kernel; design spec §1).
//
// Every FIL instance carries a typed, versioned set of ATTRIBUTION DIMENSIONS.
// A dimension is a CLOSED key with a typed value space, so a slice predicate is
// type-checked, not string-matched. There are two structurally different
// origins for a dimension's value (spec §1.1):
//
//   ORGANISATIONAL dims — `bookingAgent` (Principle 6: the "trader" IS an
//     autonomous agent), `book`, `desk`, `strategy`, `portfolio` — are NOT
//     implied by the economics. They are asserted at booking and are themselves
//     EVENT-SOURCED and re-assignable: a book transfer / desk move is an
//     `InstrumentDimensionAssigned` event (a new event with its own
//     `effectiveFrom`), never a mutation (Principle 1).
//
//   ECONOMIC dims — `currency`, `productType`, `maturityBucket`, `legalEntity`,
//     `counterparty`, `jurisdiction` — are DERIVED projections of the
//     instrument's own facets / taxonomy / cash-flow schedule. They are not
//     re-assigned by an attribution event; they fall out of the instrument.
//
// Membership ("which book did this instrument belong to AS-OF T?") is therefore
// a latest-covering-event-wins projection over `InstrumentDimensionAssigned`
// (the organisational axis) joined with the instrument's own facet outputs (the
// economic axis). NO dimension value is stored as a maintained field on a
// "book" object — a book is a query (spec §1.3, the load-bearing P1 property).
//
// PACKAGE BOUNDARY: no v1 imports (recon:v2-no-v1-import). Everything here is
// pure types + zod schemas over the FIL primitives.
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD (CEO-approved 2026-06-13);
//   D-METRIC-ATTRIBUTION-DIMENSIONAL; D-V2-TENANCY-ARCHITECTURE; Principle 1;
//   Principle 5 (legalEntity / jurisdiction axes); Principle 6 (bookingAgent).
// Brief: brief:atlas:a1-fil-attribution-kernel-dimension-metric-slice:2026-06-13.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";
import type { CitationRef, Instant } from "../fil-core/primitives";
import { citationRefSchema, instantSchema } from "../fil-core/primitives";
import { type FilInstanceUrn, filInstanceUrnSchema } from "../fil-core/urn";

// ---------------------------------------------------------------------------
// The closed attribution-dimension key set
// ---------------------------------------------------------------------------

/**
 * The closed set of attribution-dimension keys at A1. EXTENSIBLE by design: the
 * key set is open at the registry, closed at the type level per release. A new
 * dimension is a key addition here + a recon-gate allowlist bump, NEVER an
 * ad-hoc string field on an instrument (spec §1.1).
 */
export const ATTRIBUTION_DIMENSION_KEYS = [
  "bookingAgent", // Principle 6: the booking "trader" IS an autonomous agent (agent:…)
  "book", // BookDesignation (a branded type in fil-facets)
  "desk", // organisational desk grouping
  "legalEntity", // versioned LE-tree node (Principle 5)
  "counterparty", // Party-register id (urn:party:…)
  "currency", // ISO-4217 — the instrument's economic currency
  "productType", // the instrument's fil:type URN family
  "strategy", // a tenant-declared trading/ALM strategy tag (see #4 below)
  "maturityBucket", // a closed bucket enum (o/n, ≤1m, ≤3m, ≤1y, ≤5y, >5y)
  "portfolio", // an arbitrary named grouping (trader portfolio, hedge set) (see #4)
  "jurisdiction", // Principle 5 jurisdictional dispatch axis
] as const;

export type AttributionDimensionKey = (typeof ATTRIBUTION_DIMENSION_KEYS)[number];

export const attributionDimensionKeySchema = z.enum(ATTRIBUTION_DIMENSION_KEYS);

/**
 * Whether a dimension is asserted at booking + event-sourced & re-assignable
 * (ORGANISATIONAL), or derived from the instrument's own facets (ECONOMIC).
 *
 * Only ORGANISATIONAL dimensions are carried by `InstrumentDimensionAssigned`
 * (events.ts). ECONOMIC dimensions are projected from facets and may NOT be
 * re-assigned by an attribution event — attempting to do so is rejected by the
 * assignment authority check (authority.ts).
 */
export type DimensionOrigin = "organisational" | "economic";

export const DIMENSION_ORIGIN: Readonly<Record<AttributionDimensionKey, DimensionOrigin>> = {
  bookingAgent: "organisational",
  book: "organisational",
  desk: "organisational",
  strategy: "organisational",
  portfolio: "organisational",
  // economic — derived from the instrument's own facets / taxonomy / LE-tree:
  legalEntity: "economic",
  counterparty: "economic",
  currency: "economic",
  productType: "economic",
  maturityBucket: "economic",
  jurisdiction: "economic",
};

/** True iff the dimension is asserted-at-booking + event-sourced (re-assignable). */
export function isOrganisationalDimension(key: AttributionDimensionKey): boolean {
  return DIMENSION_ORIGIN[key] === "organisational";
}

// ---------------------------------------------------------------------------
// Maturity-bucket enum
//
// OPEN QUESTION #2 (spec §6): the canonical IRRBB/liquidity bucket set must be a
// single enum re-used by BA-330 ladder, LCR, IRRBB. This A1 enum is a PLACEHOLDER
// closed set; ratification of the canonical schedule (Ravi/Helena) is deferred
// to a later slice. It is closed (type-checked) but not yet asserted to equal
// the IRRBB schedule.
// ---------------------------------------------------------------------------

export const MATURITY_BUCKETS = ["o/n", "<=1m", "<=3m", "<=1y", "<=5y", ">5y"] as const;
export type MaturityBucket = (typeof MATURITY_BUCKETS)[number];
export const maturityBucketSchema = z.enum(MATURITY_BUCKETS);

// ---------------------------------------------------------------------------
// The dimension snapshot carried by a FIL instance at an asOf
//
// This is the PROJECTED view — the result of folding `InstrumentDimensionAssigned`
// (organisational axis) and reading the instrument's facets (economic axis) at a
// given asOf. It is never stored as such; it is computed by the membership
// projection (membership.ts). Organisational dims are optional because an
// instrument may not (yet) carry a desk / strategy / portfolio assignment.
// ---------------------------------------------------------------------------

export interface AttributionDimensions {
  // organisational (event-sourced):
  readonly bookingAgent?: string; // agent:…
  readonly book?: string; // BookDesignation value
  readonly desk?: string;
  readonly strategy?: string; // see open question #4
  readonly portfolio?: readonly string[]; // an instance can sit in many — see #4
  // economic (facet-derived):
  readonly legalEntity?: string; // versioned LE-tree node ref
  readonly counterparty?: string; // urn:party:…
  readonly currency?: string; // ISO-4217 alpha-3
  readonly productType?: string; // fil:type:… family
  readonly maturityBucket?: MaturityBucket;
  readonly jurisdiction?: string; // ISO-3166 / jurisdiction code
}

// ---------------------------------------------------------------------------
// Dimension hierarchy — the roll-up topology
//
// A hierarchy is a typed parent-resolution function over an asOf projection (it
// is NOT hard-coded). The load-bearing org hierarchy is:
//
//   bookingAgent → book → desk → legalEntity → consolidatedGroup (LE-tree root)
//
// Currency / maturity-bucket are FLAT (a flat dimension is a hierarchy with a
// single level). Roll-up is a property of the SLICE's target level, not of the
// metric (spec §1.2, §3). The kernel ships the interface + a flat default; real
// hierarchies (the versioned LE tree) are wired in later slices.
// ---------------------------------------------------------------------------

export interface DimensionHierarchy {
  readonly axis: AttributionDimensionKey;
  /** Parent node of `node` at `asOf`, or null at the root. */
  parentOf(node: string, asOf: Instant): string | null;
  /** Every descendant node of `node` at `asOf` (for `under` predicates). */
  descendantsOf(node: string, asOf: Instant): readonly string[];
}

/**
 * A flat hierarchy: every node is its own root with no descendants. This is the
 * correct topology for `currency`, `maturityBucket`, and any dimension whose
 * roll-up is a single level. The engine does not special-case it — a flat
 * dimension is just a hierarchy with one level.
 */
export function flatHierarchy(axis: AttributionDimensionKey): DimensionHierarchy {
  return {
    axis,
    parentOf: () => null,
    descendantsOf: (node: string) => [node],
  };
}

// ---------------------------------------------------------------------------
// Re-exports of the FIL primitives the dimension model leans on
// ---------------------------------------------------------------------------

export type { CitationRef, Instant, FilInstanceUrn };
export { citationRefSchema, instantSchema, filInstanceUrnSchema };
