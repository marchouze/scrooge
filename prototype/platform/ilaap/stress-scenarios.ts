// platform/ilaap/stress-scenarios.ts
//
// ILAAP (Internal Liquidity Adequacy Assessment Process) stress scenarios.
//
// Four standard scenarios aligned with PA / SARB ILAAP guidance:
//   1. Idiosyncratic — bank-specific stress (reputational / name-specific run)
//   2. Market-wide   — systemic market stress (flight to quality)
//   3. Combined      — simultaneous idiosyncratic + market-wide (worst-case)
//   4. Reverse-stress — binary-search for outflow multiplier that exhausts HQLA
//                        within 30 days (regulatory requirement: plausible failure)
//
// Each scenario (except reverse-stress) computes:
//   - stressedHQLAZar           = base HQLA × (1 − additional HQLA haircut)
//   - stressedNetOutflow30dZar  = base net outflow × outflow uplift factor
//   - survivalHorizonDays       = stressedHQLAZar / daily_outflow_rate, capped 365
//   - stressedLCRPct            = re-run LCR with stressed positions
//   - status                    = adequate / marginal / inadequate / no-positions
//
// For reverse-stress:
//   Binary-search the outflow multiplier (1.0×–5.0×) such that survival = 30 days.
//   If base HQLA = 0: survivalHorizonDays = 0.
//
// Build-phase posture:
//   Zero real positions → base HQLA = 0 → all scenarios return "no-positions".
//
// Authority: D-TREASURY-GAPS-WAVE1; Banks Act 94/1990; BA 325; PA ILAAP guidance.
// Author: Atlas (Core banking platform architect, engineering)

import { computeLCR } from "../liquidity/lcr";
import type { FundingPosition, HQLAPosition } from "../liquidity/lcr";

// ---------------------------------------------------------------------------
// Scenario type
// ---------------------------------------------------------------------------

export type ILAAPScenario = "idiosyncratic" | "market-wide" | "combined" | "reverse-stress";

// ---------------------------------------------------------------------------
// Scenario calibration parameters
// ---------------------------------------------------------------------------

interface ScenarioParams {
  /** Multiplier applied to the base net outflow (e.g. 1.30 = +30% outflow uplift). */
  outflowUpliftFactor: number;
  /** Fraction by which stressed inflows are reduced (e.g. 0.25 = −25% inflow reduction). */
  inflowReductionFactor: number;
  /** Additional HQLA haircut applied on top of base BA 325 haircuts (e.g. 0.05 = +5%). */
  additionalHQLAHaircutFactor: number;
}

const SCENARIO_PARAMS: Record<Exclude<ILAAPScenario, "reverse-stress">, ScenarioParams> = {
  idiosyncratic: {
    outflowUpliftFactor: 1.3,
    inflowReductionFactor: 0.25,
    additionalHQLAHaircutFactor: 0.05,
  },
  "market-wide": {
    outflowUpliftFactor: 1.15,
    inflowReductionFactor: 0.1,
    additionalHQLAHaircutFactor: 0.0,
  },
  combined: {
    outflowUpliftFactor: 1.35,
    inflowReductionFactor: 0.3,
    additionalHQLAHaircutFactor: 0.1,
  },
};

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type ILAAPStatus = "adequate" | "marginal" | "inadequate" | "no-positions";

export interface ILAAPScenarioResult {
  scenario: ILAAPScenario;
  /** Post-additional-haircut HQLA in ZAR. */
  stressedHQLAZar: number;
  /** Stressed net 30-day outflow in ZAR. */
  stressedNetOutflow30dZar: number;
  /** Days the stressed HQLA buffer covers stressed outflows; capped at 365. */
  survivalHorizonDays: number;
  /** LCR percentage under the stressed scenario. Null when no positions (or stress uncomputable). */
  stressedLCRPct: number | null;
  /** Status relative to the 30-day survival threshold. */
  status: ILAAPStatus;
  /** For reverse-stress only: the outflow multiplier at which survival = 30 days. */
  reverseStressOutflowMultiplier?: number;
}

// ---------------------------------------------------------------------------
// Inputs accepted by the runner
// ---------------------------------------------------------------------------

export interface ILAAPRunInputs {
  /** Post-haircut HQLA stock from the collateral inventory (CollateralInventoryResult). */
  baseHQLAZar: number;
  /** L1, L2a, L2b breakdown for stressed LCR re-computation. */
  hqlaPositions: HQLAPosition[];
  /** 30-day net outflow from the latest LCRComputed event. */
  baseNetOutflow30dZar: number;
  /** Full funding positions for LCR re-computation under stress. */
  fundingPositions: FundingPosition[];
}

// ---------------------------------------------------------------------------
// Status classification
// ---------------------------------------------------------------------------

function classifyStatus(survivalHorizonDays: number, baseHQLAZar: number): ILAAPStatus {
  if (baseHQLAZar === 0) return "no-positions";
  if (survivalHorizonDays < 15) return "inadequate";
  if (survivalHorizonDays <= 30) return "marginal";
  return "adequate";
}

// ---------------------------------------------------------------------------
// Single scenario computation
// ---------------------------------------------------------------------------

function computeScenario(
  scenario: Exclude<ILAAPScenario, "reverse-stress">,
  inputs: ILAAPRunInputs,
): ILAAPScenarioResult {
  const params = SCENARIO_PARAMS[scenario];

  // Build-phase early exit: no HQLA
  if (inputs.baseHQLAZar === 0) {
    return {
      scenario,
      stressedHQLAZar: 0,
      stressedNetOutflow30dZar: 0,
      survivalHorizonDays: 0,
      stressedLCRPct: null,
      status: "no-positions",
    };
  }

  // 1. Stressed HQLA — apply additional scenario haircut to base HQLA
  const stressedHQLAZar = inputs.baseHQLAZar * (1 - params.additionalHQLAHaircutFactor);

  // 2. Stressed net outflow
  const stressedNetOutflow30dZar = inputs.baseNetOutflow30dZar * params.outflowUpliftFactor;

  // 3. Survival horizon
  let survivalHorizonDays: number;
  if (stressedNetOutflow30dZar <= 0) {
    // No real outflows: effectively infinite — cap at 365
    survivalHorizonDays = 365;
  } else {
    const dailyOutflow = stressedNetOutflow30dZar / 30;
    survivalHorizonDays = Math.min(stressedHQLAZar / dailyOutflow, 365);
  }

  // 4. Stressed LCR — re-run LCR engine with stressed positions
  //    Apply outflow uplift to outflow funding positions;
  //    Apply inflow reduction to inflow funding positions;
  //    Apply additional HQLA haircut to HQLA positions.
  const stressedFundingPositions: FundingPosition[] = inputs.fundingPositions.map((pos) => {
    if (pos.category.startsWith("inflow-")) {
      return {
        ...pos,
        amountZar: pos.amountZar * (1 - params.inflowReductionFactor),
      };
    }
    return {
      ...pos,
      amountZar: pos.amountZar * params.outflowUpliftFactor,
    };
  });

  // Scale HQLA positions by (1 - additional haircut) to represent stressed HQLA
  const stressedHQLAPositions: HQLAPosition[] = inputs.hqlaPositions.map((pos) => ({
    ...pos,
    amountZar: pos.amountZar * (1 - params.additionalHQLAHaircutFactor),
  }));

  const lcrResult = computeLCR(stressedHQLAPositions, stressedFundingPositions);
  const stressedLCRPct = lcrResult.lcrRatioPct;

  const status = classifyStatus(survivalHorizonDays, inputs.baseHQLAZar);

  return {
    scenario,
    stressedHQLAZar,
    stressedNetOutflow30dZar,
    survivalHorizonDays,
    stressedLCRPct,
    status,
  };
}

// ---------------------------------------------------------------------------
// Reverse-stress scenario
// ---------------------------------------------------------------------------

function computeReverseStress(inputs: ILAAPRunInputs): ILAAPScenarioResult {
  if (inputs.baseHQLAZar === 0) {
    return {
      scenario: "reverse-stress",
      stressedHQLAZar: 0,
      stressedNetOutflow30dZar: 0,
      survivalHorizonDays: 0,
      stressedLCRPct: null,
      status: "no-positions",
      reverseStressOutflowMultiplier: 1.0,
    };
  }

  // Binary-search for outflow multiplier in [1.0, 5.0] that yields survival = 30 days.
  // survival = HQLA / (netOutflow30d * multiplier / 30) = 30
  //   → netOutflow30d * multiplier / 30 = HQLA / 30
  //   → multiplier = HQLA / netOutflow30d
  // If netOutflow30d <= 0: survival is always ≥ 30; use max multiplier (5.0)
  const SURVIVAL_TARGET = 30;
  const MULTIPLIER_MIN = 1.0;
  const MULTIPLIER_MAX = 5.0;
  const BINARY_SEARCH_ITERATIONS = 50;

  let multiplier: number;

  if (inputs.baseNetOutflow30dZar <= 0) {
    // No base outflow — survival can never be exhausted; return max multiplier as sentinel
    multiplier = MULTIPLIER_MAX;
  } else {
    // Analytical solution: survival(m) = HQLA / (netOutflow * m / 30) = 30
    // → m = HQLA / (netOutflow30d * SURVIVAL_TARGET / 30) = HQLA / netOutflow30d
    const analyticalMultiplier = inputs.baseHQLAZar / inputs.baseNetOutflow30dZar;
    multiplier = Math.max(MULTIPLIER_MIN, Math.min(MULTIPLIER_MAX, analyticalMultiplier));

    // Refine with binary search to handle any edge cases
    let lo = MULTIPLIER_MIN;
    let hi = MULTIPLIER_MAX;

    for (let i = 0; i < BINARY_SEARCH_ITERATIONS; i++) {
      const mid = (lo + hi) / 2;
      const dailyOutflow = (inputs.baseNetOutflow30dZar * mid) / 30;
      const survival = inputs.baseHQLAZar / dailyOutflow;

      if (Math.abs(survival - SURVIVAL_TARGET) < 0.001) {
        multiplier = mid;
        break;
      }

      if (survival > SURVIVAL_TARGET) {
        // Need higher multiplier to bring survival down
        lo = mid;
      } else {
        hi = mid;
      }
      multiplier = (lo + hi) / 2;
    }
  }

  const stressedNetOutflow30dZar = inputs.baseNetOutflow30dZar * multiplier;
  const dailyOutflow = stressedNetOutflow30dZar > 0 ? stressedNetOutflow30dZar / 30 : 0;
  const survivalHorizonDays =
    dailyOutflow > 0 ? Math.min(inputs.baseHQLAZar / dailyOutflow, 365) : 365;

  // No additional HQLA haircut for reverse-stress (we're looking at outflow side)
  const lcrResult = computeLCR(inputs.hqlaPositions, inputs.fundingPositions);
  const stressedLCRPct = lcrResult.lcrRatioPct;

  const status = classifyStatus(survivalHorizonDays, inputs.baseHQLAZar);

  return {
    scenario: "reverse-stress",
    stressedHQLAZar: inputs.baseHQLAZar,
    stressedNetOutflow30dZar,
    survivalHorizonDays,
    stressedLCRPct,
    status,
    reverseStressOutflowMultiplier: multiplier,
  };
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

/**
 * Run all four ILAAP stress scenarios.
 *
 * Reads base HQLA and net outflow data from inputs (which come from the
 * collateral inventory and LCR computation events respectively).
 *
 * Build-phase posture: zero positions → all scenarios return "no-positions".
 *
 * @param _asOf  ISO date string (informational; scenarios are point-in-time)
 * @param inputs Pre-loaded base data (HQLA, outflow positions)
 * @returns Array of 4 scenario results
 */
export function runILAAPStressScenarios(
  _asOf: string,
  inputs: ILAAPRunInputs,
): ILAAPScenarioResult[] {
  return [
    computeScenario("idiosyncratic", inputs),
    computeScenario("market-wide", inputs),
    computeScenario("combined", inputs),
    computeReverseStress(inputs),
  ];
}

/**
 * Build ILAAPRunInputs from raw numbers (no positions available).
 * Useful for build-phase testing with aggregate figures from events.
 */
export function makeILAAPRunInputs(
  baseHQLAZar: number,
  baseNetOutflow30dZar: number,
  hqlaPositions: HQLAPosition[] = [],
  fundingPositions: FundingPosition[] = [],
): ILAAPRunInputs {
  return { baseHQLAZar, baseNetOutflow30dZar, hqlaPositions, fundingPositions };
}
