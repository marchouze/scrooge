// platform/model-registry/data-failures-view.ts
//
// Read-side projection for the cross-page data-failure surface (/api/data-
// failures + _data-failure-banner.js). Objective 4 of the Trusted-Figures
// Program: a financial figure that could not be computed from a complete input
// set must be visible as "value unavailable", never a silent 0.
//
// The current trust of a figure is determined by its *latest* CalculationPerformed
// (model-folded, append order). This view surfaces every bound figure whose
// latest computation is `degraded` or `failed`, with the missing inputs and the
// owning model — the same fold the Models page uses, filtered to non-ok.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (Core banking platform architect, engineering).

import type { EventStore } from "../event-store/store";
import { buildCalcModelsView } from "./models-view";

export interface DataFailureView {
  readonly calcKey: string;
  readonly figure: string;
  readonly modelId: string;
  readonly owningAgent: string;
  readonly status: "degraded" | "failed";
  readonly missingInputs: readonly string[];
  readonly asOf: string;
}

/**
 * Every bound figure whose latest computation is `degraded` or `failed`.
 * Empty when every surfaced figure computed cleanly (status `ok`).
 */
export function buildDataFailuresView(store: EventStore): DataFailureView[] {
  const out: DataFailureView[] = [];
  for (const m of buildCalcModelsView(store)) {
    const last = m.lastCalculation;
    if (last && last.status !== "ok") {
      out.push({
        calcKey: m.calcKey,
        figure: m.figure,
        modelId: m.modelId,
        owningAgent: m.owningAgent,
        status: last.status,
        missingInputs: last.missingInputs,
        asOf: last.asOf,
      });
    }
  }
  return out;
}
