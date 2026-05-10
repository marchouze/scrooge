// platform/risk/icaap-narrative-data.ts
//
// D-REGULATORY-READINESS-W2-SLICE-4 — ICAAP narrative-data feed.
//
// Standing authority: D-REGULATORY-READINESS-GATE-PLAN (CEO-approved
// 2026-05-10), pack §3 W2 Slice 4.
//
// The ICAAP (Internal Capital Adequacy Assessment Process) document is
// authored by Helena (Chief Risk Officer, governance) per Banks Act §72
// + BCBS Basel III ICAAP guidance + Reg 39 (SREP equivalent). The
// document is a *narrative* — it is read by the PA at SREP and at
// licence-application; the figures in the narrative MUST trace to typed
// substrate (Principle 2: every action traces to a source).
//
// This module produces the **narrative-data feed** — a structured shape
// the narrative-author (Helena, or an LLM-author under Helena) consumes
// to populate the standard ICAAP sections without re-deriving figures.
// Each section in the feed cites the upstream substrate (RWA engine
// output, stress-engine output, Pillar-2 add-on output, RAS B2 calibration).
//
// **Pure function; no document-store writes; no event side-effects.**
// The narrative author is responsible for rendering the feed into prose
// (or markdown / docx — Helena's choice). The data feed itself is a
// stable typed contract.
//
// Citation chain (Principle 2):
//   - Banks Act 94 of 1990 §72 (ICAAP)
//   - Regulations Relating to Banks Reg 38 + Reg 39 (capital-adequacy + SREP)
//   - BCBS Basel III ICAAP guidance + §122–§148 (buffers)
//   - `ORG-PR-04` (RAS B2 — CET1 management buffer)
//   - `ORG-PR-12` (Stress-testing framework)
//
// Author: Helena (Chief Risk Officer, governance — narrative author /
//   accountable owner) + Rohan (Risk engineer, engineering — feed
//   engineer; reports to Helena).

import type { Pillar2AddOnOutput } from "./pillar-2-addon";
import type { RwaEngineOutput } from "./rwa-engine";
import type { StressEngineOutput } from "./stress-engine";

export const ICAAP_NARRATIVE_CITATIONS = {
  banksAct: "BANKS-ACT-94-1990",
  reg38: "REG-RELATING-TO-BANKS-REG-38",
  reg39: "REG-RELATING-TO-BANKS-REG-39",
  basel3Icaap: "BCBS-BASEL-III-ICAAP",
  basel3Buffers: "BCBS-BASEL-III-IV-CAPITAL-BUFFERS",
  orgPr04: "ORG-PR-04",
  orgPr12: "ORG-PR-12",
} as const;

// ---------------------------------------------------------------------------
// Section shapes
// ---------------------------------------------------------------------------

export interface CapitalAdequacySection {
  readonly asOf: string;
  readonly entityId: string;
  readonly currentCet1RatioPct: number;
  readonly currentTier1RatioPct: number;
  readonly currentTotalCapitalRatioPct: number;
  readonly currentLeverageRatioPct: number;
  readonly totalRwaMinor: number;
  readonly creditRwaMinor: number;
  readonly marketRwaMinor: number;
  readonly operationalRwaMinor: number;
  readonly cvaRwaMinor: number;
}

export interface ScenarioSummaryLine {
  readonly scenarioId: string;
  readonly label: string;
  readonly worstCet1RatioPct: number;
  readonly worstQuarter: number;
  readonly terminalCet1RatioPct: number;
  readonly terminalTier1RatioPct: number;
  readonly terminalTotalCapitalRatioPct: number;
  readonly terminalLeverageRatioPct: number;
  readonly terminalLcrPct: number;
  readonly terminalNsfrPct: number;
  /** Reverse-stress only: scaling factor applied + convergence flag. */
  readonly reverseStressScale?: number;
  readonly reverseStressConverged?: boolean;
}

export interface StressTestingSection {
  readonly horizonQuarters: number;
  readonly scenarios: readonly ScenarioSummaryLine[];
  /**
   * Per-scenario per-quarter CET1 ratio path (for chart rendering in the
   * ICAAP narrative). Index 0 is q0 (as-of base), indices 1..12 are
   * stressed quarters.
   */
  readonly cet1RatioPathByScenario: ReadonlyArray<{
    readonly scenarioId: string;
    readonly cet1RatioPathPct: readonly number[];
  }>;
}

export interface Pillar2Section {
  readonly stressDeficitMinor: number;
  readonly stressDeficitFloorRatioPct: number;
  readonly riskBucketLines: ReadonlyArray<{
    readonly category: string;
    readonly label: string;
    readonly addOnMinor: number;
    readonly rationale: string;
  }>;
  readonly riskBucketAddOnSumMinor: number;
  readonly pillar2AddOnMinor: number;
  readonly pillar2AddOnPct: number;
  readonly note: string;
}

export interface CapitalPlanningSection {
  /** PA CET1 minimum + management buffer (RAS B2 floor). */
  readonly rasB2FloorRatioPct: number;
  /** Surplus over floor at base-scenario terminal quarter. Negative = under-floor. */
  readonly baseSurplusOverFloorPct: number;
  /** Surplus over floor at severely-adverse worst quarter. Negative = under-floor. */
  readonly severelyAdverseWorstSurplusOverFloorPct: number;
  /** Recommended pre-positioned capital headroom (Pillar-2 + management buffer × RWA). */
  readonly recommendedHeadroomMinor: number;
}

// ---------------------------------------------------------------------------
// Top-level feed
// ---------------------------------------------------------------------------

export interface IcaapNarrativeDataFeed {
  readonly meta: {
    readonly feed: "icaap-narrative-data";
    readonly feedVersion: "v0.1";
    readonly entityId: string;
    readonly asOf: string;
    readonly functionalCurrency: string;
  };
  readonly capitalAdequacy: CapitalAdequacySection;
  readonly stressTesting: StressTestingSection;
  readonly pillar2: Pillar2Section;
  readonly capitalPlanning: CapitalPlanningSection;
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface IcaapNarrativeDataInput {
  readonly entityId: string;
  readonly asOf: string;
  readonly functionalCurrency: string;
  readonly rwa: RwaEngineOutput;
  readonly stress: StressEngineOutput;
  readonly pillar2: Pillar2AddOnOutput;
  /** Current-state capital stack (net of regulatory deductions). */
  readonly currentCapital: {
    readonly cet1Minor: number;
    readonly at1Minor: number;
    readonly t2Minor: number;
  };
  readonly currentLeverageExposureMinor: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class IcaapNarrativeDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IcaapNarrativeDataError";
  }
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build the ICAAP narrative-data feed from current-state + stress
 * + Pillar-2 outputs. Pure function; deterministic.
 *
 * @throws {IcaapNarrativeDataError} on missing scenarios or non-finite
 *   denominators.
 */
export function buildIcaapNarrativeData(input: IcaapNarrativeDataInput): IcaapNarrativeDataFeed {
  if (input.rwa.totalRwaMinor <= 0) {
    throw new IcaapNarrativeDataError(
      `ICAAP narrative-data: rwa.totalRwaMinor must be > 0, got ${input.rwa.totalRwaMinor}`,
    );
  }
  if (input.currentLeverageExposureMinor <= 0) {
    throw new IcaapNarrativeDataError(
      `ICAAP narrative-data: currentLeverageExposureMinor must be > 0, got ${input.currentLeverageExposureMinor}`,
    );
  }

  const tier1Minor = input.currentCapital.cet1Minor + input.currentCapital.at1Minor;
  const totalCapitalMinor = tier1Minor + input.currentCapital.t2Minor;

  const capitalAdequacy: CapitalAdequacySection = {
    asOf: input.asOf,
    entityId: input.entityId,
    currentCet1RatioPct: (input.currentCapital.cet1Minor / input.rwa.totalRwaMinor) * 100,
    currentTier1RatioPct: (tier1Minor / input.rwa.totalRwaMinor) * 100,
    currentTotalCapitalRatioPct: (totalCapitalMinor / input.rwa.totalRwaMinor) * 100,
    currentLeverageRatioPct: (tier1Minor / input.currentLeverageExposureMinor) * 100,
    totalRwaMinor: input.rwa.totalRwaMinor,
    creditRwaMinor: input.rwa.credit.totalMinor,
    marketRwaMinor: input.rwa.market.totalMinor,
    operationalRwaMinor: input.rwa.operational.totalMinor,
    cvaRwaMinor: input.rwa.cvaMinor,
  };

  const scenarios: ScenarioSummaryLine[] = input.stress.projections.map((p) => {
    const summary: ScenarioSummaryLine = {
      scenarioId: p.scenarioId,
      label: p.label,
      worstCet1RatioPct: p.worstQuarter.cet1Ratio * 100,
      worstQuarter: p.worstQuarter.quarter,
      terminalCet1RatioPct: p.terminalQuarter.cet1Ratio * 100,
      terminalTier1RatioPct: p.terminalQuarter.tier1Ratio * 100,
      terminalTotalCapitalRatioPct: p.terminalQuarter.totalCapitalRatio * 100,
      terminalLeverageRatioPct: p.terminalQuarter.leverageRatio * 100,
      terminalLcrPct: p.terminalQuarter.lcr * 100,
      terminalNsfrPct: p.terminalQuarter.nsfr * 100,
      ...(p.reverseStressScale !== undefined ? { reverseStressScale: p.reverseStressScale } : {}),
      ...(p.reverseStressConverged !== undefined
        ? { reverseStressConverged: p.reverseStressConverged }
        : {}),
    };
    return summary;
  });

  const cet1RatioPathByScenario = input.stress.projections.map((p) => ({
    scenarioId: p.scenarioId,
    cet1RatioPathPct: p.quarterlyProjections.map((q) => q.cet1Ratio * 100),
  }));

  const stressTesting: StressTestingSection = {
    horizonQuarters: input.stress.meta.horizonQuarters,
    scenarios,
    cet1RatioPathByScenario,
  };

  const pillar2Section: Pillar2Section = {
    stressDeficitMinor: input.pillar2.stressDeficit.stressDeficitMinor,
    stressDeficitFloorRatioPct: input.pillar2.stressDeficit.floorRatio * 100,
    riskBucketLines: input.pillar2.riskBucketLines.map((l) => ({
      category: l.category,
      label: l.label,
      addOnMinor: l.addOnMinor,
      rationale: l.rationale,
    })),
    riskBucketAddOnSumMinor: input.pillar2.riskBucketAddOnSumMinor,
    pillar2AddOnMinor: input.pillar2.pillar2AddOnMinor,
    pillar2AddOnPct: input.pillar2.pillar2AddOnPct,
    note: "Pillar-2 add-on is the institution-specific overlay above Pillar-1 standardised capital required to cover risks not (or under-) captured by the standardised approach + the stress-projection deficit.",
  };

  // Capital-planning derivation
  const baseScenario = input.stress.projections.find((p) => p.scenarioId === "base");
  const severelyAdverseScenario = input.stress.projections.find(
    (p) => p.scenarioId === "severely-adverse",
  );
  if (!baseScenario || !severelyAdverseScenario) {
    throw new IcaapNarrativeDataError(
      "ICAAP narrative-data: stress-engine output must include both 'base' and 'severely-adverse' scenarios for capital-planning section",
    );
  }
  const rasB2FloorRatio = input.pillar2.stressDeficit.floorRatio;
  const baseTerminalCet1Ratio = baseScenario.terminalQuarter.cet1Ratio;
  const baseSurplus = (baseTerminalCet1Ratio - rasB2FloorRatio) * 100;
  const severelyAdverseWorstSurplus =
    (severelyAdverseScenario.worstQuarter.cet1Ratio - rasB2FloorRatio) * 100;
  // Recommended headroom: Pillar-2 add-on + management-buffer × current RWA
  const recommendedHeadroomMinor = Math.round(
    input.pillar2.pillar2AddOnMinor +
      input.pillar2.meta.managementBufferRatio * input.rwa.totalRwaMinor,
  );

  const capitalPlanning: CapitalPlanningSection = {
    rasB2FloorRatioPct: rasB2FloorRatio * 100,
    baseSurplusOverFloorPct: baseSurplus,
    severelyAdverseWorstSurplusOverFloorPct: severelyAdverseWorstSurplus,
    recommendedHeadroomMinor,
  };

  const placeholders: string[] = [
    ...input.stress.placeholders,
    ...input.pillar2.placeholders,
    "[ICAAP narrative-data v0.1 — feed shape; narrative author renders to prose / markdown / docx separately]",
  ];

  return {
    meta: {
      feed: "icaap-narrative-data",
      feedVersion: "v0.1",
      entityId: input.entityId,
      asOf: input.asOf,
      functionalCurrency: input.functionalCurrency,
    },
    capitalAdequacy,
    stressTesting,
    pillar2: pillar2Section,
    capitalPlanning,
    citations: [
      "D-REGULATORY-READINESS-GATE-PLAN",
      "D-REGULATORY-READINESS-W2-SLICE-4",
      ICAAP_NARRATIVE_CITATIONS.banksAct,
      ICAAP_NARRATIVE_CITATIONS.reg38,
      ICAAP_NARRATIVE_CITATIONS.reg39,
      ICAAP_NARRATIVE_CITATIONS.basel3Icaap,
      ICAAP_NARRATIVE_CITATIONS.basel3Buffers,
      ICAAP_NARRATIVE_CITATIONS.orgPr04,
      ICAAP_NARRATIVE_CITATIONS.orgPr12,
    ],
    placeholders: [...new Set(placeholders)].sort(),
  };
}
