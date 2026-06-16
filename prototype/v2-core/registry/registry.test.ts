// v2-core/registry/registry.test.ts
//
// Wave 0 (D-BANK-WIDE-V2-MIGRATION) tests for the v2 general-host foundation:
//   - the v2 type registry (coverage of the 10 footholds, lookup, validation)
//   - the control-plane store's append-time payload validation (fail-closed on
//     a registered type's bad payload; accept on an unregistered type)
//   - schema_version stamping + default
//   - provenance + retention_class persistence and replay round-trip
//   - the envelope schemaVersion field + factory defaults / overrides
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import {
  V2_ENVELOPE_SCHEMA_VERSION_DEFAULT,
  createV2Envelope,
  v2EnvelopeSchema,
} from "../control-plane/envelope";
import { type CpEvent, openControlPlaneStore } from "../control-plane/store";
import { ANCHOR_TENANT_ID, type TenantId } from "../control-plane/tenant";
import type { Instant } from "../fil-core/primitives";
import {
  V2_EVENT_TYPE_REGISTRY,
  isV2EventTypeRegistered,
  lookupV2EventType,
  registeredV2EventTypes,
  validateV2Payload,
} from "./index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0;
function cpEvent(
  type: string,
  payload: Record<string, unknown>,
  extra: Partial<CpEvent> = {},
): CpEvent {
  counter += 1;
  return {
    event_id: `evt-${type}-${counter}`,
    type,
    as_of: "2026-06-16T00:00:00.000Z",
    entity: "control-plane",
    actor: { type: "system", id: "atlas" },
    citations: ["D-BANK-WIDE-V2-MIGRATION"],
    payload,
    ...extra,
  };
}

const validTenantRegistered: Record<string, unknown> = {
  tenantId: "tenant:za-bank",
  tier: "K",
  displayName: "Anchor Bank",
  legalEntityRef: "LE-ZA-HOZ-BANK",
  registeredAt: "2026-06-16T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Registry coverage
// ---------------------------------------------------------------------------

describe("v2 type registry — foothold coverage", () => {
  it("registers all 10 v2-parallel foothold families' event types", () => {
    const expected = [
      // control-plane
      "TenantRegistered",
      "TenantSurfaceGranted",
      "TenantUpgradeLedgerEntry",
      "TenantMeterEvent",
      "FunctionalSeatRegistered",
      // banking
      "V2ProductRegistered",
      "V2ProductDeprecated",
      "V2AccountTypeRegistered",
      "V2RiskAppetiteSet",
      // fil-instances
      "FilInstrumentCreated",
      "FilInstrumentAmended",
      "FilInstrumentTerminated",
      // fil-attribution
      "InstrumentDimensionAssigned",
      "SliceDefined",
      "OrgHierarchyEdgeAssigned",
      // posture
      "PostureRegistered",
      "PostureActivated",
      "PostureDeactivated",
      "PostureRevised",
      // applicability
      "ApplicabilityAssessmentRequested",
      "ApplicabilityAssessmentPerformed",
      "ApplicabilityAssessmentConcluded",
      // decision-impact
      "DecisionImpactSweepRequested",
      "DecisionImpactAssessed",
      // eval
      "ExamSetRegistered",
      "EvalRunCompleted",
      // context-pack
      "ContextPackBuilt",
      // cross-tenant
      "CsiCategoryRegistered",
      "CsiCategoryRetired",
      "CrossTenantLearningScreened",
      "CrossTenantLearningBlocked",
    ];
    for (const type of expected) {
      expect(isV2EventTypeRegistered(type)).toBe(true);
    }
  });

  it("every registry row carries a payloadSchema, schemaVersion, retention, migrationStatus", () => {
    for (const row of V2_EVENT_TYPE_REGISTRY) {
      expect(row.payloadSchema).toBeDefined();
      expect(row.schemaVersion).toBeGreaterThan(0);
      expect(row.retention.minimumYears).toBeGreaterThan(0);
      expect(["v2-parallel", "v2-canonical", "v1-only"]).toContain(row.migrationStatus);
      expect(row.source.length).toBeGreaterThan(0);
    }
  });

  it("type names are unique (no duplicate registry rows)", () => {
    const names = V2_EVENT_TYPE_REGISTRY.map((r) => r.type);
    expect(new Set(names).size).toBe(names.length);
  });

  it("registeredV2EventTypes returns the sorted distinct set", () => {
    const got = registeredV2EventTypes();
    expect(got).toEqual([...got].sort());
    expect(got.length).toBe(V2_EVENT_TYPE_REGISTRY.length);
  });

  it("lookup returns undefined for an unregistered type", () => {
    expect(lookupV2EventType("NotARealEventType")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Payload validation
// ---------------------------------------------------------------------------

describe("validateV2Payload", () => {
  it("passes a valid payload for a registered type", () => {
    expect(() => validateV2Payload("TenantRegistered", validTenantRegistered)).not.toThrow();
  });

  it("throws (fail-closed) on an invalid payload for a registered type", () => {
    expect(() =>
      validateV2Payload("TenantRegistered", { tenantId: "no-prefix", tier: "Z" }),
    ).toThrow();
  });

  it("is a no-op for an unregistered type (build-phase forward compat)", () => {
    expect(() => validateV2Payload("SomeFutureType", { anything: true })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Control-plane store append-time behaviour
// ---------------------------------------------------------------------------

describe("control-plane store — Wave 0 append behaviour", () => {
  it("rejects (throws) a registered type with a bad payload", () => {
    const store = openControlPlaneStore(":memory:");
    try {
      expect(() =>
        store.append(cpEvent("TenantRegistered", { tenantId: "bad", tier: "Z" })),
      ).toThrow();
      expect(store.count()).toBe(0);
    } finally {
      store.close();
    }
  });

  it("accepts a registered type with a valid payload and stamps schemaVersion 1 by default", () => {
    const store = openControlPlaneStore(":memory:");
    try {
      store.append(cpEvent("TenantRegistered", validTenantRegistered));
      const [stored] = [...store.replay()];
      expect(stored).toBeDefined();
      expect(stored?.schemaVersion).toBe(1);
    } finally {
      store.close();
    }
  });

  it("accepts an unregistered type unvalidated (forward compat)", () => {
    const store = openControlPlaneStore(":memory:");
    try {
      store.append(cpEvent("SomeFutureNonFinancialType", { foo: "bar" }));
      expect(store.count()).toBe(1);
    } finally {
      store.close();
    }
  });

  it("derives retention_class from the registry row when omitted", () => {
    const store = openControlPlaneStore(":memory:");
    try {
      store.append(cpEvent("TenantRegistered", validTenantRegistered));
      const [stored] = [...store.replay()];
      // V2_RETENTION_RUNTIME_1Y.archivalTier === "hot-cool"
      expect(stored?.retentionClass).toBe("hot-cool");
    } finally {
      store.close();
    }
  });

  it("persists provenance + explicit schemaVersion + retentionClass and round-trips on replay", () => {
    const store = openControlPlaneStore(":memory:");
    try {
      store.append(
        cpEvent("TenantRegistered", validTenantRegistered, {
          schemaVersion: 2,
          provenance: { kind: "production", sourceLineage: "atlas:wave0-test" },
          retentionClass: "hot-cool-archive",
        }),
      );
      const [stored] = [...store.replay()];
      expect(stored?.schemaVersion).toBe(2);
      expect(stored?.provenance).toEqual({
        kind: "production",
        sourceLineage: "atlas:wave0-test",
      });
      expect(stored?.retentionClass).toBe("hot-cool-archive");
    } finally {
      store.close();
    }
  });

  it("leaves provenance/retention absent on replay when not provided for an unregistered type", () => {
    const store = openControlPlaneStore(":memory:");
    try {
      store.append(cpEvent("SomeFutureNonFinancialType", { foo: "bar" }));
      const [stored] = [...store.replay()];
      expect(stored?.provenance).toBeUndefined();
      expect(stored?.retentionClass).toBeUndefined();
      expect(stored?.schemaVersion).toBe(1);
    } finally {
      store.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Envelope schemaVersion
// ---------------------------------------------------------------------------

describe("V2Envelope schemaVersion", () => {
  const base = {
    eventId: "evt-1",
    issuedAt: "2026-06-16T00:00:00.000Z" as unknown as Instant,
    payload: { x: 1 },
  };

  it("defaults schemaVersion to 1 and tenantId to the anchor", () => {
    const env = createV2Envelope(base);
    expect(env.schemaVersion).toBe(V2_ENVELOPE_SCHEMA_VERSION_DEFAULT);
    expect(env.schemaVersion).toBe(1);
    expect(env.tenantId as string).toBe(ANCHOR_TENANT_ID);
  });

  it("accepts the back-compat positional tenantId form", () => {
    const env = createV2Envelope(base, "tenant:uk-bank" as TenantId);
    expect(env.tenantId as string).toBe("tenant:uk-bank");
    expect(env.schemaVersion).toBe(1);
  });

  it("accepts explicit schemaVersion + tenantId overrides", () => {
    const env = createV2Envelope(base, {
      tenantId: "tenant:uk-bank" as TenantId,
      schemaVersion: 3,
    });
    expect(env.tenantId as string).toBe("tenant:uk-bank");
    expect(env.schemaVersion).toBe(3);
  });

  it("the schema requires a positive integer schemaVersion", () => {
    const env = createV2Envelope(base);
    expect(v2EnvelopeSchema.safeParse(env).success).toBe(true);
    expect(v2EnvelopeSchema.safeParse({ ...env, schemaVersion: 0 }).success).toBe(false);
    expect(v2EnvelopeSchema.safeParse({ ...env, schemaVersion: 1.5 }).success).toBe(false);
  });
});
