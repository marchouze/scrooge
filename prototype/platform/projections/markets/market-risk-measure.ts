// platform/projections/markets/market-risk-measure.ts
//
// MarketRiskMeasureProjection (RAS B3 review R8 / D-B3-5).
//
// Folds the latest `MarketRiskMeasureComputed` event and surfaces VaR / SVaR /
// ES against Helena's MR-1-FX 1-day 99% VaR appetite (the ceiling carried on the
// event's `varAppetiteZar`, sourced from the canonical RAS register line
// `appetite:market:trading-var` — re-calibrated to ZAR 575,000 against the
// standing-NOP basis per D-VAR-EXPOSURE-INCLUDES-STANDING-NOP) as the
// risk-calibrated rung of the market-risk appetite stack — a SEPARATE line from
// the B3 Net Open Position position limit. This closes the semantic mismatch
// behind vera:mr-1-fx-var-projection-gap: the VaR appetite is now read against a
// VaR figure, not against the NOP accumulator.
//
// NO SILENT ZEROS: when the figure is absent (flat book / too-short history) the
// view reports null utilisation + null RAG and the absent reason as lineage —
// never a green 0%.
//
// Principle 1 — derived cache; the event log is truth.
// Authors: Rohan (Risk engineer) + Helena (Chief Risk Officer, governance).

import type {
  MarketRiskMeasureComputedPayload,
  MarketRiskVarComputedPayload,
} from "../../event-store/event-types/market-risk-measure";
import type { Event } from "../../event-store/types";

// RAG bands mirror the MR-1-FX B3 calibration (Helena §1.4): amber at 80%,
// red at 100% of the VaR appetite (D-B3-6 retires the uniform 70/90 default).
const AMBER_THRESHOLD = 0.8;
const RED_THRESHOLD = 1.0;

/**
 * Compact V2 VaR comparison snapshot — populated when a `MarketRiskVarComputed`
 * (schemaVersion: 2) event exists for the same or nearest day.
 * Advisory only: the V1 read path is authoritative until the flip is approved.
 */
export interface MarketRiskMeasureV2View {
  /** ISO 8601 as-of of the latest V2 event. */
  asOf: string;
  /** V2 VaR (ZAR major-unit float) — null when the figure is absent. */
  varZar: number | null;
  /** V2 SVaR (ZAR major-unit float). */
  svarZar: number | null;
  /** V2 ES (ZAR major-unit float). */
  esZar: number | null;
  /** tenantId carried on the V2 event. */
  tenantId: string;
}

export interface MarketRiskMeasureView {
  /** "no-measure" when no MarketRiskMeasureComputed event has been emitted. */
  status: "computed" | "no-positions" | "insufficient-history" | "no-measure";
  asOf: string | null;
  /** ZAR loss magnitudes; null when the figure is absent. */
  varZar: number | null;
  svarZar: number | null;
  esZar: number | null;
  varAppetiteZar: number | null;
  /** VaR ÷ appetite; null when VaR is absent (never silently 0). */
  utilisationPct: number | null;
  ragStatus: "green" | "amber" | "red" | null;
  riskFactorCount: number;
  minObservations: number;
  /** Present-figure lineage, or the absent reason — surfaced loudly. */
  lineage: string;
  /**
   * V2 comparison snapshot — populated when a `MarketRiskVarComputed` event
   * (schemaVersion 2) exists. Advisory only: the V1 path is authoritative
   * until the flip is approved by CEO Decision.
   * `undefined` when no V2 event has been emitted yet.
   */
  v2Measure: MarketRiskMeasureV2View | undefined;
}

function figureValue(figure: MarketRiskMeasureComputedPayload["var"]): number | null {
  return figure.present ? figure.value : null;
}

function figureLineage(figure: MarketRiskMeasureComputedPayload["var"]): string {
  return figure.present ? figure.lineage : figure.reason;
}

const EMPTY_VIEW: MarketRiskMeasureView = {
  status: "no-measure",
  asOf: null,
  varZar: null,
  svarZar: null,
  esZar: null,
  varAppetiteZar: null,
  utilisationPct: null,
  ragStatus: null,
  riskFactorCount: 0,
  minObservations: 0,
  lineage:
    "no MarketRiskMeasureComputed event emitted yet — run scripts/market-risk-measure-run.ts",
  v2Measure: undefined,
};

/** Extract a ZAR major-unit float from a V2 MoneyWire VaR figure. */
function v2FigureValue(figure: MarketRiskVarComputedPayload["var"]): number | null {
  if (!figure.present) return null;
  return Number.parseFloat(figure.value.amount);
}

/**
 * Build the market-risk measure view from the event stream. Latest-wins by
 * event order (the emitter appends one measure per entity per UTC day).
 *
 * V1 path (`MarketRiskMeasureComputed`) is authoritative. V2 path
 * (`MarketRiskVarComputed`) is folded in parallel and surfaced as `v2Measure`
 * for advisory comparison. The view `ok: true` whenever V1 is present,
 * regardless of V2 state.
 */
export function getMarketRiskMeasure(events: readonly Event[]): MarketRiskMeasureView {
  let latest: MarketRiskMeasureComputedPayload | undefined;
  let latestV2: MarketRiskVarComputedPayload | undefined;

  for (const e of events) {
    if (e.type === "MarketRiskMeasureComputed") {
      latest = e.payload as unknown as MarketRiskMeasureComputedPayload;
    }
    if (e.type === "MarketRiskVarComputed") {
      latestV2 = e.payload as unknown as MarketRiskVarComputedPayload;
    }
  }

  // Build V2 comparison snapshot when available.
  const v2Measure: MarketRiskMeasureV2View | undefined = latestV2
    ? {
        asOf: latestV2.asOf,
        varZar: v2FigureValue(latestV2.var),
        svarZar: v2FigureValue(latestV2.svar),
        esZar: v2FigureValue(latestV2.es),
        tenantId: latestV2.tenantId,
      }
    : undefined;

  if (!latest) return { ...EMPTY_VIEW, v2Measure };

  const varZar = figureValue(latest.var);
  const utilisationPct =
    varZar !== null && latest.varAppetiteZar > 0 ? varZar / latest.varAppetiteZar : null;

  let ragStatus: MarketRiskMeasureView["ragStatus"] = null;
  if (utilisationPct !== null) {
    ragStatus =
      utilisationPct >= RED_THRESHOLD
        ? "red"
        : utilisationPct >= AMBER_THRESHOLD
          ? "amber"
          : "green";
  }

  return {
    status: latest.status,
    asOf: latest.asOf,
    varZar,
    svarZar: figureValue(latest.svar),
    esZar: figureValue(latest.es),
    varAppetiteZar: latest.varAppetiteZar,
    utilisationPct: utilisationPct === null ? null : Math.min(utilisationPct, 9.99),
    ragStatus,
    riskFactorCount: latest.riskFactorCount,
    minObservations: latest.minObservations,
    lineage: figureLineage(latest.var),
    v2Measure,
  };
}
