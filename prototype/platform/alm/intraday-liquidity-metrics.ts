// platform/alm/intraday-liquidity-metrics.ts
//
// BCBS 248 seven intraday liquidity monitoring metrics — register-bound
// measure (WS-TREASURER-WAVE1-SUBSTRATE).
//
// Computes the seven BCBS January-2013 monitoring tools from the intraday
// HQLA-stress projection (`runIntradayStress`) and the per-window funding
// flows it folds, plus an injectable time-specific-obligations feed.
//
//   Tool 1 daily-max-usage         — peak net cumulative outflow against the
//                                    correspondent bank across the four NPS
//                                    windows (BAU scenario; ZAR).
//   Tool 2 available-at-start      — start-of-day HQLA buffer (collateral
//                                    inventory) + undrawn correspondent
//                                    intraday credit lines (0 pre-licence).
//   Tool 3 total-payments          — gross ZAR payments sent + received via
//                                    the correspondent bank in the day.
//   Tool 4 time-specific-obligations — total ZAR value of obligations with
//                                    defined deadlines (BondservAfrica /
//                                    JSE / MT202COV cut-offs); injectable
//                                    feed, empty in build phase.
//   Tool 5 customer-payments-on-behalf — N/A-with-reason: the bank provides
//                                    no correspondent-banking services
//                                    (indirect NPS participant per
//                                    D-SAMOS-NON-CLEARING; LRM Policy v1
//                                    §4.2 marks this post-licence-day).
//   Tool 6 intraday-credit-lines   — N/A-with-reason: no customers and no
//                                    intraday credit extension before
//                                    licence-day.
//   Tool 7 throughput              — % of daily outflows settled by each
//                                    NPS window (timing of flows); null
//                                    with status "no-flows" when the day
//                                    has zero outflows.
//
// The exported `computeIntradayLiquidityMetrics` is the measurement
// function the RAS `appetite:liquidity:intraday` line binds to (Helena
// (Chief Risk Officer, governance) follow-on — `measurementBinding:
// "computeIntradayLiquidityMetrics"` in
// `platform/risk/ras-appetite-register.ts`). The headline appetite
// measure is `peakUsagePctOfAvailable` (tool 1 / tool 2), the §4.5
// stress trigger input ("peak intraday usage exceeds 80% of the
// intraday buffer").
//
// Build-phase posture: zero positions → tools 1–4 report measured zeros /
// no-flows, tools 5–6 report structural N/A, `peakUsagePctOfAvailable` is
// null, `overallStatus` is "no-positions". No synthetic values
// (Principle 1) and no false CFP trigger fires downstream.
//
// Authority: D-TREASURER-WAVE1-SUBSTRATE (CEO-approved 2026-06-11);
//   parent D-TREASURER-ROLE-DEFINITION-REVIEW.
// Citations: BCBS 248 §§16–22; LRM Policy v1 §4.2 + §4.3 + §4.5;
//   Banks Act 94 of 1990 Reg 26; ORG-PR-08; D-SAMOS-NON-CLEARING.
// Author: Ravi (Treasury and ALM engineer, engineering — reports to Eitan
//   (Treasurer, governance)).

import type {
  Bcbs248Tool,
  IntradayLiquidityMetric,
} from "../event-store/event-types/intraday-liquidity";
import type { EventStore } from "../event-store/store";
import {
  type IntradayStressResult,
  SETTLEMENT_WINDOWS,
  runIntradayStress,
} from "./intraday-stress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A time-specific settlement obligation with a defined deadline (tool 4). */
export interface TimeSpecificObligation {
  /** Obligation reference (settlement instruction id / cut-off label). */
  obligationRef: string;
  /** ISO 8601 deadline. */
  deadline: string;
  /** ZAR value due at the deadline. */
  requiredZar: number;
}

/** Per-window throughput row (tool 7). */
export interface IntradayThroughputRow {
  /** NPS settlement window label (SA clock time). */
  windowLabel: string;
  /** Cumulative share of the day's outflows settled by the end of this window (0–100). */
  cumulativeOutflowPct: number | null;
}

/** Per-window usage row behind tool 1 — feeds the §4.5 stress evaluation. */
export interface IntradayUsageRow {
  /** NPS settlement window label (SA clock time). */
  windowLabel: string;
  /** Net cumulative position at the end of this window (ZAR; BAU scenario). */
  cumulativeNetZar: number;
  /** Intraday usage at the end of this window (ZAR; max(0, -cumulativeNetZar)). */
  usageZar: number;
  /** Usage as % of available start-of-day liquidity. Null when availability is zero. */
  usagePctOfAvailable: number | null;
}

/** Full BCBS 248 seven-tool computation result. */
export interface IntradayLiquidityMetricsResult {
  /** ISO 8601 business date. */
  asOf: string;
  /** The seven tool results, in BCBS 248 tool order. */
  metrics: IntradayLiquidityMetric[];
  /** Per-window throughput detail behind tool 7. */
  throughputByWindow: IntradayThroughputRow[];
  /** Per-window usage detail behind tool 1 (BAU scenario). */
  usageByWindow: IntradayUsageRow[];
  /** Start-of-day available intraday liquidity (tool 2; ZAR). */
  availableAtStartZar: number;
  /** Time-specific obligations behind tool 4. */
  timeSpecificObligations: TimeSpecificObligation[];
  /**
   * Peak intraday usage as % of available start-of-day liquidity
   * (tool 1 / tool 2). Null when start-of-day liquidity is zero
   * (build-phase no-positions posture). The §4.5 stress definition and
   * the RAS `appetite:liquidity:intraday` line evaluate this field.
   */
  peakUsagePctOfAvailable: number | null;
  /** "measured" when a live HQLA buffer exists; "no-positions" otherwise. */
  overallStatus: "measured" | "no-positions";
  /** ISO 4217 currency. */
  currency: string;
}

export interface ComputeIntradayLiquidityMetricsOpts {
  /**
   * Event store to fold `FundingDrawnDown` flows from (passed through to
   * `runIntradayStress`). Without one, flows are zero (build-phase
   * baseline).
   */
  eventStore?: EventStore;
  /**
   * Time-specific obligations feed (tool 4). Build phase: no scheduled
   * obligations substrate yet — defaults to empty. The
   * `SettlementInstructionIssued` event class (Team/Ravi.md §16 deferred
   * gap) becomes the live source pre-licence.
   */
  timeSpecificObligations?: readonly TimeSpecificObligation[];
  /** Undrawn correspondent intraday credit lines (tool 2 add-on). Build phase: 0. */
  undrawnIntradayCreditLinesZar?: number;
  /**
   * Override the intraday-stress projection — used by tests to exercise
   * the seven-tool fold deterministically without the composition
   * event-store / collateral-inventory globals.
   */
  projection?: IntradayStressResult;
}

// ---------------------------------------------------------------------------
// Tool labels (LRM Policy v1 §4.2 table)
// ---------------------------------------------------------------------------

export const BCBS_248_TOOL_LABELS: Readonly<Record<Bcbs248Tool, string>> = {
  "daily-max-usage": "Daily maximum intraday liquidity usage",
  "available-at-start": "Available intraday liquidity at the start of day",
  "total-payments": "Total payments",
  "time-specific-obligations": "Time-specific and other critical obligations",
  "customer-payments-on-behalf":
    "Value of customer payments made on behalf of financial institution customers",
  "intraday-credit-lines": "Intraday credit lines extended to customers",
  throughput: "Timing of intraday liquidity flows (throughput)",
};

const NOT_APPLICABLE_REASONS: Readonly<Partial<Record<Bcbs248Tool, string>>> = {
  "customer-payments-on-behalf":
    "Structurally inapplicable: Hoz Bank Limited is an indirect NPS participant (D-SAMOS-NON-CLEARING) and provides no correspondent-banking / agency-settlement services; LRM Policy v1 §4.2 marks this tool post-licence-day (nil in build phase).",
  "intraday-credit-lines":
    "Structurally inapplicable in build phase: no customers and no intraday credit extension before licence-day (CLAUDE.md build phase vs licence-day); tool activates with the first customer intraday credit line.",
};

// ---------------------------------------------------------------------------
// Measurement function — RAS `appetite:liquidity:intraday` binding target
// ---------------------------------------------------------------------------

/**
 * Compute the seven BCBS 248 intraday liquidity monitoring metrics for
 * `asOf`.
 *
 * This is the register-bound measurement function for the RAS
 * `appetite:liquidity:intraday` appetite line (Helena (Chief Risk
 * Officer, governance) follow-on; bind via
 * `measurementBinding: "computeIntradayLiquidityMetrics"`).
 */
export function computeIntradayLiquidityMetrics(
  asOf: string,
  opts: ComputeIntradayLiquidityMetricsOpts = {},
): IntradayLiquidityMetricsResult {
  const projection = opts.projection ?? runIntradayStress(asOf, opts.eventStore);
  const obligations = [...(opts.timeSpecificObligations ?? [])];
  const undrawnCreditZar = opts.undrawnIntradayCreditLinesZar ?? 0;

  // BAU windows carry the day's actual (unstressed) flow folds.
  const bau = projection.bau;

  // Tool 1 — daily maximum intraday liquidity usage: the peak net
  // cumulative OUTFLOW (most negative cumulative net position) across the
  // day. A day with net inflows throughout has zero usage.
  const minCumulativeNetZar = Math.min(0, ...bau.map((w) => w.cumulativeNetZar));
  const dailyMaxUsageZar = Math.max(0, -minCumulativeNetZar);

  // Tool 2 — available intraday liquidity at start of day.
  const availableAtStartZar = projection.startingHQLAZar + undrawnCreditZar;

  // Tool 3 — total payments (gross sent + gross received).
  const grossOutflowsZar = bau.reduce((sum, w) => sum + w.outflowZar, 0);
  const grossInflowsZar = bau.reduce((sum, w) => sum + w.inflowZar, 0);
  const totalPaymentsZar = grossOutflowsZar + grossInflowsZar;

  // Tool 4 — time-specific obligations.
  const timeSpecificZar = obligations.reduce((sum, o) => sum + o.requiredZar, 0);

  // Per-window usage detail (tool 1 decomposition; §4.5 stress input).
  const usageByWindow: IntradayUsageRow[] = bau.map((w) => {
    const usageZar = Math.max(0, -w.cumulativeNetZar);
    return {
      windowLabel: w.windowLabel,
      cumulativeNetZar: w.cumulativeNetZar,
      usageZar,
      usagePctOfAvailable:
        projection.startingHQLAZar + undrawnCreditZar > 0
          ? (usageZar / (projection.startingHQLAZar + undrawnCreditZar)) * 100
          : null,
    };
  });

  // Tool 7 — throughput: cumulative share of daily outflows settled by
  // each window. Null per window when the day has zero outflows.
  let runningOutflow = 0;
  const throughputByWindow: IntradayThroughputRow[] = bau.map((w) => {
    runningOutflow += w.outflowZar;
    return {
      windowLabel: w.windowLabel,
      cumulativeOutflowPct: grossOutflowsZar > 0 ? (runningOutflow / grossOutflowsZar) * 100 : null,
    };
  });
  const finalWindow = throughputByWindow[SETTLEMENT_WINDOWS.length - 1];
  const throughputFinalPct = finalWindow ? finalWindow.cumulativeOutflowPct : null;

  // Headline appetite measure: peak usage as % of available start-of-day
  // liquidity (LRM Policy v1 §4.5 evaluates this against 80%).
  const peakUsagePctOfAvailable =
    availableAtStartZar > 0 ? (dailyMaxUsageZar / availableAtStartZar) * 100 : null;

  const overallStatus: "measured" | "no-positions" =
    projection.startingHQLAZar === 0 ? "no-positions" : "measured";

  const flowStatus = (value: number): "measured" | "no-flows" =>
    value > 0 || overallStatus === "measured" ? "measured" : "no-flows";

  const metrics: IntradayLiquidityMetric[] = [
    {
      tool: "daily-max-usage",
      toolNumber: 1,
      label: BCBS_248_TOOL_LABELS["daily-max-usage"],
      value: dailyMaxUsageZar,
      unit: "zar",
      status: flowStatus(dailyMaxUsageZar),
    },
    {
      tool: "available-at-start",
      toolNumber: 2,
      label: BCBS_248_TOOL_LABELS["available-at-start"],
      value: availableAtStartZar,
      unit: "zar",
      status: flowStatus(availableAtStartZar),
    },
    {
      tool: "total-payments",
      toolNumber: 3,
      label: BCBS_248_TOOL_LABELS["total-payments"],
      value: totalPaymentsZar,
      unit: "zar",
      status: flowStatus(totalPaymentsZar),
    },
    {
      tool: "time-specific-obligations",
      toolNumber: 4,
      label: BCBS_248_TOOL_LABELS["time-specific-obligations"],
      value: timeSpecificZar,
      unit: "zar",
      status: obligations.length > 0 ? "measured" : flowStatus(timeSpecificZar),
    },
    {
      tool: "customer-payments-on-behalf",
      toolNumber: 5,
      label: BCBS_248_TOOL_LABELS["customer-payments-on-behalf"],
      value: null,
      unit: "zar",
      status: "not-applicable",
      reason: NOT_APPLICABLE_REASONS["customer-payments-on-behalf"],
    },
    {
      tool: "intraday-credit-lines",
      toolNumber: 6,
      label: BCBS_248_TOOL_LABELS["intraday-credit-lines"],
      value: null,
      unit: "zar",
      status: "not-applicable",
      reason: NOT_APPLICABLE_REASONS["intraday-credit-lines"],
    },
    {
      tool: "throughput",
      toolNumber: 7,
      label: BCBS_248_TOOL_LABELS.throughput,
      value: throughputFinalPct,
      unit: "pct",
      status: throughputFinalPct === null ? "no-flows" : "measured",
    },
  ];

  return {
    asOf,
    metrics,
    throughputByWindow,
    usageByWindow,
    availableAtStartZar,
    timeSpecificObligations: obligations,
    peakUsagePctOfAvailable,
    overallStatus,
    currency: "ZAR",
  };
}
