// platform/event-store/registry/money-free-batch-3-v2-schema-parity.test.ts
//
// Schema-parity guard for Wave 2 batch-3 money-free migration.
//
// The v2-core package re-declares the six migrated domains' payload schemas
// (`v2-core/money-free-batch-3/events.ts`) because it cannot import the V1
// schemas across the no-v1-import boundary. This test is the anti-drift backstop
// (Charter cmd 3: no green by concealment / weakened assertions): for each
// re-declared type, a canonical sample that the AUTHORITATIVE V1 schema accepts
// MUST also be accepted by the v2 schema, and a payload the V1 schema REJECTS
// MUST also be rejected by the v2 schema. A drift that weakens the v2 copy
// (accepting something V1 rejects, or vice-versa) fails here.
//
// This test lives on the v1 side because only v1-side code may import BOTH the V1
// schemas (under platform/) and the v2 schemas (under v2-core/) — the
// no-v1-import boundary forbids the reverse, not this direction.
//
// SCOPE: the 24 RE-DECLARED types. The 15 FOOTHOLD types swept by batch-3
// (v2-banking money-free, decision-impact-sweep, v2-eval, context-pack,
// cross-tenant-csi, applicability) are NOT re-declared — they reuse their
// existing v2-core foothold schemas (validated at W0), so there is no batch-3
// re-declaration to drift-check for them.
//
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC.
// Brief: brief:atlas:wave-2-batch-3-remaining-money-free-domains:2026-06-16.
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import * as v2 from "../../../v2-core/money-free-batch-3/events";
import { MONEY_FREE_BATCH_3_REDECLARED_TYPES } from "../../../v2-core/money-free-batch-3/events";
import * as calcV1 from "../event-types/calculation";
import * as intranetV1 from "../event-types/intranet";
import * as modelV1 from "../event-types/model-risk";
import * as paV1 from "../event-types/regulatory-pa";
import * as regRepV1 from "../event-types/regulatory-reporting";
import * as seedV1 from "../event-types/seed-management";
import * as slaV1 from "../event-types/sla-approval";

const SHA = "a".repeat(64);

/**
 * One parity case: a V1 schema, the matching v2 schema, a canonical VALID sample
 * both must accept, and an INVALID sample both must reject.
 */
interface Case {
  readonly name: string;
  readonly v1: { safeParse: (p: unknown) => { success: boolean } };
  readonly v2: { safeParse: (p: unknown) => { success: boolean } };
  readonly valid: Record<string, unknown>;
  readonly invalid: Record<string, unknown>;
}

const slaSeat = { name: "Bea", position: "Accounting & financial reporting engineer, engineering" };

const cases: Case[] = [
  // --- intranet ---
  {
    name: "IntranetFeatureShipped",
    v1: intranetV1.intranetFeatureShippedPayloadSchema,
    v2: v2.intranetFeatureShippedPayloadSchema,
    valid: {
      featureId: "INTRANET-FEAT-001",
      title: "Fleet health card",
      description: "Live tile",
      prUrl: "https://github.com/marchouze/scrooge/pull/1",
      shippedBy: "noa",
      shippedAt: "2026-06-16T00:00:00Z",
    },
    // prUrl must be a URL — a bare string is rejected by both.
    invalid: {
      featureId: "INTRANET-FEAT-001",
      title: "x",
      description: "y",
      prUrl: "not-a-url",
      shippedBy: "noa",
      shippedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "DesignReviewComplete",
    v1: intranetV1.designReviewCompletePayloadSchema,
    v2: v2.designReviewCompletePayloadSchema,
    valid: {
      reviewId: "DESIGN-REV-001",
      featureOrComponent: "dashboard-home",
      reviewer: "noa",
      outcome: "approved",
      notes: "looks good",
      completedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      reviewId: "DESIGN-REV-001",
      featureOrComponent: "dashboard-home",
      reviewer: "noa",
      outcome: "maybe",
      notes: "x",
      completedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "UXFindingRaised",
    v1: intranetV1.uxFindingRaisedPayloadSchema,
    v2: v2.uxFindingRaisedPayloadSchema,
    valid: {
      findingId: "UX-FIND-001",
      component: "fleet-health-card",
      description: "low contrast",
      severity: "medium",
      raisedBy: "noa",
      raisedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      findingId: "UX-FIND-001",
      component: "fleet-health-card",
      description: "x",
      severity: "catastrophic",
      raisedBy: "noa",
      raisedAt: "2026-06-16T00:00:00Z",
    },
  },
  // --- sla-approval ---
  {
    name: "SlaRulePublished",
    v1: slaV1.slaRulePublishedPayloadSchema,
    v2: v2.slaRulePublishedPayloadSchema,
    valid: {
      representation: "IFRS",
      ruleId: "PR-FX-001-BA",
      version: 1,
      publisher: slaSeat,
      ruleContentHash: "hash1",
    },
    // version must be >= 1 — 0 rejected by both.
    invalid: {
      representation: "IFRS",
      ruleId: "PR-FX-001-BA",
      version: 0,
      publisher: slaSeat,
      ruleContentHash: "hash1",
    },
  },
  {
    name: "SlaRuleApproved",
    v1: slaV1.slaRuleApprovedPayloadSchema,
    v2: v2.slaRuleApprovedPayloadSchema,
    valid: {
      representation: "IFRS",
      ruleId: "PR-FX-001-BA",
      version: 1,
      approver: slaSeat,
      reviewedRuleHash: "hash1",
      reviewedPreviewHash: "phash1",
    },
    // missing reviewedPreviewHash → rejected by both.
    invalid: {
      representation: "IFRS",
      ruleId: "PR-FX-001-BA",
      version: 1,
      approver: slaSeat,
      reviewedRuleHash: "hash1",
    },
  },
  {
    name: "SlaRuleWithheld",
    v1: slaV1.slaRuleWithheldPayloadSchema,
    v2: v2.slaRuleWithheldPayloadSchema,
    valid: {
      representation: "IFRS",
      ruleId: "PR-FX-001-BA",
      version: 1,
      approver: slaSeat,
      reason: "preview mismatch",
    },
    invalid: {
      representation: "IFRS",
      ruleId: "PR-FX-001-BA",
      version: 1,
      approver: slaSeat,
      reason: "",
    },
  },
  // --- regulatory-pa ---
  {
    name: "PaNotificationSubmitted",
    v1: paV1.paNotificationSubmittedPayloadSchema,
    v2: v2.paNotificationSubmittedPayloadSchema,
    valid: {
      notificationId: "PA-NOTIF-2026-001",
      notificationType: "incident",
      notificationDate: "2026-06-16",
      regulatoryRef: "PA-LETTER-2026-04-17",
      recipientAuthority: "PA",
      submittedBy: "PARTY-MIRA",
      submittedAt: "2026-06-16T00:00:00Z",
    },
    // recipientAuthority not in enum → rejected by both.
    invalid: {
      notificationId: "PA-NOTIF-2026-001",
      notificationType: "incident",
      notificationDate: "2026-06-16",
      regulatoryRef: "PA-LETTER-2026-04-17",
      recipientAuthority: "SARB",
      submittedBy: "PARTY-MIRA",
      submittedAt: "2026-06-16T00:00:00Z",
    },
  },
  // --- seed-management ---
  {
    name: "SeedDescoped",
    v1: seedV1.seedDescopedPayloadSchema,
    v2: v2.seedDescopedPayloadSchema,
    valid: { seedId: "seed:fx-rates", reason: "no longer needed" },
    invalid: { seedId: "", reason: "x" },
  },
  {
    name: "SeedPromotedToSimulated",
    v1: seedV1.seedPromotedToSimulatedPayloadSchema,
    v2: v2.seedPromotedToSimulatedPayloadSchema,
    valid: { seedId: "seed:fx-rates", replacementEventIds: ["evt:1"] },
    // replacementEventIds must be an array of non-empty strings.
    invalid: { seedId: "seed:fx-rates", replacementEventIds: [""] },
  },
  // --- model-risk ---
  {
    name: "ModelSubmitted",
    v1: modelV1.modelSubmittedPayloadSchema,
    v2: v2.modelSubmittedPayloadSchema,
    valid: {
      modelId: "M-1",
      submittedBy: "helena",
      version: "1.0",
      tier: 1,
      methodologyHash: SHA,
      description: "VaR model",
    },
    // tier must be 1|2|3 → 4 rejected; methodologyHash must be 64-hex.
    invalid: {
      modelId: "M-1",
      submittedBy: "helena",
      version: "1.0",
      tier: 4,
      methodologyHash: SHA,
      description: "VaR model",
    },
  },
  {
    name: "ModelTierClassified",
    v1: modelV1.modelTierClassifiedPayloadSchema,
    v2: v2.modelTierClassifiedPayloadSchema,
    valid: { modelId: "M-1", classifiedBy: "helena", tier: 2, rationale: "material" },
    invalid: { modelId: "M-1", classifiedBy: "helena", tier: 0, rationale: "x" },
  },
  {
    name: "ModelValidationApproved",
    v1: modelV1.modelValidationApprovedPayloadSchema,
    v2: v2.modelValidationApprovedPayloadSchema,
    valid: {
      modelId: "M-1",
      version: "1.0",
      approvedBy: "helena",
      validationFindingsResolved: ["F-1"],
      expiryDate: "2027-06-16",
    },
    // validationFindingsResolved must be an array → string rejected by both.
    invalid: {
      modelId: "M-1",
      version: "1.0",
      approvedBy: "helena",
      validationFindingsResolved: "F-1",
      expiryDate: "2027-06-16",
    },
  },
  {
    name: "ModelValidationWithheld",
    v1: modelV1.modelValidationWithheldPayloadSchema,
    v2: v2.modelValidationWithheldPayloadSchema,
    valid: {
      modelId: "M-1",
      version: "1.0",
      withheldBy: "helena",
      reason: "incomplete",
      findings: ["F-1"],
    },
    invalid: {
      modelId: "M-1",
      version: "1.0",
      withheldBy: "helena",
      reason: "",
      findings: ["F-1"],
    },
  },
  {
    name: "ValidationFindingRaised",
    v1: modelV1.validationFindingRaisedPayloadSchema,
    v2: v2.validationFindingRaisedPayloadSchema,
    valid: {
      findingId: "F-1",
      modelId: "M-1",
      raisedBy: "vera",
      severity: "high",
      description: "data gap",
    },
    invalid: {
      findingId: "F-1",
      modelId: "M-1",
      raisedBy: "vera",
      severity: "critical",
      description: "x",
    },
  },
  {
    name: "ValidationFindingClosed",
    v1: modelV1.validationFindingClosedPayloadSchema,
    v2: v2.validationFindingClosedPayloadSchema,
    valid: {
      findingId: "F-1",
      closedBy: "vera",
      resolution: "remediated",
      closedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      findingId: "F-1",
      closedBy: "vera",
      resolution: "",
      closedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "BacktestRequested",
    v1: modelV1.backtestRequestedPayloadSchema,
    v2: v2.backtestRequestedPayloadSchema,
    valid: {
      modelId: "M-1",
      version: "1.0",
      windowStart: "2026-01-01",
      windowEnd: "2026-06-01",
      predictionGranularity: "daily",
      outcomeMetric: "kupiec",
      requestedBy: "vera",
      methodologyHash: SHA,
    },
    // outcomeMetric not in enum → rejected by both.
    invalid: {
      modelId: "M-1",
      version: "1.0",
      windowStart: "2026-01-01",
      windowEnd: "2026-06-01",
      predictionGranularity: "daily",
      outcomeMetric: "made-up",
      requestedBy: "vera",
      methodologyHash: SHA,
    },
  },
  {
    name: "BacktestRun",
    v1: modelV1.backtestRunPayloadSchema,
    v2: v2.backtestRunPayloadSchema,
    valid: {
      backtestRunId: "BR-1",
      modelId: "M-1",
      version: "1.0",
      windowStart: "2026-01-01",
      windowEnd: "2026-06-01",
      comparisonMetric: "kupiec",
      expectedExceptions: 2.5,
      observedExceptions: 3,
      severity: "amber",
      methodologyHash: SHA,
      predictionCount: 100,
      runDurationMs: 12,
      sourceRequestEventId: "evt:req",
    },
    // observedExceptions must be a non-negative integer → -1 rejected by both.
    invalid: {
      backtestRunId: "BR-1",
      modelId: "M-1",
      version: "1.0",
      windowStart: "2026-01-01",
      windowEnd: "2026-06-01",
      comparisonMetric: "kupiec",
      expectedExceptions: 2.5,
      observedExceptions: -1,
      severity: "amber",
      methodologyHash: SHA,
      predictionCount: 100,
      runDurationMs: 12,
      sourceRequestEventId: "evt:req",
    },
  },
  {
    name: "ValidationMethodologyPublished",
    v1: modelV1.validationMethodologyPublishedPayloadSchema,
    v2: v2.validationMethodologyPublishedPayloadSchema,
    valid: {
      methodologyId: "VM-1",
      tier: 1,
      version: "1.0",
      publishedBy: "helena",
      methodologyHash: SHA,
      effectiveFrom: "2026-06-16",
      summary: "tier-1 standard",
    },
    invalid: {
      methodologyId: "VM-1",
      tier: 5,
      version: "1.0",
      publishedBy: "helena",
      methodologyHash: SHA,
      effectiveFrom: "2026-06-16",
      summary: "x",
    },
  },
  {
    name: "BacktestBreachDisposed",
    v1: modelV1.backtestBreachDisposedPayloadSchema,
    v2: v2.backtestBreachDisposedPayloadSchema,
    valid: {
      backtestRunId: "BR-1",
      modelId: "M-1",
      version: "1.0",
      disposedBy: "helena",
      disposition: "tolerate",
      rationale: "within noise",
      linkedFindings: [],
    },
    invalid: {
      backtestRunId: "BR-1",
      modelId: "M-1",
      version: "1.0",
      disposedBy: "helena",
      disposition: "ignore",
      rationale: "x",
      linkedFindings: [],
    },
  },
  {
    name: "ModelDriftDetected",
    v1: modelV1.modelDriftDetectedPayloadSchema,
    v2: v2.modelDriftDetectedPayloadSchema,
    valid: {
      modelId: "M-1",
      version: "1.0",
      driftKind: "concept-drift",
      detectedBy: "vera",
      metricValue: 0.7,
      metricThreshold: 0.5,
      severity: "high",
      observedAt: "2026-06-16T00:00:00Z",
      description: "psi exceeded",
    },
    invalid: {
      modelId: "M-1",
      version: "1.0",
      driftKind: "made-up-drift",
      detectedBy: "vera",
      metricValue: 0.7,
      metricThreshold: 0.5,
      severity: "high",
      observedAt: "2026-06-16T00:00:00Z",
      description: "x",
    },
  },
  {
    name: "ProductionUseRequested",
    v1: modelV1.productionUseRequestedPayloadSchema,
    v2: v2.productionUseRequestedPayloadSchema,
    valid: {
      modelId: "M-1",
      version: "1.0",
      requestedBy: "rohan",
      envelopeDescription: "FX VaR daily",
      requestedFrom: "2026-07-01",
      rationale: "validated",
    },
    invalid: {
      modelId: "M-1",
      version: "1.0",
      requestedBy: "rohan",
      envelopeDescription: "",
      requestedFrom: "2026-07-01",
      rationale: "x",
    },
  },
  {
    name: "MethodologyChangeRequested",
    v1: modelV1.methodologyChangeRequestedPayloadSchema,
    v2: v2.methodologyChangeRequestedPayloadSchema,
    valid: {
      changeRequestId: "CR-1",
      methodologyId: "VM-1",
      tier: 2,
      fromVersion: "1.0",
      requestedBy: "helena",
      proposedChange: "switch to HS",
      rationale: "better tail",
    },
    invalid: {
      changeRequestId: "CR-1",
      methodologyId: "VM-1",
      tier: 9,
      fromVersion: "1.0",
      requestedBy: "helena",
      proposedChange: "x",
      rationale: "y",
    },
  },
  // --- regulatory-reporting (money-free rows) ---
  {
    name: "TradeReportSubmitted",
    v1: regRepV1.TradeReportSubmittedPayloadSchema,
    v2: v2.tradeReportSubmittedPayloadSchema,
    valid: {
      tradeId: "T-1",
      regulator: "SARB-FinSurv",
      reportCategory: "FinSurv-FX-AD",
      submittedAt: "2026-06-16T00:00:00Z",
      status: "pending",
      citations: ["EXCON-SARB-CIRC-3-2020"],
    },
    // regulator not in enum → rejected by both.
    invalid: {
      tradeId: "T-1",
      regulator: "FSCA",
      reportCategory: "FinSurv-FX-AD",
      submittedAt: "2026-06-16T00:00:00Z",
      status: "pending",
      citations: ["EXCON-SARB-CIRC-3-2020"],
    },
  },
  {
    name: "SarbSubmissionAttempted",
    v1: regRepV1.SarbSubmissionAttemptedPayloadSchema,
    v2: v2.sarbSubmissionAttemptedPayloadSchema,
    valid: {
      formId: "BA700",
      formVersion: "v0.1-rehearsal",
      institutionId: "HOZ-BANK",
      reportingPeriod: "period:hoz-bank:month:2026-05",
      submittedAt: "2026-06-16T00:00:00Z",
      accepted: true,
      mode: "simulator",
    },
    // mode not in enum → rejected by both.
    invalid: {
      formId: "BA700",
      formVersion: "v0.1-rehearsal",
      institutionId: "HOZ-BANK",
      reportingPeriod: "period:hoz-bank:month:2026-05",
      submittedAt: "2026-06-16T00:00:00Z",
      accepted: true,
      mode: "production",
    },
  },
];

describe("money-free batch-3 v2 schema parity (anti-drift)", () => {
  test("every re-declared batch-3 type has a parity case", () => {
    const covered = new Set(cases.map((c) => c.name));
    for (const type of MONEY_FREE_BATCH_3_REDECLARED_TYPES) {
      expect(covered.has(type)).toBe(true);
    }
    // No stray cases for un-migrated / non-re-declared types.
    expect(cases.length).toBe(MONEY_FREE_BATCH_3_REDECLARED_TYPES.length);
  });

  for (const c of cases) {
    test(`${c.name}: V1 accepts ⇒ v2 accepts`, () => {
      expect(c.v1.safeParse(c.valid).success).toBe(true);
      expect(c.v2.safeParse(c.valid).success).toBe(true);
    });
    test(`${c.name}: V1 rejects ⇒ v2 rejects`, () => {
      expect(c.v1.safeParse(c.invalid).success).toBe(false);
      expect(c.v2.safeParse(c.invalid).success).toBe(false);
    });
  }

  // Guard: CalculationPerformed is money-bearing (polymorphic value, unit may be
  // ZAR-minor) and is DEFERRED — it must NOT be in the re-declared set.
  test("CalculationPerformed is NOT in the batch-3 re-declared set (money-bearing deferral)", () => {
    expect(
      (MONEY_FREE_BATCH_3_REDECLARED_TYPES as readonly string[]).includes("CalculationPerformed"),
    ).toBe(false);
    // The V1 schema still exists (we just don't migrate it this batch).
    expect(typeof calcV1.calculationPerformedPayloadSchema.safeParse).toBe("function");
  });
});
