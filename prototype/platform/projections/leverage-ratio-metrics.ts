// platform/projections/leverage-ratio-metrics.ts
//
// Basel III leverage-ratio measurement module for Helena's
// `appetite:capital:leverage-ratio` Tier-1 prudential appetite line.
//
// Computes the leverage ratio against an exposure-measure projection
// + the Tier-1 capital envelope from `capital-metrics.ts`. Mirrors
// the `computeCapitalMetrics` posture: live mode when the event
// store has measurable positions / commitments, build-phase fallback
// otherwise.
//
// Build-phase posture (CLAUDE.md "build phase vs licence-day"):
//   No real positions exist. The Tier-1 capital envelope is the
//   confirmed ICAAP v1 figure (R300m). The exposure measure is
//   zero until rehearsal trades settle or commitments are booked.
//   Ratio = Infinity (compliant — no exposure to leverage).
//
// Live-capital posture (post-launch):
//   When SaCcrEadComputed / CapitalCommitmentRecorded / settled-position
//   events exist, sums them by component (derivatives, SFT, off-balance-
//   sheet, on-balance-sheet) and divides by Tier-1. v0 only has the
//   shape; the periodic SA-CCR projection wave + commitment-snapshot
//   projection wave will land the live-mode reads. The handler is
//   forward-compatible.
//
// Appetite status thresholds (RAS §B3; thresholds proposed in the
// Decision(requested) card filed alongside this module — Marc-pending):
//   green     — leverageRatio ≥ 4.5%
//   amber     — 4.0% ≤ leverageRatio < 4.5%
//   red       — 3.5% ≤ leverageRatio < 4.0%
//   critical  — leverageRatio < 3.5% (regulatory min 3% — sub-floor
//               sub-status flagged separately)
//
// The "critical" sub-status (below the management buffer) is signalled
// by `critical: true` on the result alongside `status: "red"`. Below
// the BCBS regulatory floor (3 %) sets `belowRegulatoryFloor: true`.
//
// Authority: D-RAS (2026-05-06) · D-MARKETS-CAPITAL-TIME-SHAPE (2026-05-12) ·
//   Banks Act 94 of 1990 §70 · RRTB Reg 38 · BCBS Basel III §147–§165
// Authors: Helena (Chief Risk Officer, governance) · Rohan (Market risk
//   quantitative engineer, engineering — measurement substrate)

import { getFinancialConstant } from "../config/financial-constants";
import type { EventStore } from "../event-store/store";
import {
  BCBS_LEVERAGE_RATIO_REGULATORY_MINIMUM,
  type LeverageExposureDecomposition,
} from "../reporting/ba-700-leverage-ratio";
import { generateLeverageRatio } from "../reporting/ba-700-leverage-ratio";
import { BUILD_PHASE_TOTAL_CAPITAL_MINOR, computeCapitalMetrics } from "./capital-metrics";

// ---------------------------------------------------------------------------
// RAS §B3 leverage-ratio appetite bands — owned (CRO) in
// platform/config/financial-constants.ts. Conservative buffers over the BCBS
// 3 % regulatory floor.
// ---------------------------------------------------------------------------

export const THRESHOLD_LEVERAGE_GREEN = getFinancialConstant("leverage.threshold.green");
export const THRESHOLD_LEVERAGE_AMBER = getFinancialConstant("leverage.threshold.amber");
export const THRESHOLD_LEVERAGE_RED = getFinancialConstant("leverage.threshold.red");
// `THRESHOLD_LEVERAGE_CRITICAL` mirrors `THRESHOLD_LEVERAGE_RED`: below
// 3.5 % the bank is in the management-action zone above the regulatory
// floor; status is `red` with `critical: true`.

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export type LeverageMetricStatus = "green" | "amber" | "red";

export interface LeverageRatioMetrics {
  /** ZAR cents — Tier-1 capital numerator (from capital-metrics). */
  readonly tier1CapitalMinor: number;
  /** ZAR cents — total exposure measure (sum of components). */
  readonly totalExposureMeasureMinor: number;
  /** ZAR cents — on-balance-sheet exposures (BCBS §149). */
  readonly onBalanceSheetExposureMinor: number;
  /** ZAR cents — derivative exposures (SA-CCR EAD; BCBS §157). */
  readonly derivativeExposureMinor: number;
  /** ZAR cents — SFT exposures (BCBS §164). */
  readonly sftExposureMinor: number;
  /** ZAR cents — off-balance-sheet exposures post-CCF (BCBS §165). */
  readonly offBalanceSheetExposurePostCcfMinor: number;
  /** Tier-1 / total exposure measure. May be Infinity when exposure = 0. */
  readonly leverageRatio: number;
  /** Leverage ratio as percentage string (e.g. "407.12%" or "infinity"). */
  readonly leverageRatioPct: string;
  /** RAG appetite status per RAS §B3 thresholds. */
  readonly status: LeverageMetricStatus;
  /** True when ratio < amber threshold (management-action floor). */
  readonly critical: boolean;
  /** True when ratio < BCBS regulatory minimum (3 %). */
  readonly belowRegulatoryFloor: boolean;
  /**
   * True when metrics are derived from the build-phase baseline (no
   * live measurement events in the store). False when computed from
   * live events.
   */
  readonly buildPhase: boolean;
  /** ISO 8601 — as-of date the metrics were computed at. */
  readonly asOf: string;
  /** Human-readable note summarising the source + status. */
  readonly note: string;
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

function computeStatus(leverageRatio: number): {
  status: LeverageMetricStatus;
  critical: boolean;
  belowRegulatoryFloor: boolean;
} {
  const belowRegulatoryFloor =
    Number.isFinite(leverageRatio) && leverageRatio < BCBS_LEVERAGE_RATIO_REGULATORY_MINIMUM;

  if (leverageRatio < THRESHOLD_LEVERAGE_RED) {
    // Below 3.5 % — management-action floor (sub-amber). `critical` set.
    return { status: "red", critical: true, belowRegulatoryFloor };
  }
  if (leverageRatio < THRESHOLD_LEVERAGE_AMBER) {
    // 3.5 % ≤ ratio < 4 % — red.
    return { status: "red", critical: false, belowRegulatoryFloor };
  }
  if (leverageRatio < THRESHOLD_LEVERAGE_GREEN) {
    // 4 % ≤ ratio < 4.5 % — amber.
    return { status: "amber", critical: false, belowRegulatoryFloor };
  }
  // ratio ≥ 4.5 % (or Infinity) — green.
  return { status: "green", critical: false, belowRegulatoryFloor };
}

function formatPct(ratio: number): string {
  if (!Number.isFinite(ratio)) return "infinity";
  return `${(ratio * 100).toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Build-phase exposure read — sums any in-store position/commitment events
// ---------------------------------------------------------------------------

/**
 * Read the leverage-ratio exposure decomposition from the event store.
 *
 * v0 contract: the periodic SA-CCR + commitment-snapshot projections
 * are not yet wired (D-CREDIT-LIMIT-ENGINE-BUILD Phase 5 only emits at
 * pre-deal-check granularity; commitment-snapshot wave is separate).
 * Until they land, this function returns a build-phase zero-exposure
 * decomposition — the handler reports `Infinity` ratio (compliant by
 * convention; the regulator-floor compliance flag also reports `true`).
 *
 * When live measurement events exist, this is the seam where the
 * periodic projections drop their values in. The shape is forward-
 * compatible.
 */
function readLiveExposureDecomposition(
  _eventStore: EventStore,
): LeverageExposureDecomposition | null {
  // v0: no periodic exposure-measure projection yet — returning null
  // routes the caller to the build-phase baseline. This is the substrate
  // gap surfaced in `placeholders` on the BA 700 output and in the
  // appetite-line `note`.
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the Basel III leverage-ratio metric for Helena's appetite-watch
 * handler.
 *
 * When the event store carries a measurable exposure decomposition,
 * the live mode picks it up. When it does not (build phase), the
 * function falls back to a zero-exposure baseline against the
 * `BUILD_PHASE_TOTAL_CAPITAL_MINOR` Tier-1 envelope from
 * `capital-metrics.ts`.
 *
 * @param eventStore  - the singleton event store from `platform/composition`.
 * @param asOf        - ISO 8601 run timestamp.
 */
export function computeLeverageRatioMetrics(
  eventStore: EventStore,
  asOf: string,
): LeverageRatioMetrics {
  // Tier-1 capital numerator — re-uses `computeCapitalMetrics` so the
  // leverage ratio and the BA 700 CET1 view share a single source of
  // truth for the capital envelope (currently the same single envelope;
  // splits when the BA 700 capital-stack projection wave lands).
  const capital = computeCapitalMetrics(eventStore, asOf);
  const tier1CapitalMinor = capital.availableCapitalMinor;

  const live = readLiveExposureDecomposition(eventStore);

  let exposure: LeverageExposureDecomposition;
  let buildPhase: boolean;

  if (live !== null) {
    exposure = live;
    buildPhase = false;
  } else {
    exposure = {
      onBalanceSheetExposureMinor: 0,
      derivativeExposureMinor: 0,
      sftExposureMinor: 0,
      offBalanceSheetExposurePostCcfMinor: 0,
      source: "build-phase-baseline",
    };
    buildPhase = true;
  }

  // Delegate to the pure generator so the math + edge-cases (divide-by-
  // zero, negative-input rejection) are exercised through a single code
  // path.
  const output = generateLeverageRatio({
    entity: "LE-ZA-HOZ-BANK",
    asOf,
    periodId: `period:hoz-bank:as-of:${asOf}`,
    functionalCurrency: "ZAR",
    tier1CapitalMinor,
    exposureMeasure: exposure,
  });

  const { status, critical, belowRegulatoryFloor } = computeStatus(output.leverageRatio);
  const leverageRatioPct = formatPct(output.leverageRatio);

  const capitalFmt = `R${(tier1CapitalMinor / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
  const exposureFmt = `R${(output.exposureMeasure.totalExposureMeasureMinor / 100).toLocaleString(
    "en-ZA",
    { minimumFractionDigits: 0, maximumFractionDigits: 0 },
  )}`;

  let note: string;
  if (buildPhase) {
    if (tier1CapitalMinor === BUILD_PHASE_TOTAL_CAPITAL_MINOR) {
      note = `Build-phase baseline (ICAAP v1, D-MARKETS-CAPITAL-TIME-SHAPE 2026-05-12): Tier-1 ${capitalFmt}, exposure measure ${exposureFmt}, leverage ratio ${leverageRatioPct}. No live exposure-measure projection in the store; SA-CCR + commitment + SFT projections pending. Status: ${status}${critical ? " (critical — below management-action floor)" : ""}${belowRegulatoryFloor ? " (below BCBS 3% floor)" : ""}.`;
    } else {
      note = `Build-phase baseline (no live exposure events): Tier-1 ${capitalFmt} from live CapitalEvent fold, exposure measure ${exposureFmt} (zero — no positions yet). Leverage ratio ${leverageRatioPct}. Status: ${status}.`;
    }
  } else {
    note = `Live exposure-measure read: Tier-1 ${capitalFmt}, exposure measure ${exposureFmt}, leverage ratio ${leverageRatioPct}. BCBS regulatory minimum 3%. Status: ${status}${critical ? " (critical — below management-action floor)" : ""}${belowRegulatoryFloor ? " (below BCBS 3% floor)" : ""}.`;
  }

  return {
    tier1CapitalMinor,
    totalExposureMeasureMinor: output.exposureMeasure.totalExposureMeasureMinor,
    onBalanceSheetExposureMinor: output.exposureMeasure.onBalanceSheetExposureMinor,
    derivativeExposureMinor: output.exposureMeasure.derivativeExposureMinor,
    sftExposureMinor: output.exposureMeasure.sftExposureMinor,
    offBalanceSheetExposurePostCcfMinor: output.exposureMeasure.offBalanceSheetExposurePostCcfMinor,
    leverageRatio: output.leverageRatio,
    leverageRatioPct,
    status,
    critical,
    belowRegulatoryFloor,
    buildPhase,
    asOf,
    note,
  };
}
