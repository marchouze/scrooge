// platform/recon/handler-schema-parity.test.ts
//
// Regression guard: schema ↔ handler payload parity for the 12 handlers
// whose Zod schemas were mis-aligned with actual emission shapes after
// feat(f032) wired idealised schemas to the registry.
//
// Each test reproduces the exact payload shape the handler appends to the
// event store (as seen in each handler's `eventStore.append({...})` call)
// and parses it through the schema. A Zod parse error means the schema has
// drifted from the handler again.
//
// Ground truth: the handler file is canonical; the schema describes the
// handler; never the other way around.
//
// Authority: brief:atlas:handler-schema-repair-fix-validatepayload-mismat:2026-05-29
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import {
  almReadinessSnapshotPayloadSchema,
  cyberResilienceSnapshotPayloadSchema,
  legalReadinessSnapshotPayloadSchema,
  marketsReadinessSnapshotPayloadSchema,
  operationalResilienceSnapshotPayloadSchema,
  paymentsReadinessSnapshotPayloadSchema,
  taxReadinessSnapshotPayloadSchema,
} from "../event-store/event-types/risk-treasury-extended";
import {
  riskRunCompletedPayloadSchema,
  roleResearchQueueSnapshotPayloadSchema,
} from "../event-store/event-types/agent-substrate-extended";
import { auditCommitteePackPreppedPayloadSchema } from "../event-store/event-types/governance-extended";
import { popiaControlsSnapshotPayloadSchema } from "../event-store/event-types/aml-popia-extended";
import { financialPositionSnapshotPayloadSchema } from "../event-store/event-types/ifrs-accounting-extended";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsesOk(schema: { parse: (v: unknown) => unknown }, payload: unknown): boolean {
  try {
    schema.parse(payload);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 1. pax:role-research-queue → RoleResearchQueueSnapshot
// ---------------------------------------------------------------------------

describe("handler-schema-parity: pax:role-research-queue", () => {
  it("accepts the exact payload shape emitted by pax-role-research-queue.ts", () => {
    // Reproduced from handler lines 551–567.
    const payload = {
      draftPersonaCount: 2,
      draftPersonas: [
        { name: "Env", latestVersion: "v0.1" },
        { name: "Noa", latestVersion: "v0.2" },
      ],
      substrateGapHireCount: 1,
      substrateGapHires: [{ persona: "Rohan" }],
      pendingHireBriefCount: 1,
      pendingHireBriefs: [
        {
          file: "2026-05-10_pax_role-brief_human-cro.md",
          decisionId: "D-HIRE-HUMAN-CRO",
          date: "2026-05-10",
        },
      ],
      runTrigger: "role-research-queue",
    };
    expect(parsesOk(roleResearchQueueSnapshotPayloadSchema, payload)).toBe(true);
  });

  it("accepts handler payload with null decisionId and date (from real handler null-coercion)", () => {
    const payload = {
      draftPersonaCount: 0,
      draftPersonas: [],
      substrateGapHireCount: 0,
      substrateGapHires: [],
      pendingHireBriefCount: 1,
      pendingHireBriefs: [
        {
          file: "2026-05-10_pax_role-brief.md",
          decisionId: null,
          date: null,
        },
      ],
      runTrigger: "role-research-queue",
    };
    expect(parsesOk(roleResearchQueueSnapshotPayloadSchema, payload)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. rohan:risk-run → RiskRunCompleted
// ---------------------------------------------------------------------------

describe("handler-schema-parity: rohan:risk-run", () => {
  it("accepts the exact payload shape emitted by rohan-risk-run.ts", () => {
    // Reproduced from handler lines 564–577.
    const payload = {
      appetiteLineCount: 13,
      readinessReady: 0,
      readinessDrafting: 3,
      readinessSpecified: 7,
      readinessUnspecified: 3,
      positionEventsLast7d: 0,
      riskRaisedEventsLast7d: 0,
      latestHelenaRun: null,
      runTrigger: "risk-run",
    };
    expect(parsesOk(riskRunCompletedPayloadSchema, payload)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. ravi:alm-readiness → ALMReadinessSnapshot
// ---------------------------------------------------------------------------

describe("handler-schema-parity: ravi:alm-readiness", () => {
  it("accepts the exact payload shape emitted by ravi-alm-readiness.ts", () => {
    // Reproduced from handler lines 552–572.
    const payload = {
      pipelineCount: 7,
      readinessReady: 0,
      readinessDrafting: 1,
      readinessSpecified: 5,
      readinessUnspecified: 1,
      raviObligationsCount: 6,
      raviObligationsPartial: 2,
      hqlaObservedLast7d: 0,
      lcrComputedLast7d: 0,
      nsfrComputedLast7d: 0,
      irrbbCheckedLast7d: 0,
      fxPositionReportedLast7d: 0,
      collateralUpdatedLast7d: 0,
      fundingDrawnDownLast7d: 0,
      priorRaviSnapshotsLast7d: 0,
      latestEitanRun: null,
      runTrigger: "alm-readiness",
    };
    expect(parsesOk(almReadinessSnapshotPayloadSchema, payload)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. tomas:payments-readiness → PaymentsReadinessSnapshot
// ---------------------------------------------------------------------------

describe("handler-schema-parity: tomas:payments-readiness", () => {
  it("accepts the exact payload shape emitted by tomas-payments-readiness.ts", () => {
    // Reproduced from handler lines 542–560 (uses ...snap.events spread).
    const payload = {
      capabilityCount: 6,
      readinessReady: 0,
      readinessDrafting: 2,
      readinessSpecified: 3,
      readinessUnspecified: 1,
      obligationCount: 8,
      obligationsInForce: 1,
      obligationsDrafting: 2,
      obligationsPlanned: 4,
      obligationsNAyet: 1,
      // snap.events spread
      paymentInitiatedLast7d: 0,
      paymentSettledLast7d: 0,
      reconciliationCompletedLast7d: 0,
      cutoffMissedLast7d: 0,
      samosWindowEnteredLast7d: 0,
      swiftMessageProcessedLast7d: 0,
      latestDevonSnapshot: null,
      runTrigger: "payments-readiness",
    };
    expect(parsesOk(paymentsReadinessSnapshotPayloadSchema, payload)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. imani:legal-readiness → LegalReadinessSnapshot
// ---------------------------------------------------------------------------

describe("handler-schema-parity: imani:legal-readiness", () => {
  it("accepts the exact payload shape emitted by imani-legal-readiness.ts", () => {
    // Reproduced from handler lines 421–438.
    const payload = {
      imaniOwnedObligations: 12,
      obligationsInForce: 2,
      obligationsInFlight: 1,
      obligationsPartial: 3,
      obligationsPlanned: 5,
      obligationsDrafting: 1,
      masterAgreementsSignedLast7d: 0,
      clauseLibraryVersionsPublishedLast7d: 0,
      legalEntitiesRegisteredLast7d: 0,
      ectaExecutionsRecordedLast7d: 0,
      priorReadinessSnapshotsLast30d: 0,
      clauseLibraryVersionPublished: false,
      clauseLibraryClauseCount: 0,
      legalEntityTreeCount: 1,
      ectaExecutionPathReady: false,
      counterpartyOnboardingReady: false,
      runTrigger: "legal-readiness",
    };
    expect(parsesOk(legalReadinessSnapshotPayloadSchema, payload)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. devon:operational-resilience-snapshot → OperationalResilienceSnapshot
// ---------------------------------------------------------------------------

describe("handler-schema-parity: devon:operational-resilience-snapshot", () => {
  it("accepts the exact payload shape emitted by devon-operational-resilience-snapshot.ts", () => {
    // Reproduced from handler lines 394–402 (uses ...snap.events, ...snap.upstream spreads).
    const payload = {
      benchSeats: 12,
      benchHandlersTotal: 48,
      benchSeatsWithoutHandler: 0,
      // snap.events spread (ResilienceEventCounts)
      incidentsLast7d: 0,
      sloBurnsLast7d: 0,
      capacityBreachesLast7d: 0,
      changesApprovedLast7d: 0,
      resilienceTestsLast7d: 0,
      auditFindingsOpsLast7d: 0,
      // snap.upstream spread (UpstreamSnapshotCounts)
      atlasSubstrateLast7d: 1,
      anyaProjectionDriftLast7d: 5,
      sennaSecurityLast7d: 1,
      substrateExceptionsCount: 2,
      runTrigger: "operational-resilience-snapshot",
    };
    expect(parsesOk(operationalResilienceSnapshotPayloadSchema, payload)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. rashida:cyber-resilience-snapshot → CyberResilienceSnapshot
// ---------------------------------------------------------------------------

describe("handler-schema-parity: rashida:cyber-resilience-snapshot", () => {
  it("accepts the exact payload shape emitted by rashida-cyber-resilience-snapshot.ts", () => {
    // Reproduced from handler lines 325–338.
    const payload = {
      cyberObligationsCount: 18,
      jointStandardObligationsCount: 12,
      popiaSecurityObligationsCount: 6,
      sennaSubstrateLast7d: 1,
      incidentsLast7d: 0,
      threatModelGateDecisionsLast7d: 0,
      keyRotationsLast7d: 0,
      sbomAcceptedLast7d: 0,
      sbomRejectedLast7d: 0,
      vendorSecurityReviewsLast7d: 0,
      popiaCompromiseSuspectedLast7d: 0,
      runTrigger: "cyber-resilience-snapshot",
    };
    expect(parsesOk(cyberResilienceSnapshotPayloadSchema, payload)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. iris:popia-controls-snapshot → POPIAControlsSnapshot
// ---------------------------------------------------------------------------

describe("handler-schema-parity: iris:popia-controls-snapshot", () => {
  it("accepts the exact payload shape emitted by iris-popia-controls-snapshot.ts", () => {
    // Reproduced from handler lines 291–304.
    const payload = {
      popiaObligationsCount: 24,
      popiaObligationsPartial: 4,
      dsarReceivedLast7d: 0,
      dsarClosedLast7d: 0,
      consentWithdrawnLast7d: 0,
      processingPurposeApprovedLast7d: 0,
      processingPurposeRejectedLast7d: 0,
      crossBorderTransferApprovedLast7d: 0,
      breachNotificationDispatchedLast7d: 0,
      popiaCompromiseSuspectedLast7d: 0,
      informationRegulatorInquiryLast7d: 0,
      priorSnapshotsLast30d: 3,
      runTrigger: "popia-controls-snapshot",
    };
    expect(parsesOk(popiaControlsSnapshotPayloadSchema, payload)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. thandiwe:audit-committee-prep → AuditCommitteePackPrepped
// ---------------------------------------------------------------------------

describe("handler-schema-parity: thandiwe:audit-committee-prep", () => {
  it("accepts the exact payload shape emitted by thandiwe-audit-committee-prep.ts", () => {
    // Reproduced from handler lines 290–301.
    const payload = {
      findingsLast7d: 0,
      highSeverityFindingsLast7d: 0,
      reconResultsLast7d: 150,
      reconViolationsLast7d: 0,
      governancePrepLast7d: 1,
      priorPacksLast30d: 3,
      whistleblowingLast7d: 0,
      externalAuditorInquiryLast7d: 0,
      thirdLineRelevantObligations: 12,
      runTrigger: "audit-committee-prep",
    };
    expect(parsesOk(auditCommitteePackPreppedPayloadSchema, payload)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. yael:tax-readiness → TaxReadinessSnapshot
// ---------------------------------------------------------------------------

describe("handler-schema-parity: yael:tax-readiness", () => {
  it("accepts the exact payload shape emitted by yael-tax-readiness.ts", () => {
    // Reproduced from handler lines 546–563 (uses ...snap.events spread).
    const payload = {
      yaelOwnedObligations: 10,
      obligationsInForce: 2,
      obligationsPartial: 1,
      obligationsPlanned: 5,
      obligationsDrafting: 1,
      obligationsNAyet: 1,
      // snap.events spread (TaxDomainEvents)
      taxSubmissionsApprovedLast7d: 0,
      vatFilingsApprovedLast7d: 0,
      fatcaReportingsPublishedLast7d: 0,
      crsReportingsPublishedLast7d: 0,
      transferPricingFilingsApprovedLast7d: 0,
      sttRemittedLast7d: 0,
      sarsGuidanceScannedLast7d: 0,
      taxClassificationsPublishedLast7d: 0,
      fatcaClassificationsAssignedLast7d: 0,
      crsClassificationsAssignedLast7d: 0,
      taxReturnsDraftedLast7d: 0,
      cycleCount: 5,
      cyclesReady: 0,
      cyclesDrafting: 1,
      cyclesSpecified: 3,
      cyclesNotYetSpecified: 1,
      camilleSnapshotAsOf: null,
      camilleLastCloseApproved: null,
      camilleLastBaReturnSigned: null,
      runTrigger: "tax-readiness",
    };
    expect(parsesOk(taxReadinessSnapshotPayloadSchema, payload)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 11. saskia:markets-readiness-snapshot → MarketsReadinessSnapshot
// ---------------------------------------------------------------------------

describe("handler-schema-parity: saskia:markets-readiness-snapshot", () => {
  it("accepts the exact payload shape emitted by saskia-markets-readiness-snapshot.ts", () => {
    // Reproduced from handler lines 511–528 (uses ...snap.events spread).
    const payload = {
      saskiaOwnedObligations: 32,
      obligationsInForce: 5,
      obligationsInFlight: 3,
      obligationsPartial: 8,
      obligationsPlanned: 10,
      obligationsDrafting: 4,
      obligationsPreLicence: 2,
      obligationsNAyet: 0,
      kaiHandlerCount: 5,
      // snap.events (markets event counts) — zero in build phase
      tradeBookedLast7d: 0,
      positionAdjustedLast7d: 0,
      productApprovedLast7d: 0,
      npaGatePassedLast7d: 0,
      // m1 substrate flags
      m1SchemaFoundationDecisionPresent: true,
      m1FranchiseDesignProposalPresent: false,
      m1KaiCdmBindingsDeliverablePresent: false,
      m1CdmModuleScaffolded: false,
      m1LastWorkstreamRegistered: null,
      runTrigger: "markets-readiness-snapshot",
    };
    expect(parsesOk(marketsReadinessSnapshotPayloadSchema, payload)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 12. camille:financial-position-snapshot → FinancialPositionSnapshot
// ---------------------------------------------------------------------------

describe("handler-schema-parity: camille:financial-position-snapshot", () => {
  it("accepts the exact payload shape emitted by camille-financial-position-snapshot.ts", () => {
    // Reproduced from handler lines 421–436 (uses ...snap.events spread).
    const payload = {
      camilleOwnedObligations: 15,
      obligationsInForce: 3,
      obligationsPartial: 2,
      obligationsPlanned: 7,
      obligationsDrafting: 2,
      obligationsNAyet: 1,
      beaHandlerCount: 5,
      yaelHandlerCount: 2,
      // snap.events spread (financial domain events) — zero in build phase
      periodClosedLast7d: 0,
      baReturnSignedLast7d: 0,
      afsSignedLast7d: 0,
      capitalPlanRefreshedLast7d: 0,
      lastCloseApproved: null,
      lastBaReturnSigned: null,
      lastAfsSigned: null,
      lastCapitalPlanRefresh: null,
      runTrigger: "financial-position-snapshot",
    };
    expect(parsesOk(financialPositionSnapshotPayloadSchema, payload)).toBe(true);
  });
});
