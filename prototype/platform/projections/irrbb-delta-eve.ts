// platform/projections/irrbb-delta-eve.ts
//
// IRRBB ΔEVE supervisory-outlier measurement projection.
//
// Computes the measured status for Helena (Chief Risk Officer, governance)'s
// `appetite:irrbb:delta-eve-outlier` appetite line (RAS §B4) from the
// `IRRBBChecked` events of record emitted by Ravi (Treasury and ALM engineer,
// engineering)'s daily ALM run (`runtime/agents/ravi-alm-run.ts`). This is
// deliberately NOT a parallel calculator: the ALM run already computes ΔEVE
// across the six BCBS d365 shock scenarios (bonds folded; IRS DV01 converged
// per PR #1121) and records each scenario's sensitivity as a percentage of
// Tier-1 capital in `IRRBBChecked.payload.deltaPct`. This projection only
// folds those events of record into the appetite line's headline measure:
//
//   maxAbsDeltaPct = max(|deltaPct|) over the latest run's EVE checks
//
// which is exactly the register line's `measurementBinding` (BCBS d365
// §A-3.4 supervisory outlier test: worst-case |ΔEVE| as % of Tier-1).
//
// Classification reads the threshold ladder from the canonical register
// (`platform/risk/ras-appetite-register.ts`, D-RAS-STRUCTURED-REGISTER) via
// `classifyUsageRatio` — a HIGHER-IS-WORSE ladder (green <10% / amber 10-15%
// / red ≥15% of Tier-1). Thresholds are never re-typed here.
//
// Build-phase posture:
//   Zero `IRRBBChecked` EVE events → `{ status: "no-checks" }`. Unlike the
//   cyber (`no-incidents`) and model-tier (`no-models`) lines, an empty
//   IRRBBChecked stream is NOT zero-risk-by-construction — it means Ravi's
//   ALM run has not ticked on this bench. The handler maps `no-checks` to
//   `n/a-build-phase` (measured-class, mirrors the climate line's `no-data`
//   posture), not to green.
//
// Authority: D-IRRBB-DELTA-EVE-OUTLIER-MEASUREMENT (CEO-approved 2026-06-12);
//   D-RAS (CEO-approved 2026-05-06); D-BOND-RAS-APPETITE (CRO-approved
//   2026-06-08); RAS §B4; BCBS d365 §A-3.4; Banks Act Regulations 26 and 27;
//   escalation:helena:unmeasured-lines-2026-06-12.
// Author: Rohan (Risk engineer, engineering)

import type { EventStore } from "../event-store/store";
import {
  type RasMetricStatus,
  classifyUsageRatio,
  formatThresholds,
  requireRasAppetiteLine,
} from "../risk/ras-appetite-register";

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface IrrbbDeltaEveMeasured {
  /** RAG status under the RAS §B4 register ladder. */
  readonly status: Extract<RasMetricStatus, "green" | "amber" | "red">;
  /** Worst-case |ΔEVE| as % of Tier-1 capital across the latest run's shocks. */
  readonly maxAbsDeltaPct: number;
  /** Shock scenario label that produced the worst case. */
  readonly worstShockLabel: string;
  /** ISO business date of the latest ALM run's checks. */
  readonly latestCheckAsOf: string;
  /** Number of EVE shock scenarios in the latest run (BCBS d365 set: 6). */
  readonly scenarioCount: number;
  /** Human-readable note for the appetite line. */
  readonly note: string;
}

export interface IrrbbDeltaEveNoChecks {
  readonly status: "no-checks";
  readonly note: string;
}

export type IrrbbDeltaEveMetric = IrrbbDeltaEveMeasured | IrrbbDeltaEveNoChecks;

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

const B4_LINE_ID = "appetite:irrbb:delta-eve-outlier";

interface IrrbbCheckedEvePayloadLike {
  readonly metric?: unknown;
  readonly shockLabel?: unknown;
  readonly deltaPct?: unknown;
  readonly asOf?: unknown;
}

/**
 * Fold `IRRBBChecked` (metric=EVE) events of record into the RAS §B4
 * appetite-line measure. Latest-run-wins: only the checks carrying the
 * most-recent `as_of` are evaluated (one ALM run emits one check per shock
 * scenario; an older run's worst case is superseded by the newer run's).
 */
export function getIrrbbDeltaEveMetric(store: EventStore): IrrbbDeltaEveMetric {
  const line = requireRasAppetiteLine(B4_LINE_ID);
  const thresholdsPrinted = formatThresholds(line.thresholds);

  let latestAsOf: string | null = null;
  let maxAbsDeltaPct = 0;
  let worstShockLabel = "";
  let scenarioCount = 0;

  for (const e of store.replay({ type: "IRRBBChecked" })) {
    const p = e.payload as IrrbbCheckedEvePayloadLike;
    if (p.metric !== "EVE") continue;
    if (typeof p.deltaPct !== "number") continue;

    if (latestAsOf === null || e.as_of > latestAsOf) {
      // Newer run — reset the fold to this run's checks.
      latestAsOf = e.as_of;
      maxAbsDeltaPct = Math.abs(p.deltaPct);
      worstShockLabel = typeof p.shockLabel === "string" ? p.shockLabel : "unknown";
      scenarioCount = 1;
    } else if (e.as_of === latestAsOf) {
      scenarioCount++;
      const abs = Math.abs(p.deltaPct);
      if (abs > maxAbsDeltaPct) {
        maxAbsDeltaPct = abs;
        worstShockLabel = typeof p.shockLabel === "string" ? p.shockLabel : "unknown";
      }
    }
    // Older as_of than the running latest — superseded, skip.
  }

  if (latestAsOf === null) {
    return {
      status: "no-checks",
      note: [
        "No IRRBBChecked EVE events in the store — Ravi (Treasury and ALM engineer, engineering)'s ALM run has not ticked on this bench.",
        "First run seeds the BCBS d365 §A-3.4 supervisory-outlier measurement.",
        `RAS §B4 thresholds: ${thresholdsPrinted}.`,
      ].join(" "),
    };
  }

  // HIGHER-IS-WORSE ladder (green <10 / amber 10-15 / red ≥15, % of Tier-1).
  const status = classifyUsageRatio(line.thresholds, maxAbsDeltaPct) ?? "green";

  return {
    status: status as IrrbbDeltaEveMeasured["status"],
    maxAbsDeltaPct,
    worstShockLabel,
    latestCheckAsOf: latestAsOf,
    scenarioCount,
    note: [
      `IRRBB ΔEVE supervisory-outlier test: worst-case |ΔEVE| = ${maxAbsDeltaPct.toFixed(2)}% of Tier-1`,
      `(worst shock: ${worstShockLabel}; ${scenarioCount} BCBS d365 scenario(s); latest ALM run as-of ${latestAsOf}).`,
      `RAS §B4 thresholds: ${thresholdsPrinted}.`,
      "Source: Ravi (Treasury and ALM engineer, engineering)'s ALM run IRRBBChecked events of record (BCBS d365 §A-3.4).",
    ].join(" "),
  };
}
