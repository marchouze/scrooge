// platform/risk/stress-engine.ts
//
// D-REGULATORY-READINESS-W2-SLICE-4 — stress-projection engine.
//
// Standing authority: D-REGULATORY-READINESS-GATE-PLAN (CEO-approved
// 2026-05-10), pack §3 W2 Slice 4.
//
// This module is a **pure projection** producing a 3-year quarterly
// projection of:
//
//   - CET1 ratio
//   - Tier 1 ratio
//   - Total capital ratio
//   - Leverage ratio
//   - LCR (Liquidity Coverage Ratio)
//   - NSFR (Net Stable Funding Ratio)
//
// for each of four stress scenarios (base / adverse / severely-adverse /
// reverse-stress) per `ORG-PR-12` + Reg 38 / Reg 39 + BCBS Basel III
// ICAAP guidance.
//
// **Pure function; no event side-effects; no document-store writes; no
// event-store reads.** Callers compose the as-of inputs from upstream
// projections (RWA engine — Slice 3; capital stack — BA 100 generator;
// LCR — BA 110 generator; bank-account substrate — D-BANK-ACCOUNT-
// SUBSTRATE) and consume the typed output.
//
// Pipeline (mirrors the rest of the risk substrate):
//
//   EVENT LOG          (Principle 1 — sole truth)
//      → PROJECTION RUNTIME    — folds events into balances + positions
//      → RWA ENGINE (Slice 3)  — current-state RWA decomposition
//      → BA 100 GENERATOR      — current-state capital stack + ratios
//      → BA 110 GENERATOR      — current-state LCR
//      → STRESS ENGINE (this)  — projects current-state forward × scenarios
//      → ICAAP NARRATIVE FEED  — typed shape consumed by Helena's narrative
//      → PILLAR-2 ADD-ON CALC  — derives capital add-on from stress severity
//
// Computation per quarter q for scenario s:
//
//   creditRWA_q     = creditRWA_{q-1} × creditRwaMultiplier_q^(s)
//   marketRWA_q     = marketRWA_{q-1} × marketRwaMultiplier_q^(s)
//   operationalRWA_q = ditto
//   totalRWA_q      = credit + market + operational + cva
//
//   cet1_q  = cet1_{q-1} × cet1Multiplier_q^(s)
//   at1_q   = at1_{q-1}  × at1Multiplier_q^(s)
//   t2_q    = t2_{q-1}   × t2Multiplier_q^(s)
//   tier1_q = cet1_q + at1_q
//   total_q = tier1_q + t2_q
//
//   cet1Ratio_q   = cet1_q  / totalRWA_q
//   tier1Ratio_q  = tier1_q / totalRWA_q
//   totalRatio_q  = total_q / totalRWA_q
//   leverageRatio_q = tier1_q / leverageExposure_q
//   lcr_q         = hqla_q / netCashOutflows_q
//   nsfr_q        = asf_q  / rsf_q
//
// **Reverse-stress** uses bisection: the engine searches for a scalar
// `k ∈ [1, kMax]` such that scaled shocks (1 + k·(shock−1)) drive
// CET1 ratio to the target bind point at q12. Bisection converges in
// ≤ 50 iterations to ±1bp ratio precision (build-phase tolerance).
//
// Per-entity. Bank-licence-bound; only Hoz Bank `LE-ZA-HOZ-BANK` is
// in scope (Hoz Securities + Hoz Group out of scope per
// `D-REGULATORY-PERIMETER`).
//
// Substrate gaps surfaced (forward-link in the decision record):
//   - **Macro shock paths are fixture-grade.** Real PA-published paths
//     arrive when Mira's `WS-INSTRUMENT-ANALYSES` resolves the stress-test
//     framework substream. Engine input-shape is forward-compatible.
//   - **Cross-correlations between RWA and capital stock are linear-
//     multiplicative.** A real ICAAP engine couples them via a P&L
//     projection (revenue → operating profit → retained earnings → CET1)
//     and a credit-loss model (PD migration → ECL → P&L). v0.1 takes
//     direct multipliers; v1.0 will couple them.
//   - **No FX translation overlay** at v0.1 (single functional currency).
//     Multi-currency stress arrives with M-phase markets-substrate.
//   - **No Recovery Plan trigger calibration** here — Slice 6 territory.
//   - **No tax overlay** on stressed P&L — Yael's PAYE / EMP201 / IRP5
//     slice paused build-phase per `Team/_team-roster.json`.
//
// Author: Rohan (Risk engineer, engineering — reports to Helena CRO).

import type { RwaEngineOutput } from "./rwa-engine";
import { RWA_BANK_ENTITIES, RwaEngineError } from "./rwa-engine";
import {
  type QuarterlyShock,
  type ReverseStressTarget,
  STRESS_HORIZON_QUARTERS,
  STRESS_SCENARIO_CITATION_LIST,
  type StressScenario,
  type StressScenarioId,
} from "./stress-scenarios";

// ---------------------------------------------------------------------------
// Inputs — current-state ("as-of-q0") snapshot
// ---------------------------------------------------------------------------

/**
 * Current-state capital stack (from BA 100 generator). Net of regulatory
 * deductions per BCBS Basel III §66–§90 — caller pre-computes deductions.
 * All amounts in functional-currency minor units.
 */
export interface CurrentStateCapital {
  /** Net CET1 stock (gross − CET1 deductions). */
  readonly cet1Minor: number;
  /** Net AT1 stock (gross − AT1 deductions). */
  readonly at1Minor: number;
  /** Net T2 stock (gross − T2 deductions). */
  readonly t2Minor: number;
}

/**
 * Current-state liquidity inputs. Caller supplies from BA 110 generator
 * (LCR) + a (future) BA 310 generator (NSFR). All amounts in functional-
 * currency minor units.
 */
export interface CurrentStateLiquidity {
  /** HQLA stock — LCR numerator (level-1 + haircutted level-2). */
  readonly hqlaMinor: number;
  /** Net cash outflows over 30 days — LCR denominator. */
  readonly netCashOutflows30dMinor: number;
  /** Available Stable Funding — NSFR numerator (1-year horizon). */
  readonly asfMinor: number;
  /** Required Stable Funding — NSFR denominator (1-year horizon). */
  readonly rsfMinor: number;
}

/**
 * Current-state leverage exposure (denominator of leverage ratio).
 * Per BCBS Basel III §159 + Reg 38(15) — on-balance + off-balance + SFTs +
 * derivatives at SA-CCR. Caller pre-computes; engine treats as scalar.
 */
export interface CurrentStateLeverage {
  readonly leverageExposureMinor: number;
}

/**
 * Top-level stress-engine input — bundles the four current-state
 * projections + the scenario bundle + the entity scope.
 */
export interface StressEngineInput {
  /** Legal-entity short-id (`LE-ZA-HOZ-BANK`). Engine throws on non-bank entities. */
  readonly entityId: string;
  /** ISO 8601 — the as-of date (quarter-0) of the projection. */
  readonly asOf: string;
  /** ISO 4217 functional currency. */
  readonly functionalCurrency: string;
  /** Current-state RWA decomposition (Slice 3 RWA-engine output). */
  readonly rwa: RwaEngineOutput;
  /** Current-state capital stack (BA 100 net CET1 / AT1 / T2). */
  readonly capital: CurrentStateCapital;
  /** Current-state liquidity (HQLA + net outflows + ASF + RSF). */
  readonly liquidity: CurrentStateLiquidity;
  /** Current-state leverage exposure. */
  readonly leverage: CurrentStateLeverage;
  /** Scenario bundle to project. Standard bundle is the four canonical scenarios. */
  readonly scenarios: readonly StressScenario[];
  /**
   * Optional: cite the source event_ids (TrialBalanceSnapshotted,
   * RwaComputed, etc.) so downstream consumers can chain-back under
   * Principle 1.
   */
  readonly sourceEventIds?: readonly string[];
}

// ---------------------------------------------------------------------------
// Outputs — per-quarter snapshot + per-scenario projection
// ---------------------------------------------------------------------------

/**
 * One quarter's projected ratios (one row of the projection table).
 * Quarter `0` is the as-of base (no shock applied); quarters `1..12` are
 * progressively stressed per the scenario's per-quarter shocks.
 *
 * Ratios are unit-less (e.g. 0.14 = 14%). Renderers choose display
 * precision (typically 2dp percent).
 */
export interface QuarterlyProjection {
  readonly quarter: number; // 0..12
  readonly cet1Ratio: number;
  readonly tier1Ratio: number;
  readonly totalCapitalRatio: number;
  readonly leverageRatio: number;
  readonly lcr: number;
  readonly nsfr: number;
  /** Underlying stocks (for narrative-data + audit). */
  readonly cet1Minor: number;
  readonly tier1Minor: number;
  readonly totalCapitalMinor: number;
  readonly totalRwaMinor: number;
  readonly leverageExposureMinor: number;
  readonly hqlaMinor: number;
  readonly netCashOutflowsMinor: number;
  readonly asfMinor: number;
  readonly rsfMinor: number;
}

/**
 * One scenario's full projection — `STRESS_HORIZON_QUARTERS + 1`
 * quarterly observations (q0 + q1..q12).
 */
export interface ScenarioProjection {
  readonly scenarioId: StressScenarioId;
  readonly label: string;
  readonly quarterlyProjections: readonly QuarterlyProjection[];
  /** Reverse-stress only: the calibrated scaling factor `k` that bound the target. */
  readonly reverseStressScale?: number;
  /** Reverse-stress only: target metric + bind ratio (echo of input). */
  readonly reverseStressTarget?: ReverseStressTarget;
  /** Reverse-stress only: did bisection converge within tolerance? */
  readonly reverseStressConverged?: boolean;
  /** Worst-quarter snapshot (lowest CET1 ratio across the horizon). */
  readonly worstQuarter: QuarterlyProjection;
  /**
   * Final-quarter snapshot (q12). Convenience for narrative-data; renderers
   * also use the full quarterly array.
   */
  readonly terminalQuarter: QuarterlyProjection;
}

export interface StressEngineOutput {
  readonly meta: {
    readonly engine: "stress-engine";
    readonly engineVersion: "v0.1";
    readonly entityId: string;
    readonly asOf: string;
    readonly functionalCurrency: string;
    readonly horizonQuarters: number;
    readonly sourceEventIds: readonly string[];
  };
  readonly projections: readonly ScenarioProjection[];
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class StressEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StressEngineError";
  }
}

// ---------------------------------------------------------------------------
// Per-entity scope guard
// ---------------------------------------------------------------------------

function assertBankEntity(entityId: string): void {
  if (!RWA_BANK_ENTITIES.includes(entityId)) {
    throw new RwaEngineError(
      `Stress engine: capital-adequacy projection is bank-licence-bound; entity '${entityId}' is not in RWA_BANK_ENTITIES (${RWA_BANK_ENTITIES.join(", ")}). See Regulations/_legal-entity-tree.md + D-REGULATORY-PERIMETER.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateInput(input: StressEngineInput): void {
  if (!input.functionalCurrency || input.functionalCurrency.length !== 3) {
    throw new StressEngineError(
      `Stress engine: functionalCurrency must be ISO-4217 (3 chars), got '${input.functionalCurrency}'`,
    );
  }
  if (input.scenarios.length === 0) {
    throw new StressEngineError("Stress engine: scenarios bundle must be non-empty");
  }
  for (const s of input.scenarios) {
    if (s.quarterlyShocks.length !== STRESS_HORIZON_QUARTERS) {
      throw new StressEngineError(
        `Stress engine: scenario '${s.id}' has ${s.quarterlyShocks.length} quarterly shocks; expected ${STRESS_HORIZON_QUARTERS}`,
      );
    }
  }
  if (input.capital.cet1Minor < 0 || input.capital.at1Minor < 0 || input.capital.t2Minor < 0) {
    throw new StressEngineError(
      `Stress engine: capital stack components must be non-negative (cet1=${input.capital.cet1Minor}, at1=${input.capital.at1Minor}, t2=${input.capital.t2Minor})`,
    );
  }
  if (input.liquidity.netCashOutflows30dMinor <= 0) {
    throw new StressEngineError(
      `Stress engine: netCashOutflows30dMinor must be > 0 (LCR denominator), got ${input.liquidity.netCashOutflows30dMinor}`,
    );
  }
  if (input.liquidity.rsfMinor <= 0) {
    throw new StressEngineError(
      `Stress engine: rsfMinor must be > 0 (NSFR denominator), got ${input.liquidity.rsfMinor}`,
    );
  }
  if (input.leverage.leverageExposureMinor <= 0) {
    throw new StressEngineError(
      `Stress engine: leverageExposureMinor must be > 0 (leverage-ratio denominator), got ${input.leverage.leverageExposureMinor}`,
    );
  }
  if (input.rwa.totalRwaMinor <= 0) {
    throw new StressEngineError(
      `Stress engine: rwa.totalRwaMinor must be > 0 (capital-ratio denominator), got ${input.rwa.totalRwaMinor}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Per-quarter projector
// ---------------------------------------------------------------------------

interface MutableState {
  creditRwaMinor: number;
  marketRwaMinor: number;
  operationalRwaMinor: number;
  cvaRwaMinor: number;
  cet1Minor: number;
  at1Minor: number;
  t2Minor: number;
  leverageExposureMinor: number;
  hqlaMinor: number;
  netCashOutflowsMinor: number;
  asfMinor: number;
  rsfMinor: number;
}

function snapshotQuarter(quarter: number, state: MutableState): QuarterlyProjection {
  const totalRwaMinor =
    state.creditRwaMinor + state.marketRwaMinor + state.operationalRwaMinor + state.cvaRwaMinor;
  const tier1Minor = state.cet1Minor + state.at1Minor;
  const totalCapitalMinor = tier1Minor + state.t2Minor;
  return {
    quarter,
    cet1Ratio: state.cet1Minor / totalRwaMinor,
    tier1Ratio: tier1Minor / totalRwaMinor,
    totalCapitalRatio: totalCapitalMinor / totalRwaMinor,
    leverageRatio: tier1Minor / state.leverageExposureMinor,
    lcr: state.hqlaMinor / state.netCashOutflowsMinor,
    nsfr: state.asfMinor / state.rsfMinor,
    cet1Minor: state.cet1Minor,
    tier1Minor,
    totalCapitalMinor,
    totalRwaMinor,
    leverageExposureMinor: state.leverageExposureMinor,
    hqlaMinor: state.hqlaMinor,
    netCashOutflowsMinor: state.netCashOutflowsMinor,
    asfMinor: state.asfMinor,
    rsfMinor: state.rsfMinor,
  };
}

function applyShock(state: MutableState, shock: QuarterlyShock): void {
  state.creditRwaMinor *= shock.creditRwaMultiplier;
  state.marketRwaMinor *= shock.marketRwaMultiplier;
  state.operationalRwaMinor *= shock.operationalRwaMultiplier;
  // CVA is left flat under stress at v0.1 — Reporting Slice 4 BA 600 owns CVA stress.
  state.cet1Minor *= shock.cet1Multiplier;
  state.at1Minor *= shock.at1Multiplier;
  state.t2Minor *= shock.t2Multiplier;
  state.leverageExposureMinor *= shock.leverageExposureMultiplier;
  state.hqlaMinor *= shock.hqlaMultiplier;
  state.netCashOutflowsMinor *= shock.netCashOutflowsMultiplier;
  state.asfMinor *= shock.asfMultiplier;
  state.rsfMinor *= shock.rsfMultiplier;
}

function buildInitialState(input: StressEngineInput): MutableState {
  return {
    creditRwaMinor: input.rwa.credit.totalMinor,
    marketRwaMinor: input.rwa.market.totalMinor,
    operationalRwaMinor: input.rwa.operational.totalMinor,
    cvaRwaMinor: input.rwa.cvaMinor,
    cet1Minor: input.capital.cet1Minor,
    at1Minor: input.capital.at1Minor,
    t2Minor: input.capital.t2Minor,
    leverageExposureMinor: input.leverage.leverageExposureMinor,
    hqlaMinor: input.liquidity.hqlaMinor,
    netCashOutflowsMinor: input.liquidity.netCashOutflows30dMinor,
    asfMinor: input.liquidity.asfMinor,
    rsfMinor: input.liquidity.rsfMinor,
  };
}

function projectScenario(
  input: StressEngineInput,
  scenario: StressScenario,
): QuarterlyProjection[] {
  const state = buildInitialState(input);
  const projections: QuarterlyProjection[] = [];
  // Q0 — base (no shock applied)
  projections.push(snapshotQuarter(0, state));
  for (let q = 1; q <= STRESS_HORIZON_QUARTERS; q++) {
    const shock = scenario.quarterlyShocks[q - 1];
    if (!shock) {
      throw new StressEngineError(
        `Stress engine: scenario '${scenario.id}' missing shock for quarter ${q}`,
      );
    }
    applyShock(state, shock);
    projections.push(snapshotQuarter(q, state));
  }
  return projections;
}

// ---------------------------------------------------------------------------
// Reverse-stress bisection
// ---------------------------------------------------------------------------

const REVERSE_STRESS_MAX_ITERATIONS = 50;
const REVERSE_STRESS_TOLERANCE_RATIO = 0.0001; // ±1bp ratio precision
const REVERSE_STRESS_K_MAX = 50; // upper bound on shock-multiplier scale

function scaleShock(shock: QuarterlyShock, k: number): QuarterlyShock {
  // Scale around 1.0 — `k=0` ⇒ identity; `k=1` ⇒ shock as authored;
  // `k>1` ⇒ amplified. (1 + k·(m−1))
  const scale = (m: number): number => 1 + k * (m - 1);
  return {
    creditRwaMultiplier: scale(shock.creditRwaMultiplier),
    marketRwaMultiplier: scale(shock.marketRwaMultiplier),
    operationalRwaMultiplier: scale(shock.operationalRwaMultiplier),
    cet1Multiplier: scale(shock.cet1Multiplier),
    at1Multiplier: scale(shock.at1Multiplier),
    t2Multiplier: scale(shock.t2Multiplier),
    leverageExposureMultiplier: scale(shock.leverageExposureMultiplier),
    hqlaMultiplier: scale(shock.hqlaMultiplier),
    netCashOutflowsMultiplier: scale(shock.netCashOutflowsMultiplier),
    asfMultiplier: scale(shock.asfMultiplier),
    rsfMultiplier: scale(shock.rsfMultiplier),
  };
}

function projectScaledScenario(
  input: StressEngineInput,
  scenario: StressScenario,
  k: number,
): QuarterlyProjection[] {
  const state = buildInitialState(input);
  const projections: QuarterlyProjection[] = [];
  projections.push(snapshotQuarter(0, state));
  for (let q = 1; q <= STRESS_HORIZON_QUARTERS; q++) {
    const baseShock = scenario.quarterlyShocks[q - 1];
    if (!baseShock) {
      throw new StressEngineError(
        `Stress engine: scenario '${scenario.id}' missing shock for quarter ${q}`,
      );
    }
    applyShock(state, scaleShock(baseShock, k));
    projections.push(snapshotQuarter(q, state));
  }
  return projections;
}

interface ReverseStressResult {
  readonly scale: number;
  readonly converged: boolean;
  readonly projections: readonly QuarterlyProjection[];
}

function runReverseStress(
  input: StressEngineInput,
  scenario: StressScenario,
  target: ReverseStressTarget,
): ReverseStressResult {
  // Sanity: at k=0, CET1 ratio is unstressed (current state). At k=K_MAX it
  // should be deeply below the bind. Bisection finds k* such that
  // terminal CET1 ratio ≈ bindRatio.

  const evalAtK = (
    k: number,
  ): { readonly projections: QuarterlyProjection[]; readonly terminalCet1: number } => {
    const projections = projectScaledScenario(input, scenario, k);
    const terminal = projections[projections.length - 1];
    if (!terminal) {
      throw new StressEngineError(
        `Stress engine: reverse stress projection empty for scenario '${scenario.id}'`,
      );
    }
    return { projections, terminalCet1: terminal.cet1Ratio };
  };

  let lo = 0;
  let hi = REVERSE_STRESS_K_MAX;
  const lowEval = evalAtK(lo);
  const highEval = evalAtK(hi);

  // If even at k=0 we are below the bind, we are already in breach — return
  // k=0 with `converged: true` and a flag.
  if (lowEval.terminalCet1 <= target.bindRatio) {
    return { scale: 0, converged: true, projections: lowEval.projections };
  }
  // If even at k_max we are above the bind, the scenario direction is too
  // weak to bind — return k_max with `converged: false`.
  if (highEval.terminalCet1 > target.bindRatio) {
    return { scale: hi, converged: false, projections: highEval.projections };
  }

  let lastProjections = highEval.projections;
  let lastK = hi;

  for (let iter = 0; iter < REVERSE_STRESS_MAX_ITERATIONS; iter++) {
    const mid = (lo + hi) / 2;
    const midEval = evalAtK(mid);
    lastProjections = midEval.projections;
    lastK = mid;

    if (Math.abs(midEval.terminalCet1 - target.bindRatio) < REVERSE_STRESS_TOLERANCE_RATIO) {
      return { scale: mid, converged: true, projections: midEval.projections };
    }
    if (midEval.terminalCet1 > target.bindRatio) {
      // Still above bind — need more shock
      lo = mid;
    } else {
      // Below bind — pull back
      hi = mid;
    }
  }
  return { scale: lastK, converged: false, projections: lastProjections };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Compute a 3-year quarterly projection of capital + leverage + liquidity
 * ratios for each scenario. Pure function; deterministic.
 *
 * @throws {StressEngineError | RwaEngineError} on bank-entity scope
 *   violation, invalid scenario shape, or non-positive denominators.
 */
export function projectStress(input: StressEngineInput): StressEngineOutput {
  assertBankEntity(input.entityId);
  validateInput(input);

  const projections: ScenarioProjection[] = [];
  const placeholders = new Set<string>([
    "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact PA-published macro forecast paths; build-phase fixture in use]",
    "[stress-engine v0.1 — RWA / capital coupling is linear-multiplicative; v1.0 will couple via P&L projection + credit-loss model]",
  ]);

  for (const scenario of input.scenarios) {
    let quarterlyProjections: QuarterlyProjection[];
    let reverseStressScale: number | undefined;
    let reverseStressConverged: boolean | undefined;

    if (scenario.reverseStressTarget) {
      const r = runReverseStress(input, scenario, scenario.reverseStressTarget);
      quarterlyProjections = [...r.projections];
      reverseStressScale = r.scale;
      reverseStressConverged = r.converged;
    } else {
      quarterlyProjections = projectScenario(input, scenario);
    }

    for (const p of scenario.placeholders) placeholders.add(p);

    if (quarterlyProjections.length === 0) {
      throw new StressEngineError(
        `Stress engine: scenario '${scenario.id}' produced empty projection`,
      );
    }
    const worst = quarterlyProjections.reduce((acc, p) => (p.cet1Ratio < acc.cet1Ratio ? p : acc));
    const terminal = quarterlyProjections[quarterlyProjections.length - 1];
    if (!terminal) {
      throw new StressEngineError(
        `Stress engine: scenario '${scenario.id}' missing terminal projection`,
      );
    }

    const projection: ScenarioProjection = {
      scenarioId: scenario.id,
      label: scenario.label,
      quarterlyProjections,
      ...(reverseStressScale !== undefined ? { reverseStressScale } : {}),
      ...(scenario.reverseStressTarget
        ? { reverseStressTarget: scenario.reverseStressTarget }
        : {}),
      ...(reverseStressConverged !== undefined ? { reverseStressConverged } : {}),
      worstQuarter: worst,
      terminalQuarter: terminal,
    };
    projections.push(projection);
  }

  return {
    meta: {
      engine: "stress-engine",
      engineVersion: "v0.1",
      entityId: input.entityId,
      asOf: input.asOf,
      functionalCurrency: input.functionalCurrency,
      horizonQuarters: STRESS_HORIZON_QUARTERS,
      sourceEventIds: [...(input.sourceEventIds ?? [])],
    },
    projections,
    citations: [
      "D-REGULATORY-READINESS-GATE-PLAN",
      "D-REGULATORY-READINESS-W2-SLICE-4",
      ...STRESS_SCENARIO_CITATION_LIST,
    ],
    placeholders: [...placeholders].sort(),
  };
}

/**
 * Convenience facade — mirrors the Slice-3 RWA-engine surface
 * (`rwaEngine.compute(...)`).
 */
export const stressEngine = {
  /** Project capital + leverage + liquidity ratios across scenarios. */
  project: projectStress,
} as const;
