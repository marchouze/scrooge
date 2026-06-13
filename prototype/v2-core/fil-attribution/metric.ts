// v2-core/fil-attribution/metric.ts
//
// FIL ATTRIBUTION — the metric + aggregation-semantics interface (A1 kernel;
// design spec §2, THE CRUX).
//
// A metric is a function of a SET of instances: `metric(members, marks, asOf)`.
// There is NO per-book or per-desk variant — the SAME `evaluate` runs at every
// level; only the member set differs.
//
// THE CRUX (spec §2.2): additivity is NOT assumed. Each metric DECLARES its own
// aggregation semantics as a discriminated union:
//
//   `additive`        — metric(parent) = Σ metric(disjoint child partition).
//                       Sum is a valid OPTIMISATION (a node may be cached as the
//                       sum of its children's cached values); the DEFINITION is
//                       still "evaluate over the joint member set", and
//                       recon:attribution-additivity verifies sum == recompute.
//                       Carries `zero` + `add`. (P&L, notional, delta, EAD, GL
//                       balance, RWA, HQLA …)
//
//   `joint-recompute` — metric(parent) is RE-COMPUTED over the joint member set;
//                       it is NOT a function of the children's results. NO sum
//                       shortcut is legal. Carries NO `add`/`zero` — composing
//                       children's results is mathematically wrong. Diversification
//                       lives here. (VaR, ES, SVaR, IRRBB ΔEVE at the diversified
//                       level, any quantile/tail measure.)
//
//   recon:attribution-nonadditive-no-sum is the static+runtime guard that
//   FORBIDS summation of a `joint-recompute` metric — there is no `add` to call,
//   so a sum is a type error, and the runtime guard catches a reflective attempt.
//
// A metric reads an instrument ONLY through a facet (`readsFacets`) — encapsulation
// is the audit property (FIL Framework §1). It declares `stageScope` (which
// lifecycle stages contribute, e.g. VaR consumes live + standing-NOP settled).
//
// A1 ships the INTERFACE + an EMPTY registry. Models register in later slices
// (A2 binds the FX `pnl` metric); the kernel binds none.
//
// PACKAGE BOUNDARY: no v1 imports. Reads facet names + the lifecycle-stage enum
// from fil-core / fil-facets only.
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD; D-METRIC-ATTRIBUTION-DIMENSIONAL;
//   D-FIL-FRAMEWORK-UNIFICATION (encapsulation); Principle 1.
// Author: Atlas (Core banking platform architect, engineering).

import type { FilLifecycleStage } from "../fil-core/lifecycle";
import type { Instant } from "../fil-core/primitives";
import type { FilFacetName } from "../fil-core/type-definition";
import type { FilInstanceUrn } from "../fil-core/urn";
import type { MarketDataSlice } from "../fil-facets/facets";

// ---------------------------------------------------------------------------
// A slice member — the unit a metric evaluates over
//
// A member is a FIL instance reference resolved at an asOf: its URN, its current
// lifecycle stage, and a facet-access handle. A1 keeps this minimal and
// facet-agnostic; A2+ binds concrete facet implementations (the FX `Valuable`
// model). The kernel only needs identity + stage to do member selection and to
// hand the joint set to a metric's `evaluate`.
// ---------------------------------------------------------------------------

export interface SliceMember {
  readonly instanceUrn: FilInstanceUrn;
  readonly stage: FilLifecycleStage;
  /**
   * The facet-access handle. Opaque at A1 (a metric in a later slice narrows it
   * to the facet it declared in `readsFacets`). Kept `unknown` so the kernel
   * never reaches into ad-hoc instrument fields (encapsulation, FIL §1).
   */
  readonly facets: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// AggregationSemantics — the discriminated union (THE declaration)
// ---------------------------------------------------------------------------

export const AGGREGATION_MODES = ["additive", "joint-recompute"] as const;
export type AggregationMode = (typeof AGGREGATION_MODES)[number];

/**
 * ADDITIVE: the metric over a parent equals Σ over a disjoint child partition.
 * `zero` + `add` make the children-sum optimisation expressible; the engine MAY
 * sum pre-computed children, and recon:attribution-additivity asserts that the
 * sum equals a from-scratch joint recompute.
 */
export interface AdditiveSemantics<TResult> {
  readonly mode: "additive";
  readonly zero: TResult;
  add(a: TResult, b: TResult): TResult;
}

/**
 * JOINT-RECOMPUTE: the metric over a parent is re-computed over the joint member
 * set. NO `add`/`zero` — composing children's results is mathematically wrong
 * (diversification). The absence of `add` is the type-level guarantee that no
 * summation path exists; recon:attribution-nonadditive-no-sum is the runtime
 * backstop against a reflective summation attempt.
 */
export interface JointRecomputeSemantics {
  readonly mode: "joint-recompute";
}

export type AggregationSemantics<TResult> = AdditiveSemantics<TResult> | JointRecomputeSemantics;

/** Type guard: is this an additive semantics (so summation is legal)? */
export function isAdditive<TResult>(
  sem: AggregationSemantics<TResult>,
): sem is AdditiveSemantics<TResult> {
  return sem.mode === "additive";
}

/** Type guard: is this a joint-recompute semantics (so summation is forbidden)? */
export function isJointRecompute<TResult>(
  sem: AggregationSemantics<TResult>,
): sem is JointRecomputeSemantics {
  return sem.mode === "joint-recompute";
}

// ---------------------------------------------------------------------------
// AttributionMetric — a function of a SET of instances
// ---------------------------------------------------------------------------

export interface AttributionMetric<TResult> {
  /** Stable id: "pnl" | "notional" | "var" | "ead" | … */
  readonly metricId: string;
  /** The shape of the result this metric produces. */
  readonly resultKind: "money" | "scalar" | "vector" | "distribution";
  /** The facet(s) this metric reads — the encapsulation contract (FIL §1). */
  readonly readsFacets: readonly FilFacetName[];
  /** Which lifecycle stages contribute (e.g. VaR: live ∨ standing-NOP settled). */
  stageScope(stage: FilLifecycleStage): boolean;
  /** THE declaration: how this metric aggregates over a member set. */
  readonly aggregation: AggregationSemantics<TResult>;
  /** Compute the metric over a member set at marks K, as-of T. */
  evaluate(members: readonly SliceMember[], marks: MarketDataSlice, asOf: Instant): TResult;
}

// ---------------------------------------------------------------------------
// Metric registry — EMPTY at A1 (models register in later slices)
//
// The registry is a small in-memory map keyed by metricId. A1 ships it empty;
// A2 registers the FX `pnl` metric, A3+ register notional/delta/EAD/VaR/… Each
// registration is a new AttributionMetric, NOT a new aggregate primitive (spec
// §5.3 A5). Duplicate registration is rejected (fail-loud).
// ---------------------------------------------------------------------------

export class MetricRegistry {
  private readonly metrics = new Map<string, AttributionMetric<unknown>>();

  register<TResult>(metric: AttributionMetric<TResult>): void {
    if (this.metrics.has(metric.metricId)) {
      throw new Error(
        `attribution: metric "${metric.metricId}" is already registered — duplicate registration rejected (fail-loud)`,
      );
    }
    this.metrics.set(metric.metricId, metric as AttributionMetric<unknown>);
  }

  get(metricId: string): AttributionMetric<unknown> | undefined {
    return this.metrics.get(metricId);
  }

  has(metricId: string): boolean {
    return this.metrics.has(metricId);
  }

  list(): readonly string[] {
    return [...this.metrics.keys()];
  }

  get size(): number {
    return this.metrics.size;
  }
}

/** The process-wide kernel registry — EMPTY at A1. */
export const metricRegistry = new MetricRegistry();
