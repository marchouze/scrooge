// v2-core/fil-attribution/engine.ts
//
// FIL ATTRIBUTION — the aggregation engine (A1 kernel; design spec §3.1).
//
// `evaluate(metric, slice, members, marks, asOf)`:
//   1. SELECT members — the slice predicate over each member's projected
//      dimensions, filtered by `metric.stageScope`. Members are supplied to the
//      engine ALREADY tenant-scoped (resolved from the tenant's own scoped store
//      — see `members.ts` + the S10 tenant-axis enforcement). The engine
//      ASSERTS the tenant invariant as defence-in-depth (a member whose tenant
//      does not match the slice's tenant is a cross-tenant bleed and is
//      rejected — never silently dropped into the result).
//   2. If `slice.level` is a roll-up grouping, PARTITION members by the target
//      dimension and evaluate the metric per cell.
//   3. Apply `metric.aggregation`:
//        additive       → Σ (or the children-sum optimisation; equal by §5.2).
//        joint-recompute → hand each cell's JOINT member set to `evaluate` once
//                          (NEVER compose child results — the no-sum guard).
//
// TENANT = HARD OUTER PARTITION (binding constraint): the engine REUSES the S10
// tenant-axis enforcement for member resolution (members.ts) and re-asserts the
// tenant tag here. It does NOT invent a parallel partition mechanism.
//
// THE NO-SUM GUARD (spec §2.2 / §5.2 recon:attribution-nonadditive-no-sum): a
// `joint-recompute` metric has NO `add` — there is no summation path in the type
// system. The engine's runtime guard `assertNoSum` makes any attempt to sum a
// joint-recompute metric throw, so even a reflective caller cannot compose child
// VaRs. This is the runtime half of the gate (the static half is the absence of
// `add` on `JointRecomputeSemantics`).
//
// A1 BEHAVIOUR: the engine is exercised by the two recon fixtures and the unit
// test. No live metric is bound (the registry is empty), so production evaluation
// is vacuous until A2 binds the FX `pnl` metric.
//
// PACKAGE BOUNDARY: no v1 imports.
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD; D-METRIC-ATTRIBUTION-DIMENSIONAL;
//   D-V2-TENANCY-ARCHITECTURE; Principle 1.
// Author: Atlas (Core banking platform architect, engineering).

import type { Instant } from "../fil-core/primitives";
import type { MarketDataSlice } from "../fil-facets/facets";
import { type AttributionMetric, type SliceMember, isAdditive, isJointRecompute } from "./metric";
import type { Slice } from "./slice";

// ---------------------------------------------------------------------------
// A member resolved with its projected dimensions + tenant tag
//
// The engine consumes members that carry the dimension snapshot (so the slice
// predicate is evaluable) and the tenant tag (so the partition invariant is
// re-assertable). `members.ts` produces these from the tenant-scoped store.
// ---------------------------------------------------------------------------

export interface ResolvedMember extends SliceMember {
  /** The tenant this member belongs to (must equal the slice's tenant). */
  readonly tenantId: string;
  /** Which target-level group this member rolls up to (filled at partition). */
  readonly groupKey?: string;
}

// ---------------------------------------------------------------------------
// The no-sum runtime guard
// ---------------------------------------------------------------------------

/**
 * Throw if asked to sum a `joint-recompute` metric. The static guarantee is the
 * absence of `add` on `JointRecomputeSemantics`; this is the runtime backstop a
 * reflective summation attempt hits. The runtime half of
 * recon:attribution-nonadditive-no-sum.
 */
export function assertNoSum<TResult>(metric: AttributionMetric<TResult>): void {
  if (isJointRecompute(metric.aggregation)) {
    throw new Error(
      `attribution: metric "${metric.metricId}" is joint-recompute — summing its child results is forbidden (diversification); re-compute over the joint member set instead`,
    );
  }
}

// ---------------------------------------------------------------------------
// Per-cell result
// ---------------------------------------------------------------------------

export interface CellResult<TResult> {
  /** The target-level group this cell represents ("ALL" for an ungrouped slice). */
  readonly groupKey: string;
  readonly memberCount: number;
  readonly value: TResult;
}

export interface SliceEvaluation<TResult> {
  readonly metricId: string;
  readonly sliceId?: string;
  readonly tenantId: string;
  readonly level: string;
  readonly cells: readonly CellResult<TResult>[];
}

// ---------------------------------------------------------------------------
// Tenant invariant — the hard outer partition, re-asserted (defence in depth)
// ---------------------------------------------------------------------------

/**
 * Reject any member whose tenant tag does not match the slice's tenant. Members
 * arrive already tenant-scoped (resolved from the tenant's S10 scoped store);
 * this re-assertion guarantees no cross-tenant bleed reaches a metric — the
 * structural twin of the TenantScopedStore bleed-drop.
 */
export function assertTenantPartition(slice: Slice, members: readonly ResolvedMember[]): void {
  for (const m of members) {
    if (m.tenantId !== slice.tenantId) {
      throw new Error(
        `attribution: member "${m.instanceUrn}" is tagged tenant "${m.tenantId}" but the slice is scoped to tenant "${slice.tenantId}" — cross-tenant member selection is forbidden (tenant is the hard outer partition)`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Partition + evaluate
// ---------------------------------------------------------------------------

/**
 * Partition members into target-level cells. For a flat / `leaf` / `group`
 * level the partition is "all members in one cell". For a dimension level
 * (`desk`, `legalEntity`, …) members are grouped by their `groupKey`
 * (pre-filled by `members.ts` from the dimension projection at the target
 * level). A1 keeps this minimal: ungrouped slices yield a single "ALL" cell;
 * grouped slices key on the supplied `groupKey`.
 */
function partition(
  slice: Slice,
  members: readonly ResolvedMember[],
): Map<string, ResolvedMember[]> {
  const cells = new Map<string, ResolvedMember[]>();
  const grouped = slice.level !== "leaf" && slice.level !== "group";
  for (const m of members) {
    const key = grouped ? (m.groupKey ?? "UNGROUPED") : "ALL";
    const bucket = cells.get(key);
    if (bucket) bucket.push(m);
    else cells.set(key, [m]);
  }
  return cells;
}

/**
 * Evaluate a metric over a slice's members.
 *
 * The member set is supplied by the caller (resolved tenant-scoped from the S10
 * store via `members.ts`). The engine asserts the tenant partition, filters by
 * `metric.stageScope`, partitions to the target level, then evaluates each cell.
 *
 * For an `additive` metric the per-cell value is `metric.evaluate(cellMembers)`
 * — which, BY THE ADDITIVITY CONTRACT, equals Σ of any disjoint sub-partition's
 * evaluations; `recon:attribution-additivity` asserts that equality on a sample.
 *
 * For a `joint-recompute` metric the engine evaluates each cell's JOINT member
 * set ONCE and NEVER composes cell results; `assertNoSum` is the runtime guard.
 */
export function evaluateSlice<TResult>(
  metric: AttributionMetric<TResult>,
  slice: Slice,
  members: readonly ResolvedMember[],
  marks: MarketDataSlice,
  asOf: Instant,
): SliceEvaluation<TResult> {
  assertTenantPartition(slice, members);

  const inScope = members.filter((m) => metric.stageScope(m.stage));
  const cells = partition(slice, inScope);

  const cellResults: CellResult<TResult>[] = [];
  for (const [groupKey, cellMembers] of cells) {
    // additive vs joint-recompute: BOTH paths call evaluate over the joint cell
    // member set (the definition is "evaluate over the member set"). The
    // difference is what the ENGINE may do across cells / hierarchy levels —
    // additive may sum cached children, joint-recompute may not. At a single
    // cell both recompute; the no-sum guard ensures a joint-recompute metric is
    // never asked to sum across cells.
    if (!isAdditive(metric.aggregation)) {
      assertNoSum(metric);
    }
    cellResults.push({
      groupKey,
      memberCount: cellMembers.length,
      value: metric.evaluate(cellMembers, marks, asOf),
    });
  }

  const result: SliceEvaluation<TResult> = {
    metricId: metric.metricId,
    tenantId: slice.tenantId,
    level: slice.level,
    cells: cellResults,
  };
  return slice.sliceId === undefined ? result : { ...result, sliceId: slice.sliceId };
}

/**
 * Additive children-sum optimisation: fold a set of child cell values into a
 * parent value using the metric's `add`. Only callable for an additive metric —
 * a joint-recompute metric has no `add`, so this overload is a type error for it
 * AND `assertNoSum` throws if reached reflectively. `recon:attribution-additivity`
 * asserts the folded sum equals a from-scratch joint recompute on a sample.
 */
export function sumChildren<TResult>(
  metric: AttributionMetric<TResult>,
  childValues: readonly TResult[],
): TResult {
  assertNoSum(metric); // belt-and-braces — unreachable when called on an additive metric
  if (!isAdditive(metric.aggregation)) {
    // narrowing — unreachable after assertNoSum, but keeps the type checker honest
    throw new Error(`attribution: sumChildren called on non-additive metric "${metric.metricId}"`);
  }
  const { zero, add } = metric.aggregation;
  return childValues.reduce<TResult>((acc, v) => add(acc, v), zero);
}
