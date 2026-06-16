// v2-core/money-free-batch-3/events.ts
//
// Wave 2 batch-3 — re-declared MONEY-FREE payload schemas for the remaining
// self-contained, non-substrate V1 domains swept into v2-core.
//
// WHY RE-DECLARE (not import the V1 schemas):
//   The v2-core package MUST NOT import any v1 code-line directory
//   (`recon:v2-no-v1-import`). So — exactly as batch-1 (reference-data) and
//   batch-2 (governance-attestation) did — each migrated domain's payload schema
//   is RE-DECLARED here, faithful to its authoritative V1 source. The anti-drift
//   backstop `money-free-batch-3-v2-schema-parity.test.ts` (a v1-side test that
//   may import BOTH sides) asserts each v2 copy accepts/rejects exactly what its
//   V1 source does — Charter cmd 3 (no green by concealment / weakened
//   assertions).
//
// SIX RE-DECLARED DOMAINS (24 types):
//   - intranet               (3) — IntranetFeatureShipped, DesignReviewComplete,
//                                   UXFindingRaised
//   - sla-approval           (3) — SlaRulePublished, SlaRuleApproved,
//                                   SlaRuleWithheld
//   - regulatory-pa          (1) — PaNotificationSubmitted
//   - seed-management        (2) — SeedDescoped, SeedPromotedToSimulated
//   - model-risk            (13) — ModelSubmitted, ModelTierClassified,
//                                   ModelValidationApproved, ModelValidationWithheld,
//                                   ValidationFindingRaised, ValidationFindingClosed,
//                                   BacktestRequested, BacktestRun,
//                                   ValidationMethodologyPublished,
//                                   BacktestBreachDisposed, ModelDriftDetected,
//                                   ProductionUseRequested, MethodologyChangeRequested
//   - regulatory-reporting   (2) — TradeReportSubmitted, SarbSubmissionAttempted
//                                   (the MONEY-FREE rows only; RwaComputed carries
//                                   `*RwaMinor` → money-bearing, deferred)
//
// MONEY-FREE VERIFICATION: none of the 24 schemas carry a `*Minor` field, a
// MoneyWire, a notional/par/face amount, or any typed money value — every numeric
// field is an integer count, a ratio/percentage, a metric value, or an exception
// count. Verified field-by-field against the no-residual-minor-encoding lens.
//
// The FOOTHOLD domains swept by this batch (v2-banking V2Product*/V2AccountType*,
// decision-impact-sweep, v2-eval, context-pack, cross-tenant-csi, applicability-
// assessment) already have their schemas in v2-core (the W0 footholds) and are
// NOT re-declared here — they are tee-enabled + flipped in place. Their type names
// are folded by the same batch-3 parity gate via the shared event-list register.
//
// PACKAGE BOUNDARY: no v1 imports.
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:wave-2-batch-3-remaining-money-free-domains:2026-06-16.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

// ===========================================================================
// intranet
// ===========================================================================

export const intranetFeatureShippedPayloadSchema = z.object({
  featureId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  prUrl: z.string().url(),
  shippedBy: z.string().min(1),
  shippedAt: z.string().min(1),
});

export const designReviewCompletePayloadSchema = z.object({
  reviewId: z.string().min(1),
  featureOrComponent: z.string().min(1),
  reviewer: z.string().min(1),
  outcome: z.enum(["approved", "approved-with-changes", "rejected"]),
  notes: z.string().min(1),
  completedAt: z.string().min(1),
});

export const uxFindingRaisedPayloadSchema = z.object({
  findingId: z.string().min(1),
  component: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  raisedBy: z.string().min(1),
  raisedAt: z.string().min(1),
});

// ===========================================================================
// sla-approval
// ===========================================================================

const slaSeatSchema = z.object({
  name: z.string().min(1),
  position: z.string().min(1),
});

const slaRuleVersionFields = {
  representation: z.string().min(1),
  ruleId: z.string().min(1),
  version: z.number().int().min(1),
} as const;

export const slaRulePublishedPayloadSchema = z.object({
  ...slaRuleVersionFields,
  publisher: slaSeatSchema,
  ruleContentHash: z.string().min(1),
  note: z.string().optional(),
});

export const slaRuleApprovedPayloadSchema = z.object({
  ...slaRuleVersionFields,
  approver: slaSeatSchema,
  reviewedRuleHash: z.string().min(1),
  reviewedPreviewHash: z.string().min(1),
  grandfather: z.boolean().optional(),
  note: z.string().optional(),
});

export const slaRuleWithheldPayloadSchema = z.object({
  ...slaRuleVersionFields,
  approver: slaSeatSchema,
  reason: z.string().min(1),
});

// ===========================================================================
// regulatory-pa
// ===========================================================================

const paNotificationTypeSchema = z.enum([
  "lex-cap-breach",
  "incident",
  "control-failure",
  "restatement",
  "other",
]);

const paRecipientAuthoritySchema = z.enum(["PA", "FSCA", "FIC"]);

export const paNotificationSubmittedPayloadSchema = z.object({
  notificationId: z.string().min(1),
  notificationType: paNotificationTypeSchema,
  notificationDate: z.string().min(1),
  regulatoryRef: z.string().min(1),
  recipientAuthority: paRecipientAuthoritySchema,
  submittedBy: z.string().min(1),
  submittedAt: z.string().min(1),
});

// ===========================================================================
// seed-management
// ===========================================================================

export const seedDescopedPayloadSchema = z.object({
  seedId: z.string().min(1),
  reason: z.string().min(1),
});

export const seedPromotedToSimulatedPayloadSchema = z.object({
  seedId: z.string().min(1),
  replacementEventIds: z.array(z.string().min(1)),
  note: z.string().optional(),
});

// ===========================================================================
// model-risk
//
// Money-free: every numeric field is an exception count, a metric value, a
// metric threshold, a duration in ms, or a 1/2/3 tier literal. No money fields.
// `CalculationPerformed` (generic calc envelope with a polymorphic value whose
// UNIT may be "ZAR-minor") is NOT in this batch — deferred to the money-bearing
// track (Charter cmd 5: noted, not silently skipped).
// ===========================================================================

const modelTierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const sha256HexSchema = z
  .string()
  .min(1)
  .regex(/^[0-9a-f]{64}$/, {
    message: "methodologyHash must be a lowercase hex sha256 (64 chars)",
  });

export const modelSubmittedPayloadSchema = z.object({
  modelId: z.string().min(1),
  submittedBy: z.string().min(1),
  version: z.string().min(1),
  tier: modelTierSchema,
  methodologyHash: sha256HexSchema,
  description: z.string().min(1),
});

export const modelTierClassifiedPayloadSchema = z.object({
  modelId: z.string().min(1),
  classifiedBy: z.string().min(1),
  tier: modelTierSchema,
  rationale: z.string().min(1),
});

export const modelValidationApprovedPayloadSchema = z.object({
  modelId: z.string().min(1),
  version: z.string().min(1),
  approvedBy: z.string().min(1),
  validationFindingsResolved: z.array(z.string().min(1)),
  expiryDate: z.string().min(1),
});

export const modelValidationWithheldPayloadSchema = z.object({
  modelId: z.string().min(1),
  version: z.string().min(1),
  withheldBy: z.string().min(1),
  reason: z.string().min(1),
  findings: z.array(z.string().min(1)),
});

export const validationFindingRaisedPayloadSchema = z.object({
  findingId: z.string().min(1),
  modelId: z.string().min(1),
  raisedBy: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "blocking"]),
  description: z.string().min(1),
});

export const validationFindingClosedPayloadSchema = z.object({
  findingId: z.string().min(1),
  closedBy: z.string().min(1),
  resolution: z.string().min(1),
  closedAt: z.string().min(1),
});

const backtestPredictionGranularitySchema = z.enum(["daily", "monthly", "per-event"]);

const backtestOutcomeMetricSchema = z.enum([
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
  methodologyHash: sha256HexSchema,
});

const backtestSeveritySchema = z.enum(["within-tolerance", "amber", "red"]);

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
  methodologyHash: sha256HexSchema,
  predictionCount: z.number().int().nonnegative(),
  runDurationMs: z.number().nonnegative(),
  sourceRequestEventId: z.string().min(1),
});

export const validationMethodologyPublishedPayloadSchema = z.object({
  methodologyId: z.string().min(1),
  tier: modelTierSchema,
  version: z.string().min(1),
  publishedBy: z.string().min(1),
  methodologyHash: sha256HexSchema,
  effectiveFrom: z.string().min(1),
  summary: z.string().min(1),
});

const backtestBreachDispositionSchema = z.enum([
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

const modelDriftKindSchema = z.enum([
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

export const productionUseRequestedPayloadSchema = z.object({
  modelId: z.string().min(1),
  version: z.string().min(1),
  requestedBy: z.string().min(1),
  envelopeDescription: z.string().min(1),
  requestedFrom: z.string().min(1),
  rationale: z.string().min(1),
});

export const methodologyChangeRequestedPayloadSchema = z.object({
  changeRequestId: z.string().min(1),
  methodologyId: z.string().min(1),
  tier: modelTierSchema,
  fromVersion: z.string().min(1),
  requestedBy: z.string().min(1),
  proposedChange: z.string().min(1),
  rationale: z.string().min(1),
  targetEffectiveFrom: z.string().optional(),
});

// ===========================================================================
// regulatory-reporting (money-free rows only)
//
// TradeReportSubmitted + SarbSubmissionAttempted carry NO money fields (form
// codes, references, statuses, citations). RwaComputed carries `*RwaMinor` →
// money-bearing → deferred to the money-bearing track.
// ===========================================================================

export const tradeReportSubmittedPayloadSchema = z.object({
  tradeId: z.string().min(1),
  regulator: z.enum(["SARB-FinSurv", "DTCC-SAFE"]),
  reportCategory: z.string().min(1),
  submittedAt: z.string().min(1),
  referenceNumber: z.string().optional(),
  status: z.enum(["pending", "accepted", "rejected"]),
  finsurvCategory: z.string().optional(),
  citations: z.array(z.string()).min(1),
});

export const sarbSubmissionAttemptedPayloadSchema = z.object({
  formId: z.string().min(1),
  formVersion: z.string().min(1),
  institutionId: z.string().min(1),
  reportingPeriod: z.string().min(1),
  submittedAt: z.string().min(1),
  accepted: z.boolean(),
  referenceNumber: z.string().optional(),
  errors: z.array(z.string()).optional(),
  mode: z.enum(["simulator", "live"]),
});

// ===========================================================================
// Batch-3 RE-DECLARED schema manifest.
//
// Maps each RE-DECLARED type name to its v2 schema. This drives the v2 registry
// rows (`mfb3(...)`) and the anti-drift parity test. It does NOT include the
// FOOTHOLD types (v2-banking, decision-impact, v2-eval, context-pack,
// cross-tenant-csi, applicability) — those reuse their existing v2-core schemas;
// the full batch-3 TYPE set (re-declared + foothold) is assembled in the registry.
// ===========================================================================

export const MONEY_FREE_BATCH_3_REDECLARED_SCHEMAS = {
  // intranet
  IntranetFeatureShipped: intranetFeatureShippedPayloadSchema,
  DesignReviewComplete: designReviewCompletePayloadSchema,
  UXFindingRaised: uxFindingRaisedPayloadSchema,
  // sla-approval
  SlaRulePublished: slaRulePublishedPayloadSchema,
  SlaRuleApproved: slaRuleApprovedPayloadSchema,
  SlaRuleWithheld: slaRuleWithheldPayloadSchema,
  // regulatory-pa
  PaNotificationSubmitted: paNotificationSubmittedPayloadSchema,
  // seed-management
  SeedDescoped: seedDescopedPayloadSchema,
  SeedPromotedToSimulated: seedPromotedToSimulatedPayloadSchema,
  // model-risk
  ModelSubmitted: modelSubmittedPayloadSchema,
  ModelTierClassified: modelTierClassifiedPayloadSchema,
  ModelValidationApproved: modelValidationApprovedPayloadSchema,
  ModelValidationWithheld: modelValidationWithheldPayloadSchema,
  ValidationFindingRaised: validationFindingRaisedPayloadSchema,
  ValidationFindingClosed: validationFindingClosedPayloadSchema,
  BacktestRequested: backtestRequestedPayloadSchema,
  BacktestRun: backtestRunPayloadSchema,
  ValidationMethodologyPublished: validationMethodologyPublishedPayloadSchema,
  BacktestBreachDisposed: backtestBreachDisposedPayloadSchema,
  ModelDriftDetected: modelDriftDetectedPayloadSchema,
  ProductionUseRequested: productionUseRequestedPayloadSchema,
  MethodologyChangeRequested: methodologyChangeRequestedPayloadSchema,
  // regulatory-reporting (money-free rows)
  TradeReportSubmitted: tradeReportSubmittedPayloadSchema,
  SarbSubmissionAttempted: sarbSubmissionAttemptedPayloadSchema,
} as const;

export type MoneyFreeBatch3RedeclaredType = keyof typeof MONEY_FREE_BATCH_3_REDECLARED_SCHEMAS;

export const MONEY_FREE_BATCH_3_REDECLARED_TYPES: readonly MoneyFreeBatch3RedeclaredType[] =
  Object.keys(
    MONEY_FREE_BATCH_3_REDECLARED_SCHEMAS,
  ).sort() as MoneyFreeBatch3RedeclaredType[];

/**
 * The FOOTHOLD type names swept by batch-3 — their schemas already live in
 * v2-core (the W0 footholds), so they are NOT re-declared here. They are tee-
 * enabled + flipped in place; the batch-3 parity gate folds them into the same
 * event-list register as the re-declared types.
 */
export const MONEY_FREE_BATCH_3_FOOTHOLD_TYPES: readonly string[] = [
  // v2-banking (money-free rows; V2RiskAppetiteSet carries floorZarMinor → deferred)
  "V2ProductRegistered",
  "V2ProductDeprecated",
  "V2AccountTypeRegistered",
  // decision-impact-sweep
  "DecisionImpactSweepRequested",
  "DecisionImpactAssessed",
  // v2-eval
  "ExamSetRegistered",
  "EvalRunCompleted",
  // context-pack
  "ContextPackBuilt",
  // cross-tenant-csi
  "CsiCategoryRegistered",
  "CsiCategoryRetired",
  "CrossTenantLearningScreened",
  "CrossTenantLearningBlocked",
  // applicability-assessment
  "ApplicabilityAssessmentRequested",
  "ApplicabilityAssessmentPerformed",
  "ApplicabilityAssessmentConcluded",
];

/** Every batch-3 type name (re-declared + foothold), sorted, deduped. */
export const MONEY_FREE_BATCH_3_TYPES: readonly string[] = [
  ...new Set<string>([
    ...MONEY_FREE_BATCH_3_REDECLARED_TYPES,
    ...MONEY_FREE_BATCH_3_FOOTHOLD_TYPES,
  ]),
].sort();
