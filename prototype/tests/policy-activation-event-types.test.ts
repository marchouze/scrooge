// tests/policy-activation-event-types.test.ts
//
// Tests for the PolicyVersionActivated event type (Slice A of
// D-EVENT-VIEW-BOUNDARY-WIRE).
//
// Covers:
//   1. POLICY_DOMAINS enum + policyDomainSchema.
//   2. Payload schema validation — valid payloads pass, invalid payloads reject.
//   3. Factory `makePolicyVersionActivated` produces a valid Event envelope.
//   4. Supersession chain — `supersedes` may be null (founding activation)
//      or carry the prior event_id (successor activation), forming the
//      per-(policyDomain, policyId) chain.
//   5. Registry row is present and carries the Zod schema.
//
// Authority: D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import {
  POLICY_ACTIVATION_TYPED_EVENT_TYPES,
  POLICY_DOMAINS,
  makePolicyVersionActivated,
  policyDomainSchema,
  policyVersionActivatedPayloadSchema,
} from "../platform/event-store/event-types/policy-activation";
import { EVENT_TYPE_REGISTRY, lookupEventType } from "../platform/event-store/registry";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ENTITY = "BANK-ZA-001";
const CITATIONS = ["D-EVENT-VIEW-BOUNDARY-WIRE", "P1-EVENTS-AS-TRUTH"];
const ACTOR = { id: "agent:helena:cro", type: "service" as const };
const AS_OF = "2026-05-19T00:00:00.000Z";

const VALID_HASH = `blake3:${"a".repeat(64)}`;

function validPayload() {
  return {
    policyDomain: "valuation" as const,
    policyId: "VALUATION-POLICY-V1",
    version: "1.0",
    effectiveFrom: "2026-05-19T00:00:00Z",
    documentHash: VALID_HASH,
    supersedes: null,
    activatedBy: "agent:helena:cro",
  };
}

// ---------------------------------------------------------------------------
// 1. POLICY_DOMAINS / discriminator
// ---------------------------------------------------------------------------

describe("POLICY_DOMAINS", () => {
  it("lists valuation, accounting-ifrs, fx-translation", () => {
    expect(POLICY_DOMAINS).toContain("valuation");
    expect(POLICY_DOMAINS).toContain("accounting-ifrs");
    expect(POLICY_DOMAINS).toContain("fx-translation");
  });

  it("policyDomainSchema accepts known values", () => {
    expect(() => policyDomainSchema.parse("valuation")).not.toThrow();
    expect(() => policyDomainSchema.parse("accounting-ifrs")).not.toThrow();
    expect(() => policyDomainSchema.parse("fx-translation")).not.toThrow();
  });

  it("policyDomainSchema rejects unknown values", () => {
    expect(() => policyDomainSchema.parse("liquidity")).toThrow();
    expect(() => policyDomainSchema.parse("")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. Payload schema validation
// ---------------------------------------------------------------------------

describe("policyVersionActivatedPayloadSchema", () => {
  it("happy path — founding activation parses", () => {
    expect(() => policyVersionActivatedPayloadSchema.parse(validPayload())).not.toThrow();
  });

  it("happy path — successor activation with supersedes event_id parses", () => {
    const payload = {
      ...validPayload(),
      version: "1.1",
      supersedes: "evt:01H8XYZ-prior-activation-event-id",
    };
    expect(() => policyVersionActivatedPayloadSchema.parse(payload)).not.toThrow();
  });

  it("rejects unknown policyDomain", () => {
    const payload = { ...validPayload(), policyDomain: "credit-risk" as unknown as "valuation" };
    expect(() => policyVersionActivatedPayloadSchema.parse(payload)).toThrow();
  });

  it("rejects empty policyId", () => {
    const payload = { ...validPayload(), policyId: "" };
    expect(() => policyVersionActivatedPayloadSchema.parse(payload)).toThrow();
  });

  it("rejects empty version", () => {
    const payload = { ...validPayload(), version: "" };
    expect(() => policyVersionActivatedPayloadSchema.parse(payload)).toThrow();
  });

  it("rejects empty effectiveFrom", () => {
    const payload = { ...validPayload(), effectiveFrom: "" };
    expect(() => policyVersionActivatedPayloadSchema.parse(payload)).toThrow();
  });

  it("rejects documentHash missing blake3: prefix", () => {
    const payload = { ...validPayload(), documentHash: "a".repeat(64) };
    expect(() => policyVersionActivatedPayloadSchema.parse(payload)).toThrow();
  });

  it("rejects documentHash with wrong digest length", () => {
    const payload = { ...validPayload(), documentHash: `blake3:${"a".repeat(32)}` };
    expect(() => policyVersionActivatedPayloadSchema.parse(payload)).toThrow();
  });

  it("rejects documentHash with non-hex chars", () => {
    const payload = { ...validPayload(), documentHash: `blake3:${"z".repeat(64)}` };
    expect(() => policyVersionActivatedPayloadSchema.parse(payload)).toThrow();
  });

  it("rejects missing supersedes field (must be explicit null or string)", () => {
    const { supersedes: _supersedes, ...rest } = validPayload();
    expect(() => policyVersionActivatedPayloadSchema.parse(rest)).toThrow();
  });

  it("rejects empty activatedBy", () => {
    const payload = { ...validPayload(), activatedBy: "" };
    expect(() => policyVersionActivatedPayloadSchema.parse(payload)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. Factory
// ---------------------------------------------------------------------------

describe("makePolicyVersionActivated", () => {
  it("produces a valid Event envelope", () => {
    const evt = makePolicyVersionActivated({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: validPayload(),
    });
    expect(evt.type).toBe("PolicyVersionActivated");
    expect(evt.as_of).toBe(AS_OF);
    expect(evt.entity).toBe(ENTITY);
    expect(evt.actor).toEqual(ACTOR);
    expect(evt.citations).toEqual(CITATIONS);
    expect(evt.event_id).toMatch(/.+/);
  });

  it("uses provided eventId when given (idempotent backfill use-case)", () => {
    const evt = makePolicyVersionActivated({
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
      makePolicyVersionActivated({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: [],
        payload: validPayload(),
      }),
    ).toThrow(/citation/);
  });

  it("throws on invalid payload (schema enforcement at make-site)", () => {
    expect(() =>
      makePolicyVersionActivated({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: { ...validPayload(), documentHash: "not-a-hash" },
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4. Supersession chain
// ---------------------------------------------------------------------------

describe("PolicyVersionActivated supersession chain", () => {
  it("founding activation carries supersedes=null", () => {
    const founding = makePolicyVersionActivated({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: validPayload(),
    });
    expect(
      (founding.payload as { supersedes: string | null }).supersedes,
    ).toBeNull();
  });

  it("successor activation carries supersedes=<prior event_id>", () => {
    const founding = makePolicyVersionActivated({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: validPayload(),
    });
    const successor = makePolicyVersionActivated({
      asOf: "2026-08-01T00:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        ...validPayload(),
        version: "1.1",
        effectiveFrom: "2026-08-01T00:00:00Z",
        documentHash: `blake3:${"b".repeat(64)}`,
        supersedes: founding.event_id,
      },
    });
    expect(
      (successor.payload as { supersedes: string | null }).supersedes,
    ).toBe(founding.event_id);
  });
});

// ---------------------------------------------------------------------------
// 5. Registry presence
// ---------------------------------------------------------------------------

describe("PolicyVersionActivated registry row", () => {
  it("POLICY_ACTIVATION_TYPED_EVENT_TYPES has exactly one entry", () => {
    expect(POLICY_ACTIVATION_TYPED_EVENT_TYPES).toEqual(["PolicyVersionActivated"]);
  });

  it("EVENT_TYPE_REGISTRY contains the PolicyVersionActivated row", () => {
    const row = EVENT_TYPE_REGISTRY.find((r) => r.type === "PolicyVersionActivated");
    expect(row).toBeDefined();
    expect(row?.payloadSchema).toBe(policyVersionActivatedPayloadSchema);
  });

  it("lookupEventType resolves the row with status active", () => {
    const meta = lookupEventType("PolicyVersionActivated");
    expect(meta).toBeDefined();
    expect(meta?.status).toBe("active");
    expect(meta?.class).toBe("governance");
    expect(meta?.subscribers).toEqual(
      expect.arrayContaining(["Helena", "Camille", "Rohan", "Bea", "Vera", "Atlas"]),
    );
  });
});
