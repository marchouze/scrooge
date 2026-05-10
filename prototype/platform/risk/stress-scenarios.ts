// platform/risk/stress-scenarios.ts
//
// D-REGULATORY-READINESS-W2-SLICE-4 — stress scenario definitions.
//
// Standing authority: D-REGULATORY-READINESS-GATE-PLAN (CEO-approved
// 2026-05-10), pack §3 W2 Slice 4.
//
// Defines the four stress scenarios required by `ORG-PR-12` (Stress-
// testing framework — Reg 39 + BCBS 2018 stress-testing principles) and
// Reg 38 / BCBS Basel III ICAAP guidance:
//
//   1. base               — central forecast (typically PA-published macro path)
//   2. adverse            — moderate downturn
//   3. severely-adverse   — severe downturn
//   4. reverse-stress     — what scenario would breach minimums + buffer
//
// Each scenario is a typed bundle of macro shocks expressed as
// per-quarter multipliers / additive shifts that the stress-projection
// engine applies to current-state inputs (RWA components, capital stack,
// LCR / NSFR drivers).
//
// **Build-phase posture** (per `project_rules_bind_at_commencement`):
// shock paths here are **fixture-grade** — placeholder shocks calibrated
// to BCBS-style "moderate" / "severe" downturn shapes, not the SARB
// PA-published macroprudential paths. Real PA-published paths arrive
// when Mira's `WS-INSTRUMENT-ANALYSES` resolves the stress-test framework
// substream. The engine's input-shape is forward-compatible — when the
// real paths land, callers swap the scenario bundle without re-keying
// the engine.
//
// Citation chain (Principle 2):
//   - Banks Act 94 of 1990 §70 + §72 (capital adequacy + ICAAP)
//   - Regulations Relating to Banks Reg 38 + Reg 39 (stress testing)
//   - BCBS Basel III ICAAP guidance + 2018 stress-testing principles
//   - `ORG-PR-12` (Stress-testing framework — Reg 39 + BCBS)
//   - `ORG-PR-04` (RAS B2 — CET1 management buffer; informs reverse-
//     stress reach-target)
//
// Author: Rohan (Risk engineer, engineering — reports to Helena CRO).

// ---------------------------------------------------------------------------
// Citations
// ---------------------------------------------------------------------------

export const STRESS_SCENARIO_CITATIONS = {
  banksAct: "BANKS-ACT-94-1990",
  reg38: "REG-RELATING-TO-BANKS-REG-38",
  reg39: "REG-RELATING-TO-BANKS-REG-39",
  basel3Icaap: "BCBS-BASEL-III-ICAAP",
  basel3StressPrinciples: "BCBS-2018-STRESS-TESTING-PRINCIPLES",
  orgPr12: "ORG-PR-12",
  orgPr04: "ORG-PR-04",
} as const;

export const STRESS_SCENARIO_CITATION_LIST: readonly string[] = [
  STRESS_SCENARIO_CITATIONS.banksAct,
  STRESS_SCENARIO_CITATIONS.reg38,
  STRESS_SCENARIO_CITATIONS.reg39,
  STRESS_SCENARIO_CITATIONS.basel3Icaap,
  STRESS_SCENARIO_CITATIONS.basel3StressPrinciples,
  STRESS_SCENARIO_CITATIONS.orgPr12,
  STRESS_SCENARIO_CITATIONS.orgPr04,
];

// ---------------------------------------------------------------------------
// Horizon
// ---------------------------------------------------------------------------

/**
 * Standard ICAAP / stress horizon: 3 years quarterly = 12 quarters.
 * Quarter `0` is the as-of base. Quarters `1..12` are projected forward.
 * The engine returns `13` ratio observations per scenario (q0 + q1..q12).
 */
export const STRESS_HORIZON_QUARTERS = 12;

// ---------------------------------------------------------------------------
// Scenario shock shape
// ---------------------------------------------------------------------------

export type StressScenarioId =
  | "base"
  | "adverse"
  | "severely-adverse"
  | "reverse-stress";

/**
 * Per-quarter shock for one stress scenario. All multipliers are
 * applied **cumulatively** to the as-of-q0 input (the engine
 * compounds them across quarters; per-quarter shocks here are the
 * incremental shape, not the cumulative path).
 *
 * Convention:
 *   - `*Multiplier` fields are unit-less ratios (1.0 = no change;
 *     1.05 = +5% growth this quarter; 0.97 = −3% contraction).
 *   - `*ShiftPct` fields are additive percentage-point shifts
 *     (0 = no change; +0.5 = +50bp; −0.25 = −25bp).
 *
 * Each scenario's `quarterlyShocks` array MUST be exactly
 * `STRESS_HORIZON_QUARTERS` long.
 */
export interface QuarterlyShock {
  /**
   * Multiplier on credit RWA (driven by PD migration + EAD growth +
   * collateral haircuts). Severely-adverse runs typically push this
   * 1.10–1.25 cumulatively over 3 years.
   */
  readonly creditRwaMultiplier: number;
  /**
   * Multiplier on market RWA (driven by volatility expansion + position-
   * book mark-to-market). Severely-adverse can push 1.15–1.40.
   */
  readonly marketRwaMultiplier: number;
  /**
   * Multiplier on operational RWA (driven by op-loss-event tail growth +
   * BI compression). Modest-to-flat in most scenarios.
   */
  readonly operationalRwaMultiplier: number;
  /**
   * Multiplier on net CET1 stock (driven by retained-earnings shock —
   * loan-loss provisions + market-loss + revenue compression). Severely-
   * adverse cumulative: 0.85–0.95 (i.e. 5–15% capital erosion over horizon).
   */
  readonly cet1Multiplier: number;
  /** Multiplier on AT1 stock (typically constant absent calls / new issuance). */
  readonly at1Multiplier: number;
  /** Multiplier on T2 stock (typically constant absent amortisation cliff). */
  readonly t2Multiplier: number;
  /**
   * Multiplier on leverage exposure (denominator of leverage ratio).
   * Tracks balance-sheet expansion / contraction.
   */
  readonly leverageExposureMultiplier: number;
  /**
   * Multiplier on HQLA stock (LCR numerator). Severely-adverse runs
   * compress HQLA via mark-to-market on level-2 + outflow drain.
   */
  readonly hqlaMultiplier: number;
  /**
   * Multiplier on net cash outflows (LCR denominator). Severely-adverse
   * spikes outflows via deposit-flight + drawdowns.
   */
  readonly netCashOutflowsMultiplier: number;
  /**
   * Multiplier on Available Stable Funding (NSFR numerator).
   */
  readonly asfMultiplier: number;
  /**
   * Multiplier on Required Stable Funding (NSFR denominator).
   */
  readonly rsfMultiplier: number;
}

export interface StressScenario {
  readonly id: StressScenarioId;
  readonly label: string;
  readonly description: string;
  /** Exactly `STRESS_HORIZON_QUARTERS` entries. */
  readonly quarterlyShocks: readonly QuarterlyShock[];
  /**
   * Reverse-stress only: target metric to bind. The engine searches for
   * the cumulative shock magnitude that drives this metric to its
   * regulatory minimum + buffer. For other scenarios this is `undefined`.
   */
  readonly reverseStressTarget?: ReverseStressTarget;
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

export type ReverseStressTarget = {
  readonly metric: "cet1Ratio";
  /** Target ratio at which to declare breach (e.g. PA min = 0.045 = 4.5%). */
  readonly bindRatio: number;
};

// ---------------------------------------------------------------------------
// Helpers — build a flat per-quarter shape from a 3-year cumulative
// ---------------------------------------------------------------------------

/**
 * Distribute a 3-year cumulative multiplier evenly across 12 quarters
 * via geometric mean. `cumulative^(1/12)` per quarter ⇒ compounding
 * to `cumulative` at q12.
 */
function evenQuarterly(cumulative: number): number {
  return cumulative ** (1 / STRESS_HORIZON_QUARTERS);
}

function constantShock(args: {
  readonly creditRwaCumulative: number;
  readonly marketRwaCumulative: number;
  readonly operationalRwaCumulative: number;
  readonly cet1Cumulative: number;
  readonly at1Cumulative?: number;
  readonly t2Cumulative?: number;
  readonly leverageExposureCumulative: number;
  readonly hqlaCumulative: number;
  readonly netCashOutflowsCumulative: number;
  readonly asfCumulative: number;
  readonly rsfCumulative: number;
}): readonly QuarterlyShock[] {
  const shock: QuarterlyShock = {
    creditRwaMultiplier: evenQuarterly(args.creditRwaCumulative),
    marketRwaMultiplier: evenQuarterly(args.marketRwaCumulative),
    operationalRwaMultiplier: evenQuarterly(args.operationalRwaCumulative),
    cet1Multiplier: evenQuarterly(args.cet1Cumulative),
    at1Multiplier: evenQuarterly(args.at1Cumulative ?? 1.0),
    t2Multiplier: evenQuarterly(args.t2Cumulative ?? 1.0),
    leverageExposureMultiplier: evenQuarterly(args.leverageExposureCumulative),
    hqlaMultiplier: evenQuarterly(args.hqlaCumulative),
    netCashOutflowsMultiplier: evenQuarterly(args.netCashOutflowsCumulative),
    asfMultiplier: evenQuarterly(args.asfCumulative),
    rsfMultiplier: evenQuarterly(args.rsfCumulative),
  };
  return Array.from({ length: STRESS_HORIZON_QUARTERS }, () => shock);
}

// ---------------------------------------------------------------------------
// Fixture-grade scenario bundle — build-phase placeholder
// ---------------------------------------------------------------------------

/**
 * Base scenario — central forecast. Modest balance-sheet growth, modest
 * RWA expansion, retained-earnings accumulation lifts CET1 stock.
 *
 * 3-year cumulative posture (illustrative, build-phase):
 *   - Credit RWA       +10%   (book growth)
 *   - Market RWA       +5%    (modest position-book expansion)
 *   - Operational RWA  +8%    (BI growth via revenue)
 *   - CET1 stock       +12%   (retained earnings net of dividend)
 *   - Leverage exposure +10%
 *   - HQLA             +8%
 *   - Net cash outflows +5%
 *   - ASF              +10%
 *   - RSF              +8%
 *
 * Effect: CET1 ratio mildly improving (numerator grows faster than
 * denominator); LCR + NSFR mildly improving.
 */
export const BASE_SCENARIO: StressScenario = {
  id: "base",
  label: "Base — central forecast",
  description:
    "Central macro forecast — modest growth in book + RWA, retained earnings accumulate. Build-phase placeholder pending PA-published macro path.",
  quarterlyShocks: constantShock({
    creditRwaCumulative: 1.1,
    marketRwaCumulative: 1.05,
    operationalRwaCumulative: 1.08,
    cet1Cumulative: 1.12,
    leverageExposureCumulative: 1.1,
    hqlaCumulative: 1.08,
    netCashOutflowsCumulative: 1.05,
    asfCumulative: 1.1,
    rsfCumulative: 1.08,
  }),
  citations: [STRESS_SCENARIO_CITATION_LIST[0]!, STRESS_SCENARIO_CITATIONS.orgPr12],
  placeholders: [
    "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact PA-published macro forecast path; build-phase fixture in use]",
  ],
};

/**
 * Adverse scenario — moderate downturn. Modest credit-quality
 * deterioration, modest market-stress, single-digit revenue compression.
 *
 * 3-year cumulative posture (illustrative):
 *   - Credit RWA       +15%   (PD migration; EAD grows on revolvers)
 *   - Market RWA       +20%   (vol expansion)
 *   - Operational RWA  +5%    (BI compression offsets op-loss tail)
 *   - CET1 stock       +2%    (revenue compression net of provisions)
 *   - Leverage exposure +8%
 *   - HQLA             −5%    (mark-to-market level-2)
 *   - Net cash outflows +15%  (deposit migration, drawdown utilisation)
 *   - ASF              −3%
 *   - RSF              +5%
 */
export const ADVERSE_SCENARIO: StressScenario = {
  id: "adverse",
  label: "Adverse — moderate downturn",
  description:
    "Moderate downturn — credit-quality deterioration, vol expansion, single-digit revenue compression. Build-phase fixture per `ORG-PR-12`.",
  quarterlyShocks: constantShock({
    creditRwaCumulative: 1.15,
    marketRwaCumulative: 1.2,
    operationalRwaCumulative: 1.05,
    cet1Cumulative: 1.02,
    leverageExposureCumulative: 1.08,
    hqlaCumulative: 0.95,
    netCashOutflowsCumulative: 1.15,
    asfCumulative: 0.97,
    rsfCumulative: 1.05,
  }),
  citations: [STRESS_SCENARIO_CITATIONS.reg39, STRESS_SCENARIO_CITATIONS.orgPr12],
  placeholders: [
    "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact PA-published adverse macro path; build-phase fixture in use]",
  ],
};

/**
 * Severely-adverse scenario — severe downturn. Significant credit-loss
 * amplification, sharp market-stress, double-digit revenue compression,
 * deposit-flight pressure on liquidity.
 *
 * 3-year cumulative posture (illustrative — the BCBS reference shape
 * for severely-adverse stress):
 *   - Credit RWA       +25%   (sharp PD migration; default-stage rises)
 *   - Market RWA       +35%   (vol explosion; specific-risk amplification)
 *   - Operational RWA  +12%   (op-loss tail crystallises)
 *   - CET1 stock       −10%   (loss-absorption draws stock down)
 *   - Leverage exposure +5%   (book contracts as risk-off bites)
 *   - HQLA             −15%   (level-2 mark-down + monetisation)
 *   - Net cash outflows +30%  (run on uninsured deposits)
 *   - ASF              −10%   (wholesale-funding flight)
 *   - RSF              +12%
 */
export const SEVERELY_ADVERSE_SCENARIO: StressScenario = {
  id: "severely-adverse",
  label: "Severely-adverse — severe downturn",
  description:
    "Severe downturn — sharp credit-loss amplification, vol explosion, double-digit revenue compression, deposit-flight liquidity stress. BCBS reference severely-adverse shape (build-phase fixture per `ORG-PR-12`).",
  quarterlyShocks: constantShock({
    creditRwaCumulative: 1.25,
    marketRwaCumulative: 1.35,
    operationalRwaCumulative: 1.12,
    cet1Cumulative: 0.9,
    leverageExposureCumulative: 1.05,
    hqlaCumulative: 0.85,
    netCashOutflowsCumulative: 1.3,
    asfCumulative: 0.9,
    rsfCumulative: 1.12,
  }),
  citations: [STRESS_SCENARIO_CITATIONS.reg39, STRESS_SCENARIO_CITATIONS.basel3StressPrinciples],
  placeholders: [
    "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact PA-published severely-adverse macro path; build-phase fixture in use]",
  ],
};

/**
 * Reverse-stress scenario — search for the cumulative shock magnitude
 * that drives CET1 ratio to PA-min (4.5%). The shock SHAPE is the
 * severely-adverse direction (capital erosion + RWA inflation); the
 * MAGNITUDE is calibrated by the engine via line-search to bind at the
 * target ratio.
 *
 * Per BCBS Basel III ICAAP guidance: reverse stress is RUN BACKWARDS —
 * specify the breach point (CET1 = PA min), let the engine compute the
 * shock multiplier required.
 *
 * Quarterly-shock array here is the **direction unit** (cumulative
 * 3-year shape that erodes CET1 ratio by ~1pp from the start). The
 * engine's `runReverseStress` then scales the shock by a factor `k`
 * (the search variable) to bind the target.
 */
export const REVERSE_STRESS_SCENARIO: StressScenario = {
  id: "reverse-stress",
  label: "Reverse-stress — search for breach",
  description:
    "Reverse stress per BCBS — runs backwards: specify the breach (CET1 = PA min 4.5%), the engine computes the shock multiplier required. Direction shape mirrors severely-adverse; magnitude calibrated via line-search.",
  quarterlyShocks: constantShock({
    creditRwaCumulative: 1.2,
    marketRwaCumulative: 1.25,
    operationalRwaCumulative: 1.08,
    cet1Cumulative: 0.95,
    leverageExposureCumulative: 1.05,
    hqlaCumulative: 0.9,
    netCashOutflowsCumulative: 1.2,
    asfCumulative: 0.95,
    rsfCumulative: 1.08,
  }),
  reverseStressTarget: {
    metric: "cet1Ratio",
    bindRatio: 0.045, // PA-min CET1 per Reg 38 / BCBS Basel III
  },
  citations: [STRESS_SCENARIO_CITATIONS.basel3Icaap, STRESS_SCENARIO_CITATIONS.basel3StressPrinciples],
  placeholders: [
    "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact PA-published reverse-stress framework; build-phase fixture in use]",
  ],
};

/**
 * The standard four-scenario bundle required by `ORG-PR-12` + Reg 38 +
 * BCBS Basel III ICAAP guidance.
 */
export const STANDARD_STRESS_SCENARIO_BUNDLE: readonly StressScenario[] = [
  BASE_SCENARIO,
  ADVERSE_SCENARIO,
  SEVERELY_ADVERSE_SCENARIO,
  REVERSE_STRESS_SCENARIO,
];
