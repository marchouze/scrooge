// tests/official-mark-adopted-event-types.test.ts
//
// Tests for the OfficialMarkAdopted event type (Slice B of
// D-EVENT-VIEW-BOUNDARY-WIRE).
//
// Covers:
//   1. OFFICIAL_MARK_TYPES enum + officialMarkTypeSchema discriminator.
//   2. FAIR_VALUE_LEVELS enum + fairValueLevelSchema (IFRS-13 1/2/3).
//   3. Payload schema — happy path + structural rejects.
//   4. Factory `makeOfficialMarkAdopted` produces a valid Event envelope.
//   5. Tenor coupling — required for curve-point / vol-point, rejected
//      for price / fx-rate.
//   6. Citation gate (Principle 2) — empty citations array rejected.
//   7. Registry row is present and carries the Zod schema.
//
// Authority: D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import {
  FAIR_VALUE_LEVELS,
  OFFICIAL_MARK_TYPES,
  type OfficialMarkAdoptedPayload,
  VALUATION_TYPED_EVENT_TYPES,
  fairValueLevelSchema,
  makeOfficialMarkAdopted,
  officialMarkAdoptedPayloadSchema,
  officialMarkTypeSchema,
} from "../platform/event-store/event-types/valuation";
import { EVENT_TYPE_REGISTRY, lookupEventType } from "../platform/event-store/registry";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ENTITY = "BANK-ZA-001";
const CITATIONS = ["D-EVENT-VIEW-BOUNDARY-WIRE", "P1-EVENTS-AS-TRUTH"];
const ACTOR = { id: "agent:rohan:valuation-engine", type: "service" as const };
const AS_OF = "2026-05-20T17:05:00.000Z";
const POLICY_VERSION_REF = "urn:event:PolicyVersionActivated:0aa8b5e2-5c9f-4f44-8c2c-9a1f1e8d7b32";

function pricePayload(): OfficialMarkAdoptedPayload {
  return {
    instrumentKey: "ZAE000013181", // AGL.JSE
    markType: "price",
    mark: "18500", // cents — AGL ZAR 185.00
    quoteCurrency: "ZAR",
    markAsOf: "2026-05-20T15:00:00Z",
    sourceTickRef: {
      source: "jse-closing-print",
      tickId: "tick:jse:AGL:2026-05-20:close",
    },
    policyVersionRef: POLICY_VERSION_REF,
    adoptionCodeSha: "a2ae42a",
    fairValueLevel: "1",
    fallbackChain: [],
  };
}

function fxRatePayload(): OfficialMarkAdoptedPayload {
  return {
    instrumentKey: "USD/ZAR",
    markType: "fx-rate",
    mark: "18.5234",
    quoteCurrency: "USD/ZAR",
    markAsOf: "2026-05-20T17:00:00Z",
    sourceTickRef: { source: "fx-sim", tickId: "tick:fx-sim:USDZAR:2026-05-20T1700" },
    policyVersionRef: POLICY_VERSION_REF,
    adoptionCodeSha: "a2ae42a",
    fairValueLevel: "1",
    fallbackChain: [],
  };
}

function curvePointPayload(): OfficialMarkAdoptedPayload {
  return {
    instrumentKey: "jibar-3m",
    markType: "curve-point",
    mark: "8.50",
    quoteCurrency: "ZAR",
    tenor: "3M",
    markAsOf: "2026-05-20T15:00:00Z",
    sourceTickRef: { source: "sarb-publish", tickId: "tick:jibar:3m:2026-05-20" },
    policyVersionRef: POLICY_VERSION_REF,
    adoptionCodeSha: "a2ae42a",
    fairValueLevel: "2",
    fallbackChain: [],
  };
}

function volPointPayload(): OfficialMarkAdoptedPayload {
  return {
    instrumentKey: "USD/ZAR:atm",
    markType: "vol-point",
    mark: "0.165",
    quoteCurrency: "USD/ZAR",
    tenor: "1Y",
    markAsOf: "2026-05-20T17:00:00Z",
    sourceTickRef: { source: "fx-sim", tickId: "tick:fx-sim:USDZAR:vol:1Y:2026-05-20" },
    policyVersionRef: POLICY_VERSION_REF,
    adoptionCodeSha: "a2ae42a",
    fairValueLevel: "3",
    fallbackChain: [],
  };
}

// ---------------------------------------------------------------------------
// 1. OFFICIAL_MARK_TYPES discriminator
// ---------------------------------------------------------------------------

describe("OFFICIAL_MARK_TYPES", () => {
  it("lists price, fx-rate, curve-point, vol-point", () => {
    expect(OFFICIAL_MARK_TYPES).toContain("price");
    expect(OFFICIAL_MARK_TYPES).toContain("fx-rate");
    expect(OFFICIAL_MARK_TYPES).toContain("curve-point");
    expect(OFFICIAL_MARK_TYPES).toContain("vol-point");
    expect(OFFICIAL_MARK_TYPES.length).toBe(4);
  });

  it("officialMarkTypeSchema accepts each value", () => {
    for (const t of OFFICIAL_MARK_TYPES) {
      expect(() => officialMarkTypeSchema.parse(t)).not.toThrow();
    }
  });

  it("officialMarkTypeSchema rejects unknown values", () => {
    expect(() => officialMarkTypeSchema.parse("yield")).toThrow();
    expect(() => officialMarkTypeSchema.parse("")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. FAIR_VALUE_LEVELS
// ---------------------------------------------------------------------------

describe("FAIR_VALUE_LEVELS", () => {
  it("lists IFRS-13 1, 2, 3", () => {
    expect(FAIR_VALUE_LEVELS).toEqual(["1", "2", "3"]);
  });

  it("fairValueLevelSchema accepts known levels", () => {
    expect(() => fairValueLevelSchema.parse("1")).not.toThrow();
    expect(() => fairValueLevelSchema.parse("2")).not.toThrow();
    expect(() => fairValueLevelSchema.parse("3")).not.toThrow();
  });

  it("fairValueLevelSchema rejects numeric or unknown values", () => {
    expect(() => fairValueLevelSchema.parse(1)).toThrow();
    expect(() => fairValueLevelSchema.parse("0")).toThrow();
    expect(() => fairValueLevelSchema.parse("4")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. Payload schema — happy paths + structural rejects
// ---------------------------------------------------------------------------

describe("officialMarkAdoptedPayloadSchema", () => {
  it("happy path — price mark parses", () => {
    expect(() => officialMarkAdoptedPayloadSchema.parse(pricePayload())).not.toThrow();
  });

  it("happy path — fx-rate mark parses", () => {
    expect(() => officialMarkAdoptedPayloadSchema.parse(fxRatePayload())).not.toThrow();
  });

  it("happy path — curve-point mark with tenor parses", () => {
    expect(() => officialMarkAdoptedPayloadSchema.parse(curvePointPayload())).not.toThrow();
  });

  it("happy path — vol-point mark with tenor parses", () => {
    expect(() => officialMarkAdoptedPayloadSchema.parse(volPointPayload())).not.toThrow();
  });

  it("rejects empty instrumentKey", () => {
    expect(() =>
      officialMarkAdoptedPayloadSchema.parse({ ...pricePayload(), instrumentKey: "" }),
    ).toThrow();
  });

  it("rejects unknown markType", () => {
    expect(() =>
      officialMarkAdoptedPayloadSchema.parse({
        ...pricePayload(),
        markType: "yield" as unknown as OfficialMarkAdoptedPayload["markType"],
      }),
    ).toThrow();
  });

  it("rejects empty mark", () => {
    expect(() => officialMarkAdoptedPayloadSchema.parse({ ...pricePayload(), mark: "" })).toThrow();
  });

  it("rejects empty policyVersionRef", () => {
    expect(() =>
      officialMarkAdoptedPayloadSchema.parse({ ...pricePayload(), policyVersionRef: "" }),
    ).toThrow();
  });

  it("rejects adoptionCodeSha that is not hex 7-40", () => {
    expect(() =>
      officialMarkAdoptedPayloadSchema.parse({ ...pricePayload(), adoptionCodeSha: "short" }),
    ).toThrow();
    expect(() =>
      officialMarkAdoptedPayloadSchema.parse({ ...pricePayload(), adoptionCodeSha: "NOT-HEX-XX" }),
    ).toThrow();
  });

  it("rejects sourceTickRef with missing fields", () => {
    expect(() =>
      officialMarkAdoptedPayloadSchema.parse({
        ...pricePayload(),
        sourceTickRef: { source: "", tickId: "x" },
      }),
    ).toThrow();
  });

  it("defaults fallbackChain to empty array when omitted", () => {
    const { fallbackChain: _drop, ...rest } = pricePayload();
    const parsed = officialMarkAdoptedPayloadSchema.parse(rest);
    expect(parsed.fallbackChain).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. Factory — Event envelope
// ---------------------------------------------------------------------------

describe("makeOfficialMarkAdopted", () => {
  it("produces a valid Event envelope with type=OfficialMarkAdopted", () => {
    const event = makeOfficialMarkAdopted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: pricePayload(),
    });
    expect(event.type).toBe("OfficialMarkAdopted");
    expect(event.entity).toBe(ENTITY);
    expect(event.as_of).toBe(AS_OF);
    expect(event.actor).toEqual(ACTOR);
    expect(event.citations).toEqual(CITATIONS);
    expect((event.payload as OfficialMarkAdoptedPayload).markType).toBe("price");
  });

  it("respects supplied event_id", () => {
    const event = makeOfficialMarkAdopted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: pricePayload(),
      eventId: "11111111-1111-4111-8111-111111111111",
    });
    expect(event.event_id).toBe("11111111-1111-4111-8111-111111111111");
  });
});

// ---------------------------------------------------------------------------
// 5. Tenor coupling — required for curve-point / vol-point
// ---------------------------------------------------------------------------

describe("tenor coupling", () => {
  it("curve-point without tenor — factory rejects", () => {
    const { tenor: _drop, ...rest } = curvePointPayload();
    expect(() =>
      makeOfficialMarkAdopted({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: rest,
      }),
    ).toThrow(/requires a tenor/);
  });

  it("vol-point without tenor — factory rejects", () => {
    const { tenor: _drop, ...rest } = volPointPayload();
    expect(() =>
      makeOfficialMarkAdopted({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: rest,
      }),
    ).toThrow(/requires a tenor/);
  });

  it("price with tenor — factory rejects", () => {
    expect(() =>
      makeOfficialMarkAdopted({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: { ...pricePayload(), tenor: "10Y" },
      }),
    ).toThrow(/must not carry a tenor/);
  });

  it("fx-rate with tenor — factory rejects", () => {
    expect(() =>
      makeOfficialMarkAdopted({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: { ...fxRatePayload(), tenor: "3M" },
      }),
    ).toThrow(/must not carry a tenor/);
  });
});

// ---------------------------------------------------------------------------
// 6. Citation gate
// ---------------------------------------------------------------------------

describe("citation gate", () => {
  it("rejects empty citations array (Principle 2)", () => {
    expect(() =>
      makeOfficialMarkAdopted({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: [],
        payload: pricePayload(),
      }),
    ).toThrow(/at least one citation/);
  });
});

// ---------------------------------------------------------------------------
// 7. Registry presence
// ---------------------------------------------------------------------------

describe("registry coverage", () => {
  it("VALUATION_TYPED_EVENT_TYPES includes OfficialMarkAdopted", () => {
    expect(VALUATION_TYPED_EVENT_TYPES).toContain("OfficialMarkAdopted");
  });

  it("EVENT_TYPE_REGISTRY exposes the row with a Zod schema", () => {
    const meta = lookupEventType("OfficialMarkAdopted");
    expect(meta).toBeTruthy();
    expect(meta?.payloadSchema).toBe(officialMarkAdoptedPayloadSchema);
    expect(meta?.issuer).toBe("Rohan");
  });

  it("registry row is reachable from the combined registry", () => {
    const inRegistry = EVENT_TYPE_REGISTRY.some((r) => r.type === "OfficialMarkAdopted");
    expect(inRegistry).toBe(true);
  });
});
