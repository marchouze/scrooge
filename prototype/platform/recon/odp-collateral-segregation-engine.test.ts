// platform/recon/odp-collateral-segregation-engine.test.ts
//
// Tests for the ODP Collateral Segregation Enforcement Engine.
//
// Authority: ORG-ODP-COND-010; urn:regulation:odp:cs-2-2018 §12.
// Author: Devon (COO, operations)

import { describe, expect, it } from "bun:test";

import type { EligibleCollateralItem } from "../event-store/event-types/isda-schedule-csa";
import {
  type ActiveLock,
  type CsaState,
  buildComminglingBreachPayload,
  buildMissingLockBreachPayload,
  checkCommingling,
  foldActiveLocks,
  foldCsaState,
  resolveFxRate,
  runSufficiencyCheck,
  validateSubstitution,
} from "./odp-collateral-segregation-engine";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const COUNTERPARTY_A = "party:lei:COUNTERPARTYA01";
const COUNTERPARTY_B = "party:lei:COUNTERPARTYB02";
const CSA_EVENT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CSA_EVENT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function makeMinimalCsaEvent(counterpartyId: string, eventId: string, asOf: string) {
  return {
    event_id: eventId,
    type: "IsdaCsaElected",
    as_of: asOf,
    payload: {
      counterpartyId,
      baseCurrency: "ZAR",
      thresholdPartyA: { currency: "ZAR", amountMinor: 0 },
      thresholdPartyB: { currency: "ZAR", amountMinor: 0 },
      mtaPartyA: { currency: "ZAR", amountMinor: 50_000_00 },
      mtaPartyB: { currency: "ZAR", amountMinor: 50_000_00 },
      eligibleCollateralPartyA: [
        { category: "govt-bond-za", haircutDecimal: 0.02 },
        { category: "cash-ccy", haircutDecimal: 0.0, currency: "ZAR" },
      ],
      eligibleCollateralPartyB: [
        { category: "govt-bond-za", haircutDecimal: 0.02 },
        { category: "cash-ccy", haircutDecimal: 0.0, currency: "ZAR" },
        { category: "govt-bond-g10", haircutDecimal: 0.04 },
      ],
      imSegregationRequired: false,
    },
  };
}

function makeLockEvent(
  lockId: string,
  counterpartyId: string,
  csaEventId: string,
  nominalMinor: number,
  haircutDecimal: number,
  fxRate: number,
  adjustedMinor: number,
  baseCurrency = "ZAR",
  nominalCurrency = "ZAR",
) {
  return {
    event_id: `lock-event-${lockId}`,
    type: "CollateralSegregationLocked",
    as_of: "2026-05-30T09:00:00.000Z",
    payload: {
      lockId,
      counterpartyId,
      csaEventId,
      instrumentId: `fi:bond:${lockId}`,
      assetKind: "govt-bond-za",
      nominalAmount: { currency: nominalCurrency, amountMinor: nominalMinor },
      haircutDecimal,
      fxRateToBaseCurrency: fxRate,
      adjustedValueBaseCurrency: { currency: baseCurrency, amountMinor: adjustedMinor },
      lockSource: "auto-csa",
      marginObligation: { currency: baseCurrency, amountMinor: 0 },
      lockDate: "2026-05-30",
    },
  };
}

function makeReleaseEvent(lockId: string) {
  return {
    event_id: `release-event-${lockId}`,
    type: "CollateralSegregationReleased",
    as_of: "2026-05-31T09:00:00.000Z",
    payload: {
      lockId,
      lockEventId: `lock-event-${lockId}`,
      counterpartyId: COUNTERPARTY_A,
      csaEventId: CSA_EVENT_A,
      instrumentId: `fi:bond:${lockId}`,
      nominalAmount: { currency: "ZAR", amountMinor: 10_000_000_00 },
      releaseReason: "margin-returned",
      releaseDate: "2026-05-31",
      returnAmount: { currency: "ZAR", amountMinor: 9_800_000_00 },
    },
  };
}

const ELIGIBLE_COLLATERAL_PARTY_B: EligibleCollateralItem[] = [
  { category: "govt-bond-za", haircutDecimal: 0.02 },
  { category: "cash-ccy", haircutDecimal: 0.0, currency: "ZAR" },
  { category: "govt-bond-g10", haircutDecimal: 0.04 },
];

function makeCsaState(counterpartyId: string, overrides: Partial<CsaState> = {}): CsaState {
  return {
    csaEventId: CSA_EVENT_A,
    counterpartyId,
    baseCurrency: "ZAR",
    thresholdPartyAMinor: 0,
    thresholdPartyBMinor: 0,
    mtaPartyAMinor: 50_000_00,
    mtaPartyBMinor: 50_000_00,
    eligibleCollateralPartyA: [
      { category: "govt-bond-za", haircutDecimal: 0.02 },
      { category: "cash-ccy", haircutDecimal: 0.0, currency: "ZAR" },
    ],
    eligibleCollateralPartyB: ELIGIBLE_COLLATERAL_PARTY_B,
    imSegregationRequired: false,
    ...overrides,
  };
}

function makeActiveLock(
  lockId: string,
  counterpartyId: string,
  nominalMinor: number,
  haircutDecimal: number,
  fxRate: number,
  adjustedMinor: number,
  nominalCurrency = "ZAR",
): ActiveLock {
  return {
    lockId,
    lockEventId: `lock-event-${lockId}`,
    counterpartyId,
    csaEventId: CSA_EVENT_A,
    instrumentId: `fi:bond:${lockId}`,
    assetKind: "govt-bond-za",
    nominalAmountMinor: nominalMinor,
    nominalCurrency,
    haircutDecimal,
    fxRateToBaseCurrency: fxRate,
    adjustedValueBaseCurrencyMinor: adjustedMinor,
    baseCurrency: "ZAR",
  };
}

// ---------------------------------------------------------------------------
// foldCsaState
// ---------------------------------------------------------------------------

describe("foldCsaState", () => {
  it("folds a single IsdaCsaElected event", () => {
    const events = [makeMinimalCsaEvent(COUNTERPARTY_A, CSA_EVENT_A, "2026-05-30T09:00:00.000Z")];
    const result = foldCsaState(events, []);
    expect(result.size).toBe(1);

    const state = result.get(COUNTERPARTY_A);
    expect(state).toBeDefined();
    expect(state?.csaEventId).toBe(CSA_EVENT_A);
    expect(state?.baseCurrency).toBe("ZAR");
    expect(state?.thresholdPartyBMinor).toBe(0);
  });

  it("keeps only the most-recent event when multiple events exist for the same counterparty", () => {
    const events = [
      makeMinimalCsaEvent(COUNTERPARTY_A, "old-csa-id", "2026-05-01T09:00:00.000Z"),
      makeMinimalCsaEvent(COUNTERPARTY_A, CSA_EVENT_A, "2026-05-30T09:00:00.000Z"),
    ];
    const result = foldCsaState(events, []);
    expect(result.get(COUNTERPARTY_A)?.csaEventId).toBe(CSA_EVENT_A);
  });

  it("excludes superseded CSA events", () => {
    const events = [makeMinimalCsaEvent(COUNTERPARTY_A, CSA_EVENT_A, "2026-05-30T09:00:00.000Z")];
    const superseded = [
      {
        event_id: "sup-001",
        type: "IsdaCsaSuperseded",
        as_of: "2026-05-31T09:00:00.000Z",
        payload: { supersedesEventId: CSA_EVENT_A },
      },
    ];
    const result = foldCsaState(events, superseded);
    expect(result.size).toBe(0);
  });

  it("handles two different counterparties independently", () => {
    const events = [
      makeMinimalCsaEvent(COUNTERPARTY_A, CSA_EVENT_A, "2026-05-30T09:00:00.000Z"),
      makeMinimalCsaEvent(COUNTERPARTY_B, CSA_EVENT_B, "2026-05-30T09:00:00.000Z"),
    ];
    const result = foldCsaState(events, []);
    expect(result.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// foldActiveLocks
// ---------------------------------------------------------------------------

describe("foldActiveLocks", () => {
  it("returns active locks (none released)", () => {
    const locks = [
      makeLockEvent("L-001", COUNTERPARTY_A, CSA_EVENT_A, 10_000_000_00, 0.02, 1.0, 9_800_000_00),
      makeLockEvent("L-002", COUNTERPARTY_A, CSA_EVENT_A, 5_000_000_00, 0.02, 1.0, 4_900_000_00),
    ];
    const result = foldActiveLocks(locks, [], []);
    expect(result.size).toBe(2);
    expect(result.has("L-001")).toBe(true);
    expect(result.has("L-002")).toBe(true);
  });

  it("excludes released locks", () => {
    const locks = [
      makeLockEvent("L-001", COUNTERPARTY_A, CSA_EVENT_A, 10_000_000_00, 0.02, 1.0, 9_800_000_00),
      makeLockEvent("L-002", COUNTERPARTY_A, CSA_EVENT_A, 5_000_000_00, 0.02, 1.0, 4_900_000_00),
    ];
    const releases = [makeReleaseEvent("L-001")];
    const result = foldActiveLocks(locks, releases, []);
    expect(result.size).toBe(1);
    expect(result.has("L-001")).toBe(false);
    expect(result.has("L-002")).toBe(true);
  });

  it("returns empty map when all locks are released", () => {
    const locks = [
      makeLockEvent("L-001", COUNTERPARTY_A, CSA_EVENT_A, 10_000_000_00, 0.02, 1.0, 9_800_000_00),
    ];
    const result = foldActiveLocks(locks, [makeReleaseEvent("L-001")], []);
    expect(result.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// checkCommingling
// ---------------------------------------------------------------------------

describe("checkCommingling", () => {
  it("passes with no locks", () => {
    const violations = checkCommingling(new Map());
    expect(violations).toHaveLength(0);
  });

  it("passes when each lock serves a unique counterparty", () => {
    const locks = new Map<string, ActiveLock>([
      ["L-001", makeActiveLock("L-001", COUNTERPARTY_A, 10_000_000_00, 0.02, 1.0, 9_800_000_00)],
      ["L-002", makeActiveLock("L-002", COUNTERPARTY_B, 5_000_000_00, 0.02, 1.0, 4_900_000_00)],
    ]);
    const violations = checkCommingling(locks);
    expect(violations).toHaveLength(0);
  });

  it("detects commingling when the same lockId serves two counterparties", () => {
    // Duplicate lockId intentionally serving two different counterparties
    const lockA = makeActiveLock("L-001", COUNTERPARTY_A, 10_000_000_00, 0.02, 1.0, 9_800_000_00);
    const lockACopy = {
      ...lockA,
      counterpartyId: COUNTERPARTY_B,
      lockEventId: "lock-event-L-001b",
    };
    // checkCommingling groups by lockId (not map key), so inject both under "L-001"
    const locksWithDup: Map<string, ActiveLock> = new Map([
      ["L-001", { ...lockA }],
      ["L-001-dup", { ...lockACopy, lockId: "L-001" }], // same lockId as L-001
    ]);
    const violations = checkCommingling(locksWithDup);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.at(0)?.lockId).toBe("L-001");
    expect(violations.at(0)?.description).toContain("Commingling detected");
  });
});

// ---------------------------------------------------------------------------
// resolveFxRate
// ---------------------------------------------------------------------------

describe("resolveFxRate", () => {
  it("returns 1.0 when currency equals baseCurrency", () => {
    expect(resolveFxRate("ZAR", "ZAR", {})).toBe(1.0);
  });

  it("returns the rate from the map when present", () => {
    expect(resolveFxRate("USD", "ZAR", { USD: 18.35 })).toBe(18.35);
  });

  it("throws when rate is missing for non-base currency", () => {
    expect(() => resolveFxRate("EUR", "ZAR", {})).toThrow("FX rate missing");
  });

  it("throws when rate is 0 (invalid)", () => {
    expect(() => resolveFxRate("EUR", "ZAR", { EUR: 0 })).toThrow("FX rate missing");
  });
});

// ---------------------------------------------------------------------------
// runSufficiencyCheck
// ---------------------------------------------------------------------------

describe("runSufficiencyCheck", () => {
  const csaState = makeCsaState(COUNTERPARTY_A);
  const checkDate = "2026-05-30";
  const now = "2026-05-30T09:00:00.000Z";

  it("returns sufficient when collateral covers margin requirement", () => {
    const locks = [
      makeActiveLock("L-001", COUNTERPARTY_A, 15_000_000_00, 0.02, 1.0, 14_700_000_00),
    ];
    const result = runSufficiencyCheck({
      counterpartyId: COUNTERPARTY_A,
      csaState,
      activeLocks: locks,
      netExposureMinor: 12_000_000_00,
      fxRates: {},
      checkDate,
      now,
    });

    expect(result.isSufficient).toBe(true);
    // adjustedValue = 15M × 0.98 = 14.7M; marginReq = 12M − 0 = 12M; surplus = 2.7M
    expect(result.adjustedCollateralValueMinor).toBe(14_700_000_00);
    expect(result.marginRequirementMinor).toBe(12_000_000_00);
    expect(result.surplusMinor).toBe(2_700_000_00);
    expect(result.breach).toBeUndefined();
  });

  it("returns insufficient when collateral is below margin requirement", () => {
    const locks = [makeActiveLock("L-001", COUNTERPARTY_A, 8_000_000_00, 0.02, 1.0, 7_840_000_00)];
    const result = runSufficiencyCheck({
      counterpartyId: COUNTERPARTY_A,
      csaState,
      activeLocks: locks,
      netExposureMinor: 12_000_000_00,
      fxRates: {},
      checkDate,
      now,
    });

    expect(result.isSufficient).toBe(false);
    expect(result.surplusMinor).toBeLessThan(0);
    expect(result.breach).toBeDefined();
    expect(result.breach?.breachKind).toBe("sufficiency");
  });

  it("applies FX rates for non-ZAR collateral (USD bonds)", () => {
    // USD 1M bond at FX 18.35, 2% haircut → ZAR 17.983M adjusted
    const usdNominal = 1_000_000_00; // USD 1M in minor units (cents)
    const fxRate = 18.35;
    const haircut = 0.02;
    const expectedAdjusted = Math.floor(usdNominal * (1 - haircut) * fxRate);

    const locks = [
      makeActiveLock("L-USD", COUNTERPARTY_A, usdNominal, haircut, fxRate, expectedAdjusted, "USD"),
    ];
    const result = runSufficiencyCheck({
      counterpartyId: COUNTERPARTY_A,
      csaState,
      activeLocks: locks,
      netExposureMinor: 10_000_000_00,
      fxRates: { USD: fxRate },
      checkDate,
      now,
    });

    expect(result.isSufficient).toBe(true);
    expect(result.adjustedCollateralValueMinor).toBe(expectedAdjusted);
    expect(result.fxRatesUsed).toEqual({ USD: fxRate });
  });

  it("reports no locks as a breach when margin requirement is positive", () => {
    const result = runSufficiencyCheck({
      counterpartyId: COUNTERPARTY_A,
      csaState,
      activeLocks: [],
      netExposureMinor: 5_000_000_00,
      fxRates: {},
      checkDate,
      now,
    });

    expect(result.activeLockCount).toBe(0);
    expect(result.isSufficient).toBe(false);
    expect(result.breach).toBeDefined();
  });

  it("returns sufficient when exposure is below threshold (no margin required)", () => {
    const csaWithThreshold = makeCsaState(COUNTERPARTY_A, {
      thresholdPartyBMinor: 10_000_000_00, // ZAR 10M threshold
    });
    const result = runSufficiencyCheck({
      counterpartyId: COUNTERPARTY_A,
      csaState: csaWithThreshold,
      activeLocks: [],
      netExposureMinor: 5_000_000_00, // below threshold
      fxRates: {},
      checkDate,
      now,
    });

    // marginReq = max(0, 5M − 10M) = 0; surplus = 0 − 0 = 0 → sufficient
    expect(result.isSufficient).toBe(true);
    expect(result.marginRequirementMinor).toBe(0);
  });

  it("includes FX rates used in event payload", () => {
    // 100M USD cents × 18.35 = 1_835_000_000 ZAR cents (no haircut)
    const usdNominal = 100_000_000;
    const usdAdjusted = Math.floor(usdNominal * 1.0 * 18.35); // = 1_835_000_000
    const usdLock = makeActiveLock(
      "L-USD",
      COUNTERPARTY_A,
      usdNominal,
      0.0,
      18.35,
      usdAdjusted,
      "USD",
    );
    const result = runSufficiencyCheck({
      counterpartyId: COUNTERPARTY_A,
      csaState,
      activeLocks: [usdLock],
      netExposureMinor: 5_000_000_00,
      fxRates: { USD: 18.35 },
      checkDate,
      now,
    });

    expect(result.eventPayload.fxRatesUsed).toEqual({ USD: 18.35 });
  });

  it("generates correct checkId", () => {
    const result = runSufficiencyCheck({
      counterpartyId: COUNTERPARTY_A,
      csaState,
      activeLocks: [],
      netExposureMinor: 0,
      fxRates: {},
      checkDate: "2026-05-30",
      now,
    });
    expect(result.checkId).toBe(`SUFF-20260530-${COUNTERPARTY_A}`);
  });
});

// ---------------------------------------------------------------------------
// validateSubstitution
// ---------------------------------------------------------------------------

describe("validateSubstitution", () => {
  const csaState = makeCsaState(COUNTERPARTY_A);
  const fxRates = { USD: 18.35 };

  it("approves a valid same-currency substitution (govt-bond-za → govt-bond-za)", () => {
    const result = validateSubstitution({
      csaState,
      incomingAssetKind: "govt-bond-za",
      incomingNominalAmountMinor: 11_000_000_00,
      incomingCurrency: "ZAR",
      outgoingAdjustedValueMinor: 9_800_000_00,
      fxRates,
      requestedAt: "2026-05-30T10:00:00.000Z",
      csaValuationTime: "12:00 Johannesburg",
    });

    expect(result.valid).toBe(true);
    expect(result.incomingHaircutDecimal).toBe(0.02);
    // 11M × 0.98 = 10.78M
    expect(result.incomingAdjustedValueMinor).toBe(10_780_000_00);
    expect(result.valueSurplusMinor).toBe(10_780_000_00 - 9_800_000_00);
  });

  it("rejects a substitution with an ineligible asset kind", () => {
    const result = validateSubstitution({
      csaState,
      incomingAssetKind: "equity-index", // not on eligible schedule
      incomingNominalAmountMinor: 15_000_000_00,
      incomingCurrency: "ZAR",
      outgoingAdjustedValueMinor: 9_800_000_00,
      fxRates,
      requestedAt: "2026-05-30T10:00:00.000Z",
      csaValuationTime: "12:00 Johannesburg",
    });

    expect(result.valid).toBe(false);
    expect(result.rejectionReason).toBe("ineligible-asset");
  });

  it("rejects a substitution where incoming value < outgoing value", () => {
    // incoming: 9M × 0.98 = 8.82M < outgoing 9.8M
    const result = validateSubstitution({
      csaState,
      incomingAssetKind: "govt-bond-za",
      incomingNominalAmountMinor: 9_000_000_00,
      incomingCurrency: "ZAR",
      outgoingAdjustedValueMinor: 9_800_000_00,
      fxRates,
      requestedAt: "2026-05-30T10:00:00.000Z",
      csaValuationTime: "12:00 Johannesburg",
    });

    expect(result.valid).toBe(false);
    expect(result.rejectionReason).toBe("insufficient-value");
    expect(result.valueSurplusMinor).toBeLessThan(0);
  });

  it("approves a G10 government bond substitution with FX conversion", () => {
    // USD 600k bond, 4% haircut, FX 18.35 → ZAR ~10.58M; outgoing 9.8M
    const usdNominal = 600_000_00; // USD 600k in minor units
    const result = validateSubstitution({
      csaState,
      incomingAssetKind: "govt-bond-g10",
      incomingNominalAmountMinor: usdNominal,
      incomingCurrency: "USD",
      outgoingAdjustedValueMinor: 9_800_000_00,
      fxRates,
      requestedAt: "2026-05-30T10:00:00.000Z",
      csaValuationTime: "12:00 Johannesburg",
    });

    // 600_000_00 × 0.96 × 18.35 = floor(10,580,400_00) → let engine compute
    const expected = Math.floor(usdNominal * (1 - 0.04) * 18.35);
    expect(result.valid).toBe(true);
    expect(result.incomingAdjustedValueMinor).toBe(expected);
    expect(result.incomingHaircutDecimal).toBe(0.04);
    expect(result.incomingFxRate).toBe(18.35);
  });

  it("rejects when FX rate is missing for non-base-currency incoming asset", () => {
    const result = validateSubstitution({
      csaState,
      incomingAssetKind: "govt-bond-g10",
      incomingNominalAmountMinor: 1_000_000_00,
      incomingCurrency: "EUR", // no EUR rate in fxRates
      outgoingAdjustedValueMinor: 9_800_000_00,
      fxRates, // only has USD
      requestedAt: "2026-05-30T10:00:00.000Z",
      csaValuationTime: "12:00 Johannesburg",
    });

    expect(result.valid).toBe(false);
    expect(result.rejectionReason).toBe("ineligible-asset"); // FX missing → ineligible
  });

  it("approves cash substitution (0% haircut)", () => {
    const result = validateSubstitution({
      csaState,
      incomingAssetKind: "cash-ccy",
      incomingNominalAmountMinor: 10_000_000_00,
      incomingCurrency: "ZAR",
      outgoingAdjustedValueMinor: 9_800_000_00,
      fxRates,
      requestedAt: "2026-05-30T10:00:00.000Z",
      csaValuationTime: "12:00 Johannesburg",
    });

    expect(result.valid).toBe(true);
    expect(result.incomingHaircutDecimal).toBe(0.0);
    expect(result.incomingAdjustedValueMinor).toBe(10_000_000_00); // no haircut
  });
});

// ---------------------------------------------------------------------------
// buildComminglingBreachPayload
// ---------------------------------------------------------------------------

describe("buildComminglingBreachPayload", () => {
  it("builds a critical commingling breach with CRO escalation", () => {
    const violation = {
      lockId: "L-001",
      lockEventId: "lock-event-L-001",
      lockedCounterpartyId: COUNTERPARTY_A,
      description: "Commingling: L-001 serves COUNTERPARTY_A and COUNTERPARTY_B",
    };
    const payload = buildComminglingBreachPayload(violation, "2026-05-30T09:00:00.000Z");

    expect(payload.breachKind).toBe("commingling");
    expect(payload.severity).toBe("critical");
    expect(payload.requiresCroEscalation).toBe(true);
    expect(payload.croEscalationTarget).toContain("Helena");
    expect(payload.lockId).toBe("L-001");
  });

  it("sets same-day remediation deadline for commingling", () => {
    const now = "2026-05-30T09:00:00.000Z";
    const payload = buildComminglingBreachPayload(
      {
        lockId: "L-001",
        lockEventId: "lock-event-L-001",
        lockedCounterpartyId: COUNTERPARTY_A,
        description: "test",
      },
      now,
    );
    const deadlineDate = new Date(payload.remediationDeadline).toISOString().slice(0, 10);
    expect(deadlineDate).toBe("2026-05-30"); // same day
  });
});

// ---------------------------------------------------------------------------
// buildMissingLockBreachPayload
// ---------------------------------------------------------------------------

describe("buildMissingLockBreachPayload", () => {
  it("builds a material missing-lock breach", () => {
    const payload = buildMissingLockBreachPayload(
      COUNTERPARTY_A,
      CSA_EVENT_A,
      5_000_000_00,
      "ZAR",
      "2026-05-30T09:00:00.000Z",
    );

    expect(payload.breachKind).toBe("lock-missing");
    expect(payload.severity).toBe("material");
    expect(payload.description).toContain("no CollateralSegregationLocked event covers");
    expect(payload.counterpartyId).toBe(COUNTERPARTY_A);
    expect(payload.csaEventId).toBe(CSA_EVENT_A);
  });
});
