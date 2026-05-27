// platform/event-store/event-types/risk-treasury-extended.ts
//
// Extended risk, ALM, capital, liquidity event-payload schemas.
//
// Covers: AppetiteBreach, LimitBreachProposed, LimitBreachActioned,
//   BacktestTriggered, RASCalibrationChange, RiskAppetiteSnapshot,
//   IRRBBExcursion, ALMReadinessSnapshot, CyberResilienceSnapshot,
//   OperationalResilienceSnapshot, LegalReadinessSnapshot,
//   TaxReadinessSnapshot, PaymentsReadinessSnapshot, MarketsReadinessSnapshot,
//   IcaapIlaapInputReady, CapitalActionTrigger, CapitalEvent,
//   LCRRatioProjection, NSFRRatioProjection, HQLACompositionDrift,
//   LiquiditySnapshot, CurveSourceAnomaly, CutOffBreach,
//   SAMOSFundingShortfall, ModelRegistered
//
// Authority: F-032 (event-type-registry-coverage recon).
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// AppetiteBreach
// ---------------------------------------------------------------------------

export const appetiteBreachPayloadSchema = z.object({
  breachId: z.string().min(1),
  riskDomain: z.string().min(1),
  limitName: z.string().min(1),
  limitValue: z.number(),
  actualValue: z.number(),
  breachPct: z.number(),
  detectedAt: z.string().min(1),
  severity: z.enum(["warn", "breach", "critical"]),
  reportingPeriod: z.string().optional(),
});

export type AppetiteBreachPayload = z.infer<typeof appetiteBreachPayloadSchema>;

export function makeAppetiteBreach(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AppetiteBreachPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AppetiteBreach",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: appetiteBreachPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LimitBreachProposed
// ---------------------------------------------------------------------------

export const limitBreachProposedPayloadSchema = z.object({
  breachId: z.string().min(1),
  limitName: z.string().min(1),
  limitValue: z.number(),
  actualValue: z.number(),
  detectedAt: z.string().min(1),
  severity: z.enum(["warn", "breach", "critical"]),
  proposedAction: z.string().optional(),
  instrument: z.string().optional(),
});

export type LimitBreachProposedPayload = z.infer<typeof limitBreachProposedPayloadSchema>;

export function makeLimitBreachProposed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LimitBreachProposedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LimitBreachProposed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: limitBreachProposedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LimitBreachActioned
// ---------------------------------------------------------------------------

export const limitBreachActionedPayloadSchema = z.object({
  breachId: z.string().min(1),
  limitName: z.string().min(1),
  actionTaken: z.string().min(1),
  actionedBy: z.string().min(1),
  actionedAt: z.string().min(1),
  outcome: z.enum(["resolved", "escalated", "accepted", "rejected"]),
  notes: z.string().optional(),
});

export type LimitBreachActionedPayload = z.infer<typeof limitBreachActionedPayloadSchema>;

export function makeLimitBreachActioned(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LimitBreachActionedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LimitBreachActioned",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: limitBreachActionedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BacktestTriggered
// ---------------------------------------------------------------------------

export const backtestTriggeredPayloadSchema = z.object({
  backtestId: z.string().min(1),
  modelId: z.string().min(1),
  triggeredBy: z.string().min(1),
  triggeredAt: z.string().min(1),
  backtestKind: z.enum(["scheduled", "ad-hoc", "breach-triggered"]),
  windowDays: z.number().int().positive().optional(),
});

export type BacktestTriggeredPayload = z.infer<typeof backtestTriggeredPayloadSchema>;

export function makeBacktestTriggered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BacktestTriggeredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BacktestTriggered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: backtestTriggeredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RASCalibrationChange
// ---------------------------------------------------------------------------

export const rasCalibrationChangePayloadSchema = z.object({
  calibrationId: z.string().min(1),
  limitScheduleId: z.string().min(1),
  changedBy: z.string().min(1),
  changedAt: z.string().min(1),
  effectiveDate: z.string().min(1),
  changeKind: z.enum(["tighten", "loosen", "restructure"]),
  approvedBy: z.string().optional(),
  rationale: z.string().optional(),
});

export type RASCalibrationChangePayload = z.infer<typeof rasCalibrationChangePayloadSchema>;

export function makeRASCalibrationChange(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RASCalibrationChangePayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RASCalibrationChange",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: rasCalibrationChangePayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RiskAppetiteSnapshot
// ---------------------------------------------------------------------------

// RiskAppetiteSnapshot payload — two emission shapes exist in the codebase:
//
//   Shape A (helena-risk-appetite-watch.ts): emitted by the standing appetite-
//     watch handler. Fields: appetiteLineCount, measuredCount, unmeasuredCount,
//     nABuildPhaseCount, openBreaches, tier1OpenBreaches, tier2OpenBreaches,
//     disposedBreaches, daysSinceRasReview, runTrigger, lineStatuses.
//
//   Shape B (original schema): fields snapshotId, asOf, overallStatus,
//     breachCount (plus optional VaR/stress/concentration utilisation pcts).
//     Was defined before the handler was written; the two shapes diverged.
//
// Resolution (2026-05-27): all fields optional so both shapes are valid.
// `.passthrough()` allows either shape's fields (and any future extension)
// through validation without stripping unknown keys. The authoritative
// payload shape is the one the handler emits (Shape A); Shape B fields
// are retained for backward-compat with any consumer that reads them.
//
// Authority: POSTING_RULE_REGISTRY; Team/Helena.md § 9 (Outputs).
export const riskAppetiteSnapshotPayloadSchema = z
  .object({
    // Shape B — original schema fields (kept optional for backward compat)
    snapshotId: z.string().min(1).optional(),
    asOf: z.string().min(1).optional(),
    varUtilisationPct: z.number().min(0).max(100).optional(),
    stressPnLUtilisationPct: z.number().min(0).max(100).optional(),
    concentrationUtilisationPct: z.number().min(0).max(100).optional(),
    overallStatus: z.enum(["green", "amber", "red"]).optional(),
    breachCount: z.number().int().nonnegative().optional(),
    // Shape A — helena-risk-appetite-watch.ts emission fields
    appetiteLineCount: z.number().int().nonnegative().optional(),
    measuredCount: z.number().int().nonnegative().optional(),
    unmeasuredCount: z.number().int().nonnegative().optional(),
    nABuildPhaseCount: z.number().int().nonnegative().optional(),
    openBreaches: z.number().int().nonnegative().optional(),
    tier1OpenBreaches: z.number().int().nonnegative().optional(),
    tier2OpenBreaches: z.number().int().nonnegative().optional(),
    disposedBreaches: z.number().int().nonnegative().optional(),
    daysSinceRasReview: z.number().int().nonnegative().optional(),
    runTrigger: z.string().optional(),
    lineStatuses: z.record(z.string()).optional(),
  })
  .passthrough();

export type RiskAppetiteSnapshotPayload = z.infer<typeof riskAppetiteSnapshotPayloadSchema>;

export function makeRiskAppetiteSnapshot(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RiskAppetiteSnapshotPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RiskAppetiteSnapshot",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: riskAppetiteSnapshotPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IRRBBExcursion
// ---------------------------------------------------------------------------

export const irrbBExcursionPayloadSchema = z.object({
  excursionId: z.string().min(1),
  metricName: z.string().min(1),
  metricValue: z.number(),
  limitValue: z.number(),
  currency: z.string().min(3).max(3),
  detectedAt: z.string().min(1),
  severity: z.enum(["warn", "breach", "critical"]),
  reportingPeriod: z.string().optional(),
});

export type IRRBBExcursionPayload = z.infer<typeof irrbBExcursionPayloadSchema>;

export function makeIRRBBExcursion(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IRRBBExcursionPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IRRBBExcursion",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: irrbBExcursionPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Readiness snapshots (common structure)
// ---------------------------------------------------------------------------

const readinessSnapshotBaseSchema = z.object({
  snapshotId: z.string().min(1),
  asOf: z.string().min(1),
  owner: z.string().min(1),
  overallStatus: z.enum(["green", "amber", "red", "not-started"]),
  blockerCount: z.number().int().nonnegative(),
  gapCount: z.number().int().nonnegative(),
  notes: z.string().optional(),
});

// ---------------------------------------------------------------------------
// ALMReadinessSnapshot
// ---------------------------------------------------------------------------

export const almReadinessSnapshotPayloadSchema = readinessSnapshotBaseSchema;
export type ALMReadinessSnapshotPayload = z.infer<typeof almReadinessSnapshotPayloadSchema>;

export function makeALMReadinessSnapshot(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ALMReadinessSnapshotPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ALMReadinessSnapshot",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: almReadinessSnapshotPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CyberResilienceSnapshot
// ---------------------------------------------------------------------------

export const cyberResilienceSnapshotPayloadSchema = readinessSnapshotBaseSchema.extend({
  criticalVulnerabilities: z.number().int().nonnegative(),
  patchCompliancePct: z.number().min(0).max(100).optional(),
});

export type CyberResilienceSnapshotPayload = z.infer<typeof cyberResilienceSnapshotPayloadSchema>;

export function makeCyberResilienceSnapshot(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CyberResilienceSnapshotPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CyberResilienceSnapshot",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: cyberResilienceSnapshotPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// OperationalResilienceSnapshot
// ---------------------------------------------------------------------------

export const operationalResilienceSnapshotPayloadSchema = readinessSnapshotBaseSchema.extend({
  sloCompliancePct: z.number().min(0).max(100).optional(),
  openIncidentCount: z.number().int().nonnegative(),
});

export type OperationalResilienceSnapshotPayload = z.infer<
  typeof operationalResilienceSnapshotPayloadSchema
>;

export function makeOperationalResilienceSnapshot(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OperationalResilienceSnapshotPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OperationalResilienceSnapshot",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: operationalResilienceSnapshotPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LegalReadinessSnapshot
// ---------------------------------------------------------------------------

export const legalReadinessSnapshotPayloadSchema = readinessSnapshotBaseSchema;
export type LegalReadinessSnapshotPayload = z.infer<typeof legalReadinessSnapshotPayloadSchema>;

export function makeLegalReadinessSnapshot(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LegalReadinessSnapshotPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LegalReadinessSnapshot",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: legalReadinessSnapshotPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// TaxReadinessSnapshot
// ---------------------------------------------------------------------------

export const taxReadinessSnapshotPayloadSchema = readinessSnapshotBaseSchema;
export type TaxReadinessSnapshotPayload = z.infer<typeof taxReadinessSnapshotPayloadSchema>;

export function makeTaxReadinessSnapshot(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TaxReadinessSnapshotPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TaxReadinessSnapshot",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: taxReadinessSnapshotPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// PaymentsReadinessSnapshot
// ---------------------------------------------------------------------------

export const paymentsReadinessSnapshotPayloadSchema = readinessSnapshotBaseSchema;
export type PaymentsReadinessSnapshotPayload = z.infer<
  typeof paymentsReadinessSnapshotPayloadSchema
>;

export function makePaymentsReadinessSnapshot(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PaymentsReadinessSnapshotPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PaymentsReadinessSnapshot",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: paymentsReadinessSnapshotPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MarketsReadinessSnapshot
// ---------------------------------------------------------------------------

export const marketsReadinessSnapshotPayloadSchema = readinessSnapshotBaseSchema;
export type MarketsReadinessSnapshotPayload = z.infer<typeof marketsReadinessSnapshotPayloadSchema>;

export function makeMarketsReadinessSnapshot(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MarketsReadinessSnapshotPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MarketsReadinessSnapshot",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: marketsReadinessSnapshotPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// IcaapIlaapInputReady
// ---------------------------------------------------------------------------

export const icaapIlaapInputReadyPayloadSchema = z.object({
  inputId: z.string().min(1),
  reportingPeriod: z.string().min(1),
  preparedBy: z.string().min(1),
  preparedAt: z.string().min(1),
  inputKind: z.enum(["ICAAP", "ILAAP", "combined"]),
  dataFilePath: z.string().optional(),
});

export type IcaapIlaapInputReadyPayload = z.infer<typeof icaapIlaapInputReadyPayloadSchema>;

export function makeIcaapIlaapInputReady(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: IcaapIlaapInputReadyPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "IcaapIlaapInputReady",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: icaapIlaapInputReadyPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CapitalActionTrigger
// ---------------------------------------------------------------------------

export const capitalActionTriggerPayloadSchema = z.object({
  triggerId: z.string().min(1),
  triggerKind: z.enum(["AT1-coupon-skip", "bail-in", "CET1-buffer-breach", "other"]),
  triggeredAt: z.string().min(1),
  cet1Ratio: z.number().optional(),
  threshold: z.number().optional(),
  currency: z.string().min(3).max(3).optional(),
  escalatedTo: z.string().optional(),
});

export type CapitalActionTriggerPayload = z.infer<typeof capitalActionTriggerPayloadSchema>;

export function makeCapitalActionTrigger(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CapitalActionTriggerPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CapitalActionTrigger",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: capitalActionTriggerPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CapitalEvent
// ---------------------------------------------------------------------------

export const capitalEventPayloadSchema = z.object({
  eventId: z.string().min(1),
  capitalEventKind: z.enum([
    "equity-issuance",
    "capital-injection",
    "tier2-issuance",
    "dividend-payment",
    "buyback",
    "other",
  ]),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  effectiveDate: z.string().min(1),
  approvedBy: z.string().optional(),
  notes: z.string().optional(),
});

export type CapitalEventPayload = z.infer<typeof capitalEventPayloadSchema>;

export function makeCapitalEvent(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CapitalEventPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CapitalEvent",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: capitalEventPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LCRRatioProjection
// ---------------------------------------------------------------------------

export const lcrRatioProjectionPayloadSchema = z.object({
  projectionId: z.string().min(1),
  asOf: z.string().min(1),
  projectionHorizonDays: z.number().int().positive(),
  lcrRatioPct: z.number(),
  regulatoryMinimumPct: z.number(),
  status: z.enum(["above-minimum", "at-minimum", "below-minimum"]),
  currency: z.string().min(3).max(3).optional(),
});

export type LCRRatioProjectionPayload = z.infer<typeof lcrRatioProjectionPayloadSchema>;

export function makeLCRRatioProjection(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LCRRatioProjectionPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LCRRatioProjection",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: lcrRatioProjectionPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// NSFRRatioProjection
// ---------------------------------------------------------------------------

export const nsfrRatioProjectionPayloadSchema = z.object({
  projectionId: z.string().min(1),
  asOf: z.string().min(1),
  projectionHorizonDays: z.number().int().positive(),
  nsfrRatioPct: z.number(),
  regulatoryMinimumPct: z.number(),
  status: z.enum(["above-minimum", "at-minimum", "below-minimum"]),
  currency: z.string().min(3).max(3).optional(),
});

export type NSFRRatioProjectionPayload = z.infer<typeof nsfrRatioProjectionPayloadSchema>;

export function makeNSFRRatioProjection(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: NSFRRatioProjectionPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "NSFRRatioProjection",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: nsfrRatioProjectionPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// HQLACompositionDrift
// ---------------------------------------------------------------------------

export const hqlaCompositionDriftPayloadSchema = z.object({
  alertId: z.string().min(1),
  detectedAt: z.string().min(1),
  l1HQLAPct: z.number().min(0).max(100).optional(),
  l2aHQLAPct: z.number().min(0).max(100).optional(),
  l2bHQLAPct: z.number().min(0).max(100).optional(),
  policyBandBreached: z.string().optional(),
  severity: z.enum(["warn", "breach"]),
});

export type HQLACompositionDriftPayload = z.infer<typeof hqlaCompositionDriftPayloadSchema>;

export function makeHQLACompositionDrift(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: HQLACompositionDriftPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "HQLACompositionDrift",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: hqlaCompositionDriftPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// LiquiditySnapshot
// ---------------------------------------------------------------------------

export const liquiditySnapshotPayloadSchema = z.object({
  snapshotId: z.string().min(1),
  asOf: z.string().min(1),
  lcrRatioPct: z.number().optional(),
  nsfrRatioPct: z.number().optional(),
  hqlaAmount: z.number().optional(),
  currency: z.string().min(3).max(3),
  overallStatus: z.enum(["green", "amber", "red"]),
});

export type LiquiditySnapshotPayload = z.infer<typeof liquiditySnapshotPayloadSchema>;

export function makeLiquiditySnapshot(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: LiquiditySnapshotPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "LiquiditySnapshot",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: liquiditySnapshotPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CurveSourceAnomaly
// ---------------------------------------------------------------------------

export const curveSourceAnomalyPayloadSchema = z.object({
  anomalyId: z.string().min(1),
  curveName: z.string().min(1),
  dataSource: z.string().min(1),
  anomalyKind: z.enum(["stale", "missing", "implausible", "disconnected"]),
  detectedAt: z.string().min(1),
  severity: z.enum(["warn", "critical"]),
  affectedTenors: z.array(z.string()).optional(),
});

export type CurveSourceAnomalyPayload = z.infer<typeof curveSourceAnomalyPayloadSchema>;

export function makeCurveSourceAnomaly(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CurveSourceAnomalyPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CurveSourceAnomaly",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: curveSourceAnomalyPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CutOffBreach
// ---------------------------------------------------------------------------

export const cutOffBreachPayloadSchema = z.object({
  breachId: z.string().min(1),
  cutOffKind: z.enum(["settlement", "payment", "reporting", "clearing", "other"]),
  scheduledAt: z.string().min(1),
  detectedAt: z.string().min(1),
  breachDurationMs: z.number().int().nonnegative().optional(),
  affectedPaymentCount: z.number().int().nonnegative().optional(),
  escalatedTo: z.string().optional(),
});

export type CutOffBreachPayload = z.infer<typeof cutOffBreachPayloadSchema>;

export function makeCutOffBreach(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CutOffBreachPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CutOffBreach",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: cutOffBreachPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SAMOSFundingShortfall
// ---------------------------------------------------------------------------

export const samosFundingShortfallPayloadSchema = z.object({
  shortfallId: z.string().min(1),
  settlementWindow: z.string().min(1),
  shortfallAmount: z.number().positive(),
  currency: z.string().min(3).max(3),
  detectedAt: z.string().min(1),
  correspondentRef: z.string().optional(),
  escalatedTo: z.string().optional(),
});

export type SAMOSFundingShortfallPayload = z.infer<typeof samosFundingShortfallPayloadSchema>;

export function makeSAMOSFundingShortfall(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SAMOSFundingShortfallPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SAMOSFundingShortfall",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: samosFundingShortfallPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ModelRegistered
// ---------------------------------------------------------------------------

export const modelRegisteredPayloadSchema = z.object({
  modelId: z.string().min(1),
  modelName: z.string().min(1),
  modelKind: z.enum(["risk", "pricing", "credit", "ALM", "regulatory", "other"]),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  registeredBy: z.string().min(1),
  registeredAt: z.string().min(1),
  version: z.string().min(1),
  owner: z.string().optional(),
});

export type ModelRegisteredPayload = z.infer<typeof modelRegisteredPayloadSchema>;

export function makeModelRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ModelRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ModelRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: modelRegisteredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const RISK_TREASURY_EXTENDED_TYPED_EVENT_TYPES = [
  "AppetiteBreach",
  "LimitBreachProposed",
  "LimitBreachActioned",
  "BacktestTriggered",
  "RASCalibrationChange",
  "RiskAppetiteSnapshot",
  "IRRBBExcursion",
  "ALMReadinessSnapshot",
  "CyberResilienceSnapshot",
  "OperationalResilienceSnapshot",
  "LegalReadinessSnapshot",
  "TaxReadinessSnapshot",
  "PaymentsReadinessSnapshot",
  "MarketsReadinessSnapshot",
  "IcaapIlaapInputReady",
  "CapitalActionTrigger",
  "CapitalEvent",
  "LCRRatioProjection",
  "NSFRRatioProjection",
  "HQLACompositionDrift",
  "LiquiditySnapshot",
  "CurveSourceAnomaly",
  "CutOffBreach",
  "SAMOSFundingShortfall",
  "ModelRegistered",
] as const;
