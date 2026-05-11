// platform/event-store/event-types/model-risk.ts
//
// Model-risk and validation event-payload schemas.
//
// Covers:
//   - ModelSubmitted, ModelTierClassified, ModelValidationApproved,
//     ModelValidationWithheld
//   - ValidationFindingRaised, ValidationFindingClosed
//   - BacktestRequested, BacktestRun, BacktestBreachDisposed
//   - ModelDriftDetected
//   - ProductionUseRequested, MethodologyChangeRequested,
//     ValidationMethodologyPublished
//
// F-020 split from the god-file `../event-types.ts`.
// Authors: Nadia (Model-validation engineer), Rohan (Risk engineer),
//          Atlas (substrate)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// ModelSubmitted
// ---------------------------------------------------------------------------

export const modelSubmittedPayloadSchema = z.object({
  modelId: z.string().min(1),
  submittedBy: z.string().min(1),
  version: z.string().min(1),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  methodologyHash: z
    .string()
    .min(1)
    .regex(/^[0-9a-f]{64}$/, {
      message: "methodologyHash must be a lowercase hex sha256 (64 chars)",
    }),
  description: z.string().min(1),
});

export type ModelSubmittedPayload = z.infer<typeof modelSubmittedPayloadSchema>;

export function makeModelSubmitted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ModelSubmittedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ModelSubmitted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: modelSubmittedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ModelTierClassified
// ---------------------------------------------------------------------------

export const modelTierClassifiedPayloadSchema = z.object({
  modelId: z.string().min(1),
  classifiedBy: z.string().min(1),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  rationale: z.string().min(1),
});

export type ModelTierClassifiedPayload = z.infer<typeof modelTierClassifiedPayloadSchema>;

export function makeModelTierClassified(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ModelTierClassifiedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ModelTierClassified",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: modelTierClassifiedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ModelValidationApproved
// ---------------------------------------------------------------------------

export const modelValidationApprovedPayloadSchema = z.object({
  modelId: z.string().min(1),
  version: z.string().min(1),
  approvedBy: z.string().min(1),
  validationFindingsResolved: z.array(z.string().min(1)),
  expiryDate: z.string().min(1),
});

export type ModelValidationApprovedPayload = z.infer<typeof modelValidationApprovedPayloadSchema>;

export function makeModelValidationApproved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ModelValidationApprovedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ModelValidationApproved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: modelValidationApprovedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ModelValidationWithheld
// ---------------------------------------------------------------------------

export const modelValidationWithheldPayloadSchema = z.object({
  modelId: z.string().min(1),
  version: z.string().min(1),
  withheldBy: z.string().min(1),
  reason: z.string().min(1),
  findings: z.array(z.string().min(1)),
});

export type ModelValidationWithheldPayload = z.infer<typeof modelValidationWithheldPayloadSchema>;

export function makeModelValidationWithheld(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ModelValidationWithheldPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ModelValidationWithheld",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: modelValidationWithheldPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ValidationFindingRaised
// ---------------------------------------------------------------------------

export const validationFindingRaisedPayloadSchema = z.object({
  findingId: z.string().min(1),
  modelId: z.string().min(1),
  raisedBy: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "blocking"]),
  description: z.string().min(1),
});

export type ValidationFindingRaisedPayload = z.infer<typeof validationFindingRaisedPayloadSchema>;

export function makeValidationFindingRaised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ValidationFindingRaisedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ValidationFindingRaised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: validationFindingRaisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ValidationFindingClosed
// ---------------------------------------------------------------------------

export const validationFindingClosedPayloadSchema = z.object({
  findingId: z.string().min(1),
  closedBy: z.string().min(1),
  resolution: z.string().min(1),
  closedAt: z.string().min(1),
});

export type ValidationFindingClosedPayload = z.infer<typeof validationFindingClosedPayloadSchema>;

export function makeValidationFindingClosed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ValidationFindingClosedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ValidationFindingClosed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: validationFindingClosedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Backtest family
// ---------------------------------------------------------------------------

export const backtestPredictionGranularitySchema = z.enum(["daily", "monthly", "per-event"]);

export const backtestOutcomeMetricSchema = z.enum([
  "kupiec",
  "christoffersen",
  "traffic-light",
  "staging-stability",
  "migration-matrix",
  "coverage-test",
  "custom",
]);

export const backtestRequestedPayloadSchema = z.object({
  modelId: z.string().min(1),
  version: z.string().min(1),
  windowStart: z.string().min(1),
  windowEnd: z.string().min(1),
  predictionGranularity: backtestPredictionGranularitySchema,
  outcomeMetric: backtestOutcomeMetricSchema,
  requestedBy: z.string().min(1),
  methodologyHash: z
    .string()
    .min(1)
    .regex(/^[0-9a-f]{64}$/, {
      message: "methodologyHash must be a lowercase hex sha256 (64 chars)",
    }),
});

export type BacktestRequestedPayload = z.infer<typeof backtestRequestedPayloadSchema>;

export function makeBacktestRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BacktestRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BacktestRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: backtestRequestedPayloadSchema.parse(args.payload),
  });
}

export const backtestSeveritySchema = z.enum(["within-tolerance", "amber", "red"]);

export const backtestRunPayloadSchema = z.object({
  backtestRunId: z.string().min(1),
  modelId: z.string().min(1),
  version: z.string().min(1),
  windowStart: z.string().min(1),
  windowEnd: z.string().min(1),
  comparisonMetric: backtestOutcomeMetricSchema,
  expectedExceptions: z.number().nonnegative(),
  observedExceptions: z.number().int().nonnegative(),
  severity: backtestSeveritySchema,
  methodologyHash: z
    .string()
    .min(1)
    .regex(/^[0-9a-f]{64}$/, {
      message: "methodologyHash must be a lowercase hex sha256 (64 chars)",
    }),
  predictionCount: z.number().int().nonnegative(),
  runDurationMs: z.number().nonnegative(),
  sourceRequestEventId: z.string().min(1),
});

export type BacktestRunPayload = z.infer<typeof backtestRunPayloadSchema>;

export function makeBacktestRun(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BacktestRunPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BacktestRun",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: backtestRunPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ValidationMethodologyPublished
// ---------------------------------------------------------------------------

export const validationMethodologyTierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const validationMethodologyPublishedPayloadSchema = z.object({
  methodologyId: z.string().min(1),
  tier: validationMethodologyTierSchema,
  version: z.string().min(1),
  publishedBy: z.string().min(1),
  methodologyHash: z
    .string()
    .min(1)
    .regex(/^[0-9a-f]{64}$/, {
      message: "methodologyHash must be a lowercase hex sha256 (64 chars)",
    }),
  effectiveFrom: z.string().min(1),
  summary: z.string().min(1),
});

export type ValidationMethodologyPublishedPayload = z.infer<
  typeof validationMethodologyPublishedPayloadSchema
>;

export function makeValidationMethodologyPublished(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ValidationMethodologyPublishedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ValidationMethodologyPublished",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: validationMethodologyPublishedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// BacktestBreachDisposed
// ---------------------------------------------------------------------------

export const backtestBreachDispositionSchema = z.enum([
  "tolerate",
  "remediate-by-deadline",
  "withdraw-validation",
]);

export const backtestBreachDisposedPayloadSchema = z.object({
  backtestRunId: z.string().min(1),
  modelId: z.string().min(1),
  version: z.string().min(1),
  disposedBy: z.string().min(1),
  disposition: backtestBreachDispositionSchema,
  rationale: z.string().min(1),
  remediationDeadline: z.string().optional(),
  linkedFindings: z.array(z.string().min(1)),
});

export type BacktestBreachDisposedPayload = z.infer<typeof backtestBreachDisposedPayloadSchema>;

export function makeBacktestBreachDisposed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BacktestBreachDisposedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BacktestBreachDisposed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: backtestBreachDisposedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ModelDriftDetected
// ---------------------------------------------------------------------------

export const modelDriftKindSchema = z.enum([
  "input-distribution-shift",
  "output-distribution-shift",
  "performance-degradation",
  "feature-stability",
  "concept-drift",
]);

export const modelDriftDetectedPayloadSchema = z.object({
  modelId: z.string().min(1),
  version: z.string().min(1),
  driftKind: modelDriftKindSchema,
  detectedBy: z.string().min(1),
  metricValue: z.number(),
  metricThreshold: z.number(),
  severity: z.enum(["low", "medium", "high", "blocking"]),
  observedAt: z.string().min(1),
  description: z.string().min(1),
});

export type ModelDriftDetectedPayload = z.infer<typeof modelDriftDetectedPayloadSchema>;

export function makeModelDriftDetected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ModelDriftDetectedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ModelDriftDetected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: modelDriftDetectedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ProductionUseRequested
// ---------------------------------------------------------------------------

export const productionUseRequestedPayloadSchema = z.object({
  modelId: z.string().min(1),
  version: z.string().min(1),
  requestedBy: z.string().min(1),
  envelopeDescription: z.string().min(1),
  requestedFrom: z.string().min(1),
  rationale: z.string().min(1),
});

export type ProductionUseRequestedPayload = z.infer<typeof productionUseRequestedPayloadSchema>;

export function makeProductionUseRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ProductionUseRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ProductionUseRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: productionUseRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MethodologyChangeRequested
// ---------------------------------------------------------------------------

export const methodologyChangeRequestedPayloadSchema = z.object({
  changeRequestId: z.string().min(1),
  methodologyId: z.string().min(1),
  tier: validationMethodologyTierSchema,
  fromVersion: z.string().min(1),
  requestedBy: z.string().min(1),
  proposedChange: z.string().min(1),
  rationale: z.string().min(1),
  targetEffectiveFrom: z.string().optional(),
});

export type MethodologyChangeRequestedPayload = z.infer<
  typeof methodologyChangeRequestedPayloadSchema
>;

export function makeMethodologyChangeRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MethodologyChangeRequestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MethodologyChangeRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: methodologyChangeRequestedPayloadSchema.parse(args.payload),
  });
}
