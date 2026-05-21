// tests/period-closed-event-types.test.ts
//
// Tests for the PeriodClosed event type (Slice C of
// D-EVENT-VIEW-BOUNDARY-WIRE).
//
// Covers:
//   1. Payload schema validation — valid payloads pass, invalid reject.
//   2. Factory `makePeriodClosed` produces a valid Event envelope.
//   3. Citation gate — empty citations throw.
//   4. policyVersionRefs gate — empty array throws.
//   5. Period chain — priorPeriodRef null (founding) and linked (successor).
//   6. supersedesClose — optional reopen marker.
//   7. Registry row — present with correct metadata and Zod schema.
//
// Authority: D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20).
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import {
  CLOSE_MANAGEMENT_TYPED_EVENT_TYPES,
  makePeriodClosed,
  periodClosedPayloadSchema,
} from "../platform/event-store/event-types/close-management";
import { EVENT_TYPE_REGISTRY, lookupEventType } from "../platform/event-store/registry";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["D-EVENT-VIEW-BOUNDARY-WIRE", "IFRS-IAS-1-§29", "Companies-Act-71-2008-§29"];
const ACTOR = { id: "agent:camille:cfo", type: "service" as const };
const AS_OF = "2026-06-05T16:42:00.000Z";

const VALID_HASH = `blake3:${"a".repeat(64)}`;
const VALID_CODE_SHA = "a2ae42a";
const VALID_POLICY_REF = "urn:event:PolicyVersionActivated:vpva-2026-05-19-v1";

function validPayload() {
  return {
    periodId: "period:bank-za-001:month:2026-05",
    periodKind: "month" as const,
    cutoffTs: "2026-06-01T00:00:00Z",
    uptoSequence: 184312,
    policyVersionRefs: [VALID_POLICY_REF],
    codeSha: VALID_CODE_SHA,
    derivedStatementHashes: {
      pnl: VALID_HASH,
      balanceSheet: VALID_HASH,
      cashFlow: VALID_HASH,
      baReturns: {
        "BA-325": VALID_HASH,
        "BA-700": VALID_HASH,
      },
    },
    trialBalanceSnapshotEventId: "evt:trial-balance:2026-05:abc123",
    attestingAuthority: "CFO" as const,
    attestedBy: "agent:camille:cfo",
    priorPeriodRef: null,
  };
}

// ---------------------------------------------------------------------------
// 1. Payload schema validation
// ---------------------------------------------------------------------------

describe("periodClosedPayloadSchema", () => {
  it("happy path — founding close parses", () => {
    expect(() => periodClosedPayloadSchema.parse(validPayload())).not.toThrow();
  });

  it("happy path — successor with priorPeriodRef parses", () => {
    const p = { ...validPayload(), priorPeriodRef: "evt:period-closed:2026-04:def456" };
    expect(() => periodClosedPayloadSchema.parse(p)).not.toThrow();
  });

  it("happy path — joint CFO+CEO attestation parses", () => {
    const p = { ...validPayload(), attestingAuthority: "CFO+CEO" as const };
    expect(() => periodClosedPayloadSchema.parse(p)).not.toThrow();
  });

  it("happy path — CFO+CEO+AC attestation parses", () => {
    const p = { ...validPayload(), attestingAuthority: "CFO+CEO+AC" as const };
    expect(() => periodClosedPayloadSchema.parse(p)).not.toThrow();
  });

  it("happy path — supersedesClose reopen marker parses", () => {
    const p = { ...validPayload(), supersedesClose: "evt:period-closed:2026-05:original-001" };
    expect(() => periodClosedPayloadSchema.parse(p)).not.toThrow();
  });

  it("happy path — trialBalanceSnapshotEventId is optional", () => {
    const { trialBalanceSnapshotEventId: _tb, ...rest } = validPayload();
    expect(() => periodClosedPayloadSchema.parse(rest)).not.toThrow();
  });

  it("happy path — multiple policyVersionRefs", () => {
    const p = {
      ...validPayload(),
      policyVersionRefs: [
        "urn:event:PolicyVersionActivated:valuation-v1",
        "urn:event:PolicyVersionActivated:accounting-ifrs-v1",
        "urn:event:PolicyVersionActivated:fx-translation-v1",
      ],
    };
    expect(() => periodClosedPayloadSchema.parse(p)).not.toThrow();
  });

  it("rejects empty periodId", () => {
    expect(() => periodClosedPayloadSchema.parse({ ...validPayload(), periodId: "" })).toThrow();
  });

  it("rejects unknown periodKind", () => {
    expect(() =>
      periodClosedPayloadSchema.parse({
        ...validPayload(),
        periodKind: "bi-annual" as unknown as "month",
      }),
    ).toThrow();
  });

  it("rejects empty cutoffTs", () => {
    expect(() => periodClosedPayloadSchema.parse({ ...validPayload(), cutoffTs: "" })).toThrow();
  });

  it("rejects negative uptoSequence", () => {
    expect(() =>
      periodClosedPayloadSchema.parse({ ...validPayload(), uptoSequence: -1 }),
    ).toThrow();
  });

  it("rejects empty policyVersionRefs array", () => {
    expect(() =>
      periodClosedPayloadSchema.parse({ ...validPayload(), policyVersionRefs: [] }),
    ).toThrow();
  });

  it("rejects codeSha too short (< 7 hex chars)", () => {
    expect(() =>
      periodClosedPayloadSchema.parse({ ...validPayload(), codeSha: "a2ae4" }),
    ).toThrow();
  });

  it("rejects codeSha with non-hex chars", () => {
    expect(() =>
      periodClosedPayloadSchema.parse({ ...validPayload(), codeSha: "zzzzzzzz" }),
    ).toThrow();
  });

  it("rejects empty pnl hash", () => {
    const p = {
      ...validPayload(),
      derivedStatementHashes: { ...validPayload().derivedStatementHashes, pnl: "" },
    };
    expect(() => periodClosedPayloadSchema.parse(p)).toThrow();
  });

  it("rejects baReturns key that doesn't match BA-NNN format", () => {
    const p = {
      ...validPayload(),
      derivedStatementHashes: {
        ...validPayload().derivedStatementHashes,
        baReturns: { "RETURN-325": VALID_HASH },
      },
    };
    expect(() => periodClosedPayloadSchema.parse(p)).toThrow();
  });

  it("rejects unknown attestingAuthority", () => {
    expect(() =>
      periodClosedPayloadSchema.parse({
        ...validPayload(),
        attestingAuthority: "BOARD" as unknown as "CFO",
      }),
    ).toThrow();
  });

  it("rejects empty attestedBy", () => {
    expect(() => periodClosedPayloadSchema.parse({ ...validPayload(), attestedBy: "" })).toThrow();
  });

  it("rejects missing priorPeriodRef (must be explicit null or string)", () => {
    const { priorPeriodRef: _p, ...rest } = validPayload();
    expect(() => periodClosedPayloadSchema.parse(rest)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. Factory envelope
// ---------------------------------------------------------------------------

describe("makePeriodClosed", () => {
  it("produces a valid Event envelope", () => {
    const evt = makePeriodClosed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: validPayload(),
    });
    expect(evt.type).toBe("PeriodClosed");
    expect(evt.as_of).toBe(AS_OF);
    expect(evt.entity).toBe(ENTITY);
    expect(evt.actor).toEqual(ACTOR);
    expect(evt.citations).toEqual(CITATIONS);
    expect(evt.event_id).toMatch(/.+/);
  });

  it("uses provided eventId (idempotent backfill use-case)", () => {
    const evt = makePeriodClosed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: validPayload(),
      eventId: "evt:fixed-id-for-backfill",
    });
    expect(evt.event_id).toBe("evt:fixed-id-for-backfill");
  });

  it("throws on empty citations (Principle 2)", () => {
    expect(() =>
      makePeriodClosed({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: [],
        payload: validPayload(),
      }),
    ).toThrow(/citation/);
  });

  it("throws on empty policyVersionRefs", () => {
    expect(() =>
      makePeriodClosed({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: { ...validPayload(), policyVersionRefs: [] },
      }),
    ).toThrow();
  });

  it("throws on invalid codeSha", () => {
    expect(() =>
      makePeriodClosed({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: { ...validPayload(), codeSha: "not-a-sha" },
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3-4. Citation gate + policyVersionRefs gate tested above in factory.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 5. Period chain
// ---------------------------------------------------------------------------

describe("PeriodClosed period chain", () => {
  it("founding close carries priorPeriodRef=null", () => {
    const founding = makePeriodClosed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: validPayload(),
    });
    expect((founding.payload as { priorPeriodRef: string | null }).priorPeriodRef).toBeNull();
  });

  it("successor carries priorPeriodRef=<founding event_id>", () => {
    const founding = makePeriodClosed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: validPayload(),
    });
    const successor = makePeriodClosed({
      asOf: "2026-07-05T16:42:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        ...validPayload(),
        periodId: "period:bank-za-001:month:2026-06",
        cutoffTs: "2026-07-01T00:00:00Z",
        uptoSequence: 210000,
        priorPeriodRef: founding.event_id,
      },
    });
    expect((successor.payload as { priorPeriodRef: string | null }).priorPeriodRef).toBe(
      founding.event_id,
    );
  });
});

// ---------------------------------------------------------------------------
// 6. supersedesClose (reopen marker)
// ---------------------------------------------------------------------------

describe("PeriodClosed supersedesClose", () => {
  it("founding close has no supersedesClose by default", () => {
    const evt = makePeriodClosed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: validPayload(),
    });
    expect((evt.payload as { supersedesClose?: string }).supersedesClose).toBeUndefined();
  });

  it("reopen carries supersedesClose=<original close event_id>", () => {
    const original = makePeriodClosed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: validPayload(),
    });
    const reopen = makePeriodClosed({
      asOf: "2026-08-15T10:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        ...validPayload(),
        cutoffTs: "2026-06-01T00:00:00Z",
        uptoSequence: 220000,
        supersedesClose: original.event_id,
        priorPeriodRef: null,
      },
    });
    expect((reopen.payload as { supersedesClose?: string }).supersedesClose).toBe(
      original.event_id,
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Registry presence
// ---------------------------------------------------------------------------

describe("PeriodClosed registry row", () => {
  it("CLOSE_MANAGEMENT_TYPED_EVENT_TYPES has exactly one entry", () => {
    expect(CLOSE_MANAGEMENT_TYPED_EVENT_TYPES).toEqual(["PeriodClosed"]);
  });

  it("EVENT_TYPE_REGISTRY contains the PeriodClosed row", () => {
    const row = EVENT_TYPE_REGISTRY.find((r) => r.type === "PeriodClosed");
    expect(row).toBeDefined();
    expect(row?.payloadSchema).toBe(periodClosedPayloadSchema);
  });

  it("lookupEventType resolves the row with status active", () => {
    const meta = lookupEventType("PeriodClosed");
    expect(meta).toBeDefined();
    expect(meta?.status).toBe("active");
    expect(meta?.class).toBe("governance");
    expect(meta?.subscribers).toEqual(
      expect.arrayContaining(["Camille", "Helena", "Bea", "Eitan", "Mira", "Vera", "Atlas"]),
    );
  });
});
