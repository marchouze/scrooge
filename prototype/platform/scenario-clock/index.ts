// platform/scenario-clock/index.ts
//
// Public surface for the controlled-time substrate (D-SCENARIO-CLOCK,
// authorised under D-FIRST-DRY-RUN-SCENARIO; CEO-approved 2026-05-10).
//
// Author: Atlas (Core banking platform architect, engineering)

export {
  type DurationMs,
  type ScenarioClock,
  type ScenarioClockMode,
  ONE_SECOND_MS,
  ONE_MINUTE_MS,
  ONE_HOUR_MS,
  ONE_DAY_MS,
  T_PLUS_TWO_MS,
  SCENARIO_CLOCK_MODE_ENV,
  SCENARIO_CLOCK_BASELINE_ENV,
  resolveScenarioClockMode,
} from "./types";

export { WallClock } from "./wall-clock";
export { SimulatedClock } from "./simulated-clock";

import { SimulatedClock } from "./simulated-clock";
import {
  SCENARIO_CLOCK_BASELINE_ENV,
  SCENARIO_CLOCK_MODE_ENV,
  type ScenarioClock,
  resolveScenarioClockMode,
} from "./types";
import { WallClock } from "./wall-clock";

/**
 * Resolve the composition-root clock from environment variables.
 *
 *   `BANK_SCENARIO_CLOCK_MODE=wall`        → WallClock (default).
 *   `BANK_SCENARIO_CLOCK_MODE=simulated`   → SimulatedClock initialised
 *                                            to `BANK_SCENARIO_CLOCK_BASELINE`
 *                                            (or `Date.now()` if unset).
 *
 * Used by `platform/composition.ts` to wire `clock` once at boot.
 */
export function resolveCompositionClock(env = process.env): ScenarioClock {
  const mode = resolveScenarioClockMode(env);
  if (mode === "wall") {
    return new WallClock();
  }
  const baseline = env[SCENARIO_CLOCK_BASELINE_ENV];
  if (baseline && baseline.length > 0) {
    return new SimulatedClock(baseline);
  }
  // No explicit baseline → start at the wall-clock instant of boot. The
  // clock then stops moving on its own; scenarios advance() it as needed.
  return new SimulatedClock(new Date().toISOString());
}

// Re-export the env var name in case callers want to set / inspect it
// programmatically (tests, scripts, scenario runners).
export { SCENARIO_CLOCK_MODE_ENV as MODE_ENV, SCENARIO_CLOCK_BASELINE_ENV as BASELINE_ENV };
