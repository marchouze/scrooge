// platform/projections/markets/limit-utilisation-deps.ts
//
// Convenience builder for LimitUtilisationDeps (RAS B3 review R4 / R7).
//
// The limit-utilisation projection itself stays decoupled from the event store
// and the capital / ALM projections — it accepts capital and IR-sensitivity as
// plain numbers. This helper assembles those numbers from the live projections
// for callers that hold the event store (the dashboard). Sim runs and unit
// tests construct LimitUtilisationDeps directly or omit it entirely.
//
// Authors: Rohan (Risk engineer) + Helena (Chief Risk Officer, governance).

import { computeRepricingGap } from "../../alm/repricing-gap";
import type { EventStore } from "../../event-store/store";
import { computeCapitalMetrics } from "../capital-metrics";
import type { LimitUtilisationDeps } from "./limit-utilisation";

/**
 * Build the externally-computed limit inputs from the live projections:
 *   - qualifyingCapitalZar — net qualifying capital (ZAR), denominator for
 *     "pct-capital" rows (the FX-NOP ≤10%-capital line).
 *   - b4IrSensitivityZar — Σ|repricing gap| across BCBS-319 buckets (ZAR), the
 *     B4 IR sensitivity measure that replaces IR notional.
 *
 * Each input is resolved defensively: a throw in either projection leaves that
 * input `undefined`, and the consuming row falls back to its stored limitValue
 * / folded accumulator rather than failing the whole derivation.
 */
export function buildLimitUtilisationDeps(eventStore: EventStore, asOf: string): LimitUtilisationDeps {
  let qualifyingCapitalZar: number | undefined;
  try {
    qualifyingCapitalZar = computeCapitalMetrics(eventStore, asOf).availableCapitalMinor / 100;
  } catch {
    qualifyingCapitalZar = undefined;
  }

  let b4IrSensitivityZar: number | undefined;
  try {
    const gap = computeRepricingGap(eventStore, asOf);
    b4IrSensitivityZar = gap.rows.reduce((sum, r) => sum + Math.abs(r.gapZar), 0);
  } catch {
    b4IrSensitivityZar = undefined;
  }

  return {
    ...(qualifyingCapitalZar !== undefined ? { qualifyingCapitalZar } : {}),
    ...(b4IrSensitivityZar !== undefined ? { b4IrSensitivityZar } : {}),
  };
}
