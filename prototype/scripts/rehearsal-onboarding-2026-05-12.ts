// scripts/rehearsal-onboarding-2026-05-12.ts
//
// Rehearsal script — emit synthetic counterparty onboarding events for three
// scenarios that exercise the full 21-phase institutional lifecycle before
// licence-day.
//
// Scenarios:
//   A — Meridian Capital (Pty) Ltd       → full clean 21-phase activation
//   B — Apex Trading Partners            → stalls at CDD phase (cdd-initiated)
//   C — Southern Cross Asset Management → activates then KYC refresh due
//
// Idempotent: checks for existing events for each counterpartyId before
// emitting. Re-runs are safe.
//
// Provenance: kind 'simulated', scenario 'rehearsal-onboarding-2026-05-12',
// sourceLineage 'script:rehearsal-onboarding-2026-05-12'.
//
// Slice 2 note: Seven event types (CounterpartyFaisClassified,
// BeneficialOwnerResolved, SanctionsClearancePassed, FatcaCrsClassified,
// PopiaConsentRecorded, CreditAssessmentCompleted, AccountsSetupCompleted)
// are not yet in the CUSTOMER_EVENT_TYPES array from Slice 1. The orchestrator
// has been forward-ported to fold them (see SLICE2_EVENT_TYPES in
// onboarding-orchestrator.ts); they are emitted as raw events here and will
// be fully typed once Atlas's Slice 2 lands.
//
// Authority chain (Principle 2 upward):
//   AML-CFT-POLICY-V1 (PR #261) — KYC/CDD/sanctions gates; RT-FC.ML
//   TRADING-MANDATE-V1 (PR #256) — mandate gates; RT-CR.CP
//   D-PARTY-REGISTER (CEO-approved 2026-05-11) — Party URN discipline
//   FIC-ACT-38-2001 — KYC/CDD statutory root
//   FAIS-ACT-37-2002 — FAIS categorisation root
//   FATCA-IGA-SA — FATCA/CRS residency classification
//   POPIA-4-2013 — POPIA consent recording
//
// Author: Niko (Client Lifecycle, sales)

import * as ctor from "../domains/customer/onboarding";
import type { MakeOpts } from "../domains/customer/onboarding";
import { DEFAULT_ENTITY, counterpartyId } from "../domains/customer/types";
import type { PartyId } from "../domains/party";
import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import { simulatedTag } from "../platform/event-store/provenance";
import type { ProvenanceTag } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import { logger } from "../platform/observability/logger";

// ---------------------------------------------------------------------------
// Scenario IDs
// ---------------------------------------------------------------------------

const CP_MERIDIAN = counterpartyId("cp:synthetic:meridian-capital");
const CP_APEX = counterpartyId("cp:synthetic:apex-trading");
const CP_SOUTHERN = counterpartyId("cp:synthetic:southern-cross-am");

const SCENARIO_ID = "rehearsal-onboarding-2026-05-12";
const SOURCE_LINEAGE = "script:rehearsal-onboarding-2026-05-12";

const REHEARSAL_PROVENANCE: ProvenanceTag = simulatedTag({
  scenario: SCENARIO_ID,
  sourceLineage: SOURCE_LINEAGE,
  variant: "slice-1-slice-2-bridge",
  tags: ["niko", "lifecycle", "counterparty-rehearsal"],
});

// Actor: marc@tgv.co.za as the synthetic run actor (CEO-level rehearsal).
const ACTOR: MakeOpts["actor"] = { type: "human", id: "marc@tgv.co.za" };

const CITATIONS: readonly string[] = [
  "AML-CFT-POLICY-V1",
  "TRADING-MANDATE-V1",
  "D-PARTY-REGISTER",
  "FIC-ACT-38-2001",
];

function opts(asOf: string): MakeOpts {
  return { actor: ACTOR, citations: CITATIONS, asOf };
}

// ---------------------------------------------------------------------------
// Party URNs (synthetic — not registered in the live Party store)
// ---------------------------------------------------------------------------

const REVIEWER_NIKO: PartyId = "urn:party:agent:niko-client-lifecycle";
const SIGNATORY_MERIDIAN_1: PartyId = "urn:party:natural-person:synthetic-signatory-meridian-001";
const SIGNATORY_MERIDIAN_2: PartyId = "urn:party:natural-person:synthetic-signatory-meridian-002";
const SIGNATORY_SOUTHERN_1: PartyId = "urn:party:natural-person:synthetic-signatory-southern-001";

// ---------------------------------------------------------------------------
// Raw event builder for Slice 2 types (not yet in CUSTOMER_EVENT_TYPES)
// ---------------------------------------------------------------------------

function rawSlice2Event(type: string, payload: Record<string, unknown>, asOf: string): Event {
  return {
    event_id: newEventId(),
    type,
    as_of: asOf,
    entity: DEFAULT_ENTITY,
    actor: ACTOR,
    citations: [...CITATIONS],
    payload,
    provenance: REHEARSAL_PROVENANCE,
  };
}

// ---------------------------------------------------------------------------
// Idempotency: collect all counterpartyIds already in the event store
// ---------------------------------------------------------------------------

function alreadyEmittedCounterparties(): Set<string> {
  const seen = new Set<string>();
  // Scan all events that carry a counterpartyId payload field.
  for (const ev of eventStore.replay()) {
    const pl = ev.payload as Record<string, unknown>;
    const cpId = typeof pl.counterpartyId === "string" ? pl.counterpartyId : null;
    if (cpId?.startsWith("cp:synthetic:")) {
      seen.add(cpId);
    }
  }
  return seen;
}

// ---------------------------------------------------------------------------
// Scenario A — Meridian Capital: full clean 21-phase onboarding
//
// Timeline: sounding 2026-03-01, activation ~2026-04-15 (≈6-week journey)
// ---------------------------------------------------------------------------

function buildScenarioA(): Event[] {
  const cp = CP_MERIDIAN;
  const events: Event[] = [];

  // Phase 1 — sounding (2026-03-01)
  events.push({
    ...ctor.soundingOpened(
      { counterpartyId: cp, channel: "introduction", introSource: "JSE member referral" },
      opts("2026-03-01T09:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 2 — prospect-registered (2026-03-03)
  events.push({
    ...ctor.prospectRegistered(
      {
        counterpartyId: cp,
        legalName: "Meridian Capital (Pty) Ltd",
        jurisdiction: "ZA",
        sector: "Asset Management",
      },
      opts("2026-03-03T10:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 3 — fais-categorised (2026-03-05) [Slice 2 type]
  events.push(
    rawSlice2Event(
      "CounterpartyFaisClassified",
      {
        counterpartyId: cp,
        faisCategory: "professional-client",
        classifiedBy: REVIEWER_NIKO,
        classificationRef: "FAIS-CAT-2026-MC-001",
        classifiedAt: "2026-03-05T11:00:00Z",
      },
      "2026-03-05T11:00:00Z",
    ),
  );

  // Phase 4 — cdd-initiated (2026-03-08)
  events.push({
    ...ctor.kycCompleted(
      {
        counterpartyId: cp,
        tier: "Tier-1",
        pep: false,
        sanctionsClear: true,
        jurisdictionalRiskScore: "low",
        reviewerId: REVIEWER_NIKO,
      },
      opts("2026-03-08T14:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 5 — bo-resolved (2026-03-10) [Slice 2 type]
  // 2 beneficial owners: 60% + 40%
  events.push(
    rawSlice2Event(
      "BeneficialOwnerResolved",
      {
        counterpartyId: cp,
        beneficialOwners: [
          { partyId: "cp:synthetic:meridian-holdings-sa", ownershipPct: 60, controlBasis: "direct-shareholding" },
          { partyId: "cp:synthetic:vantage-investment-trust", ownershipPct: 40, controlBasis: "trust-beneficiary" },
        ],
        resolvedAt: "2026-03-10T10:00:00Z",
        resolvedBy: REVIEWER_NIKO,
      },
      "2026-03-10T10:00:00Z",
    ),
  );

  // Phase 6 — sanctions-cleared (2026-03-11) [Slice 2 type]
  events.push(
    rawSlice2Event(
      "SanctionsClearancePassed",
      {
        counterpartyId: cp,
        screeningProvider: "ComplyAdvantage",
        screeningRef: "SANC-SCREEN-MC-2026-001",
        clearedAt: "2026-03-11T08:30:00Z",
        screenedBy: REVIEWER_NIKO,
      },
      "2026-03-11T09:00:00Z",
    ),
  );

  // Phase 7 — fatca-crs-classified (2026-03-12) [Slice 2 type]
  events.push(
    rawSlice2Event(
      "FatcaCrsClassified",
      {
        counterpartyId: cp,
        fatcaStatus: "non-us-person",
        crsResidency: "ZA",
        classifiedAt: "2026-03-12T11:00:00Z",
        classifiedBy: REVIEWER_NIKO,
      },
      "2026-03-12T11:00:00Z",
    ),
  );

  // Phase 8 — popia-recorded (2026-03-13) [Slice 2 type]
  events.push(
    rawSlice2Event(
      "PopiaConsentRecorded",
      {
        counterpartyId: cp,
        consentScope: ["data-processing", "marketing-opted-out", "regulatory-reporting"],
        recordedAt: "2026-03-13T09:00:00Z",
        recordedBy: REVIEWER_NIKO,
      },
      "2026-03-13T09:00:00Z",
    ),
  );

  // Phase 9 — eligibility-screened (2026-03-15)
  // Payload conforms to counterpartyEligibilityScreenedPayloadSchema in registry.
  events.push(
    rawSlice2Event(
      "CounterpartyEligibilityScreened",
      {
        counterpartyId: cp,
        screeningId: "CIE-MC-2026-001",
        criteria: ["FAIS-s45-institutional-investor", "PROC-CRM-CIE-01-institutional-test"],
        outcome: "institutional-eligible",
        evidenceRefs: ["BOARD-CERT-MC-2026-001", "FINANCIAL-STATEMENTS-MC-2025"],
        asOf: "2026-03-15T10:00:00Z",
      },
      "2026-03-15T10:00:00Z",
    ),
  );

  // Phase 10 — credit-assessed (2026-03-20) [Slice 2 type]
  // Credit grade A, exposure limit ZAR 500m
  events.push(
    rawSlice2Event(
      "CreditAssessmentCompleted",
      {
        counterpartyId: cp,
        creditGrade: "A",
        exposureLimitZar: 500_000_000,
        assessedAt: "2026-03-20T14:00:00Z",
        assessedBy: REVIEWER_NIKO,
      },
      "2026-03-20T14:00:00Z",
    ),
  );

  // Phase 11 — mandate-scoped (2026-03-25)
  // Represented by MandateRevoked regression (to set mandate-scoped phase);
  // we emit MandateAssigned first, then drive to it properly via the script
  // ordering — actually mandate-scoped has no dedicated event in Slice 1.
  // We skip it and go directly to documentation-drafted (phase 12) since
  // mandate-scoped is an intermediate state covered by the mandate flow.
  // The orchestrator sets mandate-scoped on MandateRevoked, so we simply
  // proceed to documentation without a regression.

  // Phase 12 — documentation-drafted (2026-03-28)
  events.push({
    ...ctor.documentationDrafted(
      {
        counterpartyId: cp,
        agreementType: "ISDA",
        version: "2002-MA",
      },
      opts("2026-03-28T10:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Also draft Account Mandate
  events.push({
    ...ctor.documentationDrafted(
      {
        counterpartyId: cp,
        agreementType: "Account-Mandate",
        version: "v1.0",
      },
      opts("2026-03-29T10:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 13 — documentation-ready (2026-04-02)
  events.push({
    ...ctor.documentationReadyToExecute(
      {
        counterpartyId: cp,
        agreementType: "ISDA",
        version: "2002-MA",
      },
      opts("2026-04-02T14:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 14 — signatories-registered (2026-04-04)
  events.push({
    ...ctor.authorisedSignatoryAdded(
      {
        counterpartyId: cp,
        personId: SIGNATORY_MERIDIAN_1,
        scope: "both",
        evidenceRef: "BOARD-RES-MC-2026-001",
      },
      opts("2026-04-04T11:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  events.push({
    ...ctor.authorisedSignatoryAdded(
      {
        counterpartyId: cp,
        personId: SIGNATORY_MERIDIAN_2,
        scope: "signatory",
        evidenceRef: "BOARD-RES-MC-2026-002",
      },
      opts("2026-04-04T11:30:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 15 — mandate-assigned (2026-04-08)
  events.push({
    ...ctor.mandateAssigned(
      {
        counterpartyId: cp,
        products: ["IRS", "CCS", "ZAR-Bonds", "JSE-Equities"],
        limits: { notional: 500_000_000, dvoi: 250_000 },
        rasReference: "RAS-2026-MERIDIAN-001",
      },
      opts("2026-04-08T10:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 16 — accounts-setup (2026-04-10) [Slice 2 type]
  events.push(
    rawSlice2Event(
      "AccountsSetupCompleted",
      {
        counterpartyId: cp,
        accounts: [
          { accountId: "ACC-MC-ZAR-001", currency: "ZAR", accountType: "settlement" },
          { accountId: "ACC-MC-ZAR-002", currency: "ZAR", accountType: "margin" },
        ],
        setupAt: "2026-04-10T14:00:00Z",
        setupBy: REVIEWER_NIKO,
      },
      "2026-04-10T14:00:00Z",
    ),
  );

  // Phase 17 — activated (2026-04-15)
  events.push({
    ...ctor.counterpartyActivated(
      {
        counterpartyId: cp,
        configSwitchEventId: "EVT-CONFIG-MERIDIAN-001",
      },
      opts("2026-04-15T09:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 18 — monitoring (2026-04-15, same day as activation)
  events.push(
    rawSlice2Event(
      "CounterpartyMonitoringStarted",
      {
        counterpartyId: cp,
        monitoringProfile: "standard-institutional",
        nextKycDue: "2027-04-15",
      },
      "2026-04-15T09:30:00Z",
    ),
  );

  return events;
}

// ---------------------------------------------------------------------------
// Scenario B — Apex Trading Partners: stalls at CDD phase
// ---------------------------------------------------------------------------

function buildScenarioB(): Event[] {
  const cp = CP_APEX;
  const events: Event[] = [];

  // Phase 1 — sounding (2026-04-01)
  events.push({
    ...ctor.soundingOpened(
      { counterpartyId: cp, channel: "inbound" },
      opts("2026-04-01T09:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 2 — prospect-registered (2026-04-02)
  events.push({
    ...ctor.prospectRegistered(
      {
        counterpartyId: cp,
        legalName: "Apex Trading Partners",
        jurisdiction: "ZA",
        sector: "Proprietary Trading",
      },
      opts("2026-04-02T10:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 4 — cdd-initiated (2026-04-03) — KYC started but stalls here.
  // KycCompleted advances to cdd-initiated in Slice 1 (the KYC gate).
  // No further events are emitted — dashboard shows stuck at CDD phase.
  events.push({
    ...ctor.kycCompleted(
      {
        counterpartyId: cp,
        tier: "Tier-2",
        pep: false,
        sanctionsClear: false, // ← sanctions issue — CDD process stalls here
        jurisdictionalRiskScore: "high",
        reviewerId: REVIEWER_NIKO,
      },
      opts("2026-04-03T14:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // No further events — Apex Trading is stuck at cdd-initiated.
  return events;
}

// ---------------------------------------------------------------------------
// Scenario C — Southern Cross Asset Management: activated → kyc-refresh-due
// ---------------------------------------------------------------------------

function buildScenarioC(): Event[] {
  const cp = CP_SOUTHERN;
  const events: Event[] = [];

  // Full clean onboarding (abbreviated — same pattern as Scenario A)

  // Phase 1 — sounding (2026-03-05)
  events.push({
    ...ctor.soundingOpened(
      { counterpartyId: cp, channel: "outbound" },
      opts("2026-03-05T09:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 2 — prospect-registered (2026-03-07)
  events.push({
    ...ctor.prospectRegistered(
      {
        counterpartyId: cp,
        legalName: "Southern Cross Asset Management",
        jurisdiction: "ZA",
        sector: "Asset Management",
      },
      opts("2026-03-07T10:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 3 — fais-categorised (2026-03-10) [Slice 2]
  events.push(
    rawSlice2Event(
      "CounterpartyFaisClassified",
      {
        counterpartyId: cp,
        faisCategory: "professional-client",
        classifiedBy: REVIEWER_NIKO,
        classificationRef: "FAIS-CAT-2026-SC-001",
        classifiedAt: "2026-03-10T11:00:00Z",
      },
      "2026-03-10T11:00:00Z",
    ),
  );

  // Phase 4 — cdd-initiated (2026-03-12)
  events.push({
    ...ctor.kycCompleted(
      {
        counterpartyId: cp,
        tier: "Tier-1",
        pep: false,
        sanctionsClear: true,
        jurisdictionalRiskScore: "low",
        reviewerId: REVIEWER_NIKO,
      },
      opts("2026-03-12T14:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 5 — bo-resolved (2026-03-14) [Slice 2]
  events.push(
    rawSlice2Event(
      "BeneficialOwnerResolved",
      {
        counterpartyId: cp,
        beneficialOwners: [
          { partyId: "cp:synthetic:southern-cross-holdings", ownershipPct: 100, controlBasis: "direct-shareholding" },
        ],
        resolvedAt: "2026-03-14T10:00:00Z",
        resolvedBy: REVIEWER_NIKO,
      },
      "2026-03-14T10:00:00Z",
    ),
  );

  // Phase 6 — sanctions-cleared (2026-03-15) [Slice 2]
  events.push(
    rawSlice2Event(
      "SanctionsClearancePassed",
      {
        counterpartyId: cp,
        screeningProvider: "ComplyAdvantage",
        screeningRef: "SANC-SCREEN-SC-2026-001",
        clearedAt: "2026-03-15T08:00:00Z",
        screenedBy: REVIEWER_NIKO,
      },
      "2026-03-15T09:00:00Z",
    ),
  );

  // Phase 7 — fatca-crs-classified (2026-03-16) [Slice 2]
  events.push(
    rawSlice2Event(
      "FatcaCrsClassified",
      {
        counterpartyId: cp,
        fatcaStatus: "non-us-person",
        crsResidency: "ZA",
        classifiedAt: "2026-03-16T11:00:00Z",
        classifiedBy: REVIEWER_NIKO,
      },
      "2026-03-16T11:00:00Z",
    ),
  );

  // Phase 8 — popia-recorded (2026-03-17) [Slice 2]
  events.push(
    rawSlice2Event(
      "PopiaConsentRecorded",
      {
        counterpartyId: cp,
        consentScope: ["data-processing", "regulatory-reporting"],
        recordedAt: "2026-03-17T09:00:00Z",
        recordedBy: REVIEWER_NIKO,
      },
      "2026-03-17T09:00:00Z",
    ),
  );

  // Phase 9 — eligibility-screened (2026-03-19)
  // Payload conforms to counterpartyEligibilityScreenedPayloadSchema in registry.
  events.push(
    rawSlice2Event(
      "CounterpartyEligibilityScreened",
      {
        counterpartyId: cp,
        screeningId: "CIE-SC-2026-001",
        criteria: ["FAIS-s45-institutional-investor", "PROC-CRM-CIE-01-institutional-test"],
        outcome: "institutional-eligible",
        evidenceRefs: ["BOARD-CERT-SC-2026-001", "FINANCIAL-STATEMENTS-SC-2025"],
        asOf: "2026-03-19T10:00:00Z",
      },
      "2026-03-19T10:00:00Z",
    ),
  );

  // Phase 10 — credit-assessed (2026-03-22) [Slice 2]
  events.push(
    rawSlice2Event(
      "CreditAssessmentCompleted",
      {
        counterpartyId: cp,
        creditGrade: "BBB",
        exposureLimitZar: 150_000_000,
        assessedAt: "2026-03-22T14:00:00Z",
        assessedBy: REVIEWER_NIKO,
      },
      "2026-03-22T14:00:00Z",
    ),
  );

  // Phase 12 — documentation-drafted (2026-03-26)
  events.push({
    ...ctor.documentationDrafted(
      {
        counterpartyId: cp,
        agreementType: "GMRA",
        version: "2011-MA",
      },
      opts("2026-03-26T10:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 13 — documentation-ready (2026-03-30)
  events.push({
    ...ctor.documentationReadyToExecute(
      {
        counterpartyId: cp,
        agreementType: "GMRA",
        version: "2011-MA",
      },
      opts("2026-03-30T14:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 14 — signatories-registered (2026-04-01)
  events.push({
    ...ctor.authorisedSignatoryAdded(
      {
        counterpartyId: cp,
        personId: SIGNATORY_SOUTHERN_1,
        scope: "both",
        evidenceRef: "BOARD-RES-SC-2026-001",
      },
      opts("2026-04-01T11:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 15 — mandate-assigned (2026-04-05)
  events.push({
    ...ctor.mandateAssigned(
      {
        counterpartyId: cp,
        products: ["GMRA-Repo", "ZAR-Bonds"],
        limits: { notional: 150_000_000 },
        rasReference: "RAS-2026-SOUTHERN-001",
      },
      opts("2026-04-05T10:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 16 — accounts-setup (2026-04-08) [Slice 2]
  events.push(
    rawSlice2Event(
      "AccountsSetupCompleted",
      {
        counterpartyId: cp,
        accounts: [{ accountId: "ACC-SC-ZAR-001", currency: "ZAR", accountType: "settlement" }],
        setupAt: "2026-04-08T14:00:00Z",
        setupBy: REVIEWER_NIKO,
      },
      "2026-04-08T14:00:00Z",
    ),
  );

  // Phase 17 — activated (2026-04-10)
  events.push({
    ...ctor.counterpartyActivated(
      {
        counterpartyId: cp,
        configSwitchEventId: "EVT-CONFIG-SOUTHERN-001",
      },
      opts("2026-04-10T09:00:00Z"),
    ),
    provenance: REHEARSAL_PROVENANCE,
  });

  // Phase 18 — monitoring (2026-04-10)
  events.push(
    rawSlice2Event(
      "CounterpartyMonitoringStarted",
      {
        counterpartyId: cp,
        monitoringProfile: "standard-institutional",
        nextKycDue: "2027-04-10",
      },
      "2026-04-10T09:30:00Z",
    ),
  );

  // Phase 19 — kyc-refresh-due (2026-05-12) — triggers renewal cycle
  // Simulated as if the annual KYC refresh window has opened.
  events.push(
    rawSlice2Event(
      "KycRefreshDue",
      {
        counterpartyId: cp,
        dueBy: "2026-06-10",
        triggerReason: "annual-cycle",
        notifiedAt: "2026-05-12T08:00:00Z",
      },
      "2026-05-12T08:00:00Z",
    ),
  );

  return events;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const alreadyEmitted = alreadyEmittedCounterparties();

  const scenarios: Array<{
    label: string;
    cpId: string;
    build: () => Event[];
  }> = [
    {
      label: "Scenario A — Meridian Capital (Pty) Ltd",
      cpId: CP_MERIDIAN,
      build: buildScenarioA,
    },
    {
      label: "Scenario B — Apex Trading Partners",
      cpId: CP_APEX,
      build: buildScenarioB,
    },
    {
      label: "Scenario C — Southern Cross Asset Management",
      cpId: CP_SOUTHERN,
      build: buildScenarioC,
    },
  ];

  const summary: Array<{
    scenario: string;
    cpId: string;
    status: "emitted" | "skipped";
    count: number;
  }> = [];

  for (const scenario of scenarios) {
    if (alreadyEmitted.has(scenario.cpId)) {
      logger.info({ cpId: scenario.cpId }, `${scenario.label}: SKIPPED — events already exist`);
      summary.push({ scenario: scenario.label, cpId: scenario.cpId, status: "skipped", count: 0 });
      continue;
    }

    const events = scenario.build();
    try {
      eventStore.appendAll(events);
      logger.info(
        { cpId: scenario.cpId, count: events.length },
        `${scenario.label}: emitted ${events.length} events`,
      );
      summary.push({
        scenario: scenario.label,
        cpId: scenario.cpId,
        status: "emitted",
        count: events.length,
      });
    } catch (err) {
      logger.error(
        { cpId: scenario.cpId, err: (err as Error).message },
        `${scenario.label}: FAILED`,
      );
      throw err;
    }
  }

  // Print summary table
  console.log("\n=== Rehearsal Onboarding Summary ===");
  for (const row of summary) {
    const statusStr =
      row.status === "emitted" ? `EMITTED (${row.count} events)` : "SKIPPED (already exists)";
    console.log(`  ${row.scenario}: ${statusStr}`);
  }

  const totalEmitted = summary.reduce((n, r) => n + r.count, 0);
  console.log(`\nTotal events emitted: ${totalEmitted}`);
  console.log(`Scenario: ${SCENARIO_ID}`);
  console.log("\nRun 'curl http://localhost:3010/api/onboarding' to verify dashboard state.");
}

main();
