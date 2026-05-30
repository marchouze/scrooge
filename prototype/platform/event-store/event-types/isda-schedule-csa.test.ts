// platform/event-store/event-types/isda-schedule-csa.test.ts
//
// Tests for WS-ODP-ISDA-ANNEXURES Slice 1 — ISDA Schedule and CSA election events.
//
// Covers: IsdaScheduleElected, IsdaCsaElected, IsdaCsaSuperseded.
//
// Authority:
//   ORG-ODP-COND-005; urn:regulation:odp:cs-2-2018 §§ 3, 7, 14;
//   ISDA 2002 MA; ISDA 1994/2016 VM CSA.
//
// Author: Imani (General Counsel, legal)

import { describe, expect, it } from "bun:test";

import {
  type EligibleCollateralItem,
  type IsdaCsaElectedPayload,
  type IsdaCsaSupersededPayload,
  type IsdaScheduleElectedPayload,
  isdaCsaElectedPayloadSchema,
  isdaCsaSupersededPayloadSchema,
  isdaScheduleElectedPayloadSchema,
  makeIsdaCsaElected,
  makeIsdaCsaSuperseded,
  makeIsdaScheduleElected,
} from "./isda-schedule-csa";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const ACTOR = { type: "system" as const, id: "imani:test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["ORG-ODP-COND-005", "urn:regulation:odp:cs-2-2018"];
const AS_OF = "2026-05-30T09:00:00Z";
const SCHEDULE_EVENT_ID = "550e8400-e29b-41d4-a716-446655440000";
const CSA_EVENT_ID = "550e8400-e29b-41d4-a716-446655440001";

const BASE_SCHEDULE_PAYLOAD: IsdaScheduleElectedPayload = {
  counterpartyId: "party:lei:LEI123456789012345678",
  counterpartyName: "Test Bank ZA Limited",
  isdaFormVersion: "2002",
  executionDate: "2026-05-30",
  scheduleDatedDate: "2026-05-30",
  governingLaw: "English",
  disputeResolutionJurisdiction: "England and Wales",
  terminationCurrency: "ZAR",
  crossDefaultPartyA: {
    obligationType: "Specified-Indebtedness",
    threshold: { currency: "ZAR", amountMinor: 50_000_000_00 }, // ZAR 50m in cents
  },
  crossDefaultPartyB: {
    obligationType: "Specified-Indebtedness",
    threshold: { currency: "ZAR", amountMinor: 50_000_000_00 },
  },
  creditEventOnMergerPartyA: false,
  creditEventOnMergerPartyB: false,
  automaticEarlyTerminationPartyA: false,
  automaticEarlyTerminationPartyB: false,
  calculationAgent: "Party-A",
  closeOutNettingElected: true,
  replacesScheduleId: null,
};

const ELIGIBLE_COLLATERAL_CASH: EligibleCollateralItem = {
  category: "cash-ccy",
  currency: "ZAR",
  haircutDecimal: 0.0,
};

const ELIGIBLE_COLLATERAL_SAGB: EligibleCollateralItem = {
  category: "govt-bond-za",
  haircutDecimal: 0.02,
};

const BASE_CSA_PAYLOAD: IsdaCsaElectedPayload = {
  counterpartyId: "party:lei:LEI123456789012345678",
  csaFormType: "2016-VM",
  executionDate: "2026-05-30",
  baseCurrency: "ZAR",
  thresholdPartyA: { currency: "ZAR", amountMinor: 0 },
  thresholdPartyB: { currency: "ZAR", amountMinor: 0 },
  mtaPartyA: { currency: "ZAR", amountMinor: 50_000_00 }, // ZAR 500k
  mtaPartyB: { currency: "ZAR", amountMinor: 50_000_00 },
  independentAmountPartyA: { currency: "ZAR", amountMinor: 0 },
  independentAmountPartyB: { currency: "ZAR", amountMinor: 0 },
  perCurrencyThresholds: [],
  eligibleCollateralPartyA: [ELIGIBLE_COLLATERAL_CASH, ELIGIBLE_COLLATERAL_SAGB],
  eligibleCollateralPartyB: [ELIGIBLE_COLLATERAL_CASH, ELIGIBLE_COLLATERAL_SAGB],
  valuationAgent: "Party-A",
  valuationTime: "12:00 London",
  notificationTime: "10:00 Johannesburg",
  settlementDayCount: 1,
  imSegregationRequired: false,
  ownImSegregated: false,
  replacesCsaId: null,
  linkedScheduleEventId: SCHEDULE_EVENT_ID,
};

// ---------------------------------------------------------------------------
// IsdaScheduleElectedPayload — schema tests
// ---------------------------------------------------------------------------

describe("IsdaScheduleElectedPayload schema", () => {
  it("1. accepts a full valid payload", () => {
    const result = isdaScheduleElectedPayloadSchema.safeParse(BASE_SCHEDULE_PAYLOAD);
    expect(result.success).toBe(true);
  });

  it("2. accepts null crossDefault (no cross-default elected)", () => {
    const payload = {
      ...BASE_SCHEDULE_PAYLOAD,
      crossDefaultPartyA: null,
      crossDefaultPartyB: null,
    };
    const result = isdaScheduleElectedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.crossDefaultPartyA).toBeNull();
    }
  });

  it("3. rejects invalid termination currency (lowercase)", () => {
    const payload = { ...BASE_SCHEDULE_PAYLOAD, terminationCurrency: "zar" };
    const result = isdaScheduleElectedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("4. rejects invalid termination currency (4-letter code)", () => {
    const payload = { ...BASE_SCHEDULE_PAYLOAD, terminationCurrency: "ZARR" };
    const result = isdaScheduleElectedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("5. accepts third-party calculation agent", () => {
    const payload = {
      ...BASE_SCHEDULE_PAYLOAD,
      calculationAgent: { thirdParty: "STANDARD BANK LIMITED" },
    };
    const result = isdaScheduleElectedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.calculationAgent).toEqual({
        thirdParty: "STANDARD BANK LIMITED",
      });
    }
  });

  it("6. accepts a valid replacesScheduleId UUID", () => {
    const payload = {
      ...BASE_SCHEDULE_PAYLOAD,
      replacesScheduleId: "550e8400-e29b-41d4-a716-446655440099",
    };
    const result = isdaScheduleElectedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("7. rejects invalid ISDA form version", () => {
    const payload = { ...BASE_SCHEDULE_PAYLOAD, isdaFormVersion: "2001" as never };
    const result = isdaScheduleElectedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("8. rejects invalid governing law", () => {
    const payload = { ...BASE_SCHEDULE_PAYLOAD, governingLaw: "Swiss" as never };
    const result = isdaScheduleElectedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// makeIsdaScheduleElected factory
// ---------------------------------------------------------------------------

describe("makeIsdaScheduleElected factory", () => {
  it("A. produces a valid event envelope", () => {
    const event = makeIsdaScheduleElected({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: BASE_SCHEDULE_PAYLOAD,
      eventId: SCHEDULE_EVENT_ID,
    });
    expect(event.type).toBe("IsdaScheduleElected");
    expect(event.entity).toBe(ENTITY);
    expect(event.citations).toEqual(CITATIONS);
    expect(event.event_id).toBe(SCHEDULE_EVENT_ID);
  });

  it("B. throws when citations is empty (Principle 2)", () => {
    expect(() =>
      makeIsdaScheduleElected({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: [],
        payload: BASE_SCHEDULE_PAYLOAD,
      }),
    ).toThrow("IsdaScheduleElected requires at least one citation");
  });
});

// ---------------------------------------------------------------------------
// IsdaCsaElectedPayload — schema tests
// ---------------------------------------------------------------------------

describe("IsdaCsaElectedPayload schema", () => {
  it("1. accepts a full valid payload", () => {
    const result = isdaCsaElectedPayloadSchema.safeParse(BASE_CSA_PAYLOAD);
    expect(result.success).toBe(true);
  });

  it("2. accepts per-currency threshold override", () => {
    const payload: IsdaCsaElectedPayload = {
      ...BASE_CSA_PAYLOAD,
      perCurrencyThresholds: [
        {
          currency: "USD",
          thresholdPartyA: { currency: "USD", amountMinor: 0 },
          thresholdPartyB: { currency: "USD", amountMinor: 0 },
          mtaPartyA: { currency: "USD", amountMinor: 50_000_00 },
          mtaPartyB: { currency: "USD", amountMinor: 50_000_00 },
        },
      ],
    };
    const result = isdaCsaElectedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.perCurrencyThresholds).toHaveLength(1);
      expect(result.data.perCurrencyThresholds[0]?.currency).toBe("USD");
    }
  });

  it("3. accepts zero-threshold CSA (ODP VM-CSA requirement)", () => {
    const result = isdaCsaElectedPayloadSchema.safeParse(BASE_CSA_PAYLOAD);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.thresholdPartyA.amountMinor).toBe(0);
      expect(result.data.thresholdPartyB.amountMinor).toBe(0);
    }
  });

  it("4. eligible collateral haircut must be between 0 and 1", () => {
    const badCollateral: EligibleCollateralItem = {
      category: "govt-bond-za",
      haircutDecimal: 1.5, // > 1 is invalid
    };
    const payload = {
      ...BASE_CSA_PAYLOAD,
      eligibleCollateralPartyA: [badCollateral],
    };
    const result = isdaCsaElectedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("5. accepts Both as valuation agent", () => {
    const payload = { ...BASE_CSA_PAYLOAD, valuationAgent: "Both" as const };
    const result = isdaCsaElectedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("6. accepts third-party valuation agent", () => {
    const payload = {
      ...BASE_CSA_PAYLOAD,
      valuationAgent: { thirdParty: "ABSA BANK LIMITED" },
    };
    const result = isdaCsaElectedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("7. rejects invalid base currency (lowercase)", () => {
    const payload = { ...BASE_CSA_PAYLOAD, baseCurrency: "zar" };
    const result = isdaCsaElectedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("8. rejects invalid CSA form type", () => {
    const payload = { ...BASE_CSA_PAYLOAD, csaFormType: "2020-VM" as never };
    const result = isdaCsaElectedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("9. rejects settlement day count > 5", () => {
    const payload = { ...BASE_CSA_PAYLOAD, settlementDayCount: 6 };
    const result = isdaCsaElectedPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// makeIsdaCsaElected factory
// ---------------------------------------------------------------------------

describe("makeIsdaCsaElected factory", () => {
  it("A. produces a valid event envelope", () => {
    const event = makeIsdaCsaElected({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: BASE_CSA_PAYLOAD,
      eventId: CSA_EVENT_ID,
    });
    expect(event.type).toBe("IsdaCsaElected");
    expect(event.event_id).toBe(CSA_EVENT_ID);
    expect((event.payload as IsdaCsaElectedPayload).linkedScheduleEventId).toBe(SCHEDULE_EVENT_ID);
  });

  it("B. throws when citations empty (Principle 2)", () => {
    expect(() =>
      makeIsdaCsaElected({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: [],
        payload: BASE_CSA_PAYLOAD,
      }),
    ).toThrow("IsdaCsaElected requires at least one citation");
  });
});

// ---------------------------------------------------------------------------
// IsdaCsaSuperseded
// ---------------------------------------------------------------------------

describe("IsdaCsaSuperseded", () => {
  const supersededPayload: IsdaCsaSupersededPayload = {
    counterpartyId: "party:lei:LEI123456789012345678",
    supersedesEventId: CSA_EVENT_ID,
    supersessionDate: "2026-06-01",
    reason: "replaced-by-new-form",
    replacedByEventId: "550e8400-e29b-41d4-a716-446655440002",
  };

  it("1. schema accepts valid payload", () => {
    const result = isdaCsaSupersededPayloadSchema.safeParse(supersededPayload);
    expect(result.success).toBe(true);
  });

  it("2. accepts null replacedByEventId when no replacement", () => {
    const payload = {
      ...supersededPayload,
      reason: "counterparty-terminated" as const,
      replacedByEventId: null,
    };
    const result = isdaCsaSupersededPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.replacedByEventId).toBeNull();
    }
  });

  it("3. rejects invalid reason", () => {
    const payload = {
      ...supersededPayload,
      reason: "expired" as never,
    };
    const result = isdaCsaSupersededPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("4. factory produces valid event", () => {
    const event = makeIsdaCsaSuperseded({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: supersededPayload,
    });
    expect(event.type).toBe("IsdaCsaSuperseded");
    expect(event.citations).toEqual(CITATIONS);
  });

  it("5. factory throws when citations empty", () => {
    expect(() =>
      makeIsdaCsaSuperseded({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: [],
        payload: supersededPayload,
      }),
    ).toThrow("IsdaCsaSuperseded requires at least one citation");
  });
});
