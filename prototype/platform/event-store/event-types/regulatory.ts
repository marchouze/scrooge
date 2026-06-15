// platform/event-store/event-types/regulatory.ts
//
// Regulatory horizon-scanning event-payload schemas.
//
// Covers:
//   - RegulatoryInstrumentRegistered  — new instrument version registered
//   - RegulatoryInstrumentAmended     — existing instrument amended
//   - RegulatoryInstrumentContextualised — authority, framework, objective
//   - RegulatoryConceptExtracted      — AI-extracted obligation concept per section
//   - ObligationConceptLinked         — concept matched to obligations-register row
//
// Authority: Mira mandate (Compliance / RegTech engineer, engineering).
// Pilot: FAIS Act 37/2002 horizon scan.
// Author: Mira (Compliance / RegTech engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// RegulatoryInstrumentRegistered
// ---------------------------------------------------------------------------

export const regulatoryInstrumentRegisteredPayloadSchema = z.object({
  /** Stable identifier — e.g. "FAIS-ACT-37-2002". */
  instrumentId: z.string().min(1),

  /** Human-readable full title. */
  title: z.string().min(1),

  /** Body that issued the instrument. */
  issuingBody: z.enum(["Parliament", "FSCA", "SARB", "PA", "National Treasury", "BCBS"]),

  /** Type of the legal instrument. */
  instrumentType: z.enum([
    "act",
    "regulation",
    "notice",
    "circular",
    "guidance",
    "directive",
    "conduct-standard",
  ]),

  /** ISO 3166-1 alpha-2 jurisdiction code. */
  jurisdiction: z.string().min(1),

  /** ISO date — date the gazette was published. */
  publicationDate: z.string().min(1),

  /** ISO date — date the instrument came into legal effect. */
  effectiveDate: z.string().min(1),

  /** Government Gazette reference — e.g. "GG-24079". */
  gazetteRef: z.string().min(1).optional(),

  /** Version string — e.g. "2002-orig" or "2002-amend-1". */
  version: z.string().min(1),

  /** BLAKE3 content hash of the full instrument text (`blake3:<64 hex>`). */
  contentHash: z
    .string()
    .min(1)
    .regex(/^blake3:[0-9a-f]{64}$/, {
      message: "contentHash must be `blake3:<64 lowercase hex chars>`",
    }),

  /** Canonical URL of the source document (FSCA / gov.za). */
  sourceUrl: z.string().url().optional(),

  /** instrumentIds that this version supersedes. */
  supersedes: z.array(z.string().min(1)).optional(),
});

export type RegulatoryInstrumentRegisteredPayload = z.infer<
  typeof regulatoryInstrumentRegisteredPayloadSchema
>;

export function makeRegulatoryInstrumentRegistered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RegulatoryInstrumentRegisteredPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RegulatoryInstrumentRegistered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: regulatoryInstrumentRegisteredPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RegulatoryInstrumentAmended
// ---------------------------------------------------------------------------

export const regulatoryInstrumentAmendedPayloadSchema = z.object({
  /** Instrument being amended. */
  instrumentId: z.string().min(1),

  /** New version string after amendment. */
  newVersion: z.string().min(1),

  /** ISO date of the amendment. */
  amendmentDate: z.string().min(1),

  /** BLAKE3 hash of the new full-text content. */
  newContentHash: z
    .string()
    .min(1)
    .regex(/^blake3:[0-9a-f]{64}$/, {
      message: "newContentHash must be `blake3:<64 lowercase hex chars>`",
    }),

  /** BLAKE3 hash of the version being superseded. */
  supersededHash: z
    .string()
    .min(1)
    .regex(/^blake3:[0-9a-f]{64}$/, {
      message: "supersededHash must be `blake3:<64 lowercase hex chars>`",
    }),

  /** Human-readable summary of what changed. */
  changeDescription: z.string().min(1),

  /** Government Gazette reference for the amending notice. */
  gazetteRef: z.string().min(1).optional(),
});

export type RegulatoryInstrumentAmendedPayload = z.infer<
  typeof regulatoryInstrumentAmendedPayloadSchema
>;

export function makeRegulatoryInstrumentAmended(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RegulatoryInstrumentAmendedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RegulatoryInstrumentAmended",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: regulatoryInstrumentAmendedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RegulatoryInstrumentContextualised
// ---------------------------------------------------------------------------

export const regulatoryInstrumentContextualisedPayloadSchema = z.object({
  /** Instrument this contextualisation applies to. */
  instrumentId: z.string().min(1),

  /** Regulatory authority profile. */
  regulatoryAuthority: z.object({
    name: z.string().min(1),
    mandate: z.string().min(1),
    enforcementPowers: z.array(z.string().min(1)),
  }),

  /** Legislative framework placement. */
  legislativeFramework: z.object({
    instrumentType: z.string().min(1),
    parentLegislation: z.array(z.string().min(1)).optional(),
    relatedDomesticInstruments: z.array(z.string().min(1)),
    positionInHierarchy: z.string().min(1),
    administeredBy: z.string().min(1),
  }),

  /** International alignment. */
  internationalAlignment: z.object({
    /** Standards bodies / frameworks the instrument aligns with. */
    conformsTo: z.array(z.string().min(1)),
    alignmentDescription: z.string().min(1),
    knownDeviations: z.array(z.string().min(1)).optional(),
  }),

  /** Core regulatory objective. */
  regulatoryObjective: z.object({
    /** Verbatim long title of the act. */
    longTitle: z.string().min(1),
    primaryObjective: z.string().min(1),
    protectedInterests: z.array(z.string().min(1)),
    enforcementApproach: z.enum(["principles-based", "rules-based", "hybrid"]),
    outcomeStatement: z.string().min(1),
  }),

  /** ISO 8601 UTC when contextualisation was produced. */
  contextualisedAt: z.string().min(1),

  /** Agent URN or email of the contextualiser. */
  contextualisedBy: z.string().min(1),
});

export type RegulatoryInstrumentContextualisedPayload = z.infer<
  typeof regulatoryInstrumentContextualisedPayloadSchema
>;

export function makeRegulatoryInstrumentContextualised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RegulatoryInstrumentContextualisedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RegulatoryInstrumentContextualised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: regulatoryInstrumentContextualisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RegulatoryConceptExtracted
// ---------------------------------------------------------------------------

export const regulatoryConceptExtractedPayloadSchema = z.object({
  /** Instrument this concept belongs to. */
  instrumentId: z.string().min(1),

  /** Section identifier — e.g. "FAIS-ACT-37-2002:s7" or "FAIS-ACT-37-2002:s13-1-a". */
  sectionId: z.string().min(1),

  /** Section heading or derived title. */
  sectionTitle: z.string().min(1),

  /** Verbatim excerpt — max 2000 chars. */
  verbatimText: z.string().max(2000),

  // ── Dimension 1: to whom does this apply? ──────────────────────────────

  subjectScope: z.object({
    /** e.g. ["FSP", "bank", "key-individual", "board", "auditor"] */
    entityTypes: z.array(z.string()),
    /** e.g. ["Category-I-FSP", "bank"] */
    licenceTypes: z.array(z.string()),
    /** Named roles within the entity (e.g. "compliance officer"). */
    roles: z.array(z.string()),
    /** Free-text threshold description if one applies. */
    thresholdDescription: z.string().optional(),
  }),

  // ── Dimension 2: when does it apply? ──────────────────────────────────

  temporalScope: z.object({
    /** ISO date — section commencement date if different from act. */
    commencementDate: z.string().optional(),
    cadence: z.enum(["ongoing", "one-time", "periodic", "event-triggered"]),
    /** Trigger event description (for event-triggered cadence). */
    eventTrigger: z.string().optional(),
    /** Period in days for periodic cadence. */
    periodDays: z.number().int().positive().optional(),
    /** Any transitional or phase-in notes. */
    transitionalNote: z.string().optional(),
  }),

  // ── Dimension 3: under what circumstances? ────────────────────────────

  conditionScope: z.object({
    /** Client type classifications the obligation targets. */
    clientTypes: z.array(z.string()).optional(),
    /** Activity triggers for the obligation. */
    activityTriggers: z.array(z.string()).optional(),
    /** Financial instrument types in scope. */
    instrumentTypes: z.array(z.string()).optional(),
    /** Threshold conditions that gate the obligation. */
    thresholdConditions: z.array(z.string()).optional(),
    /** Explicit exclusions from the obligation. */
    exclusions: z.array(z.string()).optional(),
  }),

  // ── Dimension 4: what must happen? ────────────────────────────────────

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
    /** Who must fulfil this obligation. */
    actor: z.array(z.string()),
    /** One-sentence summary of required action. */
    actionSummary: z.string().min(1),
    /** Timeframe in plain text (e.g. "within 15 business days"). */
    timeframeDescription: z.string().optional(),
    /** Output artifact required (e.g. "written disclosure notice"). */
    output: z.string().optional(),
    /** Recipients of the output (e.g. ["client", "FSCA"]). */
    recipient: z.array(z.string()).optional(),
  }),

  // ── Scores ────────────────────────────────────────────────────────────

  /**
   * How applicable is this section to the bank? 0.0–1.0.
   * 1.0 = explicitly names bank's entity/licence type + matches activities.
   * 0.0 = purely definitional or no direct obligation on the bank.
   */
  applicabilityScore: z.number().min(0).max(1),

  /** Rationale for the applicability score. */
  applicabilityRationale: z.string().min(1),

  /**
   * Given it applies, how operationally significant? 0.0–1.0.
   * 0.9–1.0 = criminal penalty / licence-affecting.
   * 0.0–0.2 = definitional / contextual.
   */
  relevancyScore: z.number().min(0).max(1),

  /** Rationale for the relevancy score. */
  relevancyRationale: z.string().min(1),

  // ── Classifications ───────────────────────────────────────────────────

  classifications: z.object({
    /** Domain codes from the canonical taxonomy (e.g. ["C-FAIS"]). */
    domain: z.array(z.string()),
    /** Risk taxonomy codes (e.g. ["CMP-001"]). */
    riskTaxonomy: z.array(z.string()),
    /** Product-scope codes (e.g. ["bonds", "equities"]). */
    productScope: z.array(z.string()),
    /** Activity-scope codes (e.g. ["ACT-COMPLIANCE"]). */
    activityScope: z.array(z.string()),
  }),

  /** ISO 8601 UTC when extraction ran. */
  extractedAt: z.string().min(1),

  /** Agent URN or email of the extractor. */
  extractedBy: z.string().min(1),

  /**
   * Graph nodes extracted from this provision (optional — populated when
   * the LLM extraction pass includes knowledge-graph extraction).
   * Schema contract: GRAPH_NODE_SCHEMA in platform/regulatory/graph/ontology-schema.ts.
   * Kept loose (z.unknown()) here since the ontology is evolving; validated
   * externally via validateExtractionResponse().
   */
  graphNodes: z.array(z.unknown()).optional(),

  /**
   * Graph edges asserted by this provision (optional — populated when
   * the LLM extraction pass includes knowledge-graph extraction).
   * Schema contract: GRAPH_EDGE_SCHEMA in platform/regulatory/graph/ontology-schema.ts.
   */
  graphEdges: z.array(z.unknown()).optional(),
});

export type RegulatoryConceptExtractedPayload = z.infer<
  typeof regulatoryConceptExtractedPayloadSchema
>;

export function makeRegulatoryConceptExtracted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RegulatoryConceptExtractedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RegulatoryConceptExtracted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: regulatoryConceptExtractedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ObligationConceptLinked
// ---------------------------------------------------------------------------

export const obligationConceptLinkedPayloadSchema = z.object({
  /** sectionId from the RegulatoryConceptExtracted event. */
  conceptRef: z.string().min(1),

  /** Obligations-register row ID — e.g. "ORG-CD-01". */
  obligationId: z.string().min(1),

  /**
   * Relationship type:
   * - primary: this section is the main statutory basis for the obligation
   * - supporting: corroborates or elaborates the obligation
   * - context: background / definitional; no direct obligation
   */
  linkType: z.enum(["primary", "supporting", "context"]),

  /** ISO 8601 UTC when the link was established. */
  linkedAt: z.string().min(1),

  /** Agent URN or email that established the link. */
  linkedBy: z.string().min(1),
});

export type ObligationConceptLinkedPayload = z.infer<typeof obligationConceptLinkedPayloadSchema>;

export function makeObligationConceptLinked(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ObligationConceptLinkedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ObligationConceptLinked",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: obligationConceptLinkedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RegulatorySourceReviewed — WS-REGULATORY-REVIEW-MARKER (Phase 1)
// ---------------------------------------------------------------------------
//
// Marks that a regulator's acquired source text has been read / LLM-reviewed
// and its obligations traced back into the bank's register. The review marker
// is keyed to the *exact source bytes reviewed* via `reviewedSourceHash`
// (the instrument's goldenSourceHash at review time), so the freshness recon
// can detect when the source has since been re-acquired (hash drift → stale).
//
// Authority: brief:atlas:phase-1-regulatory-review-marker-foundation-regu:2026-06-15.
// Author: Atlas (Core Banking Platform Architect, engineering).

export const regulatorySourceReviewedPayloadSchema = z.object({
  /** Structured-document slug of the reviewed instrument (e.g. "bcbs-cre"). */
  slug: z.string().min(1),

  /** Stable instrument id (e.g. "BCBS-CRE", "IFRS-9"). */
  instrumentId: z.string().min(1),

  /** ISO 8601 UTC timestamp the review was performed. */
  reviewedAt: z.string().min(1),

  /**
   * BLAKE3 document hash of the exact source bytes that were reviewed. The
   * freshness recon flags a review as `stale` once the instrument's current
   * goldenSourceHash diverges from this value. Free-form string (the source
   * filing's `documentHash`), not constrained to a `blake3:` prefix because
   * the RecordFiled document store may hash with or without the prefix.
   */
  reviewedSourceHash: z.string().min(1),

  /** How the review was carried out. */
  method: z.enum(["llm-distill", "accepted-existing", "manual-expert"]),

  /** LLM model used (when method === "llm-distill"). */
  model: z.string().min(1).optional(),

  /** Number of bank obligations traced back to this source at review time. */
  obligationCount: z.number().int().nonnegative(),

  /** Agent / person who is accountable for the review. */
  reviewedBy: z.string().min(1),
});

export type RegulatorySourceReviewedPayload = z.infer<
  typeof regulatorySourceReviewedPayloadSchema
>;

export function makeRegulatorySourceReviewed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RegulatorySourceReviewedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RegulatorySourceReviewed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: regulatorySourceReviewedPayloadSchema.parse(args.payload),
  });
}

export const REGULATORY_TYPED_EVENT_TYPES = [
  "RegulatoryInstrumentRegistered",
  "RegulatoryInstrumentAmended",
  "RegulatoryInstrumentContextualised",
  "RegulatoryConceptExtracted",
  "ObligationConceptLinked",
  "RegulatorySourceReviewed",
] as const;
export type RegulatoryEventType = (typeof REGULATORY_TYPED_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// GraphNodeAsserted
// ---------------------------------------------------------------------------

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
export type GraphNodeAssertedPayload = z.infer<typeof graphNodeAssertedPayloadSchema>;

export function makeGraphNodeAsserted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: GraphNodeAssertedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "GraphNodeAsserted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: graphNodeAssertedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// GraphEdgeAsserted
// ---------------------------------------------------------------------------

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
export type GraphEdgeAssertedPayload = z.infer<typeof graphEdgeAssertedPayloadSchema>;

export function makeGraphEdgeAsserted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: GraphEdgeAssertedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "GraphEdgeAsserted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: graphEdgeAssertedPayloadSchema.parse(args.payload),
  });
}
