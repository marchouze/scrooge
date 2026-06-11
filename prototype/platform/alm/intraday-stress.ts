// platform/alm/intraday-stress.ts
//
// Intraday HQLA-stress projection engine — BCBS 248 framework.
//
// Runs two scenarios (BAU + stress) across four NPS settlement windows
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
// NPS settlement is accessed via correspondent bank (indirect-participant operating
// posture — memory: `project_indirect_participant_posture.md`). The window
// labels reflect NPS settlement session times; actual settlement messages
// route through the correspondent connector (Tomas's scope).
//
// Authority: D-TREASURY-GAPS-WAVE1; BCBS 248 (Monitoring tools for intraday
//   liquidity management, 2013); Banks Act 94 of 1990 Reg 26.
// Author: Ravi (Treasury/ALM Engineer, engineering)

import { getCollateralInventory } from "../collateral";
import type { FundingDrawnDownPayload } from "../event-store/event-types/ifrs-accounting-extended";
import type { EventStore } from "../event-store/store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The four NPS settlement windows, expressed as SA clock time labels. */
export type SettlementWindow = "09:00" | "12:00" | "15:00" | "16:30";

/** The two stress scenarios per BCBS 248. */
export type IntradayScenario = "BAU" | "stress";

/** Status signal for a single window + scenario projection. */
export type IntradayWindowStatus = "green" | "amber" | "red" | "no-positions";

/** Projection result for one window in one scenario. */
export interface IntradayWindowResult {
  /** NPS settlement window label (SA clock time). */
  windowLabel: SettlementWindow;
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

/** NPS settlement windows in chronological order. */
export const SETTLEMENT_WINDOWS: readonly SettlementWindow[] = ["09:00", "12:00", "15:00", "16:30"];

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

  for (let i = 0; i < SETTLEMENT_WINDOWS.length; i++) {
    const windowLabel = SETTLEMENT_WINDOWS[i] as SettlementWindow;
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

/**
 * Map an ISO instant to the NPS settlement window it falls in.
 * SA local time = UTC + 2. An instant before 12:00 SAST lands in the 09:00
 * window, before 15:00 in the 12:00 window, before 16:30 in the 15:00
 * window, else 16:30. Exported for the BCBS 248 metrics engine
 * (`platform/alm/intraday-liquidity-metrics.ts`) so deadline-to-window
 * mapping stays single-sourced.
 */
export function windowIndexForInstant(drawnAtIso: string): number {
  const d = new Date(drawnAtIso);
  // SA local time (UTC+2) — minutes-since-midnight.
  const saMinutes = (d.getUTCHours() * 60 + d.getUTCMinutes() + 120) % (24 * 60);
  if (saMinutes < 12 * 60) return 0; // 09:00 window
  if (saMinutes < 15 * 60) return 1; // 12:00 window
  if (saMinutes < 16 * 60 + 30) return 2; // 15:00 window
  return 3; // 16:30 window
}

/**
 * Fold `FundingDrawnDown` events dated on `asOf`'s day into per-window ZAR
 * outflows. Each draw is the correspondent funding an intraday net-outflow
 * shortfall (reported via MT942), so it is the bank's intraday outflow pressure
 * for BCBS 248 monitoring. Returns a length-4 array (ZAR major) aligned to
 * SETTLEMENT_WINDOWS. Empty/absent store → all zeros (build-phase posture).
 */
function foldFundingDrawsByWindow(eventStore: EventStore, asOf: string): number[] {
  const outflows = SETTLEMENT_WINDOWS.map(() => 0);
  const day = asOf.slice(0, 10);
  try {
    for (const ev of eventStore.replay({ type: "FundingDrawnDown" })) {
      const p = ev.payload as unknown as FundingDrawnDownPayload;
      if (p.currency !== "ZAR") continue;
      if (typeof p.drawnAt !== "string" || p.drawnAt.slice(0, 10) !== day) continue;
      const amount = Number(p.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const idx = windowIndexForInstant(p.drawnAt);
      outflows[idx] = (outflows[idx] ?? 0) + amount;
    }
  } catch {
    // FundingDrawnDown not registered in a test mock — leave zeros.
  }
  return outflows;
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
 * Per-window outflows are folded from `FundingDrawnDown` events (the
 * correspondent funding intraday net-outflow shortfalls, reported via MT942 —
 * see `CorrespondentNostroSimulator`) when an `eventStore` is supplied; without
 * one (or with no draws) outflows are zero, the correct build-phase baseline.
 * Inflows remain zero pending a scheduled-receipts feed.
 *
 * @param asOf       ISO 8601 business date string (e.g. "2026-05-19T05:00:00.000Z").
 * @param eventStore Optional event store — when present, `FundingDrawnDown`
 *                   events dated on `asOf`'s day drive per-window outflows.
 */
export function runIntradayStress(asOf: string, eventStore?: EventStore): IntradayStressResult {
  const floorZar = INTRADAY_FLOOR_ZAR;

  // Seed the starting HQLA buffer from the collateral inventory.
  const inventory = getCollateralInventory(asOf);
  const startingHQLAZar = inventory.totalHQLAZar;

  // Inflows are zero pending a scheduled-receipts feed. Outflows are folded from
  // FundingDrawnDown events (correspondent intraday funding draws) when an event
  // store is supplied — zero otherwise (build-phase baseline).
  const bauInflows: number[] = SETTLEMENT_WINDOWS.map(() => 0);
  const bauOutflows: number[] = eventStore
    ? foldFundingDrawsByWindow(eventStore, asOf)
    : SETTLEMENT_WINDOWS.map(() => 0);

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
