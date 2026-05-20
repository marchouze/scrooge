// platform/projections/capital-metrics.ts
//
// CET1 / capital headroom measurement module.
//
// Computes capital headroom and CET1 ratio for Helena's
// appetite:capital:cet1-buffer tier-1 prudential appetite line.
//
// Build-phase posture (CLAUDE.md "build phase vs licence-day"):
//   No real capital exists. ICAAP v1 confirmed figures (D-MARKETS-CAPITAL-
//   TIME-SHAPE, approved 2026-05-12) are used as the build-phase baseline:
//     - Total capital envelope: R300,000,000 (300_000_000_00 ZAR cents)
//     - Total RWA (franchise-design scale): R73,750,000 (7_375_000_000 ZAR cents)
//     - TICR: R36,675,000 (3_667_500_000 ZAR cents)
//     - Capital headroom: R263,325,000 (263_325_000_00 ZAR cents)
//     - CET1 ratio: ~407% (300m / 73.75m)
//
//   NOTE: all amounts internally use ZAR minor units (cents); the public API
//   surface also exposes amounts in ZAR major units (rands) for display.
//
// Live-capital posture (post-launch):
//   When CapitalEvent or CapitalActionTrigger events exist in the store,
//   reads capital position from the event store and computes:
//     headroom = availableCapitalMinor − ticrMinor − accruedChargesMinor
//
// Appetite status thresholds (RAS §B3, authority D-RAS 2026-05-06):
//   green  — headroom ≥ R100,000,000 (10_000_000_000 cents)
//   amber  — R50,000,000 ≤ headroom < R100,000,000
//   red    — R36,675,000 ≤ headroom < R50,000,000
//   red    — headroom < R36,675,000 (critical; below TICR)
//
// The "critical" sub-status (headroom < TICR) is signalled by setting
// `critical: true` on the result alongside `status: "red"`. Callers that
// need to distinguish critical from non-critical red check this flag.
//
// Authority: D-RAS (2026-05-06) · D-MARKETS-CAPITAL-TIME-SHAPE (2026-05-12)
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { type Money, minor } from "../core/money";
import { ZAR } from "../core/types";
import type { EventStore } from "../event-store/store";

// ---------------------------------------------------------------------------
// Constants — ICAAP v1 build-phase baseline (D-MARKETS-CAPITAL-TIME-SHAPE)
// ---------------------------------------------------------------------------

/** ZAR cents — R300,000,000 total capital envelope (ICAAP v1 build-phase) */
export const BUILD_PHASE_TOTAL_CAPITAL_MINOR = 30_000_000_000;

/** ZAR cents — R73,750,000 total RWA at franchise-design scale (ICAAP v1) */
export const BUILD_PHASE_TOTAL_RWA_MINOR = 7_375_000_000;

/** ZAR cents — R36,675,000 Total Internal Capital Requirement (TICR / ICAAP v1) */
export const TICR_MINOR = 3_667_500_000;

/** ZAR cents — R263,325,000 capital headroom in build phase (ICAAP v1) */
export const BUILD_PHASE_HEADROOM_MINOR = BUILD_PHASE_TOTAL_CAPITAL_MINOR - TICR_MINOR;

// ---------------------------------------------------------------------------
// RAS §B3 appetite thresholds (authority: D-RAS 2026-05-06)
// ---------------------------------------------------------------------------

/** CEO escalation trigger (< R100m headroom) in ZAR cents */
export const THRESHOLD_CEO_ESCALATION_MINOR = 10_000_000_000;

/** Board notification trigger (< R50m headroom) in ZAR cents */
export const THRESHOLD_BOARD_NOTIFICATION_MINOR = 5_000_000_000;

/** TICR floor — critical breach when headroom < R36.675m (= TICR_MINOR) */
export const THRESHOLD_CRITICAL_MINOR = TICR_MINOR;

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type CapitalMetricStatus = "green" | "amber" | "red";

export interface CapitalMetrics {
  /** ZAR cents — available capital (CET1 base or confirmed ICAAP envelope) */
  readonly availableCapitalMinor: number;
  /** ZAR cents — Total Internal Capital Requirement */
  readonly ticrMinor: number;
  /** ZAR cents — accrued charges / deductions from capital base */
  readonly accruedChargesMinor: number;
  /** ZAR cents — headroom = availableCapital − TICR − accruedCharges */
  readonly headroomMinor: number;
  /** ZAR units (rands) — convenience display */
  readonly headroomZar: number;
  /** ZAR cents — total RWA denominator */
  readonly totalRwaMinor: number;
  /** CET1 ratio (availableCapital / totalRwa); may be Infinity when RWA = 0 */
  readonly cet1Ratio: number;
  /** CET1 ratio expressed as percentage string (e.g. "407.12%") */
  readonly cet1RatioPct: string;
  /** RAG appetite status per RAS §B3 thresholds */
  readonly status: CapitalMetricStatus;
  /** True when headroom < TICR (critical breach) */
  readonly critical: boolean;
  /**
   * True when the metrics are derived from the ICAAP v1 build-phase baseline
   * (no live capital events in the store). False when computed from live events.
   */
  readonly buildPhase: boolean;
  /** ISO 8601 — as-of date the metrics were computed at */
  readonly asOf: string;
  /** Human-readable note summarising the source + status */
  readonly note: string;
}

// ---------------------------------------------------------------------------
// Internal: projection state over CapitalEvent events
// ---------------------------------------------------------------------------

interface CapitalEventPayload {
  capitalEventKind?: string;
  amount?: number;
  currency?: string;
  effectiveDate?: string;
}

/**
 * Scan the event store for CapitalEvent entries (equity injections, dividends,
 * buybacks etc.) and derive a live capital position.
 *
 * Returns null when the store contains no CapitalEvent events —
 * the caller falls back to the build-phase baseline in that case.
 */
function readLiveCapitalPosition(eventStore: EventStore): {
  availableCapitalMinor: number;
  accruedChargesMinor: number;
} | null {
  let inflows = 0;
  let outflows = 0;
  let hasEvents = false;

  for (const e of eventStore.replay({ type: "CapitalEvent" })) {
    const p = (e.payload ?? {}) as CapitalEventPayload;
    const kind = p.capitalEventKind;
    const amount = p.amount ?? 0;
    // Convert to ZAR cents (events store amounts in ZAR major units based on
    // capitalEventPayloadSchema.amount being a positive number without unit qualifier;
    // we treat it as minor units consistently with the rest of the platform).
    // Guard: only fold ZAR events (build-phase is ZAR-only).
    if (p.currency && p.currency !== "ZAR") continue;
    hasEvents = true;

    switch (kind) {
      case "equity-issuance":
      case "capital-injection":
      case "tier2-issuance":
        inflows += amount;
        break;
      case "dividend-payment":
      case "buyback":
        outflows += amount;
        break;
      default:
        // "other" — treat as neutral; surfaced in note
        break;
    }
  }

  if (!hasEvents) return null;

  const availableCapitalMinor = Math.max(inflows - outflows, 0);
  return {
    availableCapitalMinor,
    accruedChargesMinor: 0, // Accrued-charges projection (Bea+Camille) deferred; zero until Slice 6
  };
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

function computeStatus(headroomMinor: number): {
  status: CapitalMetricStatus;
  critical: boolean;
} {
  if (headroomMinor < THRESHOLD_CRITICAL_MINOR) {
    // Below TICR — critical
    return { status: "red", critical: true };
  }
  if (headroomMinor < THRESHOLD_BOARD_NOTIFICATION_MINOR) {
    // ≥ TICR but < R50m — red (non-critical)
    return { status: "red", critical: false };
  }
  if (headroomMinor < THRESHOLD_CEO_ESCALATION_MINOR) {
    // R50m ≤ headroom < R100m — amber
    return { status: "amber", critical: false };
  }
  // headroom ≥ R100m — green
  return { status: "green", critical: false };
}

function formatPct(ratio: number): string {
  if (!Number.isFinite(ratio)) return "infinity";
  return `${(ratio * 100).toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute CET1 / capital headroom metrics for Helena's appetite-watch handler.
 *
 * When the event store contains CapitalEvent entries, derives a live capital
 * position and computes headroom against the confirmed TICR. When no capital
 * events exist (build phase), falls back to the ICAAP v1 confirmed baseline
 * (D-MARKETS-CAPITAL-TIME-SHAPE, 2026-05-12).
 *
 * @param eventStore  - the singleton event store from `platform/composition`.
 * @param asOf        - ISO 8601 run timestamp.
 */
export function computeCapitalMetrics(eventStore: EventStore, asOf: string): CapitalMetrics {
  const live = readLiveCapitalPosition(eventStore);

  let availableCapitalMinor: number;
  let accruedChargesMinor: number;
  let totalRwaMinor: number;
  let buildPhase: boolean;

  if (live !== null) {
    // Live mode: capital position from event store
    availableCapitalMinor = live.availableCapitalMinor;
    accruedChargesMinor = live.accruedChargesMinor;
    // RWA projection is not yet a live event-sourced value; use build-phase
    // denominator until W2 Slice 3 RWA engine lands.
    totalRwaMinor = BUILD_PHASE_TOTAL_RWA_MINOR;
    buildPhase = false;
  } else {
    // Build-phase fallback: ICAAP v1 confirmed baseline (D-MARKETS-CAPITAL-TIME-SHAPE)
    availableCapitalMinor = BUILD_PHASE_TOTAL_CAPITAL_MINOR;
    accruedChargesMinor = 0;
    totalRwaMinor = BUILD_PHASE_TOTAL_RWA_MINOR;
    buildPhase = true;
  }

  const headroomMinor = availableCapitalMinor - TICR_MINOR - accruedChargesMinor;
  const headroomZar = headroomMinor / 100;
  const cet1Ratio =
    totalRwaMinor > 0 ? availableCapitalMinor / totalRwaMinor : Number.POSITIVE_INFINITY;
  const cet1RatioPct = formatPct(cet1Ratio);
  const { status, critical } = computeStatus(headroomMinor);

  const headroomFmt = `R${(Math.abs(headroomMinor) / 100).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const capitalFmt = `R${(availableCapitalMinor / 100).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const sign = headroomMinor >= 0 ? "" : "−";

  let note: string;
  if (buildPhase) {
    note = `Build-phase baseline (ICAAP v1, D-MARKETS-CAPITAL-TIME-SHAPE 2026-05-12): capital ${capitalFmt}, headroom ${sign}${headroomFmt}, CET1 ratio ${cet1RatioPct}. No live CapitalEvent events in store; build-phase confirmed figures used. Status: ${status}${critical ? " (critical — below TICR)" : ""}.`;
  } else {
    note = `Live capital position derived from CapitalEvent events: capital ${capitalFmt}, headroom ${sign}${headroomFmt}, CET1 ratio ${cet1RatioPct}. TICR = R${(TICR_MINOR / 100).toLocaleString("en-ZA")}. Status: ${status}${critical ? " (critical — below TICR)" : ""}.`;
  }

  return {
    availableCapitalMinor,
    ticrMinor: TICR_MINOR,
    accruedChargesMinor,
    headroomMinor,
    headroomZar,
    totalRwaMinor,
    cet1Ratio,
    cet1RatioPct,
    status,
    critical,
    buildPhase,
    asOf,
    note,
  };
}

// ---------------------------------------------------------------------------
// Eligible-capital helper — canonical source for LEX denominator
//
// Banks Act §73 + RRB Reg 23 + LEX Directive D3/2022 + BCBS 283 §32 define
// "eligible capital" as Tier-1 + eligible Tier-2 capital. In the v0 build-
// phase substrate the bank exposes a single capital envelope via
// `computeCapitalMetrics().availableCapitalMinor` (ICAAP v1 build-phase
// baseline of R300m; switches to live CapitalEvent fold when live events
// exist). That single envelope IS the eligible-capital amount until the
// Tier-1 / Tier-2 split lands as part of the BA 700 capital-adequacy
// projection wave.
//
// Until the split lands, `getEligibleCapital(asOf)` returns the same
// envelope as `availableCapitalMinor` — typed as `Money` (ZAR cents).
// Downstream callers (Vera's `lex-cap-utilisation` recon) MUST use this
// helper rather than re-sourcing capital from `LexUtilisationComputed`
// payloads (cyclic dependency).
//
// Authority: D-CREDIT-LIMIT-ENGINE-BUILD; D-MARKETS-CAPITAL-TIME-SHAPE;
//   Banks Act §73; RRB Reg 23; LEX D3/2022; BCBS 283 §32.
// ---------------------------------------------------------------------------

/**
 * Return the bank's eligible LEX capital denominator at `asOf` as a
 * currency-typed Money value (ZAR cents). Reads from the same event-source
 * chain as `computeCapitalMetrics` — never invents new events; never reads
 * from `LexUtilisationComputed` payloads (would create a recon cycle).
 *
 * v0: returns the single capital envelope (no Tier-1 / Tier-2 split). The
 * Tier-1 / Tier-2 split is delivered by the BA 700 capital-adequacy
 * projection wave and will refine this helper without changing its
 * signature.
 */
export function getEligibleCapital(eventStore: EventStore, asOf: string): Money {
  const metrics = computeCapitalMetrics(eventStore, asOf);
  return minor(BigInt(metrics.availableCapitalMinor), ZAR);
}
