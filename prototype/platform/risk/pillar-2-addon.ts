// platform/risk/pillar-2-addon.ts
//
// D-REGULATORY-READINESS-W2-SLICE-4 — Pillar-2 add-on computation.
//
// Standing authority: D-REGULATORY-READINESS-GATE-PLAN (CEO-approved
// 2026-05-10), pack §3 W2 Slice 4.
//
// Pillar-2 capital — the institution-specific add-on the bank holds
// **above** the Pillar-1 standardised capital requirement to cover risks
// the standardised approach does not capture (concentration risk,
// interest-rate risk in the banking book, model risk, conduct risk,
// pension obligations, business / strategic risk, etc.) and the stress-
// projection deficit (the additional capital required so the bank
// remains above PA-min through the severely-adverse scenario).
//
// Per BCBS Basel III ICAAP guidance + Reg 39 (SREP equivalent in SA):
//   pillar2AddOn = max(
//     stressDeficit,            // capital required to keep CET1 above PA-min through stress
//     riskBucketAddOnSum,       // sum of sub-bucket add-ons for un-captured risks
//   )
//
// **Build-phase posture:** the PA has not yet issued an SREP / Pillar-2A
// letter for Hoz Bank (no-letter posture noted in `Owner Inbox/2026-05-
// 06_reporting-capability-spec.md`). The engine computes a *self-assessed*
// Pillar-2 add-on from the stress-engine output + a typed risk-bucket
// declaration; the SARB-issued figure replaces the self-assessment when
// the SREP letter arrives.
//
// Citation chain (Principle 2):
//   - Banks Act 94 of 1990 §70 + §72 (capital adequacy + ICAAP)
//   - Regulations Relating to Banks Reg 38 (Pillar 2A) + Reg 39 (SREP)
//   - BCBS Basel III ICAAP guidance (Pillar 2)
//   - `ORG-PR-04` (RAS B2 — CET1 management buffer)
//   - `ORG-PR-12` (Stress-testing framework — informs stress-deficit)
//
// Author: Rohan (Risk engineer, engineering — reports to Helena CRO)
//   + Helena (Chief Risk Officer, governance — Pillar-2 accountable owner).

import type { StressEngineOutput, ScenarioProjection } from "./stress-engine";

export const PILLAR_2_CITATIONS = {
  banksAct: "BANKS-ACT-94-1990",
  reg38: "REG-RELATING-TO-BANKS-REG-38",
  reg39: "REG-RELATING-TO-BANKS-REG-39",
  basel3Icaap: "BCBS-BASEL-III-ICAAP",
  orgPr04: "ORG-PR-04",
  orgPr12: "ORG-PR-12",
} as const;

// ---------------------------------------------------------------------------
// Risk bucket inputs
// ---------------------------------------------------------------------------

/**
 * One Pillar-2 risk bucket — a category of risk the standardised
 * Pillar-1 approach does not (or under-) capture. The institution's
 * ICAAP enumerates these and assigns a self-assessed capital add-on
 * per bucket.
 *
 * Standard buckets per BCBS ICAAP guidance:
 *   - concentration              — single-name, sector, geographic
 *   - irrbb                      — interest-rate risk in the banking book
 *   - model-risk                 — internal model error
 *   - business-strategic         — revenue volatility, business-model risk
 *   - conduct                    — mis-selling, unfair-treatment, etc.
 *   - pension-obligations        — defined-benefit obligations beyond fund assets
 *   - reputational               — franchise damage
 *   - other                      — catch-all
 */
export type Pillar2RiskBucketCategory =
  | "concentration"
  | "irrbb"
  | "model-risk"
  | "business-strategic"
  | "conduct"
  | "pension-obligations"
  | "reputational"
  | "other";

export interface Pillar2RiskBucket {
  readonly category: Pillar2RiskBucketCategory;
  readonly label: string;
  /** Self-assessed capital add-on for this bucket, in functional-currency minor units. */
  readonly addOnMinor: number;
  /** Free-form rationale (cited in the ICAAP narrative). */
  readonly rationale: string;
}

export interface Pillar2AddOnInput {
  /** Stress-engine output — engine reads severely-adverse scenario for stress-deficit. */
  readonly stress: StressEngineOutput;
  /** Self-assessed risk-bucket add-ons. May be empty in build-phase posture. */
  readonly riskBuckets: readonly Pillar2RiskBucket[];
  /** PA CET1 minimum ratio (e.g. 0.045 = 4.5%) — defines the stress-deficit floor. */
  readonly paCet1MinimumRatio: number;
  /** Optional management-buffer overlay (RAS B2 +1.5pp by default). */
  readonly managementBufferRatio?: number;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export interface StressDeficitDecomposition {
  /** Severely-adverse scenario id (always "severely-adverse" if present). */
  readonly scenarioId: string;
  /** Worst-quarter CET1 ratio across the projection horizon. */
  readonly worstCet1Ratio: number;
  /** Worst-quarter total-RWA — denominator for the deficit calculation. */
  readonly worstTotalRwaMinor: number;
  /** Floor ratio = paCet1MinimumRatio + managementBufferRatio. */
  readonly floorRatio: number;
  /** CET1 deficit at worst quarter, in minor units. Zero if the bank stays above floor. */
  readonly stressDeficitMinor: number;
}

export interface Pillar2RiskBucketLine {
  readonly category: Pillar2RiskBucketCategory;
  readonly label: string;
  readonly addOnMinor: number;
  readonly rationale: string;
}

export interface Pillar2AddOnOutput {
  readonly meta: {
    readonly computation: "pillar-2-self-assessed";
    readonly engineVersion: "v0.1";
    readonly paCet1MinimumRatio: number;
    readonly managementBufferRatio: number;
  };
  readonly stressDeficit: StressDeficitDecomposition;
  readonly riskBucketLines: readonly Pillar2RiskBucketLine[];
  readonly riskBucketAddOnSumMinor: number;
  /** `max(stressDeficitMinor, riskBucketAddOnSumMinor)`. */
  readonly pillar2AddOnMinor: number;
  /** Pillar-2 add-on expressed as percentage points of total RWA at worst-quarter. */
  readonly pillar2AddOnPct: number;
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class Pillar2AddOnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Pillar2AddOnError";
  }
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

const DEFAULT_MANAGEMENT_BUFFER_RATIO = 0.015; // RAS B2 +1.5pp

function findSeverelyAdverse(stress: StressEngineOutput): ScenarioProjection {
  const sa = stress.projections.find((p) => p.scenarioId === "severely-adverse");
  if (!sa) {
    throw new Pillar2AddOnError(
      "Pillar-2 add-on: stress-engine output does not include 'severely-adverse' scenario; required for stress-deficit derivation",
    );
  }
  return sa;
}

/**
 * Compute the institution-specific Pillar-2 add-on. Pure function;
 * deterministic.
 *
 * @throws {Pillar2AddOnError} on missing severely-adverse scenario,
 *   negative add-on, or non-finite ratios.
 */
export function computePillar2AddOn(input: Pillar2AddOnInput): Pillar2AddOnOutput {
  if (!Number.isFinite(input.paCet1MinimumRatio) || input.paCet1MinimumRatio <= 0) {
    throw new Pillar2AddOnError(
      `Pillar-2 add-on: paCet1MinimumRatio must be > 0, got ${input.paCet1MinimumRatio}`,
    );
  }
  const managementBufferRatio = input.managementBufferRatio ?? DEFAULT_MANAGEMENT_BUFFER_RATIO;
  if (!Number.isFinite(managementBufferRatio) || managementBufferRatio < 0) {
    throw new Pillar2AddOnError(
      `Pillar-2 add-on: managementBufferRatio must be ≥ 0, got ${managementBufferRatio}`,
    );
  }
  for (const b of input.riskBuckets) {
    if (b.addOnMinor < 0) {
      throw new Pillar2AddOnError(
        `Pillar-2 add-on: risk-bucket '${b.category}' add-on must be ≥ 0, got ${b.addOnMinor}`,
      );
    }
  }

  const severelyAdverse = findSeverelyAdverse(input.stress);
  const worst = severelyAdverse.worstQuarter;
  const floorRatio = input.paCet1MinimumRatio + managementBufferRatio;
  const requiredCet1AtWorstMinor = floorRatio * worst.totalRwaMinor;
  const stressDeficitMinor = Math.max(0, requiredCet1AtWorstMinor - worst.cet1Minor);

  const stressDeficit: StressDeficitDecomposition = {
    scenarioId: severelyAdverse.scenarioId,
    worstCet1Ratio: worst.cet1Ratio,
    worstTotalRwaMinor: worst.totalRwaMinor,
    floorRatio,
    stressDeficitMinor: Math.round(stressDeficitMinor),
  };

  const riskBucketLines: Pillar2RiskBucketLine[] = input.riskBuckets.map((b) => ({
    category: b.category,
    label: b.label,
    addOnMinor: b.addOnMinor,
    rationale: b.rationale,
  }));
  const riskBucketAddOnSumMinor = riskBucketLines.reduce((acc, l) => acc + l.addOnMinor, 0);

  const pillar2AddOnMinor = Math.max(stressDeficit.stressDeficitMinor, riskBucketAddOnSumMinor);
  const pillar2AddOnPct =
    worst.totalRwaMinor > 0 ? (pillar2AddOnMinor / worst.totalRwaMinor) * 100 : 0;

  const placeholders: string[] = [
    "[Pillar-2 add-on is self-assessed; PA-issued SREP / Pillar-2A figure supersedes when issued]",
  ];
  if (riskBucketLines.length === 0) {
    placeholders.push(
      "[risk-bucket inventory is build-phase empty — Helena's first ICAAP run populates concentration / IRRBB / model-risk / conduct etc.]",
    );
  }

  return {
    meta: {
      computation: "pillar-2-self-assessed",
      engineVersion: "v0.1",
      paCet1MinimumRatio: input.paCet1MinimumRatio,
      managementBufferRatio,
    },
    stressDeficit,
    riskBucketLines,
    riskBucketAddOnSumMinor,
    pillar2AddOnMinor,
    pillar2AddOnPct,
    citations: [
      "D-REGULATORY-READINESS-GATE-PLAN",
      "D-REGULATORY-READINESS-W2-SLICE-4",
      PILLAR_2_CITATIONS.banksAct,
      PILLAR_2_CITATIONS.reg38,
      PILLAR_2_CITATIONS.reg39,
      PILLAR_2_CITATIONS.basel3Icaap,
      PILLAR_2_CITATIONS.orgPr04,
      PILLAR_2_CITATIONS.orgPr12,
    ],
    placeholders,
  };
}
