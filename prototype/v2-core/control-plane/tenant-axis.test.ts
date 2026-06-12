// v2-core/control-plane/tenant-axis.test.ts
//
// Unit tests for the V2 S2 tenant axis: ANCHOR_TENANT_ID, tenantIdSchema,
// isAnchorTenantEvent, V2Envelope, createV2Envelope.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";
import {
  ANCHOR_TENANT_ID,
  type TenantId,
  isAnchorTenantEvent,
  tenantIdSchema,
} from "./tenant";
import { createV2Envelope, v2EnvelopeSchema } from "./envelope";

// ---------------------------------------------------------------------------
// tenantIdSchema
// ---------------------------------------------------------------------------

describe("tenantIdSchema", () => {
  it("parses a valid tenant ID", () => {
    const result = tenantIdSchema.safeParse("tenant:za-bank");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("tenant:za-bank");
  });

  it("parses an alternative tenant ID", () => {
    const result = tenantIdSchema.safeParse("tenant:some-other-bank");
    expect(result.success).toBe(true);
  });

  it("rejects a string without the 'tenant:' prefix", () => {
    expect(tenantIdSchema.safeParse("za-bank").success).toBe(false);
    expect(tenantIdSchema.safeParse("").success).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(tenantIdSchema.safeParse("").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ANCHOR_TENANT_ID
// ---------------------------------------------------------------------------

describe("ANCHOR_TENANT_ID", () => {
  it("has the canonical value 'tenant:za-bank'", () => {
    expect(ANCHOR_TENANT_ID).toBe("tenant:za-bank");
  });

  it("is parseable by tenantIdSchema", () => {
    const result = tenantIdSchema.safeParse(ANCHOR_TENANT_ID);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isAnchorTenantEvent
// ---------------------------------------------------------------------------

describe("isAnchorTenantEvent", () => {
  it("returns true for the anchor tenant", () => {
    const id = ANCHOR_TENANT_ID as TenantId;
    expect(isAnchorTenantEvent(id)).toBe(true);
  });

  it("returns false for a different tenant", () => {
    const other = tenantIdSchema.parse("tenant:other-bank");
    expect(isAnchorTenantEvent(other)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createV2Envelope
// ---------------------------------------------------------------------------

const FAKE_INSTANT = "2026-06-12T10:00:00.000Z" as ReturnType<typeof import("../fil-core/primitives").instantSchema.parse>;

describe("createV2Envelope", () => {
  it("defaults tenantId to ANCHOR_TENANT_ID when omitted", () => {
    const env = createV2Envelope({
      eventId: "evt-001",
      issuedAt: FAKE_INSTANT,
      payload: { type: "TestEvent" },
    });
    expect(env.tenantId).toBe(ANCHOR_TENANT_ID);
  });

  it("accepts an explicit tenantId", () => {
    const tenantId = tenantIdSchema.parse("tenant:other-bank");
    const env = createV2Envelope(
      { eventId: "evt-002", issuedAt: FAKE_INSTANT, payload: {} },
      tenantId,
    );
    expect(env.tenantId).toBe("tenant:other-bank");
  });

  it("preserves all base fields", () => {
    const payload = { kind: "TestEvent", data: 42 };
    const env = createV2Envelope({
      eventId: "evt-003",
      issuedAt: FAKE_INSTANT,
      payload,
    });
    expect(env.eventId).toBe("evt-003");
    expect(env.issuedAt).toBe(FAKE_INSTANT);
    expect(env.payload).toBe(payload);
  });

  it("produces an object accepted by v2EnvelopeSchema", () => {
    const env = createV2Envelope({
      eventId: "evt-004",
      issuedAt: FAKE_INSTANT,
      payload: { x: 1 },
    });
    const result = v2EnvelopeSchema.safeParse(env);
    expect(result.success).toBe(true);
  });
});
