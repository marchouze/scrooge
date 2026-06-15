// v2-core/fil-models/market-risk-var/var-metric.ts
//
// MARKET-RISK VaR — the FIRST `joint-recompute` `AttributionMetric` (V2 A3).
//
// A2 bound the first ADDITIVE metric (FX book P&L). A3 binds the first
// NON-ADDITIVE one: VaR. This is the metric that makes
// `recon:attribution-nonadditive-no-sum` NON-VACUOUS — there is now a registered
// `joint-recompute` metric with no `add` member, and the new
// `recon:attribution-var-diversification` gate exercises the diversification
// effect (group VaR < Σ desk VaRs) + the v1-NOP parity at the group node.
//
// THE METRIC (spec §2.2, A3 "Prove"):
//   - resultKind `distribution`; aggregation `joint-recompute` — VaR over a
//     parent is RE-COMPUTED over the joint member set, NEVER composed from
//     children (diversification). No `add`/`zero`.
//   - reads BOTH `RiskMeasurable` (to know each member's risk factor — the
//     currency it loads) and `Valuable` (to get its signed ZAR exposure). The
//     encapsulation contract: the metric never reaches into ad-hoc fields.
//   - stageScope: a member contributes iff `active` (unsettled FX position) OR
//     `settled` (standing FCY cash) — the SAME standing-NOP basis as the v1 VaR
//     engine + the B3 limit-utilisation projection (D-VAR-EXPOSURE-INCLUDES-
//     STANDING-NOP). The settlement boundary does not change the risk factor.
//
// JOINT POSITION SET → JOINT VaR: `evaluate` reads each member's signed ZAR
// value, accumulates it into a per-currency exposure vector, then runs the
// ported historical-simulation (`jointVar`) over that vector + a per-factor
// RETURN MATRIX. The return matrix is CALIBRATION data threaded at construction
// (a factory) — the structural twin of the v1 engine's `returnsByFactor`, and of
// how the S7-FIL SA-CCR model pins its inputs from a recorded v1 event to avoid
// drift. The metric is constructed per evaluation with the live return window.
//
// NO v1 imports (recon:v2-no-v1-import — ENFORCING). The HS math is PORTED
// (methodology.ts), not imported; the parity gate asserts byte-agreement.
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD (A3 build slice);
//   D-METRIC-ATTRIBUTION-DIMENSIONAL; D-VAR-EXPOSURE-INCLUDES-STANDING-NOP;
//   D-FIL-FRAMEWORK-UNIFICATION (encapsulation); Principle 1.
// Author: Atlas (Core banking platform architect, engineering) ·
//         Rohan (Risk systems engineer, engineering) ·
//         Helena (Chief Risk Officer, governance — methodology accountability).

import type {
  AttributionMetric,
  JointRecomputeSemantics,
  MetricRegistry,
  SliceMember,
} from "../../fil-attribution";
import type { FilLifecycleStage } from "../../fil-core/lifecycle";
import type { CitationRef } from "../../fil-core/primitives";
import type {
  MarketDataSlice,
  RevaluationRecord,
  RiskMeasurable,
  Valuable,
} from "../../fil-facets/facets";
import { type JointVarResult, type VarRiskFactorExposure, jointVar } from "./methodology";

export const VAR_METRIC_ID = "market-risk-var" as const;

/** The reporting currency VaR is expressed in. */
export const VAR_REPORTING_CURRENCY = "ZAR" as const;

/**
 * The per-risk-factor return matrix (calibration). `factor → most-recent-first
 * daily log-returns`. The structural twin of the v1 engine's `returnsByFactor`;
 * supplied at metric construction so the metric stays pure over its member set.
 */
export type VarReturnMatrix = ReadonlyMap<string, readonly number[]>;

// ---------------------------------------------------------------------------
// Reading the facet handles off a member (encapsulation).
// ---------------------------------------------------------------------------

function valuableOf(member: SliceMember): Valuable | undefined {
  const handle = member.facets.Valuable;
  if (handle && typeof (handle as Valuable).value === "function") return handle as Valuable;
  return undefined;
}

function riskMeasurableOf(member: SliceMember): RiskMeasurable | undefined {
  const handle = member.facets.RiskMeasurable;
  if (handle && typeof (handle as RiskMeasurable).riskFactors === "function") {
    return handle as RiskMeasurable;
  }
  return undefined;
}

/**
 * The risk factor a member loads — the FX pair `<CCY>/ZAR`. Read from the
 * member's `RiskMeasurable.riskFactors()` (the first FX delta factor). The
 * factor id is the canonical pair string (matches the v1 engine's factor key).
 */
function factorOf(member: SliceMember): string | undefined {
  const rm = riskMeasurableOf(member);
  if (!rm) return undefined;
  const factors = rm.riskFactors();
  const fx = factors.find((f) => f.kind === "delta");
  return fx?.factorId;
}

// ---------------------------------------------------------------------------
// stageScope — active (unsettled FX) ∨ settled (standing FCY cash). The standing-
// NOP basis (matches v1 VaR engine + B3).
// ---------------------------------------------------------------------------

export function varStageScope(stage: FilLifecycleStage): boolean {
  return stage === "active" || stage === "settled";
}

const VAR_AGGREGATION: JointRecomputeSemantics = { mode: "joint-recompute" };

// ---------------------------------------------------------------------------
// The metric — a function of a SET of instances, joint-recompute.
// ---------------------------------------------------------------------------

export type VarMetric = AttributionMetric<JointVarResult> & {
  aggregation: JointRecomputeSemantics;
};

/**
 * Build the VaR metric over a given return matrix (calibration). The metric:
 *   1. reads each member's signed ZAR exposure (`Valuable.value(marks, asOf)`)
 *      and its risk factor (`RiskMeasurable.riskFactors()`),
 *   2. accumulates a per-factor JOINT exposure vector,
 *   3. runs the ported historical simulation over (exposure vector × return
 *      matrix) → the JOINT VaR + ES.
 *
 * `joint-recompute`: there is no `add`/`zero`; composing children's results is a
 * type error AND a runtime throw (assertNoSum). The engine hands the whole
 * member set of each node to `evaluate` — diversification falls out of the joint
 * distribution.
 */
export function makeVarMetric(returnMatrix: VarReturnMatrix): VarMetric {
  return {
    metricId: VAR_METRIC_ID,
    resultKind: "distribution",
    readsFacets: ["RiskMeasurable", "Valuable"],
    stageScope: varStageScope,
    aggregation: VAR_AGGREGATION,
    evaluate(members: readonly SliceMember[], marks: MarketDataSlice, asOf): JointVarResult {
      // Accumulate the JOINT exposure vector: per risk factor, the signed ZAR
      // exposure summed across every member loading that factor.
      const exposureByFactor = new Map<string, number>();
      for (const m of members) {
        const factor = factorOf(m);
        if (!factor) {
          throw new Error(
            `market-risk-var: member "${m.instanceUrn}" exposes no RiskMeasurable FX delta factor — the projection must attach a RiskMeasurable for a VaR member`,
          );
        }
        const valuable = valuableOf(m);
        if (!valuable) {
          throw new Error(
            `market-risk-var: member "${m.instanceUrn}" exposes no Valuable facet handle — the projection must attach a Valuable for a VaR member`,
          );
        }
        const rec: RevaluationRecord = valuable.value(marks, asOf);
        // The signed ZAR exposure is the member's mark-to-market value in the
        // reporting currency. The decimal-native Money amount is ALREADY in major
        // units (D-V2-CORE-MONEY-DECIMAL-NATIVE) — parse the canonical string into
        // the float working basis the historical-simulation VaR operates in.
        const exposureZar = Number.parseFloat(rec.value.amount);
        exposureByFactor.set(factor, (exposureByFactor.get(factor) ?? 0) + exposureZar);
      }

      const exposures: VarRiskFactorExposure[] = [];
      for (const [factor, exposureZar] of exposureByFactor) {
        exposures.push({
          factor,
          exposureZar,
          returns: returnMatrix.get(factor) ?? [],
        });
      }
      return jointVar(exposures);
    },
  };
}

// ---------------------------------------------------------------------------
// Registration — bind the VaR metric into a metric registry. Because the metric
// is calibration-parameterised (the return matrix), the registry holds a
// CANONICAL instance built over an EMPTY return matrix (the registry entry
// exists so the no-sum recon's LIVE scan is non-vacuous — it confirms the
// registered joint-recompute metric carries no `add`). Live evaluation builds a
// fresh metric over the live return window via `makeVarMetric`.
// ---------------------------------------------------------------------------

/** The Principle-2 citation for the VaR metric registration. */
export const VAR_METRIC_CITATION = "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP" as CitationRef;

/** A canonical (empty-calibration) VaR metric for the registry entry. */
export const varMetricCanonical: VarMetric = makeVarMetric(new Map());

export function registerVarMetric(registry: MetricRegistry): void {
  if (!registry.has(VAR_METRIC_ID)) {
    registry.register(varMetricCanonical);
  }
}
