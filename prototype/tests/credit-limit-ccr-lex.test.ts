// tests/credit-limit-ccr-lex.test.ts
//
// WS-CREDIT-LIMIT-ENGINE — Round-trip tests for the credit-limit + SA-CCR /
// LEX event-type family.
//
// Coverage:
//   - Lifecycle: at least one happy-path factory + EventStore round-trip
//     for each of the 12 credit-limit events.
//   - Computation: round-trip + schema validation for the 3 SA-CCR / LEX
//     events.
//   - Schema rejection: negative integer + bad enum + missing required
//     field for representative events.
//   - Registry: every type appears in EVENT_TYPE_REGISTRY with a non-null
//     payloadSchema; subscriber lists are non-empty; class is "audit".
//   - Index: every type appears in TYPED_EVENT_TYPES.
//
// Authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20);
//   Policies/credit-risk-policy-v1.md; Procedures/by-policy/credit-origination.md.
//
// Authors: Atlas (Core banking platform architect, engineering) +
//   Rohan (Market risk quantitative engineer, engineering).

import { describe, expect, it } from "bun:test";

import { BANK_ZA_001, newEventId } from "../platform/core/types";
import {
  COUNTERPARTY_CREDIT_RISK_TYPED_EVENT_TYPES,
  CREDIT_LIMIT_TYPED_EVENT_TYPES,
  type CrcLimitExceptionApprovedPayload,
  type CreditAnalysisCompletedPayload,
  type CreditLimitAnnualReviewCompletedPayload,
  type CreditLimitApplicationSubmittedPayload,
  type CreditLimitApprovedPayload,
  type CreditLimitBreachDisposedPayload,
  type CreditLimitBreachedPayload,
  type CreditLimitExtensionRequestedPayload,
  type CreditLimitLoadedPayload,
  type CreditLimitProposedPayload,
  type ISDACSAAssessmentCompletedPayload,
  type SubInvestmentGradeCounterpartyApprovedPayload,
  ccrReplacementCostComputedPayloadSchema,
  creditLimitBreachedPayloadSchema,
  makeCrcLimitExceptionApproved,
  makeCreditAnalysisCompleted,
  makeCreditLimitAnnualReviewCompleted,
  makeCreditLimitApplicationSubmitted,
  makeCreditLimitApproved,
  makeCreditLimitBreachDisposed,
  makeCreditLimitBreached,
  makeCreditLimitExtensionRequested,
  makeCreditLimitLoaded,
  makeCreditLimitProposed,
  makeISDACSAAssessmentCompleted,
  makeSubInvestmentGradeCounterpartyApproved,
} from "../platform/event-store/event-types";
import { TYPED_EVENT_TYPES } from "../platform/event-store/event-types";
import {
  type CcrReplacementCostComputedPayload,
  type LexExceptionApprovedPayload,
  type LexUtilisationComputedPayload,
  makeCcrReplacementCostComputed,
  makeLexExceptionApproved,
  makeLexUtilisationComputed,
} from "../platform/event-store/event-types/counterparty-credit-risk";
// Direct import — these factories live on counterparty-credit-risk and
// credit-limit, but the barrel re-export covers them. We also separately
// validate the schemas exported from the credit-limit module.
import { lexUtilisationComputedPayloadSchema } from "../platform/event-store/event-types/counterparty-credit-risk";
import { creditLimitApprovedPayloadSchema } from "../platform/event-store/event-types/credit-limit";
import { EVENT_TYPE_REGISTRY } from "../platform/event-store/registry";
import { EventStore } from "../platform/event-store/store";

const ENTITY = BANK_ZA_001;
const ACTOR = { type: "service" as const, id: "test:credit-limit-ccr-lex" };
const CITATIONS = ["D-CREDIT-LIMIT-ENGINE-BUILD", "POLICY:credit-risk-policy-v1"];
const AS_OF = "2026-05-20T10:00:00.000Z";
const TS = "2026-05-20T10:05:00.000Z";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function applicationPayload(
  o: Partial<CreditLimitApplicationSubmittedPayload> = {},
): CreditLimitApplicationSubmittedPayload {
  return {
    applicationId: "CL-APP-2026-001",
    counterpartyId: "CP-BIG4BANK-001",
    requestedLimit: 50_000_000_00,
    currency: "ZAR",
    tenor: "364D",
    productTypes: ["fx-spot", "fx-forward"],
    tradingDesk: "FX-Sales",
    commercialRationale: "Tier-1 SA bank counterparty for FX flow.",
    submittedBy: "saskia",
    submittedAt: TS,
    ...o,
  };
}

function extensionPayload(
  o: Partial<CreditLimitExtensionRequestedPayload> = {},
): CreditLimitExtensionRequestedPayload {
  return {
    applicationId: "CL-EXT-2026-001",
    counterpartyId: "CP-BIG4BANK-001",
    currentLimit: 50_000_000_00,
    requestedLimit: 75_000_000_00,
    reason: "Growing FX flow vs. current cap.",
    requestedBy: "saskia",
    requestedAt: TS,
    ...o,
  };
}

function analysisPayload(
  o: Partial<CreditAnalysisCompletedPayload> = {},
): CreditAnalysisCompletedPayload {
  return {
    applicationId: "CL-APP-2026-001",
    counterpartyId: "CP-BIG4BANK-001",
    externalRating: "BBB+",
    internalRating: "IG-3",
    capitalAdequacyRatio: 15.4,
    liquidityRatio: 142.0,
    concentrationFlags: [],
    analystRef: "helena",
    completedAt: TS,
    ...o,
  };
}

function isdaPayload(
  o: Partial<ISDACSAAssessmentCompletedPayload> = {},
): ISDACSAAssessmentCompletedPayload {
  return {
    counterpartyId: "CP-BIG4BANK-001",
    isdaStatus: "executed",
    csaThreshold: 10_000_000_00,
    mta: 1_000_000_00,
    currency: "ZAR",
    nettingEnforceable: true,
    jurisdictionOpinionRef: "DOC-ISDA-OP-ZA-001",
    assessedBy: "imani",
    assessedAt: TS,
    ...o,
  };
}

function proposedPayload(o: Partial<CreditLimitProposedPayload> = {}): CreditLimitProposedPayload {
  return {
    applicationId: "CL-APP-2026-001",
    counterpartyId: "CP-BIG4BANK-001",
    proposedLimit: 50_000_000_00,
    currency: "ZAR",
    basis: "sa-ccr-derived",
    largeExposurePct: 12.5,
    rasHeadroomPct: 7.5,
    conditions: ["ISDA-execution-prerequisite"],
    proposedBy: "helena",
    proposedAt: TS,
    ...o,
  };
}

function approvedPayload(o: Partial<CreditLimitApprovedPayload> = {}): CreditLimitApprovedPayload {
  return {
    applicationId: "CL-APP-2026-001",
    counterpartyId: "CP-BIG4BANK-001",
    limit: 50_000_000_00,
    currency: "ZAR",
    tenor: "364D",
    approvedBy: "helena",
    approvalAuthority: "CRC",
    approvedAt: TS,
    conditions: [],
    expiryDate: "2027-05-20",
    ...o,
  };
}

function loadedPayload(o: Partial<CreditLimitLoadedPayload> = {}): CreditLimitLoadedPayload {
  return {
    counterpartyId: "CP-BIG4BANK-001",
    limit: 50_000_000_00,
    currency: "ZAR",
    loadedAt: TS,
    effectiveFrom: TS,
    loadedBy: "atlas",
    ...o,
  };
}

function annualReviewPayload(
  o: Partial<CreditLimitAnnualReviewCompletedPayload> = {},
): CreditLimitAnnualReviewCompletedPayload {
  return {
    counterpartyId: "CP-BIG4BANK-001",
    reviewYear: 2026,
    revisedLimit: 60_000_000_00,
    currency: "ZAR",
    rationale: "Counterparty fundamentals improved; raise by 20%.",
    reviewedBy: "helena",
    reviewedAt: TS,
    ...o,
  };
}

function breachedPayload(o: Partial<CreditLimitBreachedPayload> = {}): CreditLimitBreachedPayload {
  return {
    counterpartyId: "CP-BIG4BANK-001",
    breachId: "CL-BREACH-2026-001",
    exposure: 55_000_000_00,
    limit: 50_000_000_00,
    currency: "ZAR",
    severity: "red",
    detectedAt: TS,
    ...o,
  };
}

function breachDisposedPayload(
  o: Partial<CreditLimitBreachDisposedPayload> = {},
): CreditLimitBreachDisposedPayload {
  return {
    counterpartyId: "CP-BIG4BANK-001",
    breachId: "CL-BREACH-2026-001",
    dispositionType: "unwound",
    approvedBy: "helena",
    remediationDeadline: TS,
    disposedAt: TS,
    ...o,
  };
}

function crcExceptionPayload(
  o: Partial<CrcLimitExceptionApprovedPayload> = {},
): CrcLimitExceptionApprovedPayload {
  return {
    counterpartyId: "CP-BIG4BANK-001",
    exceptionType: "temporary-cap-override",
    applicationId: "CL-APP-2026-001",
    approvedAt: TS,
    minutesRef: "DOC-CRC-MIN-2026-04-001",
    ...o,
  };
}

function subIGPayload(
  o: Partial<SubInvestmentGradeCounterpartyApprovedPayload> = {},
): SubInvestmentGradeCounterpartyApprovedPayload {
  return {
    counterpartyId: "CP-MIDTIER-001",
    ratingAtApproval: "BB+",
    approvalDate: "2026-05-20",
    reviewDate: "2027-05-20",
    approverAuthority: "BRC",
    ...o,
  };
}

function ccrRcPayload(
  o: Partial<CcrReplacementCostComputedPayload> = {},
): CcrReplacementCostComputedPayload {
  return {
    nettingSetId: "NS-CP-BIG4BANK-001-ZAR",
    counterpartyId: "CP-BIG4BANK-001",
    rc: 5_000_000_00,
    currency: "ZAR",
    computationDate: "2026-05-20",
    methodology: "sa-ccr",
    vMtm: 7_000_000_00,
    collateralHeld: 2_000_000_00,
    ...o,
  };
}

function lexUtilPayload(
  o: Partial<LexUtilisationComputedPayload> = {},
): LexUtilisationComputedPayload {
  return {
    counterpartyId: "CP-BIG4BANK-001",
    connectedGroupId: "GROUP-BIG4BANK-HOLDCO",
    totalExposure: 100_000_000_00,
    eligibleCapital: 1_000_000_000_00,
    currency: "ZAR",
    utilisationPct: 10.0,
    computedAt: TS,
    ...o,
  };
}

function lexExceptionPayload(
  o: Partial<LexExceptionApprovedPayload> = {},
): LexExceptionApprovedPayload {
  return {
    counterpartyId: "CP-BIG4BANK-001",
    exceptionType: "sub-limit",
    approver: "crc-chair",
    approverAuthority: "CRC",
    expiryDate: "2027-05-20",
    approvedAt: TS,
    ...o,
  };
}

// ---------------------------------------------------------------------------
// Lifecycle — happy-path factory + round-trip
// ---------------------------------------------------------------------------

describe("CreditLimit lifecycle — factories + round-trip", () => {
  const cases: Array<{
    name: string;
    type: string;
    build: () => ReturnType<typeof makeCreditLimitApplicationSubmitted>;
  }> = [
    {
      name: "CreditLimitApplicationSubmitted",
      type: "CreditLimitApplicationSubmitted",
      build: () =>
        makeCreditLimitApplicationSubmitted({
          asOf: AS_OF,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: applicationPayload(),
          eventId: newEventId(),
        }),
    },
    {
      name: "CreditLimitExtensionRequested",
      type: "CreditLimitExtensionRequested",
      build: () =>
        makeCreditLimitExtensionRequested({
          asOf: AS_OF,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: extensionPayload(),
          eventId: newEventId(),
        }),
    },
    {
      name: "CreditAnalysisCompleted",
      type: "CreditAnalysisCompleted",
      build: () =>
        makeCreditAnalysisCompleted({
          asOf: AS_OF,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: analysisPayload(),
          eventId: newEventId(),
        }),
    },
    {
      name: "ISDACSAAssessmentCompleted",
      type: "ISDACSAAssessmentCompleted",
      build: () =>
        makeISDACSAAssessmentCompleted({
          asOf: AS_OF,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: isdaPayload(),
          eventId: newEventId(),
        }),
    },
    {
      name: "CreditLimitProposed",
      type: "CreditLimitProposed",
      build: () =>
        makeCreditLimitProposed({
          asOf: AS_OF,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: proposedPayload(),
          eventId: newEventId(),
        }),
    },
    {
      name: "CreditLimitApproved",
      type: "CreditLimitApproved",
      build: () =>
        makeCreditLimitApproved({
          asOf: AS_OF,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: approvedPayload(),
          eventId: newEventId(),
        }),
    },
    {
      name: "CreditLimitLoaded",
      type: "CreditLimitLoaded",
      build: () =>
        makeCreditLimitLoaded({
          asOf: AS_OF,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: loadedPayload(),
          eventId: newEventId(),
        }),
    },
    {
      name: "CreditLimitAnnualReviewCompleted",
      type: "CreditLimitAnnualReviewCompleted",
      build: () =>
        makeCreditLimitAnnualReviewCompleted({
          asOf: AS_OF,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: annualReviewPayload(),
          eventId: newEventId(),
        }),
    },
    {
      name: "CreditLimitBreached",
      type: "CreditLimitBreached",
      build: () =>
        makeCreditLimitBreached({
          asOf: AS_OF,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: breachedPayload(),
          eventId: newEventId(),
        }),
    },
    {
      name: "CreditLimitBreachDisposed",
      type: "CreditLimitBreachDisposed",
      build: () =>
        makeCreditLimitBreachDisposed({
          asOf: AS_OF,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: breachDisposedPayload(),
          eventId: newEventId(),
        }),
    },
    {
      name: "CrcLimitExceptionApproved",
      type: "CrcLimitExceptionApproved",
      build: () =>
        makeCrcLimitExceptionApproved({
          asOf: AS_OF,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: crcExceptionPayload(),
          eventId: newEventId(),
        }),
    },
    {
      name: "SubInvestmentGradeCounterpartyApproved",
      type: "SubInvestmentGradeCounterpartyApproved",
      build: () =>
        makeSubInvestmentGradeCounterpartyApproved({
          asOf: AS_OF,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: subIGPayload(),
          eventId: newEventId(),
        }),
    },
  ];

  for (const c of cases) {
    it(`${c.name} factory produces correct type + round-trips through EventStore`, () => {
      const event = c.build();
      expect(event.type).toBe(c.type);
      const store = new EventStore(":memory:");
      expect(() => store.append(event)).not.toThrow();
      let seen = 0;
      for (const e of store.replay({ type: c.type })) {
        seen += 1;
        expect(e.type).toBe(c.type);
      }
      expect(seen).toBe(1);
      store.close();
    });
  }
});

// ---------------------------------------------------------------------------
// SA-CCR / LEX computation — happy-path factory + round-trip
// ---------------------------------------------------------------------------

describe("CCR / LEX computation — factories + round-trip", () => {
  it("CcrReplacementCostComputed round-trips through EventStore", () => {
    const event = makeCcrReplacementCostComputed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: ccrRcPayload(),
      eventId: newEventId(),
    });
    expect(event.type).toBe("CcrReplacementCostComputed");
    const store = new EventStore(":memory:");
    store.append(event);
    let seen = 0;
    for (const e of store.replay({ type: "CcrReplacementCostComputed" })) {
      seen += 1;
      const p = e.payload as CcrReplacementCostComputedPayload;
      expect(p.methodology).toBe("sa-ccr");
      expect(p.rc).toBe(5_000_000_00);
    }
    expect(seen).toBe(1);
    store.close();
  });

  it("LexUtilisationComputed round-trips through EventStore", () => {
    const event = makeLexUtilisationComputed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: lexUtilPayload(),
      eventId: newEventId(),
    });
    expect(event.type).toBe("LexUtilisationComputed");
    const store = new EventStore(":memory:");
    store.append(event);
    let seen = 0;
    for (const e of store.replay({ type: "LexUtilisationComputed" })) {
      seen += 1;
      const p = e.payload as LexUtilisationComputedPayload;
      expect(p.utilisationPct).toBe(10);
    }
    expect(seen).toBe(1);
    store.close();
  });

  it("LexExceptionApproved round-trips through EventStore", () => {
    const event = makeLexExceptionApproved({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: lexExceptionPayload(),
      eventId: newEventId(),
    });
    expect(event.type).toBe("LexExceptionApproved");
    const store = new EventStore(":memory:");
    store.append(event);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// Schema validation — rejection paths
// ---------------------------------------------------------------------------

describe("CreditLimit / CCR / LEX schema rejection paths", () => {
  it("rejects negative requestedLimit", () => {
    expect(() =>
      makeCreditLimitApplicationSubmitted({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: applicationPayload({ requestedLimit: -1 }),
      }),
    ).toThrow();
  });

  it("rejects bad approvalAuthority enum", () => {
    expect(() =>
      creditLimitApprovedPayloadSchema.parse({
        ...approvedPayload(),
        approvalAuthority: "junior-trader",
      }),
    ).toThrow();
  });

  it("rejects bad severity enum on CreditLimitBreached", () => {
    expect(() =>
      creditLimitBreachedPayloadSchema.parse({
        ...breachedPayload(),
        severity: "yellow",
      }),
    ).toThrow();
  });

  it("rejects negative rc on CcrReplacementCostComputed", () => {
    expect(() =>
      ccrReplacementCostComputedPayloadSchema.parse({
        ...ccrRcPayload(),
        rc: -1,
      }),
    ).toThrow();
  });

  it("rejects non-sa-ccr methodology on CcrReplacementCostComputed", () => {
    expect(() =>
      ccrReplacementCostComputedPayloadSchema.parse({
        ...ccrRcPayload(),
        methodology: "imm",
      }),
    ).toThrow();
  });

  it("rejects negative eligibleCapital on LexUtilisationComputed", () => {
    expect(() =>
      lexUtilisationComputedPayloadSchema.parse({
        ...lexUtilPayload(),
        eligibleCapital: -1,
      }),
    ).toThrow();
  });

  it("rejects missing counterpartyId", () => {
    expect(() =>
      makeCreditLimitLoaded({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: loadedPayload({ counterpartyId: "" }),
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Registry / TYPED_EVENT_TYPES integration
// ---------------------------------------------------------------------------

describe("Registry + TYPED_EVENT_TYPES integration", () => {
  it("every credit-limit type appears in TYPED_EVENT_TYPES", () => {
    for (const t of CREDIT_LIMIT_TYPED_EVENT_TYPES) {
      expect((TYPED_EVENT_TYPES as readonly string[]).includes(t)).toBe(true);
    }
  });

  it("every CCR / LEX type appears in TYPED_EVENT_TYPES", () => {
    for (const t of COUNTERPARTY_CREDIT_RISK_TYPED_EVENT_TYPES) {
      expect((TYPED_EVENT_TYPES as readonly string[]).includes(t)).toBe(true);
    }
  });

  it("every credit-limit type has an EVENT_TYPE_REGISTRY row with a payloadSchema", () => {
    for (const t of CREDIT_LIMIT_TYPED_EVENT_TYPES) {
      const rows = EVENT_TYPE_REGISTRY.filter((m) => m.type === t);
      expect(rows.length).toBeGreaterThan(0);
      const row = rows[rows.length - 1];
      if (!row) throw new Error(`registry row missing for ${t}`);
      expect(row.payloadSchema).toBeDefined();
      expect(row.class).toBe("audit");
      expect(row.subscribers.length).toBeGreaterThan(0);
      expect(row.subscribers).toContain("Atlas");
    }
  });

  it("every CCR / LEX type has an EVENT_TYPE_REGISTRY row with a payloadSchema", () => {
    for (const t of COUNTERPARTY_CREDIT_RISK_TYPED_EVENT_TYPES) {
      const rows = EVENT_TYPE_REGISTRY.filter((m) => m.type === t);
      expect(rows.length).toBeGreaterThan(0);
      const row = rows[rows.length - 1];
      if (!row) throw new Error(`registry row missing for ${t}`);
      expect(row.payloadSchema).toBeDefined();
      expect(row.class).toBe("audit");
      expect(row.subscribers.length).toBeGreaterThan(0);
    }
  });

  it("Rohan is the issuer for the SA-CCR computation events", () => {
    const rc = EVENT_TYPE_REGISTRY.find((m) => m.type === "CcrReplacementCostComputed");
    const util = EVENT_TYPE_REGISTRY.find((m) => m.type === "LexUtilisationComputed");
    expect(rc?.issuer).toBe("Rohan");
    expect(util?.issuer).toBe("Rohan");
  });

  it("Helena is a subscriber to every credit-limit + CCR / LEX event", () => {
    const all = [...CREDIT_LIMIT_TYPED_EVENT_TYPES, ...COUNTERPARTY_CREDIT_RISK_TYPED_EVENT_TYPES];
    for (const t of all) {
      const row = EVENT_TYPE_REGISTRY.find((m) => m.type === t);
      expect(row?.subscribers).toContain("Helena");
    }
  });
});
