// platform/alm/cfp-ewi.ts
//
// CFP early-warning-indicator (EWI) evaluation engine
// (WS-TREASURER-WAVE1-SUBSTRATE).
//
// Pure evaluation layer behind the `ravi:cfp-ewi-monitor` handler: reads
// the bank's live liquidity measures and returns the LRM Policy v1 §5.2
// trigger events that should fire. Emission is the handler's
// responsibility — this module appends nothing (Principle 1 separation:
// projection/evaluation pure, emission at the handler boundary).
//
// EWI set evaluated against the §5.2 policy-default thresholds:
//
//   Tier 1:
//     IntradayStressDetected            — peak intraday usage > 80% of
//       available start-of-day liquidity (§4.5 stress definition), from
//       the BCBS 248 metrics (`computeIntradayLiquidityMetrics`). Severity
//       "persistent" when the stress condition holds in ≥ 2 NPS windows.
//     CriticalSettlementObligationAtRisk — a time-specific obligation's
//       required value exceeds the liquidity projected available at its
//       deadline window.
//   Tier 2:
//     LcrRatioBreach { severity: "warning" }  — LCR below the 120%
//       internal floor but ≥ 100% (from latest `LCRComputed`).
//     FundingConcentrationAlertTriggered      — single-counterparty
//       funding share ≥ 15% of total liabilities.
//     ExternalCreditEventDetected { impact: "material" } — injectable
//       external credit-event feed (rating-agency / market-spread /
//       counterparty-default watches; licence-day feed wiring).
//   Tier 3:
//     LcrRatioBreach { severity: "critical" } — LCR at or below 100%.
//     NsfrRatioBreach { severity: "critical" } — NSFR at or below 100%
//       (from latest `NSFRComputed`).
//     RecoveryEarlyWarningTriggered           — Recovery Plan EWI trip
//       (ICAAP/ILAAP/Recovery framework §3.3.5); injectable feed until
//       Helena's recovery-plan indicator substrate lands.
//
// §5.2 LCR warning-threshold note: the policy's typed pattern literal is
// `threshold: 115` while its prose rule is "below the internal floor of
// 120% but remains ≥ 100%". The prose rule is operative here (matches §2's
// internal floor + RAS §B3); see the cfp-triggers event-type module header
// for the erratum flag.
//
// Build-phase posture: zero positions → every measure is null /
// no-positions → `evaluateCfpEwis` returns []. No false fires; tests
// assert this explicitly.
//
// Authority: D-TREASURER-WAVE1-SUBSTRATE (CEO-approved 2026-06-11);
//   parent D-TREASURER-ROLE-DEFINITION-REVIEW.
// Citations: LRM Policy v1 §5.2 + §4.5; BCBS 144 Principle 11; BCBS 248;
//   Banks Act 94 of 1990 Reg 26; Principles/1-events-are-truth.md.
// Author: Ravi (Treasury and ALM engineer, engineering — reports to Eitan
//   (Treasurer, governance)).

import type {
  CfpTier,
  CfpTriggerEventType,
  CriticalSettlementObligationAtRiskPayload,
  ExternalCreditEventDetectedPayload,
  ExternalCreditEventImpact,
  FundingConcentrationAlertTriggeredPayload,
  IntradayStressDetectedPayload,
  LcrRatioBreachPayload,
  NsfrRatioBreachPayload,
  RecoveryEarlyWarningTriggeredPayload,
} from "../event-store/event-types/cfp-triggers";
import { CFP_TIER_BY_TRIGGER } from "../event-store/event-types/cfp-triggers";
import type { EventStore } from "../event-store/store";
import {
  type IntradayLiquidityMetricsResult,
  type TimeSpecificObligation,
  computeIntradayLiquidityMetrics,
} from "./intraday-liquidity-metrics";
import { windowIndexForInstant } from "./intraday-stress";

// ---------------------------------------------------------------------------
// Policy-default thresholds (LRM Policy v1 §5.2 + §4.5 + §2)
// ---------------------------------------------------------------------------

/** LCR internal floor (§2; warning band upper bound). */
export const LCR_INTERNAL_FLOOR_PCT = 120;

/** LCR PA regulatory minimum (critical at or below). */
export const LCR_REGULATORY_MINIMUM_PCT = 100;

/** NSFR PA regulatory minimum (critical at or below). */
export const NSFR_REGULATORY_MINIMUM_PCT = 100;

/** Single-counterparty share of total liabilities that trips Tier 2 (§5.2). */
export const FUNDING_CONCENTRATION_COUNTERPARTY_LIMIT_PCT = 15;

/** Peak-usage share of available intraday liquidity that defines intraday stress (§4.5). */
export const INTRADAY_STRESS_USAGE_PCT = 80;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** External credit-event observation (feed item; licence-day wiring). */
export interface ExternalCreditEventObservation {
  impact: ExternalCreditEventImpact;
  description: string;
  detectionSource: string;
  sourceEventId?: string;
}

/** Recovery Plan EWI trip observation (feed item until Helena's substrate lands). */
export interface RecoveryEwiObservation {
  indicatorId: string;
  indicatorLabel: string;
  observed: number | null;
  thresholdDescription: string;
  sourceEventId?: string;
}

/** Fully-injectable input set for one EWI evaluation pass. */
export interface CfpEwiInputs {
  /** Latest LCR ratio (% points) from `LCRComputed`; null when no computation / no positions. */
  lcrRatioPct: number | null;
  lcrSourceEventId?: string;
  /** Latest NSFR ratio (% points) from `NSFRComputed`; null when no computation / no positions. */
  nsfrRatioPct: number | null;
  nsfrSourceEventId?: string;
  /** Largest single-counterparty share of total liabilities (% points); null when unmeasured. */
  counterpartyConcentrationPct: number | null;
  counterpartySubjectRef?: string;
  concentrationSourceEventId?: string;
  /** BCBS 248 seven-tool result for the business date. */
  intradayMetrics: IntradayLiquidityMetricsResult;
  /** Time-specific obligations to test for at-risk coverage (build phase: empty). */
  timeSpecificObligations: readonly TimeSpecificObligation[];
  /** External credit-event feed (build phase: empty). */
  externalCreditEvents: readonly ExternalCreditEventObservation[];
  /** Recovery Plan EWI trips (build phase: empty). */
  recoveryEwiTrips: readonly RecoveryEwiObservation[];
}

/**
 * Load live inputs for an EWI evaluation pass from the projection layer.
 *
 * LCR / NSFR / concentration come from the liquidity-limit engine's
 * observation folds (same upstream events: `LCRComputed`, `NSFRComputed`,
 * `ALCOPackGenerated`); the intraday measures come from the BCBS 248
 * metrics engine. External-credit and recovery-EWI feeds default to empty
 * until their substrates land (licence-day wiring / Helena's recovery-plan
 * indicator substrate).
 */
export async function loadCfpEwiInputs(
  asOf: string,
  opts: { eventStore?: EventStore } = {},
): Promise<CfpEwiInputs> {
  // Lazy import: the projection module binds the composition event store at
  // import time; deferring keeps this engine importable in pure unit tests.
  const { getConcentrationObservations, getPortfolioObservations } = await import(
    "../risk/liquidity-limit-engine/projection"
  );

  const portfolio = getPortfolioObservations(asOf);
  const concentration = getConcentrationObservations(asOf);

  const lcr = portfolio.find((o) => o.line === "lcr-ratio");
  const nsfr = portfolio.find((o) => o.line === "nsfr-ratio");
  const counterparty = concentration.find((o) => o.line === "funding-concentration-counterparty");

  const inputs: CfpEwiInputs = {
    lcrRatioPct: lcr ? lcr.current : null,
    nsfrRatioPct: nsfr ? nsfr.current : null,
    counterpartyConcentrationPct: counterparty ? counterparty.current : null,
    intradayMetrics: computeIntradayLiquidityMetrics(
      asOf,
      opts.eventStore ? { eventStore: opts.eventStore } : {},
    ),
    timeSpecificObligations: [],
    externalCreditEvents: [],
    recoveryEwiTrips: [],
  };
  if (lcr?.sourceEventId) inputs.lcrSourceEventId = lcr.sourceEventId;
  if (nsfr?.sourceEventId) inputs.nsfrSourceEventId = nsfr.sourceEventId;
  if (counterparty?.sourceEventId) inputs.concentrationSourceEventId = counterparty.sourceEventId;
  if (counterparty?.subjectRef) inputs.counterpartySubjectRef = counterparty.subjectRef;
  return inputs;
}

// ---------------------------------------------------------------------------
// Evaluations
// ---------------------------------------------------------------------------

/** One trigger the EWI monitor should emit. */
export type CfpTriggerEvaluation =
  | { type: "IntradayStressDetected"; payload: IntradayStressDetectedPayload }
  | {
      type: "CriticalSettlementObligationAtRisk";
      payload: CriticalSettlementObligationAtRiskPayload;
    }
  | { type: "LcrRatioBreach"; payload: LcrRatioBreachPayload }
  | { type: "NsfrRatioBreach"; payload: NsfrRatioBreachPayload }
  | {
      type: "FundingConcentrationAlertTriggered";
      payload: FundingConcentrationAlertTriggeredPayload;
    }
  | { type: "ExternalCreditEventDetected"; payload: ExternalCreditEventDetectedPayload }
  | { type: "RecoveryEarlyWarningTriggered"; payload: RecoveryEarlyWarningTriggeredPayload };

/**
 * The trigger event types this engine has a wired firing path for. All
 * seven §5.2 types are wired; `recon:cfp-trigger-coverage` asserts every
 * CFP tier is reachable through this set.
 */
export const EWI_WIRED_TRIGGER_TYPES: readonly CfpTriggerEventType[] = [
  "IntradayStressDetected",
  "CriticalSettlementObligationAtRisk",
  "LcrRatioBreach",
  "NsfrRatioBreach",
  "FundingConcentrationAlertTriggered",
  "ExternalCreditEventDetected",
  "RecoveryEarlyWarningTriggered",
];

/**
 * The upstream measurement event types the EWI monitor must subscribe to.
 * `recon:cfp-trigger-coverage` asserts the `ravi:cfp-ewi-monitor`
 * metadata row's `subscribesTo` covers this set.
 */
export const EWI_MONITOR_MEASUREMENT_TYPES = [
  "LCRComputed",
  "NSFRComputed",
  "IntradayLiquidityMetricsComputed",
  "IntradayHQLAStressProjection",
  "ALCOPackGenerated",
  "FundingDrawnDown",
] as const;

function day(asOf: string): string {
  return asOf.slice(0, 10);
}

/**
 * Evaluate the EWI set against the supplied inputs and return the §5.2
 * trigger events that should fire. Pure — no event-store access, no
 * emission.
 *
 * Build-phase zero-position posture: all-null measures → returns [].
 */
export function evaluateCfpEwis(asOf: string, inputs: CfpEwiInputs): CfpTriggerEvaluation[] {
  const out: CfpTriggerEvaluation[] = [];
  const d = day(asOf);

  // --- LCR (Tier 2 warning / Tier 3 critical) -----------------------------
  if (inputs.lcrRatioPct !== null) {
    const lcr = inputs.lcrRatioPct;
    if (lcr <= LCR_REGULATORY_MINIMUM_PCT) {
      out.push({
        type: "LcrRatioBreach",
        payload: {
          triggerId: `CFP-LCR-CRITICAL-${d}`,
          sourceMeasure: "lcr-ratio-pct",
          observed: lcr,
          threshold: LCR_REGULATORY_MINIMUM_PCT,
          thresholdDescription: "LCR at or below the 100% PA regulatory minimum (LRM Policy v1 §5.2 Tier 3)",
          cfpTier: "tier-3",
          detectedAt: asOf,
          severity: "critical",
          ...(inputs.lcrSourceEventId ? { sourceEventId: inputs.lcrSourceEventId } : {}),
        },
      });
    } else if (lcr < LCR_INTERNAL_FLOOR_PCT) {
      out.push({
        type: "LcrRatioBreach",
        payload: {
          triggerId: `CFP-LCR-WARNING-${d}`,
          sourceMeasure: "lcr-ratio-pct",
          observed: lcr,
          threshold: LCR_INTERNAL_FLOOR_PCT,
          thresholdDescription:
            "LCR below the 120% internal floor but at or above the 100% PA minimum (LRM Policy v1 §5.2 Tier 2; §5.2 pattern literal 115 superseded by the prose rule — see cfp-triggers module header)",
          cfpTier: "tier-2",
          detectedAt: asOf,
          severity: "warning",
          ...(inputs.lcrSourceEventId ? { sourceEventId: inputs.lcrSourceEventId } : {}),
        },
      });
    }
  }

  // --- NSFR (Tier 3 critical) ----------------------------------------------
  if (inputs.nsfrRatioPct !== null && inputs.nsfrRatioPct <= NSFR_REGULATORY_MINIMUM_PCT) {
    out.push({
      type: "NsfrRatioBreach",
      payload: {
        triggerId: `CFP-NSFR-CRITICAL-${d}`,
        sourceMeasure: "nsfr-ratio-pct",
        observed: inputs.nsfrRatioPct,
        threshold: NSFR_REGULATORY_MINIMUM_PCT,
        thresholdDescription: "NSFR at or below the 100% PA regulatory minimum (LRM Policy v1 §5.2 Tier 3)",
        cfpTier: "tier-3",
        detectedAt: asOf,
        severity: "critical",
        ...(inputs.nsfrSourceEventId ? { sourceEventId: inputs.nsfrSourceEventId } : {}),
      },
    });
  }

  // --- Funding concentration (Tier 2) --------------------------------------
  if (
    inputs.counterpartyConcentrationPct !== null &&
    inputs.counterpartyConcentrationPct >= FUNDING_CONCENTRATION_COUNTERPARTY_LIMIT_PCT
  ) {
    out.push({
      type: "FundingConcentrationAlertTriggered",
      payload: {
        triggerId: `CFP-FUNDING-CONC-${d}`,
        sourceMeasure: "funding-concentration-counterparty-pct",
        observed: inputs.counterpartyConcentrationPct,
        threshold: FUNDING_CONCENTRATION_COUNTERPARTY_LIMIT_PCT,
        thresholdDescription:
          "Single-counterparty funding at or above 15% of total liabilities (LRM Policy v1 §5.2 Tier 2)",
        cfpTier: "tier-2",
        detectedAt: asOf,
        dimension: "counterparty",
        ...(inputs.counterpartySubjectRef ? { subjectRef: inputs.counterpartySubjectRef } : {}),
        ...(inputs.concentrationSourceEventId
          ? { sourceEventId: inputs.concentrationSourceEventId }
          : {}),
      },
    });
  }

  // --- Intraday stress (Tier 1) ---------------------------------------------
  const peak = inputs.intradayMetrics.peakUsagePctOfAvailable;
  if (peak !== null && peak > INTRADAY_STRESS_USAGE_PCT) {
    const stressedWindows = inputs.intradayMetrics.usageByWindow
      .filter((w) => w.usagePctOfAvailable !== null && w.usagePctOfAvailable > INTRADAY_STRESS_USAGE_PCT)
      .map((w) => w.windowLabel);
    out.push({
      type: "IntradayStressDetected",
      payload: {
        triggerId: `CFP-INTRADAY-STRESS-${d}`,
        sourceMeasure: "intraday-peak-usage-pct-of-available",
        observed: peak,
        threshold: INTRADAY_STRESS_USAGE_PCT,
        thresholdDescription:
          "Peak intraday usage above 80% of available start-of-day liquidity (LRM Policy v1 §4.5; Tier 1 per §5.2)",
        cfpTier: "tier-1",
        detectedAt: asOf,
        severity: stressedWindows.length >= 2 ? "persistent" : "transient",
        stressedWindows: stressedWindows.length > 0 ? stressedWindows : ["16:30"],
      },
    });
  }

  // --- Critical settlement obligations (Tier 1) -----------------------------
  for (const obligation of inputs.timeSpecificObligations) {
    const windowIdx = windowIndexForInstant(obligation.deadline);
    const usageRow = inputs.intradayMetrics.usageByWindow[windowIdx];
    const projectedAvailableZar =
      inputs.intradayMetrics.availableAtStartZar + (usageRow ? usageRow.cumulativeNetZar : 0);
    if (obligation.requiredZar > projectedAvailableZar) {
      out.push({
        type: "CriticalSettlementObligationAtRisk",
        payload: {
          triggerId: `CFP-SETTLEMENT-AT-RISK-${obligation.obligationRef}-${d}`,
          sourceMeasure: "time-specific-obligation-coverage",
          observed: projectedAvailableZar,
          threshold: obligation.requiredZar,
          thresholdDescription:
            "Projected available liquidity at the obligation's deadline window below the obligation value (LRM Policy v1 §5.2 Tier 1; BCBS 248 tool 4)",
          cfpTier: "tier-1",
          detectedAt: asOf,
          obligationRef: obligation.obligationRef,
          deadline: obligation.deadline,
          requiredZar: obligation.requiredZar,
          projectedAvailableZar,
        },
      });
    }
  }

  // --- External credit events (Tier 2; material only) -----------------------
  for (const [i, ev] of inputs.externalCreditEvents.entries()) {
    if (ev.impact !== "material") continue;
    out.push({
      type: "ExternalCreditEventDetected",
      payload: {
        triggerId: `CFP-EXT-CREDIT-${d}-${i + 1}`,
        sourceMeasure: "external-credit-event-feed",
        observed: null,
        observedDetail: ev.description,
        threshold: null,
        thresholdDescription:
          "Material external credit event (LRM Policy v1 §5.2 Tier 2; impact classification by feed)",
        cfpTier: "tier-2",
        detectedAt: asOf,
        impact: ev.impact,
        description: ev.description,
        detectionSource: ev.detectionSource,
        ...(ev.sourceEventId ? { sourceEventId: ev.sourceEventId } : {}),
      },
    });
  }

  // --- Recovery Plan EWIs (Tier 3) -------------------------------------------
  for (const trip of inputs.recoveryEwiTrips) {
    out.push({
      type: "RecoveryEarlyWarningTriggered",
      payload: {
        triggerId: `CFP-RECOVERY-EWI-${trip.indicatorId}-${d}`,
        sourceMeasure: "recovery-plan-ewi",
        observed: trip.observed,
        threshold: null,
        thresholdDescription: trip.thresholdDescription,
        cfpTier: "tier-3",
        detectedAt: asOf,
        indicatorId: trip.indicatorId,
        indicatorLabel: trip.indicatorLabel,
        ...(trip.sourceEventId ? { sourceEventId: trip.sourceEventId } : {}),
      },
    });
  }

  return out;
}

/**
 * Convenience: the set of CFP tiers reachable through the wired trigger
 * types — used by `recon:cfp-trigger-coverage`'s tier-coverage assertion.
 */
export function wiredCfpTiers(): ReadonlySet<CfpTier> {
  const tiers = new Set<CfpTier>();
  for (const type of EWI_WIRED_TRIGGER_TYPES) {
    for (const tier of CFP_TIER_BY_TRIGGER[type]) tiers.add(tier);
  }
  return tiers;
}
