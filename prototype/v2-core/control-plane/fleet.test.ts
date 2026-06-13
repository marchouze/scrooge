// v2-core/control-plane/fleet.test.ts
//
// Unit tests for the V2 S14 operational fleet layer (FleetProjection).
// Drives the projection over an in-memory control-plane store so the proofs
// run deterministically on any runner.
//
// Author: Sade (AgentOps, operations).

import { describe, expect, it } from "bun:test";

import {
  type ControlPlaneStore,
  type CpEvent,
  TENANT_METER_EVENT,
  TENANT_REGISTERED,
  TENANT_SURFACE_GRANTED,
  TENANT_UPGRADE_LEDGER_ENTRY,
  buildFleetProjection,
  comparePlatformVersions,
  openControlPlaneStore,
  parsePlatformVersion,
} from "./index";

const ENTITY = "control-plane";
const ACTOR = { type: "service" as const, id: "test:fleet" };
const CITES: string[] = ["D-V2-TENANCY-ARCHITECTURE"];

let idCounter = 0;
function evt(type: string, payload: Record<string, unknown>): CpEvent {
  idCounter += 1;
  return {
    event_id: `evt-${idCounter}`,
    type,
    as_of: "2026-06-13T00:00:00.000Z",
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload,
  };
}

function register(tenantId: string, tier: "K" | "R" | "C"): CpEvent {
  return evt(TENANT_REGISTERED, {
    tenantId,
    tier,
    displayName: `Tenant ${tenantId}`,
    legalEntityRef: `LE-${tenantId}`,
    registeredAt: "2026-06-13T00:00:00.000Z",
  });
}

function grant(tenantId: string, surfaceVersion: string, tier: "K" | "R" | "C"): CpEvent {
  return evt(TENANT_SURFACE_GRANTED, {
    tenantId,
    surfaceVersion,
    tier,
    grantedAt: "2026-06-13T00:00:00.000Z",
  });
}

function upgrade(tenantId: string, fromVersion: string, toVersion: string): CpEvent {
  return evt(TENANT_UPGRADE_LEDGER_ENTRY, {
    tenantId,
    fromVersion,
    toVersion,
    appliedAt: "2026-06-13T00:00:00.000Z",
  });
}

function meter(
  tenantId: string,
  metricKey: string,
  quantity: number,
  windowStart: string,
  windowEnd: string,
): CpEvent {
  return evt(TENANT_METER_EVENT, { tenantId, metricKey, quantity, windowStart, windowEnd });
}

function storeWith(events: CpEvent[]): ControlPlaneStore {
  const store = openControlPlaneStore(":memory:");
  for (const e of events) store.append(e);
  return store;
}

describe("version comparison helpers", () => {
  it("parses and treats missing trailing components as 0", () => {
    expect(parsePlatformVersion("v1.0")).toEqual([1, 0]);
    expect(parsePlatformVersion("V2")).toEqual([2]);
    expect(parsePlatformVersion("1.10.3")).toEqual([1, 10, 3]);
    expect(parsePlatformVersion("")).toBeNull();
  });

  it("orders versions numerically, not lexically", () => {
    expect(comparePlatformVersions("v1.0", "v1.1")).toBeLessThan(0);
    expect(comparePlatformVersions("v1.10", "v1.9")).toBeGreaterThan(0); // not "1.10" < "1.9"
    expect(comparePlatformVersions("v1", "v1.0")).toBe(0);
    expect(comparePlatformVersions("v2.0", "v1.9")).toBeGreaterThan(0);
  });
});

describe("FleetProjection — fleet register", () => {
  it("derives active status for a tenant with surface + current version", () => {
    const store = storeWith([
      register("tenant:za-bank", "K"),
      grant("tenant:za-bank", "v1.0", "K"),
      upgrade("tenant:za-bank", "v0", "v1.0"),
    ]);
    const fleet = buildFleetProjection(store);
    const state = fleet.getTenantFleetState("tenant:za-bank");
    expect(state).not.toBeNull();
    expect(state?.tier).toBe("K");
    expect(state?.surfaceVersion).toBe("v1.0");
    expect(state?.platformVersion).toBe("v1.0");
    expect(state?.status).toBe("active");
    store.close();
  });

  it("derives suspended status when a tenant has no surface grant", () => {
    const store = storeWith([register("tenant:dark", "R")]);
    const fleet = buildFleetProjection(store);
    expect(fleet.getTenantFleetState("tenant:dark")?.status).toBe("suspended");
    store.close();
  });

  it("derives behind-on-upgrade when a tenant trails the fleet version", () => {
    const store = storeWith([
      register("tenant:a", "K"),
      grant("tenant:a", "v1.0", "K"),
      upgrade("tenant:a", "v0", "v1.1"), // fleet-leading version
      register("tenant:b", "R"),
      grant("tenant:b", "v1.0", "R"),
      upgrade("tenant:b", "v0", "v1.0"), // behind v1.1
    ]);
    const fleet = buildFleetProjection(store);
    expect(fleet.fleetCurrentVersion()).toBe("v1.1");
    expect(fleet.getTenantFleetState("tenant:a")?.status).toBe("active");
    expect(fleet.getTenantFleetState("tenant:b")?.status).toBe("behind-on-upgrade");
    store.close();
  });

  it("reports last-meter activity as the latest windowEnd", () => {
    const store = storeWith([
      register("tenant:a", "K"),
      grant("tenant:a", "v1.0", "K"),
      meter("tenant:a", "api-calls", 10, "2026-06-01T00:00:00Z", "2026-06-02T00:00:00Z"),
      meter("tenant:a", "api-calls", 5, "2026-06-03T00:00:00Z", "2026-06-04T00:00:00Z"),
    ]);
    const fleet = buildFleetProjection(store);
    expect(fleet.getTenantFleetState("tenant:a")?.lastMeterActivity).toBe("2026-06-04T00:00:00Z");
    store.close();
  });

  it("returns null fleet state for an unknown tenant", () => {
    const store = storeWith([register("tenant:a", "K")]);
    const fleet = buildFleetProjection(store);
    expect(fleet.getTenantFleetState("tenant:nope")).toBeNull();
    store.close();
  });

  it("listFleet covers every registered tenant", () => {
    const store = storeWith([register("tenant:a", "K"), register("tenant:b", "R")]);
    const fleet = buildFleetProjection(store);
    expect(
      fleet
        .listFleet()
        .map((f) => f.tenantId)
        .sort(),
    ).toEqual(["tenant:a", "tenant:b"]);
    store.close();
  });
});

describe("FleetProjection — metering aggregation", () => {
  const WINDOW = { windowStart: "2026-06-01T00:00:00Z", windowEnd: "2026-06-30T00:00:00Z" };

  it("sums per-metric within a window and excludes out-of-window events", () => {
    const store = storeWith([
      register("tenant:a", "K"),
      meter("tenant:a", "api-calls", 10, "2026-06-02T00:00:00Z", "2026-06-03T00:00:00Z"),
      meter("tenant:a", "api-calls", 7, "2026-06-04T00:00:00Z", "2026-06-05T00:00:00Z"),
      meter("tenant:a", "trade-events", 3, "2026-06-06T00:00:00Z", "2026-06-07T00:00:00Z"),
      // out of window — should be excluded
      meter("tenant:a", "api-calls", 99, "2026-07-01T00:00:00Z", "2026-07-02T00:00:00Z"),
    ]);
    const fleet = buildFleetProjection(store);
    const summary = fleet.meteringSummary("tenant:a", WINDOW);
    expect(summary.perMetric).toEqual([
      { metricKey: "api-calls", quantity: 17 },
      { metricKey: "trade-events", quantity: 3 },
    ]);
    expect(summary.total).toBe(20);
    store.close();
  });

  it("fleetMeteringSummary covers every tenant + a grand total", () => {
    const store = storeWith([
      register("tenant:a", "K"),
      register("tenant:b", "R"),
      meter("tenant:a", "api-calls", 10, "2026-06-02T00:00:00Z", "2026-06-03T00:00:00Z"),
      meter("tenant:b", "api-calls", 5, "2026-06-02T00:00:00Z", "2026-06-03T00:00:00Z"),
    ]);
    const fleet = buildFleetProjection(store);
    const summary = fleet.fleetMeteringSummary(WINDOW);
    expect(summary.tenants.map((t) => t.tenantId).sort()).toEqual(["tenant:a", "tenant:b"]);
    expect(summary.fleetTotal).toBe(15);
    store.close();
  });

  it("returns zero totals for a tenant with no metering", () => {
    const store = storeWith([register("tenant:a", "K")]);
    const fleet = buildFleetProjection(store);
    const summary = fleet.meteringSummary("tenant:a", WINDOW);
    expect(summary.perMetric).toEqual([]);
    expect(summary.total).toBe(0);
    store.close();
  });
});

describe("FleetProjection — upgrade ledger + version drift", () => {
  it("tenantVersion reflects the latest ledger toVersion", () => {
    const store = storeWith([
      register("tenant:a", "K"),
      upgrade("tenant:a", "v0", "v1.0"),
      upgrade("tenant:a", "v1.0", "v1.1"),
    ]);
    const fleet = buildFleetProjection(store);
    expect(fleet.tenantVersion("tenant:a")).toBe("v1.1");
    expect(fleet.tenantUpgradeHistory("tenant:a").map((u) => u.toVersion)).toEqual([
      "v1.0",
      "v1.1",
    ]);
    store.close();
  });

  it("fleetVersionDrift lists tenants behind the target (including version-less)", () => {
    const store = storeWith([
      register("tenant:a", "K"),
      upgrade("tenant:a", "v0", "v1.1"), // at target
      register("tenant:b", "R"),
      upgrade("tenant:b", "v0", "v1.0"), // behind
      register("tenant:c", "C"), // no upgrade entry → version-less, behind
    ]);
    const fleet = buildFleetProjection(store);
    const drift = fleet.fleetVersionDrift("v1.1");
    const byTenant = Object.fromEntries(drift.map((d) => [d.tenantId, d.currentVersion]));
    expect(byTenant).toEqual({ "tenant:b": "v1.0", "tenant:c": null });
    expect(byTenant["tenant:a"]).toBeUndefined(); // at target → not behind
    store.close();
  });
});
