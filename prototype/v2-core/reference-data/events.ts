// v2-core/reference-data/events.ts
//
// Wave 2 batch-1 reference-data event-payload schemas — the v2-native MIRRORS
// of four MONEY-FREE V1 reference-data domains, re-declared inside the v2-core
// package so the v2 type registry can validate them (the v2 package has a HARD
// no-v1-import boundary — `recon:v2-no-v1-import` — so the V1 schemas under
// `platform/` cannot be imported here; they are faithfully re-declared).
//
// DOMAINS IN THIS BATCH (all verified money-free — no `*Minor` / MoneyWire /
// notional-position fields; decimal rate/score values are plain `z.number()`,
// reference data, not bank money):
//
//   1. regulatory             — RegulatoryInstrumentRegistered / Amended /
//                               Contextualised, RegulatoryConceptExtracted,
//                               ObligationConceptLinked, RegulatorySourceReviewed,
//                               GraphNodeAsserted, GraphEdgeAsserted (8 types)
//   2. market-data            — MarketDataStaleAlert, ZaroniaRatePublished,
//                               ZaroniaTermRatePublished, JibarFixingPublished,
//                               OisCurvePublished, SagbYieldsPublished (6 types)
//   3. obligation-review      — ObligationReviewMatched / Conflict,
//                               ObligationCandidateProposed,
//                               ObligationReviewCompleted (4 types)
//   4. obligation-equivalence — ObligationEquivalenceClassified (1 type)
//
// SOURCE-OF-TRUTH: the canonical V1 schemas live in
//   platform/event-store/event-types/{regulatory,market-data,obligation-review,
//   obligation-equivalence}.ts
// These v2 copies are kept structurally identical. The registry test
// (`v2-core/reference-data/schema-parity.test.ts`) asserts each v2 schema accepts
// the same canonical sample the V1 emitter produces, so drift is caught in CI —
// the v2 schema may NOT be weaker than its V1 source (Charter cmd 3: no green by
// concealment / weakened assertions).
//
// DEFERRED (money-bearing or heavyweight — NOT in this batch, no silent skip,
// Charter cmd 5):
//   - isda-odp legal-terms (IsdaScheduleElected / IsdaCsaElected /
//     IsdaCsaSuperseded) carry `moneyAmountSchema { currency, amountMinor }`
//     cross-default thresholds / independent amounts / CSA thresholds — need a
//     money codec (a later money-bearing batch).
//   - financial-instrument (FinancialInstrumentDefined / Classified / Decomposed
//     / Reconstituted) — no `*Minor` money, but a large deeply-nested ACTUS
//     contract-terms discriminated union; warrants its own focused re-declaration
//     PR to avoid drift.
//   - market-data ModelValidationApproved — lives in the model-risk domain
//     (different owner / family); migrated with model-risk, not here.
//
// PACKAGE BOUNDARY: no v1 imports. Only bare `zod` (+ Node/Bun builtins).
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC
//   (both CEO-approved 2026-06-16).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:wave-2-batch-1-money-free-reference-data-domains:2026-06-16.
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

// ===========================================================================
// 1. regulatory
// ===========================================================================

const blake3Hash = z
  .string()
  .min(1)
  .regex(/^blake3:[0-9a-f]{64}$/, {
    message: "must be `blake3:<64 lowercase hex chars>`",
  });

export const regulatoryInstrumentRegisteredPayloadSchema = z.object({
  instrumentId: z.string().min(1),
  title: z.string().min(1),
  issuingBody: z.enum(["Parliament", "FSCA", "SARB", "PA", "National Treasury", "BCBS", "IASB"]),
  instrumentType: z.enum([
    "act",
    "regulation",
    "notice",
    "circular",
    "guidance",
    "directive",
    "conduct-standard",
  ]),
  jurisdiction: z.string().min(1),
  publicationDate: z.string().min(1),
  effectiveDate: z.string().min(1),
  gazetteRef: z.string().min(1).optional(),
  version: z.string().min(1),
  contentHash: blake3Hash,
  sourceUrl: z.string().url().optional(),
  supersedes: z.array(z.string().min(1)).optional(),
});

export const regulatoryInstrumentAmendedPayloadSchema = z.object({
  instrumentId: z.string().min(1),
  newVersion: z.string().min(1),
  amendmentDate: z.string().min(1),
  newContentHash: blake3Hash,
  supersededHash: blake3Hash,
  changeDescription: z.string().min(1),
  gazetteRef: z.string().min(1).optional(),
});

export const regulatoryInstrumentContextualisedPayloadSchema = z.object({
  instrumentId: z.string().min(1),
  regulatoryAuthority: z.object({
    name: z.string().min(1),
    mandate: z.string().min(1),
    enforcementPowers: z.array(z.string().min(1)),
  }),
  legislativeFramework: z.object({
    instrumentType: z.string().min(1),
    parentLegislation: z.array(z.string().min(1)).optional(),
    relatedDomesticInstruments: z.array(z.string().min(1)),
    positionInHierarchy: z.string().min(1),
    administeredBy: z.string().min(1),
  }),
  internationalAlignment: z.object({
    conformsTo: z.array(z.string().min(1)),
    alignmentDescription: z.string().min(1),
    knownDeviations: z.array(z.string().min(1)).optional(),
  }),
  regulatoryObjective: z.object({
    longTitle: z.string().min(1),
    primaryObjective: z.string().min(1),
    protectedInterests: z.array(z.string().min(1)),
    enforcementApproach: z.enum(["principles-based", "rules-based", "hybrid"]),
    outcomeStatement: z.string().min(1),
  }),
  contextualisedAt: z.string().min(1),
  contextualisedBy: z.string().min(1),
});

export const regulatoryConceptExtractedPayloadSchema = z.object({
  instrumentId: z.string().min(1),
  sectionId: z.string().min(1),
  sectionTitle: z.string().min(1),
  verbatimText: z.string().max(2000),
  subjectScope: z.object({
    entityTypes: z.array(z.string()),
    licenceTypes: z.array(z.string()),
    roles: z.array(z.string()),
    thresholdDescription: z.string().optional(),
  }),
  temporalScope: z.object({
    commencementDate: z.string().optional(),
    cadence: z.enum(["ongoing", "one-time", "periodic", "event-triggered"]),
    eventTrigger: z.string().optional(),
    periodDays: z.number().int().positive().optional(),
    transitionalNote: z.string().optional(),
  }),
  conditionScope: z.object({
    clientTypes: z.array(z.string()).optional(),
    activityTriggers: z.array(z.string()).optional(),
    instrumentTypes: z.array(z.string()).optional(),
    thresholdConditions: z.array(z.string()).optional(),
    exclusions: z.array(z.string()).optional(),
  }),
  obligation: z.object({
    type: z.enum([
      "duty",
      "prohibition",
      "disclosure",
      "reporting",
      "record-keeping",
      "system-capability",
      "definition",
      "penalty",
      "other",
    ]),
    actor: z.array(z.string()),
    actionSummary: z.string().min(1),
    timeframeDescription: z.string().optional(),
    output: z.string().optional(),
    recipient: z.array(z.string()).optional(),
  }),
  applicabilityScore: z.number().min(0).max(1),
  applicabilityRationale: z.string().min(1),
  relevancyScore: z.number().min(0).max(1),
  relevancyRationale: z.string().min(1),
  classifications: z.object({
    domain: z.array(z.string()),
    riskTaxonomy: z.array(z.string()),
    productScope: z.array(z.string()),
    activityScope: z.array(z.string()),
  }),
  extractedAt: z.string().min(1),
  extractedBy: z.string().min(1),
  graphNodes: z.array(z.unknown()).optional(),
  graphEdges: z.array(z.unknown()).optional(),
});

export const obligationConceptLinkedPayloadSchema = z.object({
  conceptRef: z.string().min(1),
  obligationId: z.string().min(1),
  linkType: z.enum(["primary", "supporting", "context"]),
  linkedAt: z.string().min(1),
  linkedBy: z.string().min(1),
});

export const regulatorySourceReviewedPayloadSchema = z.object({
  slug: z.string().min(1),
  instrumentId: z.string().min(1),
  reviewedAt: z.string().min(1),
  reviewedSourceHash: z.string().min(1),
  method: z.enum(["llm-distill", "accepted-existing", "manual-expert"]),
  model: z.string().min(1).optional(),
  obligationCount: z.number().int().nonnegative(),
  reviewedBy: z.string().min(1),
});

export const graphNodeAssertedPayloadSchema = z.object({
  nodeId: z.string().min(1),
  nodeType: z.enum([
    "Regulator",
    "Jurisdiction",
    "Framework",
    "Document",
    "Provision",
    "Obligation",
    "Term",
    "RegulatedEntity",
    "Activity",
    "RiskCategory",
    "Control",
    "ReportingRequirement",
    "Threshold",
    "EffectivePeriod",
    "Policy",
    "Procedure",
  ]),
  label: z.string().min(1),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const graphEdgeAssertedPayloadSchema = z.object({
  edgeId: z.string().min(1),
  fromId: z.string().min(1),
  toId: z.string().min(1),
  edgeType: z.string().min(1),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  sourceProvision: z.string().optional(),
  extractionMethod: z.enum(["register", "frontmatter", "llm", "rule-based"]),
  confidenceScore: z.number().min(0).max(1),
  metadata: z.record(z.unknown()).optional(),
});

// ===========================================================================
// 2. market-data
// ===========================================================================

export const marketDataStaleAlertPayloadSchema = z.object({
  instrument: z.string(),
  source: z.string(),
  dataType: z.string(),
  thresholdMs: z.number().int().positive(),
  actualAgeMs: z.number().int().nonnegative(),
  asOf: z.string(),
  fallbackSourceUsed: z.string().nullable(),
});

export const zaroniaRatePublishedPayloadSchema = z.object({
  rate: z.number(),
  publicationDate: z.string(),
  source: z.string(),
});

export const zaroniaTermRatePublishedPayloadSchema = z.object({
  rate: z.number(),
  tenor: z.string(),
  publicationDate: z.string(),
  source: z.string(),
});

export const jibarFixingPublishedPayloadSchema = z.object({
  rate: z.number(),
  tenor: z.string(),
  fixingDate: z.string(),
  source: z.string(),
});

export const oisCurvePublishedPayloadSchema = z.object({
  pillars: z.array(
    z.object({
      tenor: z.string(),
      rate: z.number(),
    }),
  ),
  curveDate: z.string(),
  source: z.string(),
});

export const sagbYieldsPublishedPayloadSchema = z.object({
  yields: z.array(
    z.object({
      tenor: z.string(),
      yieldPct: z.number(),
      isin: z.string().optional(),
    }),
  ),
  settleDate: z.string(),
  source: z.string(),
});

// ===========================================================================
// 3. obligation-review
// ===========================================================================

const obligationReviewDomainSchema = z.enum(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]);

const obligationReviewCompletedStatusSchema = z.enum([
  "reviewed-confirmed",
  "reviewed-modified",
  "reviewed-retired",
]);

export const obligationReviewMatchedPayloadSchema = z.object({
  existingObligationUrn: z.string().min(1),
  instrumentId: z.string().min(1),
  sectionRef: z.string().min(1),
  llmExtractionEventId: z.string().min(1),
  matchConfidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
});

export const obligationReviewConflictPayloadSchema = z.object({
  existingObligationUrn: z.string().min(1),
  instrumentId: z.string().min(1),
  sectionRef: z.string().min(1),
  llmExtractionEventId: z.string().min(1),
  conflictFields: z.array(z.string().min(1)).min(1),
  existingValue: z.record(z.string(), z.string()),
  proposedValue: z.record(z.string(), z.string()),
  rationale: z.string().min(1),
});

const obligationProposedFieldsSchema = z
  .object({
    requirement: z.string().min(1),
    citation: z.string().min(1),
    fulfilmentPolicy: z.string().optional(),
    owner: z.string().optional(),
    status: z.string().optional(),
    bindTrigger: z.string().optional(),
    entityScope: z.string().optional(),
    appliesAt: z.string().optional(),
    productScope: z.string().optional(),
    activityScope: z.string().optional(),
    riskTaxonomy: z.string().optional(),
  })
  .passthrough();

export const obligationCandidateProposedPayloadSchema = z.object({
  proposedUrn: z.string().min(1),
  instrumentId: z.string().min(1),
  sectionRef: z.string().min(1),
  llmExtractionEventId: z.string().min(1),
  applicabilityScore: z.number().min(0).max(1),
  relevancyScore: z.number().min(0).max(1),
  domain: obligationReviewDomainSchema,
  proposedFields: obligationProposedFieldsSchema,
});

export const obligationReviewCompletedPayloadSchema = z
  .object({
    obligationUrn: z.string().min(1),
    newStatus: obligationReviewCompletedStatusSchema,
    reviewerAgentName: z.string().min(1),
    reviewerSeat: z.string().min(1),
    rationale: z.string().min(1),
    modifications: z.record(z.string(), z.string()).optional(),
  })
  .refine(
    (payload) =>
      payload.newStatus !== "reviewed-modified" ||
      (payload.modifications !== undefined && Object.keys(payload.modifications).length > 0),
    {
      message: "modifications must be non-empty when newStatus is reviewed-modified",
      path: ["modifications"],
    },
  );

// ===========================================================================
// 4. obligation-equivalence
// ===========================================================================

const obligationEquivalenceVerdictSchema = z.enum([
  "equivalent",
  "sa-stricter-gold-plates",
  "materially-divergent",
]);

export const obligationEquivalenceClassifiedPayloadSchema = z
  .object({
    saObligationId: z.string().min(1),
    bcbsObligationId: z.string().min(1),
    verdict: obligationEquivalenceVerdictSchema,
    delta: z.string().min(1).optional(),
    rationale: z.string().min(1),
    classifiedBy: z.string().min(1),
    confidence: z.number().min(0).max(1),
    asOf: z.string().min(1),
  })
  .refine((p) => p.verdict !== "sa-stricter-gold-plates" || p.delta !== undefined, {
    message: "delta is required when verdict is sa-stricter-gold-plates",
    path: ["delta"],
  })
  .refine((p) => p.verdict !== "materially-divergent" || p.delta !== undefined, {
    message: "delta is required when verdict is materially-divergent",
    path: ["delta"],
  });

// ===========================================================================
// Batch type-name manifest — the single source of truth for which types this
// batch teas + flips. The registry rows, the parity gate, and the schema-parity
// test all read this list so the three stay in lock-step.
// ===========================================================================

/**
 * Every reference-data event type in Wave 2 batch-1, paired with its v2 schema.
 * The registry maps these into tee-enabled foothold rows; the parity gate folds
 * an event-list register over exactly this type set on both stores.
 */
export const REFERENCE_DATA_BATCH_1_SCHEMAS = {
  // regulatory
  RegulatoryInstrumentRegistered: regulatoryInstrumentRegisteredPayloadSchema,
  RegulatoryInstrumentAmended: regulatoryInstrumentAmendedPayloadSchema,
  RegulatoryInstrumentContextualised: regulatoryInstrumentContextualisedPayloadSchema,
  RegulatoryConceptExtracted: regulatoryConceptExtractedPayloadSchema,
  ObligationConceptLinked: obligationConceptLinkedPayloadSchema,
  RegulatorySourceReviewed: regulatorySourceReviewedPayloadSchema,
  GraphNodeAsserted: graphNodeAssertedPayloadSchema,
  GraphEdgeAsserted: graphEdgeAssertedPayloadSchema,
  // market-data
  MarketDataStaleAlert: marketDataStaleAlertPayloadSchema,
  ZaroniaRatePublished: zaroniaRatePublishedPayloadSchema,
  ZaroniaTermRatePublished: zaroniaTermRatePublishedPayloadSchema,
  JibarFixingPublished: jibarFixingPublishedPayloadSchema,
  OisCurvePublished: oisCurvePublishedPayloadSchema,
  SagbYieldsPublished: sagbYieldsPublishedPayloadSchema,
  // obligation-review
  ObligationReviewMatched: obligationReviewMatchedPayloadSchema,
  ObligationReviewConflict: obligationReviewConflictPayloadSchema,
  ObligationCandidateProposed: obligationCandidateProposedPayloadSchema,
  ObligationReviewCompleted: obligationReviewCompletedPayloadSchema,
  // obligation-equivalence
  ObligationEquivalenceClassified: obligationEquivalenceClassifiedPayloadSchema,
} as const;

export type ReferenceDataBatch1Type = keyof typeof REFERENCE_DATA_BATCH_1_SCHEMAS;

/** Sorted array of the batch's event-type names. */
export const REFERENCE_DATA_BATCH_1_TYPES: readonly ReferenceDataBatch1Type[] = Object.keys(
  REFERENCE_DATA_BATCH_1_SCHEMAS,
).sort() as ReferenceDataBatch1Type[];
