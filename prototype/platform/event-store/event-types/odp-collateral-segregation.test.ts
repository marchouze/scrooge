// platform/event-store/event-types/odp-collateral-segregation.test.ts
//
// Tests for the ODP Collateral Segregation event-type schemas and helpers.
//
// Authority: ORG-ODP-COND-010; urn:regulation:odp:cs-2-2018 §12.
// Author: Devon (COO, operations)

import { describe, expect, it } from "bun:test";

import {
  computeAdjustedCollateralValue,
  computeBreachRemediationDeadline,
  computeMarginRequirement,
  makeCollateralSegregationBreachRaised,
  makeCollateralSegregationLocked,
  makeCollateralSegregationReleased,
  makeCollateralSubstitutionApproved,
  makeCollateralSubstitutionRejected,
  makeCollateralSubstitutionRequested,
  makeCollateralSufficiencyChecked,
} from "./odp-collateral-segregation";

const CITATIONS = ["ORG-ODP-COND-010", "urn:regulation:odp:cs-2-2018"];
const ACTOR = { type: "service" as const, id: "devon" };
const ENTITY = "hoz-bank";
const AS_OF = "2026-05-30T09:00:00.000Z";
const COUNTERPARTY = "party:lei:ABCDEF123456";
const CSA_EVENT_ID = "11111111-1111-1111-1111-111111111111";
const LOCK_EVENT_ID = "22222222-2222-2222-2222-222222222222";

// ---------------------------------------------------------------------------
// Helper: make a valid locked payload
// ---------------------------------------------------------------------------

function validLockPayload(overrides: Record<string, unknown> = {}) {
  return {
    lockId: "LOCK-20260530-cp1-001",
    counterpartyId: COUNTERPARTY,
    csaEventId: CSA_EVENT_ID,
    instrumentId: "fi:bond:ZAG000010A9",
    assetKind: "govt-bond-za" as const,
    nominalAmount: { currency: "ZAR", amountMinor: 10_000_000_00 }, // ZAR 10m
    haircutDecimal: 0.02,
    fxRateToBaseCurrency: 1.0,
    adjustedValueBaseCurrency: { currency: "ZAR", amountMinor: 9_800_000_00 },
    lockSource: "auto-csa" as const,
    marginObligation: { currency: "ZAR", amountMinor: 5_000_000_00 },
    lockDate: "2026-05-30",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CollateralSegregationLocked
// ---------------------------------------------------------------------------

describe("makeCollateralSegregationLocked", () => {
  it("creates a valid lock event", () => {
    const event = makeCollateralSegregationLocked({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: validLockPayload(),
    });

    expect(event.type).toBe("CollateralSegregationLocked");
    expect(event.payload.lockId).toBe("LOCK-20260530-cp1-001");
    expect(event.payload.counterpartyId).toBe(COUNTERPARTY);
    expect(event.payload.haircutDecimal).toBe(0.02);
    expect(event.payload.assetKind).toBe("govt-bond-za");
    expect(event.citations).toEqual(CITATIONS);
  });

  it("throws when citations are empty", () => {
    expect(() =>
      makeCollateralSegregationLocked({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: [],
        payload: validLockPayload(),
      }),
    ).toThrow("CollateralSegregationLocked requires at least one citation");
  });

  it("accepts manual lock with manualLockReason", () => {
    const event = makeCollateralSegregationLocked({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: validLockPayload({ lockSource: "manual", manualLockReason: "Ops override" }),
    });
    expect(event.payload.lockSource).toBe("manual");
    expect(event.payload.manualLockReason).toBe("Ops override");
  });

  it("rejects an invalid assetKind", () => {
    expect(() =>
      makeCollateralSegregationLocked({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: validLockPayload({ assetKind: "invalid-kind" }),
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// CollateralSegregationReleased
// ---------------------------------------------------------------------------

describe("makeCollateralSegregationReleased", () => {
  it("creates a valid release event", () => {
    const event = makeCollateralSegregationReleased({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        lockId: "LOCK-20260530-cp1-001",
        lockEventId: LOCK_EVENT_ID,
        counterpartyId: COUNTERPARTY,
        csaEventId: CSA_EVENT_ID,
        instrumentId: "fi:bond:ZAG000010A9",
        nominalAmount: { currency: "ZAR", amountMinor: 10_000_000_00 },
        releaseReason: "margin-returned",
        releaseDate: "2026-05-31",
        returnAmount: { currency: "ZAR", amountMinor: 9_800_000_00 },
      },
    });

    expect(event.type).toBe("CollateralSegregationReleased");
    expect(event.payload.releaseReason).toBe("margin-returned");
  });

  it("throws when citations are empty", () => {
    expect(() =>
      makeCollateralSegregationReleased({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: [],
        payload: {
          lockId: "LOCK-20260530-cp1-001",
          lockEventId: LOCK_EVENT_ID,
          counterpartyId: COUNTERPARTY,
          csaEventId: CSA_EVENT_ID,
          instrumentId: "fi:bond:ZAG000010A9",
          nominalAmount: { currency: "ZAR", amountMinor: 10_000_000_00 },
          releaseReason: "substitution-out",
          releaseDate: "2026-05-31",
          returnAmount: { currency: "ZAR", amountMinor: 0 },
        },
      }),
    ).toThrow("CollateralSegregationReleased requires at least one citation");
  });
});

// ---------------------------------------------------------------------------
// CollateralSubstitutionRequested
// ---------------------------------------------------------------------------

describe("makeCollateralSubstitutionRequested", () => {
  it("creates a valid substitution request", () => {
    const event = makeCollateralSubstitutionRequested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        substitutionId: "SUB-20260530-cp1-001",
        counterpartyId: COUNTERPARTY,
        csaEventId: CSA_EVENT_ID,
        outgoingLockId: "LOCK-20260530-cp1-001",
        outgoingInstrumentId: "fi:bond:ZAG000010A9",
        outgoingAdjustedValue: { currency: "ZAR", amountMinor: 9_800_000_00 },
        incomingInstrumentId: "fi:bond:ZAG000020A8",
        incomingAssetKind: "govt-bond-za",
        incomingNominalAmount: { currency: "ZAR", amountMinor: 10_500_000_00 },
        requestedAt: AS_OF,
      },
    });

    expect(event.type).toBe("CollateralSubstitutionRequested");
    expect(event.payload.substitutionId).toBe("SUB-20260530-cp1-001");
    expect(event.payload.incomingAssetKind).toBe("govt-bond-za");
  });
});

// ---------------------------------------------------------------------------
// CollateralSubstitutionApproved + Rejected
// ---------------------------------------------------------------------------

describe("makeCollateralSubstitutionApproved", () => {
  it("creates a valid approval event", () => {
    const newLockId = "33333333-3333-3333-3333-333333333333";
    const event = makeCollateralSubstitutionApproved({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        substitutionId: "SUB-20260530-cp1-001",
        requestEventId: "44444444-4444-4444-4444-444444444444",
        counterpartyId: COUNTERPARTY,
        csaEventId: CSA_EVENT_ID,
        incomingEligible: true,
        incomingHaircutDecimal: 0.02,
        incomingFxRateToBaseCurrency: 1.0,
        incomingAdjustedValue: { currency: "ZAR", amountMinor: 10_290_000_00 },
        valueSurplusMinor: 490_000_00,
        newLockEventId: newLockId,
        approvedAt: AS_OF,
      },
    });

    expect(event.type).toBe("CollateralSubstitutionApproved");
    expect(event.payload.incomingEligible).toBe(true);
    expect(event.payload.valueSurplusMinor).toBe(490_000_00);
  });
});

describe("makeCollateralSubstitutionRejected", () => {
  it("creates a valid rejection event for ineligible asset", () => {
    const event = makeCollateralSubstitutionRejected({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        substitutionId: "SUB-20260530-cp1-002",
        requestEventId: "55555555-5555-5555-5555-555555555555",
        counterpartyId: COUNTERPARTY,
        rejectionReason: "ineligible-asset",
        outgoingAdjustedValue: { currency: "ZAR", amountMinor: 9_800_000_00 },
        rejectionNote: "equity-index assets not on eligible schedule",
        rejectedAt: AS_OF,
      },
    });

    expect(event.type).toBe("CollateralSubstitutionRejected");
    expect(event.payload.rejectionReason).toBe("ineligible-asset");
  });

  it("creates a valid rejection event for insufficient-value with shortfall", () => {
    const event = makeCollateralSubstitutionRejected({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        substitutionId: "SUB-20260530-cp1-003",
        requestEventId: "66666666-6666-6666-6666-666666666666",
        counterpartyId: COUNTERPARTY,
        rejectionReason: "insufficient-value",
        incomingAdjustedValue: { currency: "ZAR", amountMinor: 9_000_000_00 },
        outgoingAdjustedValue: { currency: "ZAR", amountMinor: 9_800_000_00 },
        valueShortfallMinor: 800_000_00,
        rejectedAt: AS_OF,
      },
    });

    expect(event.payload.valueShortfallMinor).toBe(800_000_00);
  });
});

// ---------------------------------------------------------------------------
// CollateralSufficiencyChecked
// ---------------------------------------------------------------------------

describe("makeCollateralSufficiencyChecked", () => {
  it("creates a sufficient check event (no breach)", () => {
    const event = makeCollateralSufficiencyChecked({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        checkId: "SUFF-20260530-cp1",
        counterpartyId: COUNTERPARTY,
        checkDate: "2026-05-30",
        csaEventId: CSA_EVENT_ID,
        activeLockCount: 2,
        adjustedCollateralValue: { currency: "ZAR", amountMinor: 15_000_000_00 },
        netExposure: { currency: "ZAR", amountMinor: 12_000_000_00 },
        csaThresholdPartyB: { currency: "ZAR", amountMinor: 0 },
        marginRequirement: { currency: "ZAR", amountMinor: 12_000_000_00 },
        surplusMinor: 3_000_000_00,
        isSufficient: true,
      },
    });

    expect(event.type).toBe("CollateralSufficiencyChecked");
    expect(event.payload.isSufficient).toBe(true);
    expect(event.payload.surplusMinor).toBe(3_000_000_00);
  });

  it("creates an insufficient check event (with breachEventId)", () => {
    const breachEventId = "77777777-7777-7777-7777-777777777777";
    const event = makeCollateralSufficiencyChecked({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        checkId: "SUFF-20260530-cp2",
        counterpartyId: COUNTERPARTY,
        checkDate: "2026-05-30",
        csaEventId: CSA_EVENT_ID,
        activeLockCount: 1,
        adjustedCollateralValue: { currency: "ZAR", amountMinor: 8_000_000_00 },
        netExposure: { currency: "ZAR", amountMinor: 12_000_000_00 },
        csaThresholdPartyB: { currency: "ZAR", amountMinor: 0 },
        marginRequirement: { currency: "ZAR", amountMinor: 12_000_000_00 },
        surplusMinor: -4_000_000_00,
        isSufficient: false,
        breachEventId,
      },
    });

    expect(event.payload.isSufficient).toBe(false);
    expect(event.payload.surplusMinor).toBe(-4_000_000_00);
    expect(event.payload.breachEventId).toBe(breachEventId);
  });

  it("includes FX rates when provided", () => {
    const event = makeCollateralSufficiencyChecked({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        checkId: "SUFF-20260530-cp3",
        counterpartyId: COUNTERPARTY,
        checkDate: "2026-05-30",
        csaEventId: CSA_EVENT_ID,
        activeLockCount: 1,
        adjustedCollateralValue: { currency: "ZAR", amountMinor: 18_350_000_00 },
        netExposure: { currency: "ZAR", amountMinor: 15_000_000_00 },
        csaThresholdPartyB: { currency: "ZAR", amountMinor: 0 },
        marginRequirement: { currency: "ZAR", amountMinor: 15_000_000_00 },
        surplusMinor: 3_350_000_00,
        isSufficient: true,
        fxRatesUsed: { USD: 18.35 },
      },
    });

    expect(event.payload.fxRatesUsed).toEqual({ USD: 18.35 });
  });
});

// ---------------------------------------------------------------------------
// CollateralSegregationBreachRaised
// ---------------------------------------------------------------------------

describe("makeCollateralSegregationBreachRaised", () => {
  it("creates a sufficiency breach event", () => {
    const event = makeCollateralSegregationBreachRaised({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        breachId: "BREACH-20260530-cp1-SUFF-001",
        counterpartyId: COUNTERPARTY,
        breachKind: "sufficiency",
        severity: "material",
        csaEventId: CSA_EVENT_ID,
        adjustedCollateralValue: { currency: "ZAR", amountMinor: 8_000_000_00 },
        marginRequirement: { currency: "ZAR", amountMinor: 12_000_000_00 },
        shortfallMinor: 4_000_000_00,
        description: "Collateral sufficiency breach: ZAR 8M < margin requirement ZAR 12M.",
        remediationRequired: "Post additional collateral of ZAR 4M by T+1 settlement date.",
        remediationDeadline: "2026-05-31T09:00:00.000Z",
        requiresCroEscalation: false,
      },
    });

    expect(event.type).toBe("CollateralSegregationBreachRaised");
    expect(event.payload.breachKind).toBe("sufficiency");
    expect(event.payload.shortfallMinor).toBe(4_000_000_00);
  });

  it("creates a commingling breach event with CRO escalation", () => {
    const event = makeCollateralSegregationBreachRaised({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        breachId: "BREACH-20260530-cp1-COMMINGLING-001",
        counterpartyId: COUNTERPARTY,
        breachKind: "commingling",
        severity: "critical",
        lockId: "LOCK-20260530-cp1-001",
        description: "Commingling detected: lockId serves multiple counterparties.",
        remediationRequired: "Release lock from incorrect counterparty immediately.",
        remediationDeadline: "2026-05-30T17:00:00.000Z",
        requiresCroEscalation: true,
        croEscalationTarget: "Helena (Chief Risk Officer, risk)",
      },
    });

    expect(event.payload.breachKind).toBe("commingling");
    expect(event.payload.severity).toBe("critical");
    expect(event.payload.requiresCroEscalation).toBe(true);
    expect(event.payload.croEscalationTarget).toBe("Helena (Chief Risk Officer, risk)");
  });

  it("throws when citations are empty", () => {
    expect(() =>
      makeCollateralSegregationBreachRaised({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: [],
        payload: {
          breachId: "B-001",
          counterpartyId: COUNTERPARTY,
          breachKind: "sufficiency",
          severity: "material",
          description: "test",
          remediationRequired: "fix it",
          remediationDeadline: "2026-05-31T09:00:00.000Z",
          requiresCroEscalation: false,
        },
      }),
    ).toThrow("CollateralSegregationBreachRaised requires at least one citation");
  });
});

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

describe("computeAdjustedCollateralValue", () => {
  it("applies haircut and FX rate correctly", () => {
    // ZAR 10M bond, 2% haircut, ZAR base → ZAR 9.8M
    const result = computeAdjustedCollateralValue(10_000_000_00, 0.02, 1.0);
    expect(result).toBe(9_800_000_00);
  });

  it("applies FX conversion for non-base currency (USD→ZAR)", () => {
    // USD 1M: 100_000_000 minor units (1M × 100 cents/dollar)
    // 0% haircut, FX rate 18.35 → ZAR 18.35M = 1_835_000_000 ZAR cents
    const result = computeAdjustedCollateralValue(100_000_000, 0.0, 18.35);
    // 100_000_000 × 1.0 × 18.35 = 1_835_000_000
    expect(result).toBe(1_835_000_000);
  });

  it("combines haircut + FX (USD bond, 2% haircut, rate 18.35)", () => {
    // USD 1M: 100_000_000 minor units; 2% haircut; FX 18.35 → ZAR ~17.983M
    const nominal = 100_000_000;
    const result = computeAdjustedCollateralValue(nominal, 0.02, 18.35);
    expect(result).toBe(Math.floor(nominal * 0.98 * 18.35));
  });

  it("returns 0 for 100% haircut", () => {
    expect(computeAdjustedCollateralValue(1_000_000_00, 1.0, 1.0)).toBe(0);
  });
});

describe("computeMarginRequirement", () => {
  it("returns exposure minus threshold when positive", () => {
    // exposure ZAR 12M, threshold ZAR 1M → margin req ZAR 11M
    expect(computeMarginRequirement(12_000_000_00, 1_000_000_00)).toBe(11_000_000_00);
  });

  it("returns 0 when exposure ≤ threshold", () => {
    expect(computeMarginRequirement(5_000_000_00, 10_000_000_00)).toBe(0);
  });

  it("returns full exposure when threshold is 0 (VM CSA rule)", () => {
    expect(computeMarginRequirement(12_000_000_00, 0)).toBe(12_000_000_00);
  });

  it("returns 0 for zero exposure", () => {
    expect(computeMarginRequirement(0, 0)).toBe(0);
  });
});

describe("computeBreachRemediationDeadline", () => {
  const anchor = "2026-05-30T09:00:00.000Z";

  it("returns same-day deadline for commingling (T+0)", () => {
    const deadline = computeBreachRemediationDeadline("commingling", anchor);
    const deadlineDate = new Date(deadline).toISOString().slice(0, 10);
    expect(deadlineDate).toBe("2026-05-30");
  });

  it("returns T+1 for sufficiency breach", () => {
    const deadline = computeBreachRemediationDeadline("sufficiency", anchor);
    const deadlineDate = new Date(deadline).toISOString().slice(0, 10);
    expect(deadlineDate).toBe("2026-05-31");
  });

  it("returns ~T+9 calendar days for ineligible breach (approx 5 business days)", () => {
    const deadline = computeBreachRemediationDeadline("ineligible", anchor);
    const anchorMs = new Date(anchor).getTime();
    const deadlineMs = new Date(deadline).getTime();
    const calDays = (deadlineMs - anchorMs) / 86_400_000;
    expect(calDays).toBe(9);
  });

  it("returns T+1 for lock-missing breach", () => {
    const deadline = computeBreachRemediationDeadline("lock-missing", anchor);
    const deadlineDate = new Date(deadline).toISOString().slice(0, 10);
    expect(deadlineDate).toBe("2026-05-31");
  });
});
