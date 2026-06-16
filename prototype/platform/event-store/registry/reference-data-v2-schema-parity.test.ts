// platform/event-store/registry/reference-data-v2-schema-parity.test.ts
//
// Schema-parity guard for Wave 2 batch-1 reference-data migration.
//
// The v2-core package re-declares the four migrated domains' payload schemas
// (`v2-core/reference-data/events.ts`) because it cannot import the V1 schemas
// across the no-v1-import boundary. This test is the anti-drift backstop
// (Charter cmd 3: no green by concealment / weakened assertions): for each
// migrated type, a canonical sample that the AUTHORITATIVE V1 schema accepts
// MUST also be accepted by the v2 schema, and a payload the V1 schema REJECTS
// MUST also be rejected by the v2 schema. A drift that weakens the v2 copy
// (accepting something V1 rejects, or vice-versa) fails here.
//
// This test lives on the v1 side because only v1-side code may import BOTH the
// V1 schemas (under platform/) and the v2 schemas (under v2-core/) — the
// no-v1-import boundary forbids the reverse, not this direction.
//
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC.
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import * as v2 from "../../../v2-core/reference-data/events";
import * as mdV1 from "../event-types/market-data";
import * as oeV1 from "../event-types/obligation-equivalence";
import * as orV1 from "../event-types/obligation-review";
import * as regV1 from "../event-types/regulatory";

const BLAKE3 = `blake3:${"a".repeat(64)}`;

/**
 * One parity case: a V1 schema, the matching v2 schema, a canonical VALID
 * sample both must accept, and an INVALID sample both must reject.
 */
interface Case {
  readonly name: string;
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous Zod schemas across 19 types; parse() is the only call.
  readonly v1: { parse: (p: unknown) => unknown; safeParse: (p: unknown) => { success: boolean } };
  // biome-ignore lint/suspicious/noExplicitAny: see above.
  readonly v2: { parse: (p: unknown) => unknown; safeParse: (p: unknown) => { success: boolean } };
  readonly valid: Record<string, unknown>;
  readonly invalid: Record<string, unknown>;
}

const cases: Case[] = [
  // --- regulatory ---
  {
    name: "RegulatoryInstrumentRegistered",
    v1: regV1.regulatoryInstrumentRegisteredPayloadSchema,
    v2: v2.regulatoryInstrumentRegisteredPayloadSchema,
    valid: {
      instrumentId: "FAIS-ACT-37-2002",
      title: "FAIS Act",
      issuingBody: "Parliament",
      instrumentType: "act",
      jurisdiction: "ZA",
      publicationDate: "2002-09-15",
      effectiveDate: "2004-09-30",
      version: "2002-orig",
      contentHash: BLAKE3,
    },
    invalid: { instrumentId: "X", issuingBody: "NOT-A-BODY" },
  },
  {
    name: "RegulatoryInstrumentAmended",
    v1: regV1.regulatoryInstrumentAmendedPayloadSchema,
    v2: v2.regulatoryInstrumentAmendedPayloadSchema,
    valid: {
      instrumentId: "FAIS-ACT-37-2002",
      newVersion: "2002-amend-1",
      amendmentDate: "2008-01-01",
      newContentHash: BLAKE3,
      supersededHash: BLAKE3,
      changeDescription: "amended s7",
    },
    invalid: { instrumentId: "X", newContentHash: "not-blake3" },
  },
  {
    name: "RegulatoryInstrumentContextualised",
    v1: regV1.regulatoryInstrumentContextualisedPayloadSchema,
    v2: v2.regulatoryInstrumentContextualisedPayloadSchema,
    valid: {
      instrumentId: "FAIS-ACT-37-2002",
      regulatoryAuthority: { name: "FSCA", mandate: "conduct", enforcementPowers: ["fines"] },
      legislativeFramework: {
        instrumentType: "act",
        relatedDomesticInstruments: [],
        positionInHierarchy: "primary",
        administeredBy: "FSCA",
      },
      internationalAlignment: { conformsTo: [], alignmentDescription: "n/a" },
      regulatoryObjective: {
        longTitle: "An Act ...",
        primaryObjective: "protect clients",
        protectedInterests: ["clients"],
        enforcementApproach: "principles-based",
        outcomeStatement: "fair outcomes",
      },
      contextualisedAt: "2026-06-16T00:00:00Z",
      contextualisedBy: "mira@bank",
    },
    invalid: { instrumentId: "X" },
  },
  {
    name: "RegulatoryConceptExtracted",
    v1: regV1.regulatoryConceptExtractedPayloadSchema,
    v2: v2.regulatoryConceptExtractedPayloadSchema,
    valid: {
      instrumentId: "FAIS-ACT-37-2002",
      sectionId: "FAIS-ACT-37-2002:s7",
      sectionTitle: "Authorisation",
      verbatimText: "No person may ...",
      subjectScope: { entityTypes: ["FSP"], licenceTypes: ["bank"], roles: [] },
      temporalScope: { cadence: "ongoing" },
      conditionScope: {},
      obligation: { type: "duty", actor: ["FSP"], actionSummary: "be authorised" },
      applicabilityScore: 0.9,
      applicabilityRationale: "names banks",
      relevancyScore: 0.8,
      relevancyRationale: "licence-affecting",
      classifications: {
        domain: ["C-FAIS"],
        riskTaxonomy: [],
        productScope: [],
        activityScope: [],
      },
      extractedAt: "2026-06-16T00:00:00Z",
      extractedBy: "mira@bank",
    },
    invalid: { instrumentId: "X", applicabilityScore: 5 },
  },
  {
    name: "ObligationConceptLinked",
    v1: regV1.obligationConceptLinkedPayloadSchema,
    v2: v2.obligationConceptLinkedPayloadSchema,
    valid: {
      conceptRef: "FAIS-ACT-37-2002:s7",
      obligationId: "ORG-CD-01",
      linkType: "primary",
      linkedAt: "2026-06-16T00:00:00Z",
      linkedBy: "mira@bank",
    },
    invalid: { conceptRef: "X", linkType: "not-a-link-type" },
  },
  {
    name: "RegulatorySourceReviewed",
    v1: regV1.regulatorySourceReviewedPayloadSchema,
    v2: v2.regulatorySourceReviewedPayloadSchema,
    valid: {
      slug: "bcbs-cre",
      instrumentId: "BCBS-CRE",
      reviewedAt: "2026-06-16T00:00:00Z",
      reviewedSourceHash: "abc123",
      method: "llm-distill",
      obligationCount: 5,
      reviewedBy: "mira@bank",
    },
    invalid: { slug: "x", method: "not-a-method", obligationCount: -1 },
  },
  {
    name: "GraphNodeAsserted",
    v1: regV1.graphNodeAssertedPayloadSchema,
    v2: v2.graphNodeAssertedPayloadSchema,
    valid: { nodeId: "n1", nodeType: "Regulator", label: "FSCA" },
    invalid: { nodeId: "n1", nodeType: "NotAType", label: "x" },
  },
  {
    name: "GraphEdgeAsserted",
    v1: regV1.graphEdgeAssertedPayloadSchema,
    v2: v2.graphEdgeAssertedPayloadSchema,
    valid: {
      edgeId: "e1",
      fromId: "n1",
      toId: "n2",
      edgeType: "EXPRESSES",
      extractionMethod: "register",
      confidenceScore: 0.9,
    },
    invalid: {
      edgeId: "e1",
      fromId: "n1",
      toId: "n2",
      edgeType: "X",
      extractionMethod: "register",
      confidenceScore: 2,
    },
  },
  // --- market-data ---
  {
    name: "MarketDataStaleAlert",
    v1: mdV1.marketDataStaleAlertPayloadSchema,
    v2: v2.marketDataStaleAlertPayloadSchema,
    valid: {
      instrument: "USD/ZAR",
      source: "Bloomberg",
      dataType: "mid-price",
      thresholdMs: 60000,
      actualAgeMs: 120000,
      asOf: "2026-06-16T00:00:00Z",
      fallbackSourceUsed: null,
    },
    invalid: { instrument: "USD/ZAR", thresholdMs: -1, fallbackSourceUsed: null },
  },
  {
    name: "ZaroniaRatePublished",
    v1: mdV1.zaroniaRatePublishedPayloadSchema,
    v2: v2.zaroniaRatePublishedPayloadSchema,
    valid: { rate: 0.0818, publicationDate: "2026-06-16", source: "sarb" },
    invalid: { rate: "not-a-number", publicationDate: "2026-06-16", source: "sarb" },
  },
  {
    name: "ZaroniaTermRatePublished",
    v1: mdV1.zaroniaTermRatePublishedPayloadSchema,
    v2: v2.zaroniaTermRatePublishedPayloadSchema,
    valid: { rate: 0.0822, tenor: "3M", publicationDate: "2026-06-16", source: "sarb" },
    invalid: { rate: 0.0822, publicationDate: "2026-06-16", source: "sarb" },
  },
  {
    name: "JibarFixingPublished",
    v1: mdV1.jibarFixingPublishedPayloadSchema,
    v2: v2.jibarFixingPublishedPayloadSchema,
    valid: { rate: 0.089, tenor: "3M", fixingDate: "2026-06-16", source: "sarb" },
    invalid: { rate: 0.089, fixingDate: "2026-06-16", source: "sarb" },
  },
  {
    name: "OisCurvePublished",
    v1: mdV1.oisCurvePublishedPayloadSchema,
    v2: v2.oisCurvePublishedPayloadSchema,
    valid: { pillars: [{ tenor: "1M", rate: 0.08 }], curveDate: "2026-06-16", source: "rbond" },
    invalid: { pillars: [{ tenor: "1M" }], curveDate: "2026-06-16", source: "rbond" },
  },
  {
    name: "SagbYieldsPublished",
    v1: mdV1.sagbYieldsPublishedPayloadSchema,
    v2: v2.sagbYieldsPublishedPayloadSchema,
    valid: {
      yields: [{ tenor: "10Y", yieldPct: 9.25 }],
      settleDate: "2026-06-16",
      source: "rbond",
    },
    invalid: { yields: [{ tenor: "10Y" }], settleDate: "2026-06-16", source: "rbond" },
  },
  // --- obligation-review ---
  {
    name: "ObligationReviewMatched",
    v1: orV1.obligationReviewMatchedPayloadSchema,
    v2: v2.obligationReviewMatchedPayloadSchema,
    valid: {
      existingObligationUrn: "urn:org:cd:01",
      instrumentId: "BANKS-ACT-94-1990",
      sectionRef: "s.60(5)(a)",
      llmExtractionEventId: "evt-1",
      matchConfidence: 0.9,
      rationale: "exact match",
    },
    invalid: { existingObligationUrn: "x", matchConfidence: 2 },
  },
  {
    name: "ObligationReviewConflict",
    v1: orV1.obligationReviewConflictPayloadSchema,
    v2: v2.obligationReviewConflictPayloadSchema,
    valid: {
      existingObligationUrn: "urn:org:cd:01",
      instrumentId: "BANKS-ACT-94-1990",
      sectionRef: "s.60",
      llmExtractionEventId: "evt-1",
      conflictFields: ["requirement"],
      existingValue: { requirement: "old" },
      proposedValue: { requirement: "new" },
      rationale: "register stale",
    },
    invalid: {
      existingObligationUrn: "x",
      instrumentId: "y",
      sectionRef: "z",
      llmExtractionEventId: "e",
      conflictFields: [],
      existingValue: {},
      proposedValue: {},
      rationale: "r",
    },
  },
  {
    name: "ObligationCandidateProposed",
    v1: orV1.obligationCandidateProposedPayloadSchema,
    v2: v2.obligationCandidateProposedPayloadSchema,
    valid: {
      proposedUrn: "urn:org:cd:99",
      instrumentId: "BANKS-ACT-94-1990",
      sectionRef: "s.60",
      llmExtractionEventId: "evt-1",
      applicabilityScore: 0.9,
      relevancyScore: 0.8,
      domain: "A",
      proposedFields: { requirement: "do X", citation: "s.60" },
    },
    invalid: {
      proposedUrn: "x",
      instrumentId: "y",
      sectionRef: "z",
      llmExtractionEventId: "e",
      applicabilityScore: 0.9,
      relevancyScore: 0.8,
      domain: "Z",
      proposedFields: { requirement: "do X", citation: "s.60" },
    },
  },
  {
    name: "ObligationReviewCompleted",
    v1: orV1.obligationReviewCompletedPayloadSchema,
    v2: v2.obligationReviewCompletedPayloadSchema,
    valid: {
      obligationUrn: "urn:org:cd:01",
      newStatus: "reviewed-confirmed",
      reviewerAgentName: "Owen",
      reviewerSeat: "company-secretary",
      rationale: "confirmed",
    },
    // reviewed-modified without modifications must be rejected by both (refine).
    invalid: {
      obligationUrn: "urn:org:cd:01",
      newStatus: "reviewed-modified",
      reviewerAgentName: "Owen",
      reviewerSeat: "company-secretary",
      rationale: "modified",
    },
  },
  // --- obligation-equivalence ---
  {
    name: "ObligationEquivalenceClassified",
    v1: oeV1.obligationEquivalenceClassifiedPayloadSchema,
    v2: v2.obligationEquivalenceClassifiedPayloadSchema,
    valid: {
      saObligationId: "ORG-PR-01",
      bcbsObligationId: "BCBS-CRE-s20",
      verdict: "equivalent",
      rationale: "same outcome",
      classifiedBy: "Mira (Compliance / RegTech engineer)",
      confidence: 0.9,
      asOf: "2026-06-16",
    },
    // materially-divergent without delta must be rejected by both (refine).
    invalid: {
      saObligationId: "ORG-PR-01",
      bcbsObligationId: "BCBS-CRE-s20",
      verdict: "materially-divergent",
      rationale: "different",
      classifiedBy: "Mira",
      confidence: 0.9,
      asOf: "2026-06-16",
    },
  },
];

describe("reference-data v2 schema parity (anti-drift)", () => {
  test("all 19 migrated types are covered", () => {
    const covered = new Set(cases.map((c) => c.name));
    for (const type of v2.REFERENCE_DATA_BATCH_1_TYPES) {
      expect(covered.has(type)).toBe(true);
    }
    expect(cases.length).toBe(v2.REFERENCE_DATA_BATCH_1_TYPES.length);
  });

  for (const c of cases) {
    test(`${c.name}: V1 and v2 both ACCEPT the canonical valid sample`, () => {
      expect(c.v1.safeParse(c.valid).success).toBe(true);
      expect(c.v2.safeParse(c.valid).success).toBe(true);
    });

    test(`${c.name}: V1 and v2 both REJECT the invalid sample`, () => {
      expect(c.v1.safeParse(c.invalid).success).toBe(false);
      expect(c.v2.safeParse(c.invalid).success).toBe(false);
    });
  }
});
