// v2-core/fil-models/fx/performance/fx-performance-metrics.ts
//
// Three additive AttributionMetrics for FX performance attribution:
//   1. fx-unrealised-pnl  — reads Performable; additive across positions
//   2. fx-carry           — reads Performable; stageScope: "active" only
//   3. fx-delta-exposure  — reads Valuable + RiskMeasurable; sums value in reporting currency
//
// Author: Atlas (Core banking platform architect, engineering).
// Authority: D-ENGINEERING-INTEGRITY-CHARTER; brief:atlas:fil-fx-language-phase-1-linear-otc-models:2026-06-15

import type {
  AdditiveSemantics,
  AttributionMetric,
  MetricRegistry,
  SliceMember,
} from "../../../fil-attribution/metric.ts";
import { addD, isZeroD, toDecimal } from "../../../fil-core/decimal.ts";
import type { FilLifecycleStage } from "../../../fil-core/lifecycle.ts";
import { type Instant, moneyFromDecimal, zeroMoney } from "../../../fil-core/primitives.ts";
import type {
  MarketDataSlice,
  Performable,
  RevaluationRecord,
  Valuable,
} from "../../../fil-facets/facets.ts";
import { FX_REPORTING_CURRENCY } from "../../fx-valuation/methodology.ts";

// ---------------------------------------------------------------------------
// Result type — shared by all three metrics. DECIMAL-NATIVE
// (D-V2-CORE-MONEY-DECIMAL-NATIVE): amount = MAJOR-unit canonical decimal string.
// ---------------------------------------------------------------------------

export interface FxPerformanceResult {
  readonly currency: string;
  readonly amount: string;
}

const ZERO_RESULT: FxPerformanceResult = {
  currency: FX_REPORTING_CURRENCY,
  amount: "0",
};

function addResults(a: FxPerformanceResult, b: FxPerformanceResult): FxPerformanceResult {
  if (isZeroD(toDecimal(a.amount)) && a.currency === FX_REPORTING_CURRENCY) return b;
  if (isZeroD(toDecimal(b.amount)) && b.currency === FX_REPORTING_CURRENCY) return a;
  if (a.currency !== b.currency) {
    throw new Error(
      `fx-performance: cannot add across currencies (${a.currency} + ${b.currency}) — single-currency book required`,
    );
  }
  const sum = moneyFromDecimal(a.currency, addD(toDecimal(a.amount), toDecimal(b.amount)));
  return { currency: sum.currency, amount: sum.amount };
}

const ADDITIVE: AdditiveSemantics<FxPerformanceResult> = {
  mode: "additive",
  zero: ZERO_RESULT,
  add: addResults,
};

// ---------------------------------------------------------------------------
// Facet access helpers
// ---------------------------------------------------------------------------

function performableOf(member: SliceMember): Performable | undefined {
  const handle = member.facets.Performable;
  if (handle && typeof (handle as Performable).unrealisedPnl === "function") {
    return handle as Performable;
  }
  return undefined;
}

function valuableOf(member: SliceMember): Valuable | undefined {
  const handle = member.facets.Valuable;
  if (handle && typeof (handle as Valuable).value === "function") {
    return handle as Valuable;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Metric 1: fx-unrealised-pnl
// ---------------------------------------------------------------------------

export const FX_UNREALISED_PNL_METRIC_ID = "fx-unrealised-pnl" as const;

export const fxUnrealisedPnlMetric: AttributionMetric<FxPerformanceResult> & {
  aggregation: AdditiveSemantics<FxPerformanceResult>;
} = {
  metricId: FX_UNREALISED_PNL_METRIC_ID,
  resultKind: "money",
  readsFacets: ["Performable"],
  stageScope(stage: FilLifecycleStage): boolean {
    return stage === "active";
  },
  aggregation: ADDITIVE,
  evaluate(
    members: readonly SliceMember[],
    marks: MarketDataSlice,
    asOf: Instant,
  ): FxPerformanceResult {
    let acc = ZERO_RESULT;
    for (const m of members) {
      const perf = performableOf(m);
      if (!perf) {
        throw new Error(
          `${FX_UNREALISED_PNL_METRIC_ID}: member "${m.instanceUrn}" exposes no Performable facet`,
        );
      }
      const rec = perf.unrealisedPnl(marks, asOf, zeroMoney(FX_REPORTING_CURRENCY));
      acc = addResults(acc, {
        currency: rec.unrealisedPnl.currency,
        amount: rec.unrealisedPnl.amount,
      });
    }
    return acc;
  },
};

// ---------------------------------------------------------------------------
// Metric 2: fx-carry
// ---------------------------------------------------------------------------

export const FX_CARRY_METRIC_ID = "fx-carry" as const;

export const fxCarryMetric: AttributionMetric<FxPerformanceResult> & {
  aggregation: AdditiveSemantics<FxPerformanceResult>;
} = {
  metricId: FX_CARRY_METRIC_ID,
  resultKind: "money",
  readsFacets: ["Performable"],
  stageScope(stage: FilLifecycleStage): boolean {
    // Carry only for active (unsettled) positions
    return stage === "active";
  },
  aggregation: ADDITIVE,
  evaluate(
    members: readonly SliceMember[],
    marks: MarketDataSlice,
    asOf: Instant,
  ): FxPerformanceResult {
    let acc = ZERO_RESULT;
    for (const m of members) {
      const perf = performableOf(m);
      if (!perf) {
        throw new Error(
          `${FX_CARRY_METRIC_ID}: member "${m.instanceUrn}" exposes no Performable facet`,
        );
      }
      const carry = perf.carry(marks, asOf);
      acc = addResults(acc, { currency: carry.currency, amount: carry.amount });
    }
    return acc;
  },
};

// ---------------------------------------------------------------------------
// Metric 3: fx-delta-exposure
// ---------------------------------------------------------------------------

export const FX_DELTA_EXPOSURE_METRIC_ID = "fx-delta-exposure" as const;

export const fxDeltaExposureMetric: AttributionMetric<FxPerformanceResult> & {
  aggregation: AdditiveSemantics<FxPerformanceResult>;
} = {
  metricId: FX_DELTA_EXPOSURE_METRIC_ID,
  resultKind: "money",
  readsFacets: ["Valuable"],
  stageScope(stage: FilLifecycleStage): boolean {
    return stage === "active" || stage === "settled";
  },
  aggregation: ADDITIVE,
  evaluate(
    members: readonly SliceMember[],
    marks: MarketDataSlice,
    asOf: Instant,
  ): FxPerformanceResult {
    let acc = ZERO_RESULT;
    for (const m of members) {
      const valuable = valuableOf(m);
      if (!valuable) {
        throw new Error(
          `${FX_DELTA_EXPOSURE_METRIC_ID}: member "${m.instanceUrn}" exposes no Valuable facet`,
        );
      }
      const rec: RevaluationRecord = valuable.value(marks, asOf);
      acc = addResults(acc, { currency: rec.value.currency, amount: rec.value.amount });
    }
    return acc;
  },
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerFxPerformanceMetrics(registry: MetricRegistry): void {
  registry.register(fxUnrealisedPnlMetric);
  registry.register(fxCarryMetric);
  registry.register(fxDeltaExposureMetric);
}
