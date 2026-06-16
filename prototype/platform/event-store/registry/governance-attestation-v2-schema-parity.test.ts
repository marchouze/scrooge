// platform/event-store/registry/governance-attestation-v2-schema-parity.test.ts
//
// Schema-parity guard for Wave 2 batch-2 governance-attestation migration.
//
// The v2-core package re-declares the seven migrated domains' payload schemas
// (`v2-core/governance-attestation/events.ts`) because it cannot import the V1
// schemas across the no-v1-import boundary. This test is the anti-drift backstop
// (Charter cmd 3: no green by concealment / weakened assertions): for each
// migrated type, a canonical sample that the AUTHORITATIVE V1 schema accepts MUST
// also be accepted by the v2 schema, and a payload the V1 schema REJECTS MUST
// also be rejected by the v2 schema. A drift that weakens the v2 copy (accepting
// something V1 rejects, or vice-versa) fails here.
//
// This test lives on the v1 side because only v1-side code may import BOTH the V1
// schemas (under platform/) and the v2 schemas (under v2-core/) — the
// no-v1-import boundary forbids the reverse, not this direction.
//
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC.
// Brief: brief:atlas:wave-2-4-batch-2-money-free-risk-governance-atte:2026-06-16.
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import * as v2 from "../../../v2-core/governance-attestation/events";
import * as caeV1 from "../event-types/cae-governance";
import * as cisoV1 from "../event-types/ciso-governance";
import * as ddV1 from "../event-types/decision-distillation";
import * as gsrV1 from "../event-types/governance-seat-runs";
import * as kycV1 from "../event-types/kyc";
import * as olV1 from "../event-types/obligation-lifecycle";
import * as paV1 from "../event-types/policy-activation";

const BLAKE3 = `blake3:${"a".repeat(64)}`;

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

const cases: Case[] = [
  // --- kyc ---
  {
    name: "KYCIdentityCollected",
    v1: kycV1.kycIdentityCollectedPayloadSchema,
    v2: v2.kycIdentityCollectedPayloadSchema,
    valid: {
      candidateId: "CAND-1",
      documents: [{ type: "passport", hash: "h1" }],
      collectedAt: "2026-06-16T00:00:00Z",
    },
    invalid: { candidateId: "CAND-1", documents: [], collectedAt: "2026-06-16T00:00:00Z" },
  },
  {
    name: "KYCIdentityVerified",
    v1: kycV1.kycIdentityVerifiedPayloadSchema,
    v2: v2.kycIdentityVerifiedPayloadSchema,
    valid: {
      candidateId: "CAND-1",
      adapter: "dha",
      result: "matched",
      verifiedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      candidateId: "CAND-1",
      adapter: "unknown",
      result: "matched",
      verifiedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "KYCIdentityVerificationFailed",
    v1: kycV1.kycIdentityVerificationFailedPayloadSchema,
    v2: v2.kycIdentityVerificationFailedPayloadSchema,
    valid: {
      candidateId: "CAND-1",
      adapter: "cipc",
      reason: "not-found",
      failedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      candidateId: "CAND-1",
      adapter: "cipc",
      reason: "no-such-reason",
      failedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "KYCSanctionsPEPScreened",
    v1: kycV1.kycSanctionsPEPScreenedPayloadSchema,
    v2: v2.kycSanctionsPEPScreenedPayloadSchema,
    valid: {
      candidateId: "CAND-1",
      lists_checked: ["un", "ofac"],
      result: "clean",
      pep_flag: false,
      pep_linked: false,
      screenedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      candidateId: "CAND-1",
      lists_checked: [],
      result: "clean",
      pep_flag: false,
      pep_linked: false,
      screenedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "KYCUBOResolved",
    v1: kycV1.kycUBOResolvedPayloadSchema,
    v2: v2.kycUBOResolvedPayloadSchema,
    valid: {
      candidateId: "CAND-1",
      ubo_chain: [
        {
          name: "Jane",
          id_number: "ID1",
          nationality: "ZA",
          residence_country: "ZA",
          ownership_pct: 30,
          basis_of_control: "shares",
          dha_verified: true,
          pep_flag: false,
        },
      ],
      ubo_opaque_structure: false,
      resolvedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      candidateId: "CAND-1",
      ubo_chain: [],
      ubo_opaque_structure: false,
      resolvedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "KYCRiskRated",
    v1: kycV1.kycRiskRatedPayloadSchema,
    v2: v2.kycRiskRatedPayloadSchema,
    valid: {
      candidateId: "CAND-1",
      score: 42,
      band: "medium",
      factors: [{ factor_name: "geo", weight: 0.5, value: 40 }],
      ratedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      candidateId: "CAND-1",
      score: 200,
      band: "medium",
      factors: [{ factor_name: "geo", weight: 0.5, value: 40 }],
      ratedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "KYCEDDInitiated",
    v1: kycV1.kycEDDInitiatedPayloadSchema,
    v2: v2.kycEDDInitiatedPayloadSchema,
    valid: {
      candidateId: "CAND-1",
      reason: "pep",
      initiatedBy: "zara",
      initiatedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      candidateId: "CAND-1",
      reason: "nope",
      initiatedBy: "zara",
      initiatedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "KYCEDDCompleted",
    v1: kycV1.kycEDDCompletedPayloadSchema,
    v2: v2.kycEDDCompletedPayloadSchema,
    valid: {
      candidateId: "CAND-1",
      mlro_sign_off_event_id: "EV-1",
      outcome: "proceed",
      completedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      candidateId: "CAND-1",
      mlro_sign_off_event_id: "",
      outcome: "proceed",
      completedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "KYCDecisionMade",
    v1: kycV1.kycDecisionMadePayloadSchema,
    v2: v2.kycDecisionMadePayloadSchema,
    valid: {
      candidateId: "CAND-1",
      decision: "accept",
      reason: "clean",
      decided_by: "zara",
      decidedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      candidateId: "CAND-1",
      decision: "maybe",
      reason: "clean",
      decided_by: "zara",
      decidedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "ClientAccepted",
    v1: kycV1.clientAcceptedPayloadSchema,
    v2: v2.clientAcceptedPayloadSchema,
    valid: { candidateId: "CAND-1", clientId: "CL-1", acceptedAt: "2026-06-16T00:00:00Z" },
    invalid: { clientId: "CL-1" },
  },
  {
    name: "ClientRejected",
    v1: kycV1.clientRejectedPayloadSchema,
    v2: v2.clientRejectedPayloadSchema,
    valid: { candidateId: "CAND-1", reason: "sanctions", rejectedAt: "2026-06-16T00:00:00Z" },
    invalid: { candidateId: "CAND-1", reason: "", rejectedAt: "2026-06-16T00:00:00Z" },
  },
  {
    name: "LawfulProcessingRegistered",
    v1: kycV1.lawfulProcessingRegisteredPayloadSchema,
    v2: v2.lawfulProcessingRegisteredPayloadSchema,
    valid: {
      clientId: "CL-1",
      lawful_basis: "contract",
      processing_purposes: ["kyc"],
      registeredAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      clientId: "CL-1",
      lawful_basis: "vibes",
      processing_purposes: ["kyc"],
      registeredAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "KYCRefreshScheduled",
    v1: kycV1.kycRefreshScheduledPayloadSchema,
    v2: v2.kycRefreshScheduledPayloadSchema,
    valid: {
      clientId: "CL-1",
      cadence: "annual",
      triggerReason: "calendar",
      scheduledFor: "2027-06-16",
      scheduledAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      clientId: "CL-1",
      cadence: "monthly",
      triggerReason: "calendar",
      scheduledFor: "2027-06-16",
      scheduledAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "KYCRefreshCompleted",
    v1: kycV1.kycRefreshCompletedPayloadSchema,
    v2: v2.kycRefreshCompletedPayloadSchema,
    valid: {
      clientId: "CL-1",
      refreshId: "RF-1",
      nextDueDate: "2027-06-16",
      completedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      clientId: "CL-1",
      refreshId: "",
      nextDueDate: "2027-06-16",
      completedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "KYCRatingRevised",
    v1: kycV1.kycRatingRevisedPayloadSchema,
    v2: v2.kycRatingRevisedPayloadSchema,
    valid: {
      clientId: "CL-1",
      refreshId: "RF-1",
      oldBand: "high",
      newBand: "low",
      revisedAt: "2026-06-16T00:00:00Z",
    },
    // upgrade low→high WITHOUT mlro sign-off must be rejected by both (refine).
    invalid: {
      clientId: "CL-1",
      refreshId: "RF-1",
      oldBand: "low",
      newBand: "high",
      revisedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "CounterpartyCategorised",
    v1: kycV1.counterpartyCategorisedPayloadSchema,
    v2: v2.counterpartyCategorisedPayloadSchema,
    valid: {
      partyId: "P-1",
      category: "EC",
      basis: "size",
      validUntil: "2027-06-16",
      categorisedBy: "mira",
      categorisedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      partyId: "P-1",
      category: "ZZ",
      basis: "size",
      validUntil: "2027-06-16",
      categorisedBy: "mira",
      categorisedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "CounterpartyDeclined",
    v1: kycV1.counterpartyDeclinedPayloadSchema,
    v2: v2.counterpartyDeclinedPayloadSchema,
    valid: {
      partyId: "P-1",
      reason: "eligibility-failed",
      declinedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      partyId: "P-1",
      reason: "because",
      declinedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "OdpCounterpartyCategorised",
    v1: kycV1.odpCounterpartyCategorisedPayloadSchema,
    v2: v2.odpCounterpartyCategorisedPayloadSchema,
    valid: {
      partyId: "P-1",
      category: "client",
      reason: "CS 2/2018 s4",
      electedUpCategorisation: false,
      asOf: "2026-06-16T00:00:00Z",
    },
    invalid: {
      partyId: "P-1",
      category: "neither",
      reason: "CS 2/2018 s4",
      electedUpCategorisation: false,
      asOf: "2026-06-16T00:00:00Z",
    },
  },

  // --- cae-governance ---
  {
    name: "AuditPlanUpdated",
    v1: caeV1.auditPlanUpdatedPayloadSchema,
    v2: v2.auditPlanUpdatedPayloadSchema,
    valid: {
      runId: "R-1",
      period: "2026-Q2",
      auditsScheduled: 5,
      auditsCompleted: 2,
      highRiskAreasCovered: 3,
      planVersion: "AUP-2026-Q2",
      updatedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      runId: "R-1",
      period: "2026-Q5",
      auditsScheduled: 5,
      auditsCompleted: 2,
      highRiskAreasCovered: 3,
      planVersion: "AUP-2026-Q2",
      updatedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "AuditIssueTrackerReviewed",
    v1: caeV1.auditIssueTrackerReviewedPayloadSchema,
    v2: v2.auditIssueTrackerReviewedPayloadSchema,
    valid: {
      runId: "R-1",
      period: "2026-Q2",
      openFindings: 4,
      overdueFindings: 1,
      criticalFindings: 0,
      findingsClosedThisQuarter: 3,
      reviewedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      runId: "R-1",
      period: "2026-Q2",
      openFindings: -1,
      overdueFindings: 1,
      criticalFindings: 0,
      findingsClosedThisQuarter: 3,
      reviewedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "QaipAttestationFiled",
    v1: caeV1.qaipAttestationFiledPayloadSchema,
    v2: v2.qaipAttestationFiledPayloadSchema,
    valid: {
      runId: "R-1",
      period: "2026-Q2",
      internalAssessmentCompleted: true,
      externalAssessmentDue: "2028-01-01",
      conformanceRating: "generally-conforms",
      attestedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      runId: "R-1",
      period: "2026-Q2",
      internalAssessmentCompleted: true,
      externalAssessmentDue: "2028-01-01",
      conformanceRating: "mostly-ok",
      attestedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "ThirdLineOpinionFiled",
    v1: caeV1.thirdLineOpinionFiledPayloadSchema,
    v2: v2.thirdLineOpinionFiledPayloadSchema,
    valid: {
      runId: "R-1",
      period: "2026-Q2",
      opinionScope: "all controls",
      overallAssurance: "reasonable",
      keyFindings: ["ok"],
      filedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      runId: "R-1",
      period: "2026-Q2",
      opinionScope: "all controls",
      overallAssurance: "reasonable",
      keyFindings: [],
      filedAt: "2026-06-16T00:00:00Z",
    },
  },

  // --- ciso-governance ---
  {
    name: "CisoJs2AttestationFiled",
    v1: cisoV1.cisoJs2AttestationFiledPayloadSchema,
    v2: v2.cisoJs2AttestationFiledPayloadSchema,
    valid: {
      runId: "R-1",
      period: "2026-Q2",
      attestedBy: "Senna",
      js2Version: "JS2-2024",
      controlsAssessed: 10,
      findingsOpen: 1,
      findingsResolved: 9,
      overallRating: "green",
      attestedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      runId: "R-1",
      period: "2026-Q2",
      attestedBy: "SomeoneElse",
      js2Version: "JS2-2024",
      controlsAssessed: 10,
      findingsOpen: 1,
      findingsResolved: 9,
      overallRating: "green",
      attestedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "SbomReviewCompleted",
    v1: cisoV1.sbomReviewCompletedPayloadSchema,
    v2: v2.sbomReviewCompletedPayloadSchema,
    valid: {
      runId: "R-1",
      period: "2026-Q2",
      componentsScanned: 100,
      vulnerabilitiesFound: 3,
      criticalCount: 0,
      highCount: 1,
      remediationDeadline: "2026-07-01",
      reviewedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      runId: "R-1",
      period: "2026-Q2",
      componentsScanned: 100,
      vulnerabilitiesFound: 3,
      criticalCount: -1,
      highCount: 1,
      remediationDeadline: "2026-07-01",
      reviewedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "ThreatModelGateCompleted",
    v1: cisoV1.threatModelGateCompletedPayloadSchema,
    v2: v2.threatModelGateCompletedPayloadSchema,
    valid: {
      runId: "R-1",
      period: "2026-Q2",
      systemsReviewed: 5,
      threatsIdentified: 12,
      controlsAdequate: true,
      gateStatus: "passed",
      completedAt: "2026-06-16T00:00:00Z",
    },
    invalid: {
      runId: "R-1",
      period: "2026-Q2",
      systemsReviewed: 5,
      threatsIdentified: 12,
      controlsAdequate: true,
      gateStatus: "maybe",
      completedAt: "2026-06-16T00:00:00Z",
    },
  },
  {
    name: "KeyCeremonyAttested",
    v1: cisoV1.keyCeremonyAttestedPayloadSchema,
    v2: v2.keyCeremonyAttestedPayloadSchema,
    valid: {
      runId: "R-1",
      period: "2026-Q2",
      ceremonyType: "quarterly-rotation",
      participantCount: 3,
      witnessedBy: "auditor",
      keyMaterialIntact: true,
      completedAt: "2026-06-16T00:00:00Z",
    },
    // participantCount must be POSITIVE — 0 is rejected by both.
    invalid: {
      runId: "R-1",
      period: "2026-Q2",
      ceremonyType: "quarterly-rotation",
      participantCount: 0,
      witnessedBy: "auditor",
      keyMaterialIntact: true,
      completedAt: "2026-06-16T00:00:00Z",
    },
  },

  // --- governance-seat-runs ---
  {
    name: "GovernanceSeatRunCompleted",
    v1: gsrV1.GovernanceSeatRunCompletedPayloadSchema,
    v2: v2.governanceSeatRunCompletedPayloadSchema,
    valid: {
      seatId: "cco",
      agentId: "zara",
      runType: "quarterly",
      period: "2026-Q2",
      eventsEmitted: 4,
      findings: [],
      status: "completed",
    },
    invalid: {
      seatId: "cco",
      agentId: "zara",
      runType: "quarterly",
      period: "2026-Q9",
      eventsEmitted: 4,
      findings: [],
      status: "completed",
    },
  },
  {
    name: "GovernanceAttestationFiled",
    v1: gsrV1.GovernanceAttestationFiledPayloadSchema,
    v2: v2.governanceAttestationFiledPayloadSchema,
    valid: {
      seatId: "cco",
      attestorId: "zara",
      attestationType: "rmcp-quarterly",
      period: "2026-Q2",
      attestedAt: "2026-06-16T00:00:00Z",
      findings: [],
      policyRef: "RMCP-4",
    },
    invalid: {
      seatId: "cco",
      attestorId: "zara",
      attestationType: "rmcp-quarterly",
      period: "2026-Q2",
      attestedAt: "2026-06-16T00:00:00Z",
      findings: [],
      policyRef: "",
    },
  },
  {
    name: "SuspiciousActivityQueueReviewed",
    v1: gsrV1.SuspiciousActivityQueueReviewedPayloadSchema,
    v2: v2.suspiciousActivityQueueReviewedPayloadSchema,
    valid: {
      reviewedAt: "2026-06-16T00:00:00Z",
      queueDepth: 2,
      strFiled: 1,
      ctrFiled: 0,
      notes: "ok",
    },
    invalid: {
      reviewedAt: "2026-06-16T00:00:00Z",
      queueDepth: -2,
      strFiled: 1,
      ctrFiled: 0,
      notes: "ok",
    },
  },
  {
    name: "AmlRiskAssessmentCompleted",
    v1: gsrV1.AmlRiskAssessmentCompletedPayloadSchema,
    v2: v2.amlRiskAssessmentCompletedPayloadSchema,
    valid: {
      assessmentType: "institutional-quarterly",
      period: "2026-Q2",
      riskRating: "medium",
      keyFindings: "none",
      policyRef: "POL-AML-001",
    },
    invalid: {
      assessmentType: "",
      period: "2026-Q2",
      riskRating: "medium",
      keyFindings: "none",
      policyRef: "POL-AML-001",
    },
  },
  {
    name: "EddQueueReviewed",
    v1: gsrV1.EddQueueReviewedPayloadSchema,
    v2: v2.eddQueueReviewedPayloadSchema,
    valid: {
      reviewedAt: "2026-06-16T00:00:00Z",
      queueDepth: 1,
      signed: true,
      notes: "no action",
    },
    invalid: {
      reviewedAt: "2026-06-16T00:00:00Z",
      queueDepth: 1,
      signed: "yes",
      notes: "no action",
    },
  },

  // --- obligation-lifecycle ---
  {
    name: "ObligationAdopted",
    v1: olV1.obligationAdoptedPayloadSchema,
    v2: v2.obligationAdoptedPayloadSchema,
    valid: {
      obligationId: "ORG-PR-06",
      urn: "",
      domain: "PR",
      citation: "Banks Act s.60",
      requirement: "maintain register",
      fulfilmentPolicy: "POL-1",
      owner: "mira",
      status: "active",
      adoptedAt: "2026-06-16",
    },
    invalid: {
      obligationId: "",
      urn: "",
      domain: "PR",
      citation: "Banks Act s.60",
      requirement: "maintain register",
      fulfilmentPolicy: "POL-1",
      owner: "mira",
      status: "active",
      adoptedAt: "2026-06-16",
    },
  },
  {
    name: "ObligationLifecycleTransitioned",
    v1: olV1.obligationLifecycleTransitionedPayloadSchema,
    v2: v2.obligationLifecycleTransitionedPayloadSchema,
    valid: {
      obligationId: "ORG-PR-06",
      transition: "attested",
      at: "2026-06-16",
    },
    invalid: {
      obligationId: "ORG-PR-06",
      transition: "vibing",
      at: "2026-06-16",
    },
  },
  {
    name: "ProvisionScopeAdopted",
    v1: olV1.provisionScopeAdoptedPayloadSchema,
    v2: v2.provisionScopeAdoptedPayloadSchema,
    valid: {
      instrumentSlug: "banks-act",
      scopeId: "s60",
      adopted: true,
      adoptedBy: "mira",
      adoptedAt: "2026-06-16",
      verbatimHash: "abc123",
    },
    invalid: {
      instrumentSlug: "",
      scopeId: "s60",
      adopted: true,
      adoptedBy: "mira",
      adoptedAt: "2026-06-16",
      verbatimHash: "abc123",
    },
  },

  // --- policy-activation ---
  {
    name: "PolicyVersionActivated",
    v1: paV1.policyVersionActivatedPayloadSchema,
    v2: v2.policyVersionActivatedPayloadSchema,
    valid: {
      policyDomain: "valuation",
      policyId: "VALUATION-POLICY-V1",
      version: "1.0",
      effectiveFrom: "2026-05-19",
      documentHash: BLAKE3,
      supersedes: null,
      activatedBy: "agent:helena:cro",
    },
    invalid: {
      policyDomain: "valuation",
      policyId: "VALUATION-POLICY-V1",
      version: "1.0",
      effectiveFrom: "2026-05-19",
      documentHash: "not-blake3",
      supersedes: null,
      activatedBy: "agent:helena:cro",
    },
  },

  // --- decision-distillation ---
  {
    name: "DecisionDistilled",
    v1: ddV1.decisionDistilledPayloadSchema,
    v2: v2.decisionDistilledPayloadSchema,
    valid: {
      decisionId: "D-RMS-PHASE-1",
      class: "foundational",
      rationale: "defines the backbone",
      citations: ["D-RMS-PHASE-1"],
      distilledBy: "company-secretary",
      workstream: "WS-V2-BBAAS-W1",
    },
    invalid: {
      decisionId: "not-a-decision-id",
      class: "foundational",
      rationale: "defines the backbone",
      citations: ["D-RMS-PHASE-1"],
      distilledBy: "company-secretary",
      workstream: "WS-V2-BBAAS-W1",
    },
  },
];

describe("governance-attestation v2 schema parity (anti-drift)", () => {
  test("all 36 migrated types are covered", () => {
    const covered = new Set(cases.map((c) => c.name));
    for (const type of v2.GOVERNANCE_ATTESTATION_BATCH_2_TYPES) {
      expect(covered.has(type)).toBe(true);
    }
    expect(cases.length).toBe(v2.GOVERNANCE_ATTESTATION_BATCH_2_TYPES.length);
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
