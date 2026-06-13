// v2-core/fil-attribution/slice.ts
//
// FIL ATTRIBUTION — the slice / query model (A1 kernel; design spec §3).
//
// A SLICE = a predicate over dimensions + a target roll-up level. A book, a
// trader portfolio, a consolidation view are all NAMED slices over one model —
// not bespoke primitives. A named slice is a STORED PREDICATE (the `SliceDefined`
// event), never a stored number; membership is re-evaluated against the live
// event log every time (spec §3.2).
//
// `asOf` is supplied at evaluation, NOT stored on the slice — a slice is a
// timeless predicate; its members are an asOf projection (Principle 1).
//
// TENANT = HARD OUTER PARTITION (spec §3 binding constraint): every Slice carries
// a `tenantId` and is implicitly tenant-scoped. The engine (engine.ts) selects
// members ONLY from the tenant's own scoped store (reusing the S10 tenant-axis
// enforcement) — no `metric(slice)` may select members across tenants.
//
// PACKAGE BOUNDARY: no v1 imports.
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD; D-METRIC-ATTRIBUTION-DIMENSIONAL;
//   D-V2-TENANCY-ARCHITECTURE; Principle 1.
// Author: Atlas (Core banking platform architect, engineering).

import type { TenantId } from "../control-plane/tenant";
import type { AttributionDimensions } from "./dimensions";
import {
  type DimensionPredicate,
  type SliceLevel,
  dimensionPredicateSchema,
  sliceLevelSchema,
} from "./events";

// ---------------------------------------------------------------------------
// Slice — predicate over dimensions + target level
// ---------------------------------------------------------------------------

export interface Slice {
  /** Present iff this is a NAMED / stored slice (a `SliceDefined` event). */
  readonly sliceId?: string;
  /** The HARD OUTER PARTITION. Every slice is tenant-scoped; never cross-tenant. */
  readonly tenantId: TenantId;
  /** Conjunction of typed dimension predicates. */
  readonly where: readonly DimensionPredicate[];
  /** The roll-up target level — controls hierarchy aggregation depth. */
  readonly level: SliceLevel;
}

export type { DimensionPredicate, SliceLevel };
export { dimensionPredicateSchema, sliceLevelSchema };

// ---------------------------------------------------------------------------
// Predicate evaluation over a projected dimension snapshot
// ---------------------------------------------------------------------------

/**
 * A descendant-resolver: given a dimension key, a candidate node, and the
 * predicate's `under` node, decide whether the candidate is at-or-under the
 * predicate node. Supplied by the engine from the dimension hierarchy (asOf
 * projection). The default is exact-match (flat dimension).
 */
export type UnderResolver = (
  dim: DimensionPredicate["dim"],
  candidateNode: string,
  predicateNode: string,
) => boolean;

const exactMatchUnder: UnderResolver = (_dim, candidate, predicateNode) =>
  candidate === predicateNode;

/** Evaluate a single predicate against an instance's projected dimensions. */
export function matchesPredicate(
  dims: AttributionDimensions,
  predicate: DimensionPredicate,
  under: UnderResolver = exactMatchUnder,
): boolean {
  const raw = (dims as Record<string, unknown>)[predicate.dim];

  // `portfolio` is a multi-valued dimension (an instance can sit in many).
  const values: string[] = Array.isArray(raw)
    ? (raw as unknown[]).map(String)
    : raw === undefined || raw === null
      ? []
      : [String(raw)];

  switch (predicate.op) {
    case "eq":
      return values.includes(predicate.value);
    case "in":
      return values.some((v) => predicate.values.includes(v));
    case "under":
      return values.some((v) => under(predicate.dim, v, predicate.node));
  }
}

/** Evaluate the full conjunction (every predicate must hold). */
export function matchesSlice(
  dims: AttributionDimensions,
  where: readonly DimensionPredicate[],
  under: UnderResolver = exactMatchUnder,
): boolean {
  return where.every((p) => matchesPredicate(dims, p, under));
}
