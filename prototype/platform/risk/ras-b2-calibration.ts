// platform/risk/ras-b2-calibration.ts
//
// RAS B2 — CET1 management buffer calibration. Pure function over typed
// inputs. Implements the calibration rule specified in the Risk Appetite
// Statement (RAS) §B3 and the Capital Management Policy:
//
//   Operate above:    PA-set CET1 minimum + Pillar 2A + Capital
//                     Conservation Buffer (CCB) + 1.5pp management buffer.
//   Trigger at:       PA-set CET1 minimum + 0.75pp.
//   Escalate at:      PA-set CET1 minimum + 0.25pp.
//
// The calibration emits two artefacts:
//
//   1. A `targetCet1RatioPct` — the RAS B2 floor against which the bank's
//      live CET1 ratio is reconciled. Computed as
//      `paCet1MinimumPct + pillar2APct + ccbPct + managementBufferPct`.
//   2. A `breachPosture` — `green` / `amber-trigger` / `red-escalate`
//      relative to the live (or fixture) CET1 ratio.
//
// **Build-phase posture.** Pillar-1 ratios from Bea (Accounting & financial
// reporting engineer)'s reporting-capability spec + Rohan (Risk
// engineer)'s stress-projection engine (W2 Slice 4) are not yet wired
// through. Until they are, the calibration runs against a typed fixture
// — `ras-b2-fixture-pillar1-2026-05-10` — that mirrors the synthetic
// numbers in Bea's reporting-capability spec. The fixture is itself
// citable; downstream consumers know the difference between
// "calibration computed against fixture" and "calibration computed
// against live PA-min + live RWA". The calibration formula is the
// same in both cases — only the inputs differ.
//
// Citation chain (Principle 2):
//   - Banks Act 94 of 1990 §§ 70-72 (capital adequacy) `BANKS-ACT-94-1990`
//   - Regulations Relating to Banks 2012, Regulation 38 (capital adequacy
//     + capital conservation buffer + Pillar 2A) `REG-RELATING-TO-BANKS-REG-38`
//   - BCBS Basel III/IV — capital framework + buffers
//     `BCBS-BASEL-III-IV-CAPITAL-BUFFERS`
//   - RAS §B3 — capital buffer floors `RAS-FRAMEWORK-2026-05-06-B3`
//   - Obligations register row `ORG-PR-04` — CET1 management buffer
//     ≥ +1.5pp (currently `PARTIAL (B2 deferred)` — this calibration
//     lifts that to IN FORCE).
//
// Author: Helena (Chief Risk Officer, governance) + Rohan (Risk
//         engineer, engineering — under Helena) + Bea (Accounting &
//         financial reporting engineer, engineering — under Camille
//         (CFO, governance); consult on capital fixture inputs).

// ---------------------------------------------------------------------------
// Citation constants. Fixed strings — referenced from event citations,
// recon-pipeline citations, and the calibration record.
// ---------------------------------------------------------------------------

export const RAS_B2_CITATIONS = {
  banksAct: "BANKS-ACT-94-1990",
  reg38: "REG-RELATING-TO-BANKS-REG-38",
  basel3: "BCBS-BASEL-III-IV-CAPITAL-BUFFERS",
  rasB3: "RAS-FRAMEWORK-2026-05-06-B3",
  obligation: "ORG-PR-04",
} as const;

/** All citations as a flat array — convenient for event citation arrays. */
export const RAS_B2_CITATION_LIST: readonly string[] = [
  RAS_B2_CITATIONS.banksAct,
  RAS_B2_CITATIONS.reg38,
  RAS_B2_CITATIONS.basel3,
  RAS_B2_CITATIONS.rasB3,
  RAS_B2_CITATIONS.obligation,
];

// ---------------------------------------------------------------------------
// Calibration thresholds. Authored in the RAS §B3 / Capital Management
// Policy. Codified here so the calibration formula and the RAS narrative
// stay byte-equivalent on both sides; recon catches drift.
// ---------------------------------------------------------------------------

/** Management buffer above PA min + Pillar 2A + CCB. RAS §B3. */
export const MANAGEMENT_BUFFER_PCT = 1.5;

/** Trigger threshold (above PA min). RAS §B3 — management action. */
export const TRIGGER_BUFFER_PCT = 0.75;

/** Escalation threshold (above PA min). RAS §B3 — BRC escalation. */
export const ESCALATE_BUFFER_PCT = 0.25;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Pillar-1 inputs into the CET1 calibration. All fields are percentage
 * points (e.g. 4.5 means 4.5%) unless otherwise stated. The shape mirrors
 * the BA 100 (Pillar 1 capital adequacy; capital + reserves) D5/2025
 * line-set per Bea (Accounting & financial reporting engineer)'s
 * reporting-capability spec at
 * `Owner Inbox/2026-05-06_reporting-capability-spec.md`.
 */
export interface Pillar1Inputs {
  /**
   * PA-set CET1 minimum (percentage points). For a SA bank under the
   * Regulations Relating to Banks 2012 Reg 38 read with BCBS Basel III/IV,
   * this is 4.5pp before any institution-specific Pillar 2A add-on.
   */
  readonly paCet1MinimumPct: number;
  /**
   * Pillar 2A add-on as set by the PA for this institution. May be 0
   * before the PA has issued an SREP letter (build-phase posture).
   */
  readonly pillar2APct: number;
  /**
   * Capital Conservation Buffer (CCB) per BCBS Basel III. Standard
   * is 2.5pp.
   */
  readonly ccbPct: number;
  /**
   * Live (or fixture) CET1 ratio for the entity. Computed by Bea's
   * RWA engine when wired through (W2 Slice 3); fixture value used
   * until then.
   */
  readonly liveCet1RatioPct: number;
  /**
   * Free-form label for the input source. Examples:
   * `"fixture:ras-b2-fixture-pillar1-2026-05-10"` (build-phase),
   * `"live:bea:ba-110:2026-XX-XX"` (post-W2-Slice-3).
   */
  readonly inputSource: string;
}

export type BreachPosture = "green" | "amber-trigger" | "red-escalate";

export interface CalibrationResult {
  /** RAS §B3 floor: `paCet1MinimumPct + pillar2APct + ccbPct + 1.5`. */
  readonly targetCet1RatioPct: number;
  /** Trigger floor: `paCet1MinimumPct + 0.75`. */
  readonly triggerCet1RatioPct: number;
  /** Escalation floor: `paCet1MinimumPct + 0.25`. */
  readonly escalateCet1RatioPct: number;
  /**
   * Surplus over RAS target (positive = above floor; negative = under).
   * `liveCet1RatioPct - targetCet1RatioPct`.
   */
  readonly surplusOverTargetPct: number;
  /**
   * Posture classification:
   *   `red-escalate`  if `liveCet1RatioPct < escalateCet1RatioPct`
   *   `amber-trigger` if `liveCet1RatioPct < triggerCet1RatioPct`
   *   `green`         otherwise.
   * Note: a `green` posture is consistent with `surplusOverTargetPct < 0`
   * — i.e. live ratio below the RAS B2 *target* but still above the
   * *trigger*. That is the operating-zone where management response is
   * voluntary; below trigger, response is required; below escalate,
   * Board notification.
   */
  readonly breachPosture: BreachPosture;
  /** Echo of the input source for audit-trail. */
  readonly inputSource: string;
}

// ---------------------------------------------------------------------------
// Build-phase fixture inputs.
//
// Mirror of Bea (Accounting & financial reporting engineer)'s synthetic
// Pillar-1 numbers in the reporting-capability spec at
// `Owner Inbox/2026-05-06_reporting-capability-spec.md`. The fixture is
// the canonical input for the calibration until W2 Slice 3 (RWA engine
// + BA-form generator) produces live ratios.
//
// Numerical posture:
//   - `paCet1MinimumPct = 4.5` (Reg 38 / BCBS Basel III baseline)
//   - `pillar2APct = 0.0`     (no PA SREP letter in build phase)
//   - `ccbPct = 2.5`          (BCBS Basel III standard)
//   - `liveCet1RatioPct = 14.0` (illustrative — well above the 8.5pp
//                                target for build-phase rehearsal)
//
// Target floor under this fixture: 4.5 + 0.0 + 2.5 + 1.5 = 8.5pp.
// Live 14.0pp gives surplusOverTarget = 5.5pp → posture `green`.
// ---------------------------------------------------------------------------

export const RAS_B2_FIXTURE_PILLAR1: Pillar1Inputs = {
  paCet1MinimumPct: 4.5,
  pillar2APct: 0.0,
  ccbPct: 2.5,
  liveCet1RatioPct: 14.0,
  inputSource: "fixture:ras-b2-fixture-pillar1-2026-05-10",
};

// ---------------------------------------------------------------------------
// Calibration function. Pure; no side effects.
// ---------------------------------------------------------------------------

/**
 * Compute the RAS B2 calibration against the supplied Pillar-1 inputs.
 *
 * Validates inputs are non-negative percentages. Rounding: the function
 * returns numbers at the precision of the inputs; downstream renderers
 * choose display precision (typically 2 decimal places).
 *
 * @throws if any percentage input is negative or non-finite.
 */
export function calibrateRasB2(inputs: Pillar1Inputs): CalibrationResult {
  const fields: Array<[string, number]> = [
    ["paCet1MinimumPct", inputs.paCet1MinimumPct],
    ["pillar2APct", inputs.pillar2APct],
    ["ccbPct", inputs.ccbPct],
    ["liveCet1RatioPct", inputs.liveCet1RatioPct],
  ];
  for (const [name, value] of fields) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`calibrateRasB2: ${name} must be a finite number (got ${value})`);
    }
    if (value < 0) {
      throw new RangeError(`calibrateRasB2: ${name} must be non-negative (got ${value})`);
    }
  }

  const targetCet1RatioPct =
    inputs.paCet1MinimumPct + inputs.pillar2APct + inputs.ccbPct + MANAGEMENT_BUFFER_PCT;
  const triggerCet1RatioPct = inputs.paCet1MinimumPct + TRIGGER_BUFFER_PCT;
  const escalateCet1RatioPct = inputs.paCet1MinimumPct + ESCALATE_BUFFER_PCT;
  const surplusOverTargetPct = inputs.liveCet1RatioPct - targetCet1RatioPct;

  let breachPosture: BreachPosture;
  if (inputs.liveCet1RatioPct < escalateCet1RatioPct) {
    breachPosture = "red-escalate";
  } else if (inputs.liveCet1RatioPct < triggerCet1RatioPct) {
    breachPosture = "amber-trigger";
  } else {
    breachPosture = "green";
  }

  return {
    targetCet1RatioPct,
    triggerCet1RatioPct,
    escalateCet1RatioPct,
    surplusOverTargetPct,
    breachPosture,
    inputSource: inputs.inputSource,
  };
}

/**
 * Convenience: compute the calibration against the build-phase fixture.
 * Used by the recon pipeline + the calibration script. Identical to
 * `calibrateRasB2(RAS_B2_FIXTURE_PILLAR1)`.
 */
export function calibrateRasB2FromFixture(): CalibrationResult {
  return calibrateRasB2(RAS_B2_FIXTURE_PILLAR1);
}
