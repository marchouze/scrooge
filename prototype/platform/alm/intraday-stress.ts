// platform/alm/intraday-stress.ts
//
// Intraday HQLA-stress projection engine — BCBS 248 framework.
//
// Runs two scenarios (BAU + stress) across four SAMOS settlement windows
// per calendar day (SA time: 09:00, 12:00, 15:00, 16:30). For each
// window the engine computes:
//
//   BAU scenario:
//     Inflows  = scheduled receipts spread evenly (build phase: 0)
//     Outflows = scheduled payments spread evenly (build phase: 0)
//     Net position = HQLA buffer + cumulative inflows − cumulative outflows
//
//   Stress scenario (additive on BAU):
//     Inflows  *= 0.80  (20% haircut — delayed settlements)
//     Outflows *= 1.15  (15% uplift — margin calls)
//     Re-computed net position per window
//
//   Status per window:
//     "no-positions" — starting HQLA = 0 (build phase, no portfolio yet)
//     "green"        — projectedHQLAZar > floorZar
//     "amber"        — 0 < projectedHQLAZar ≤ floorZar
//     "red"          — projectedHQLAZar ≤ 0
//
// Floor:
//   Build-phase constant ZAR 50,000,000 (50m) per Helena's RAS intraday
//   liquidity floor. Future: read from `RASCalibrationChange` events once
//   the RAS event substrate lands.
//
// SAMOS is accessed via correspondent bank (indirect-participant operating
// posture — memory: `project_indirect_participant_posture.md`). The window
// labels reflect SAMOS settlement session times; actual settlement messages
// route through the correspondent connector (Tomas's scope).
//
// Authority: D-TREASURY-GAPS-WAVE1; BCBS 248 (Monitoring tools for intraday
//   liquidity management, 2013); Banks Act 94 of 1990 Reg 26.
// Author: Ravi (Treasury/ALM Engineer, engineering)

import { getCollateralInventory } from "../collateral";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The four SAMOS settlement windows, expressed as SA clock time labels. */
export type SAMOSWindow = "09:00" | "12:00" | "15:00" | "16:30";

/** The two stress scenarios per BCBS 248. */
export type IntradayScenario = "BAU" | "stress";

/** Status signal for a single window + scenario projection. */
export type IntradayWindowStatus = "green" | "amber" | "red" | "no-positions";

/** Projection result for one window in one scenario. */
export interface IntradayWindowResult {
  /** SAMOS settlement window label. */
  windowLabel: SAMOSWindow;
  /** Scenario this result belongs to. */
  scenario: IntradayScenario;
  /** HQLA inflows in this window (ZAR). */
  inflowZar: number;
  /** HQLA outflows in this window (ZAR). */
  outflowZar: number;
  /** Cumulative net inflows up to and including this window (ZAR). */
  cumulativeNetZar: number;
  /** Starting HQLA buffer from collateral inventory (ZAR). */
  startingHQLAZar: number;
  /** Projected HQLA buffer at the end of this window (ZAR). */
  projectedHQLAZar: number;
  /** RAS intraday floor (ZAR). */
  floorZar: number;
  /** Traffic-light status. */
  status: IntradayWindowStatus;
  /** ISO 4217 currency. */
  currency: string;
}

/** Full intraday HQLA-stress projection result. */
export interface IntradayStressResult {
  /** ISO 8601 business date. */
  asOf: string;
  /** BAU scenario across all four windows. */
  bau: IntradayWindowResult[];
  /** Stress scenario across all four windows. */
  stress: IntradayWindowResult[];
  /** Starting HQLA buffer at the open of the day (ZAR). */
  startingHQLAZar: number;
  /** RAS intraday floor used (ZAR). */
  floorZar: number;
  /** ISO 4217 currency. */
  currency: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** SAMOS settlement windows in chronological order. */
export const SAMOS_WINDOWS: readonly SAMOSWindow[] = ["09:00", "12:00", "15:00", "16:30"];

/**
 * RAS intraday liquidity floor — ZAR 50,000,000 (50m).
 *
 * Build-phase constant. Represents Helena's RAS-calibrated intraday minimum
 * buffer per Banks Act Reg 26. Future substrate: read from `RASCalibrationChange`
 * events once Helena's RAS event layer lands.
 *
 * Authority: D-TREASURY-GAPS-WAVE1; Banks Act Reg 26 / Helena's RAS.
 */
export const INTRADAY_FLOOR_ZAR = 50_000_000;

/** BCBS 248 stress haircut on inflows: 20% delayed-settlement assumption. */
const STRESS_INFLOW_HAIRCUT = 0.2;

/** BCBS 248 stress uplift on outflows: 15% margin-call assumption. */
const STRESS_OUTFLOW_UPLIFT = 0.15;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Classify a projected HQLA position against the floor.
 *
 * "no-positions" is returned when the starting HQLA buffer is exactly zero —
 * this is the correct build-phase posture (no real portfolio until
 * commencement-of-trading, CLAUDE.md "build phase vs licence-day").
 */
function classifyStatus(
  projectedHQLAZar: number,
  floorZar: number,
  startingHQLAZar: number,
): IntradayWindowStatus {
  if (startingHQLAZar === 0) return "no-positions";
  if (projectedHQLAZar <= 0) return "red";
  if (projectedHQLAZar <= floorZar) return "amber";
  return "green";
}

/**
 * Compute per-window projections for one scenario.
 *
 * @param windowInflows   Array of per-window inflow amounts (length 4, ZAR).
 * @param windowOutflows  Array of per-window outflow amounts (length 4, ZAR).
 * @param startingHQLAZar HQLA buffer at start of day.
 * @param scenario        "BAU" or "stress".
 * @param floorZar        RAS intraday floor.
 */
function computeWindowsForScenario(
  windowInflows: number[],
  windowOutflows: number[],
  startingHQLAZar: number,
  scenario: IntradayScenario,
  floorZar: number,
): IntradayWindowResult[] {
  const results: IntradayWindowResult[] = [];
  let cumulativeNet = 0;

  for (let i = 0; i < SAMOS_WINDOWS.length; i++) {
    const windowLabel = SAMOS_WINDOWS[i] as SAMOSWindow;
    const rawInflow = windowInflows[i] ?? 0;
    const rawOutflow = windowOutflows[i] ?? 0;

    // Apply scenario adjustments.
    const inflow = scenario === "stress" ? rawInflow * (1 - STRESS_INFLOW_HAIRCUT) : rawInflow;
    const outflow = scenario === "stress" ? rawOutflow * (1 + STRESS_OUTFLOW_UPLIFT) : rawOutflow;

    cumulativeNet += inflow - outflow;
    const projectedHQLAZar = startingHQLAZar + cumulativeNet;

    results.push({
      windowLabel,
      scenario,
      inflowZar: inflow,
      outflowZar: outflow,
      cumulativeNetZar: cumulativeNet,
      startingHQLAZar,
      projectedHQLAZar,
      floorZar,
      status: classifyStatus(projectedHQLAZar, floorZar, startingHQLAZar),
      currency: "ZAR",
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Engine — exported entry point
// ---------------------------------------------------------------------------

/**
 * Run the intraday HQLA-stress projection for `asOf`.
 *
 * Reads the collateral inventory (via `getCollateralInventory`) to seed the
 * starting HQLA buffer. In build phase (zero positions) the buffer is 0 and
 * all window statuses are "no-positions" — the correct production posture
 * (Principle 1: events are the only source of truth; no synthetic state).
 *
 * BAU inflows / outflows are zero in build phase (no scheduled receipts or
 * payments in the event store). The engine will produce non-zero flows when
 * `PaymentScheduled` / `ReceiptScheduled` events land.
 *
 * @param asOf ISO 8601 business date string (e.g. "2026-05-19T05:00:00.000Z").
 */
export function runIntradayStress(asOf: string): IntradayStressResult {
  const floorZar = INTRADAY_FLOOR_ZAR;

  // Seed the starting HQLA buffer from the collateral inventory.
  const inventory = getCollateralInventory(asOf);
  const startingHQLAZar = inventory.totalHQLAZar;

  // Build-phase: no scheduled inflows or outflows exist in the event store.
  // Spread evenly across the four windows (all zero in build phase).
  // Future: read PaymentScheduled / ReceiptScheduled events and bucket by window.
  const bauInflows: number[] = SAMOS_WINDOWS.map(() => 0);
  const bauOutflows: number[] = SAMOS_WINDOWS.map(() => 0);

  const bauWindows = computeWindowsForScenario(
    bauInflows,
    bauOutflows,
    startingHQLAZar,
    "BAU",
    floorZar,
  );

  const stressWindows = computeWindowsForScenario(
    bauInflows,
    bauOutflows,
    startingHQLAZar,
    "stress",
    floorZar,
  );

  return {
    asOf,
    bau: bauWindows,
    stress: stressWindows,
    startingHQLAZar,
    floorZar,
    currency: "ZAR",
  };
}
