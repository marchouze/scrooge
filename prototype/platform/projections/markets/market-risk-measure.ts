// platform/projections/markets/market-risk-measure.ts
//
// MarketRiskMeasureProjection (RAS B3 review R8 / D-B3-5).
//
// Folds the latest `MarketRiskMeasureComputed` event and surfaces VaR / SVaR /
// ES against Helena's MR-1-FX 1-day 99% VaR appetite (ZAR 350,000) as the
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

import type { MarketRiskMeasureComputedPayload } from "../../event-store/event-types/market-risk-measure";
import type { Event } from "../../event-store/types";

// RAG bands mirror the MR-1-FX B3 calibration (Helena §1.4): amber at 80%,
// red at 100% of the VaR appetite (D-B3-6 retires the uniform 70/90 default).
const AMBER_THRESHOLD = 0.8;
const RED_THRESHOLD = 1.0;

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
};

/**
 * Build the market-risk measure view from the event stream. Latest-wins by
 * event order (the emitter appends one measure per entity per UTC day).
 */
export function getMarketRiskMeasure(events: readonly Event[]): MarketRiskMeasureView {
  let latest: MarketRiskMeasureComputedPayload | undefined;
  for (const e of events) {
    if (e.type === "MarketRiskMeasureComputed") {
      latest = e.payload as unknown as MarketRiskMeasureComputedPayload;
    }
  }
  if (!latest) return EMPTY_VIEW;

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
  };
}
