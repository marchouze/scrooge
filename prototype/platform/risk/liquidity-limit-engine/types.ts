// platform/risk/liquidity-limit-engine/types.ts
//
// WS-LIQUIDITY-LIMIT-ENGINE — projected state shapes for the liquidity-
// limit engine. Pure types; no event emission, no runtime state.
//
// Standing authority:
//   - D-RAS (CEO-approved 2026-05-06; Owner Inbox §B3 liquidity-risk lines).
//   - Liquidity Risk Management Policy v1 (Camille + Eitan + Helena,
//     2026-05-11; archive/owner-inbox/2026-05-11_camille-eitan-helena_
//     liquidity-risk-management-policy-v1.md).
//   - brief:ravi:liquidity-limit-engine-mirroring-credit-limit-en:2026-05-21.
//
// Citations:
//   Banks Act 94 of 1990 §§ 60–72;
//   RRB Regulation 26 (LCR + intraday + ILAAP); Regulation 26A (NSFR);
//   PA D6/2015 (LCR); PA D1/2023 (NSFR); BCBS 144; BCBS D295; BCBS D335;
//   BCBS 248 (intraday liquidity);
//   LRM Policy v1 §§ 9.1 + 9.2 + 9.3 (breach taxonomy + escalation +
//     restoration);
//   Procedures/by-policy/liquidity-limit-management.md (PROC-RISK-LLM-01);
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Ravi (Treasury and ALM engineer, engineering — reports to Eitan
//   (Treasurer, governance)).

import type {
  LiquidityBreachSeverity,
  LiquidityLimitLine,
  LiquidityLimitTier,
} from "../../event-store/event-types/liquidity-limit";

// ---------------------------------------------------------------------------
// LiquidityLimitConfig — tier thresholds for each line.
//
// The engine is configured with a set of `LiquidityLimitConfig` rows. Each
// row pins one (`tier`, `line`) pair to a numeric threshold; the breach
// detector reads upstream computed values (LCR ratio, NSFR ratio,
// concentration percentages) and emits a `LiquidityLimitBreached` payload
// when the value crosses the threshold for that tier.
//
// Thresholds are *floors* for ratio lines (LCR ≥ 100% is the PA minimum;
// a value of 95% is a breach) and *ceilings* for concentration lines
// (counterparty concentration ≤ 15% is the limit; a value of 18% is a
// breach). The `direction` field disambiguates.
// ---------------------------------------------------------------------------

export interface LiquidityLimitConfig {
  tier: LiquidityLimitTier;
  line: LiquidityLimitLine;
  /**
   * Threshold value. Units depend on `line`:
   *   lcr-ratio / nsfr-ratio                 — percentage points (e.g. 100).
   *   intraday-liquidity-buffer              — ZAR minor units.
   *   contingent-liquidity                   — ZAR minor units.
   *   funding-concentration-*                — percentage points.
   *   hqla-concentration                     — percentage points.
   */
  threshold: number;
  /**
   * `floor` — observed value `< threshold` triggers breach (ratio lines).
   * `ceiling` — observed value `> threshold` triggers breach (concentration).
   */
  direction: "floor" | "ceiling";
  /** Severity assigned when this threshold is crossed. */
  severity: LiquidityBreachSeverity;
  /** Human-readable units string carried into the breach payload. */
  currentUnit: string;
}

// ---------------------------------------------------------------------------
// LiquidityLimitObservation — engine-internal carrier of (line, current,
// subjectRef) before applying tier thresholds. The projection emits one
// observation per (line, subjectRef) on each run; the breach detector
// consumes these against the configured limits.
// ---------------------------------------------------------------------------

export interface LiquidityLimitObservation {
  line: LiquidityLimitLine;
  current: number;
  /** Sub-subject for concentration / HQLA lines; absent for portfolio ratios. */
  subjectRef?: string;
  /** Upstream event id (LCRComputed / NSFRComputed) for traceability. */
  sourceEventId?: string;
}

// ---------------------------------------------------------------------------
// LiquidityLimitStatus — engine status per line.
//
//   green        — observed value within all configured tier thresholds.
//   amber        — observed value crossed tier-3 / tier-2 threshold.
//   red          — observed value crossed tier-1 threshold (PA minimum
//                  breach, hard line).
//   no-positions — no upstream observation available (the ALM projection
//                  has not yet produced any data, or the build-phase
//                  bank has no balance sheet to measure).
// ---------------------------------------------------------------------------

export type LiquidityLimitStatus = "green" | "amber" | "red" | "no-positions";

/**
 * Engine line-status snapshot — combines the latest observation with the
 * computed tier status.
 */
export interface LiquidityLimitLineStatus {
  line: LiquidityLimitLine;
  /** Optional sub-subject for non-portfolio lines. */
  subjectRef?: string;
  current: number | null;
  /** Tightest tier breached (tier-1 wins over tier-2 wins over tier-3). */
  worstTier: LiquidityLimitTier | null;
  status: LiquidityLimitStatus;
  currentUnit: string;
}
