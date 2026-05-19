// platform/ilaap/summary.ts
//
// ILAAP summary computation — aggregates across all scenario results to produce
// the headline worst-case assessment presented to ALCO / regulator.
//
// Authority: D-TREASURY-GAPS-WAVE1; Banks Act 94/1990; PA ILAAP guidance.
// Author: Atlas (Core banking platform architect, engineering)

import type { ILAAPScenarioResult, ILAAPStatus } from "./stress-scenarios";

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface ILAAPSummary {
  /** Minimum survival horizon across all scenarios (days). */
  worstCaseSurvivalDays: number;
  /** Name of the scenario that produced the worst-case survival. */
  worstCaseScenario: string;
  /** Overall liquidity adequacy status based on worst-case survival. */
  overallStatus: ILAAPStatus;
  /** Recommended management action (build-phase constant until licence-day). */
  recommendedAction: string;
}

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

function deriveOverallStatus(worstCaseSurvivalDays: number, allNoPositions: boolean): ILAAPStatus {
  if (allNoPositions) return "no-positions";
  if (worstCaseSurvivalDays < 15) return "inadequate";
  if (worstCaseSurvivalDays <= 30) return "marginal";
  return "adequate";
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Compute the ILAAP summary from the full scenario result array.
 *
 * Aggregation rules:
 *   - Worst-case survival: min(survivalHorizonDays) across all scenarios
 *   - Worst-case scenario: the scenario name that produced the minimum
 *   - Overall status: derived from the worst-case survival threshold
 *   - Recommended action: build-phase constant
 *
 * Build-phase posture: all scenarios at "no-positions" → overallStatus "no-positions".
 */
export function computeILAAPSummary(results: ILAAPScenarioResult[]): ILAAPSummary {
  if (results.length === 0) {
    return {
      worstCaseSurvivalDays: 0,
      worstCaseScenario: "none",
      overallStatus: "no-positions",
      recommendedAction: "Monitor — zero-position baseline until licence-day.",
    };
  }

  const allNoPositions = results.every((r) => r.status === "no-positions");

  const firstResult = results[0];
  // results.length > 0 is checked by the guard above (returns early when empty)
  if (!firstResult) {
    return {
      worstCaseSurvivalDays: 0,
      worstCaseScenario: "none",
      overallStatus: "no-positions",
      recommendedAction: "Monitor — zero-position baseline until licence-day.",
    };
  }

  let worstCaseSurvivalDays = firstResult.survivalHorizonDays;
  let worstCaseScenario = firstResult.scenario;

  for (const result of results) {
    if (result.survivalHorizonDays < worstCaseSurvivalDays) {
      worstCaseSurvivalDays = result.survivalHorizonDays;
      worstCaseScenario = result.scenario;
    }
  }

  const overallStatus = deriveOverallStatus(worstCaseSurvivalDays, allNoPositions);

  return {
    worstCaseSurvivalDays,
    worstCaseScenario,
    overallStatus,
    recommendedAction: "Monitor — zero-position baseline until licence-day.",
  };
}
