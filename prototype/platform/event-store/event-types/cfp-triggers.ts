// platform/event-store/event-types/cfp-triggers.ts
//
// WS-TREASURER-WAVE1-SUBSTRATE — Contingency Funding Plan (CFP) trigger
// typed event-payload schemas.
//
// The Liquidity Risk Management Policy v1 §5.2 organises the CFP in three
// activation tiers and names SEVEN typed trigger events. Until this module
// landed, none of those types existed in the event-type registry — the CFP
// was policy prose, not an executable control. This module registers the
// seven trigger types exactly as named in §5.2:
//
//   Tier 1 — Intraday stress (automatic activation; same-day measures):
//     IntradayStressDetected { severity: "persistent" }
//     CriticalSettlementObligationAtRisk { }
//
//   Tier 2 — 30-day stress (ALCO within 24h + CRO sign-off):
//     LcrRatioBreach { severity: "warning" }   (LCR below the 120% internal
//                                               floor but ≥ 100%)
//     FundingConcentrationAlertTriggered { }   (single-counterparty ≥ 15% of
//                                               total liabilities)
//     ExternalCreditEventDetected { impact: "material" }
//
//   Tier 3 — Systemic / survival (full CFP activation; CEO + Board + PA):
//     LcrRatioBreach { severity: "critical" }  (LCR at or below 100%)
//     NsfrRatioBreach { severity: "critical" } (NSFR at or below 100%)
//     RecoveryEarlyWarningTriggered { }        (Recovery Plan EWI trip)
//
// Per the dispatch brief, each trigger payload carries: the source measure
// evaluated, the threshold crossed, the CFP tier the event activates, and
// the detection timestamp; citations ride on the event envelope (Principle 2).
//
// NOTE on the §5.2 LCR warning threshold literal: the policy's typed-event
// pattern originally read `LcrRatioBreach { severity: "warning",
// threshold: 115 }` while its own prose defines the warning band as "LCR
// falls below the internal floor of 120% but remains ≥ 100%". The prose
// definition was always the operative rule (it matches §2's 120% internal
// floor and the RAS §B3 LCR bands); the EWI monitor emits `threshold: 120`
// for the warning severity. ERRATUM RESOLVED: Helena (Chief Risk Officer,
// governance — LRM policy owner) corrected the §5.2 literal to 120 on
// 2026-06-11 (LRM Policy v1.4 change log; dispatch
// brief:helena:appetite-liquidity-intraday-ras-line-calibrate-b:2026-06-11,
// under D-TREASURER-WAVE1-SUBSTRATE). Policy and code now agree.
//
// Build-phase posture: zero positions → no false trigger fires. The EWI
// monitor (`ravi:cfp-ewi-monitor`) only emits when a live measure crosses
// a threshold; `no-positions` / null measures never fire.
//
// Authority: D-TREASURER-WAVE1-SUBSTRATE (CEO-approved 2026-06-11);
//   parent D-TREASURER-ROLE-DEFINITION-REVIEW.
// Citations:
//   Policies/liquidity-risk-management-policy-v1.md §5.2 (trigger events
//     and severity tiers) + §4.5 (intraday stress definition);
//   BCBS 144 (Principles for Sound Liquidity Risk Management, 2008,
//     Principle 11 — contingency funding plans);
//   BCBS 248 (Monitoring tools for intraday liquidity management, 2013);
//   Banks Act 94 of 1990 Reg 26 (liquidity-risk management);
//   Principles/1-events-are-truth.md; Principles/2-single-graph-discipline.md.
// Author: Ravi (Treasury and ALM engineer, engineering — reports to Eitan
//   (Treasurer, governance)).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { deterministicAggregateId, makeAggregateLabel } from "../aggregate";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Shared vocabulary
// ---------------------------------------------------------------------------

/** CFP activation tier per LRM Policy v1 §5.2. */
export const cfpTierSchema = z.enum(["tier-1", "tier-2", "tier-3"]);

export type CfpTier = z.infer<typeof cfpTierSchema>;

/**
 * Base fields every CFP trigger payload carries (dispatch-brief contract):
 * source measure, threshold crossed, CFP tier activated, detection time.
 */
const cfpTriggerBaseFields = {
  /** Trigger identifier. Convention: `CFP-<TYPE-SLUG>-<YYYY-MM-DD>[-<seq>]`. */
  triggerId: z.string().min(1),

  /**
   * The source measure the EWI monitor evaluated — e.g. "lcr-ratio-pct"
   * (from `LCRComputed`), "nsfr-ratio-pct" (from `NSFRComputed`),
   * "intraday-peak-usage-pct-of-available" (from the BCBS 248 metrics),
   * "funding-concentration-counterparty-pct", "recovery-plan-ewi",
   * "external-credit-event-feed", "time-specific-obligation-coverage".
   */
  sourceMeasure: z.string().min(1),

  /**
   * Observed value of the source measure at detection. Null when the
   * trigger is categorical (e.g. an external credit event with no single
   * numeric observation); pair with `observedDetail` in that case.
   */
  observed: z.number().nullable(),

  /** Human-readable elaboration of the observation (optional). */
  observedDetail: z.string().min(1).optional(),

  /**
   * Threshold crossed (same units as `observed`). Null for categorical
   * triggers; pair with `thresholdDescription`.
   */
  threshold: z.number().nullable(),

  /** Human-readable threshold description — e.g. "LCR internal floor 120%". */
  thresholdDescription: z.string().min(1),

  /** CFP tier this event activates per LRM Policy v1 §5.2. */
  cfpTier: cfpTierSchema,

  /** ISO 8601 timestamp the EWI monitor detected the threshold crossing. */
  detectedAt: z.string().min(1),

  /**
   * Optional upstream-event reference — the `event_id` of the measurement
   * event the monitor read (e.g. an `LCRComputed` event).
   */
  sourceEventId: z.string().min(1).optional(),
} as const;

// ---------------------------------------------------------------------------
// IntradayStressDetected — Tier 1 (LRM Policy v1 §5.2 + §4.5)
// ---------------------------------------------------------------------------

/**
 * Intraday stress severity per §4.5: "transient" (expected to self-correct
 * within the business day; monitoring only) vs "persistent" (activates the
 * Tier-1 CFP intraday-funding escalation per §5.3).
 */
export const intradayStressSeveritySchema = z.enum(["transient", "persistent"]);

export type IntradayStressSeverity = z.infer<typeof intradayStressSeveritySchema>;

export const intradayStressDetectedPayloadSchema = z.object({
  ...cfpTriggerBaseFields,
  /** §4.5 transient/persistent classification. Tier-1 activation is automatic only for "persistent". */
  severity: intradayStressSeveritySchema,
  /** NPS settlement windows in which the stress condition held (SA clock labels). */
  stressedWindows: z.array(z.string().min(1)).min(1),
});

export type IntradayStressDetectedPayload = z.infer<typeof intradayStressDetectedPayloadSchema>;

export function makeIntradayStressDetected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IntradayStressDetectedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("cfp-trigger", args.payload.triggerId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IntradayStressDetected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: intradayStressDetectedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// CriticalSettlementObligationAtRisk — Tier 1 (LRM Policy v1 §5.2 + §4.2 tool 4)
// ---------------------------------------------------------------------------

export const criticalSettlementObligationAtRiskPayloadSchema = z.object({
  ...cfpTriggerBaseFields,
  /** Reference to the at-risk obligation (settlement instruction id, BondservAfrica cut-off label, MT202COV reference). */
  obligationRef: z.string().min(1),
  /** ISO 8601 deadline of the time-specific obligation. */
  deadline: z.string().min(1),
  /** ZAR value required to meet the obligation. */
  requiredZar: z.number().nonnegative(),
  /** ZAR liquidity projected available at the deadline window. */
  projectedAvailableZar: z.number(),
});

export type CriticalSettlementObligationAtRiskPayload = z.infer<
  typeof criticalSettlementObligationAtRiskPayloadSchema
>;

export function makeCriticalSettlementObligationAtRisk(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CriticalSettlementObligationAtRiskPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("cfp-trigger", args.payload.triggerId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CriticalSettlementObligationAtRisk",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: criticalSettlementObligationAtRiskPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// LcrRatioBreach — Tier 2 (warning) / Tier 3 (critical)
// ---------------------------------------------------------------------------

/**
 * LCR breach severity per §5.2:
 *   warning  — LCR below the 120% internal floor but ≥ 100% → Tier 2.
 *   critical — LCR at or below 100% (PA regulatory minimum) → Tier 3.
 */
export const ratioBreachSeveritySchema = z.enum(["warning", "critical"]);

export type RatioBreachSeverity = z.infer<typeof ratioBreachSeveritySchema>;

export const lcrRatioBreachPayloadSchema = z.object({
  ...cfpTriggerBaseFields,
  severity: ratioBreachSeveritySchema,
});

export type LcrRatioBreachPayload = z.infer<typeof lcrRatioBreachPayloadSchema>;

export function makeLcrRatioBreach(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LcrRatioBreachPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("cfp-trigger", args.payload.triggerId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LcrRatioBreach",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: lcrRatioBreachPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// NsfrRatioBreach — Tier 3 (critical; warning reserved for the 115% internal floor)
// ---------------------------------------------------------------------------

export const nsfrRatioBreachPayloadSchema = z.object({
  ...cfpTriggerBaseFields,
  /**
   * §5.2 names only `severity: "critical"` (NSFR at or below 100%) as a
   * Tier-3 trigger. "warning" is reserved for the 115% internal floor
   * (RAS §B3) — it does not activate a CFP tier and the EWI monitor does
   * not emit it in this slice.
   */
  severity: ratioBreachSeveritySchema,
});

export type NsfrRatioBreachPayload = z.infer<typeof nsfrRatioBreachPayloadSchema>;

export function makeNsfrRatioBreach(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: NsfrRatioBreachPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("cfp-trigger", args.payload.triggerId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "NsfrRatioBreach",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: nsfrRatioBreachPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// FundingConcentrationAlertTriggered — Tier 2
// ---------------------------------------------------------------------------

/** Concentration dimension. §5.2 names single-counterparty (≥ 15% of total liabilities) as the Tier-2 trigger. */
export const fundingConcentrationDimensionSchema = z.enum(["counterparty", "depositor", "tenor"]);

export type FundingConcentrationDimension = z.infer<typeof fundingConcentrationDimensionSchema>;

export const fundingConcentrationAlertTriggeredPayloadSchema = z.object({
  ...cfpTriggerBaseFields,
  dimension: fundingConcentrationDimensionSchema,
  /** Counterparty / depositor / tenor-bucket reference the concentration sits against. */
  subjectRef: z.string().min(1).optional(),
});

export type FundingConcentrationAlertTriggeredPayload = z.infer<
  typeof fundingConcentrationAlertTriggeredPayloadSchema
>;

export function makeFundingConcentrationAlertTriggered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FundingConcentrationAlertTriggeredPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("cfp-trigger", args.payload.triggerId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FundingConcentrationAlertTriggered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fundingConcentrationAlertTriggeredPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// ExternalCreditEventDetected — Tier 2 (impact: "material")
// ---------------------------------------------------------------------------

export const externalCreditEventImpactSchema = z.enum(["immaterial", "material"]);

export type ExternalCreditEventImpact = z.infer<typeof externalCreditEventImpactSchema>;

export const externalCreditEventDetectedPayloadSchema = z.object({
  ...cfpTriggerBaseFields,
  /** §5.2: only `impact: "material"` activates Tier 2. Immaterial events are logged for trend monitoring. */
  impact: externalCreditEventImpactSchema,
  /** What happened — e.g. "sovereign downgrade to sub-investment-grade", "correspondent bank CDS widening". */
  description: z.string().min(1),
  /** Where the detection came from — e.g. "rating-agency-feed", "market-spread-watch", "counterparty-default-notice". */
  detectionSource: z.string().min(1),
});

export type ExternalCreditEventDetectedPayload = z.infer<
  typeof externalCreditEventDetectedPayloadSchema
>;

export function makeExternalCreditEventDetected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ExternalCreditEventDetectedPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("cfp-trigger", args.payload.triggerId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ExternalCreditEventDetected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: externalCreditEventDetectedPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// RecoveryEarlyWarningTriggered — Tier 3
// ---------------------------------------------------------------------------

export const recoveryEarlyWarningTriggeredPayloadSchema = z.object({
  ...cfpTriggerBaseFields,
  /** Recovery Plan early-warning indicator id per the ICAAP/ILAAP/Recovery triplet (§3.3.5 of the framework). */
  indicatorId: z.string().min(1),
  /** Human-readable indicator label. */
  indicatorLabel: z.string().min(1),
});

export type RecoveryEarlyWarningTriggeredPayload = z.infer<
  typeof recoveryEarlyWarningTriggeredPayloadSchema
>;

export function makeRecoveryEarlyWarningTriggered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RecoveryEarlyWarningTriggeredPayload;
  eventId?: string;
}): Event {
  const aggregateLabel = makeAggregateLabel("cfp-trigger", args.payload.triggerId);
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RecoveryEarlyWarningTriggered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: recoveryEarlyWarningTriggeredPayloadSchema.parse(args.payload),
    aggregateId: deterministicAggregateId(aggregateLabel),
    aggregateLabel,
  });
}

// ---------------------------------------------------------------------------
// CFP_TRIGGER_TYPED_EVENT_TYPES — registry of event types in this module.
//
// To add a new CFP trigger event type:
//   (1) define its payload schema + factory above,
//   (2) add its name to this array + a tier mapping below,
//   (3) add a row to platform/event-store/registry/cfp-triggers.ts,
//   (4) add a spread in event-types/index.ts.
// ---------------------------------------------------------------------------

export const CFP_TRIGGER_TYPED_EVENT_TYPES = [
  "IntradayStressDetected",
  "CriticalSettlementObligationAtRisk",
  "LcrRatioBreach",
  "NsfrRatioBreach",
  "FundingConcentrationAlertTriggered",
  "ExternalCreditEventDetected",
  "RecoveryEarlyWarningTriggered",
] as const;

export type CfpTriggerEventType = (typeof CFP_TRIGGER_TYPED_EVENT_TYPES)[number];

/**
 * CFP tier(s) each trigger type can activate per LRM Policy v1 §5.2.
 * `LcrRatioBreach` spans two tiers because severity selects the tier
 * (warning → tier-2; critical → tier-3).
 *
 * The `recon:cfp-trigger-coverage` gate asserts every tier has at least
 * one wired firing path through this map.
 */
export const CFP_TIER_BY_TRIGGER: Readonly<Record<CfpTriggerEventType, readonly CfpTier[]>> = {
  IntradayStressDetected: ["tier-1"],
  CriticalSettlementObligationAtRisk: ["tier-1"],
  LcrRatioBreach: ["tier-2", "tier-3"],
  NsfrRatioBreach: ["tier-3"],
  FundingConcentrationAlertTriggered: ["tier-2"],
  ExternalCreditEventDetected: ["tier-2"],
  RecoveryEarlyWarningTriggered: ["tier-3"],
};
