// v2-core/control-plane/tenant-store.test.ts
//
// Unit tests for the V2 S10 tenant-axis ENFORCEMENT seam: per-tenant store
// routing (fail-closed on unknown tenant), tenant-scoped reads (no cross-tenant
// bleed), and the swappable resolver through the shared alias-registry.
//
// Author: Atlas (Substrate Architect, engineering).

import { afterEach, describe, expect, it } from "bun:test";
import { ANCHOR_TENANT_ID, type TenantId, tenantIdSchema } from "./tenant";
import {
  type TenantEventStore,
  TenantScopedStore,
  type TenantTaggedEvent,
  UnknownTenantError,
  makeAnchorOnlyResolver,
  makeRegistryResolver,
  resetTenantStoreResolver,
  resolveTenantStore,
  resolveTenantStoreResolver,
  swapTenantStoreResolver,
} from "./tenant-store";

// ---------------------------------------------------------------------------
// In-memory underlying store — a dumb bag of rows (the substrate the scoped
// wrapper enforces over). Deliberately NOT tenant-aware so the scoped wrapper's
// isolation is what is under test.
// ---------------------------------------------------------------------------

function memStore(rows: TenantTaggedEvent[] = []): TenantEventStore {
  const data = [...rows];
  return {
    append(e) {
      data.push(e);
    },
    *replayAll() {
      yield* data;
    },
    count() {
      return data.length;
    },
  };
}

const ANCHOR = ANCHOR_TENANT_ID as TenantId;
const OTHER = tenantIdSchema.parse("tenant:other-bank");

function evt(tenantId: TenantId, eventId: string, type = "V2ProductRegistered"): TenantTaggedEvent {
  return {
    tenantId,
    eventId,
    type,
    asOf: "2026-06-13T00:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    payload: { eventId },
  };
}

afterEach(() => {
  resetTenantStoreResolver();
});

// ---------------------------------------------------------------------------
// TenantScopedStore — isolation
// ---------------------------------------------------------------------------

describe("TenantScopedStore", () => {
  it("yields only the bound tenant's rows (tenant A never sees tenant B)", () => {
    const underlying = memStore([
      evt(ANCHOR, "a1"),
      evt(OTHER, "b1"),
      evt(ANCHOR, "a2"),
      evt(OTHER, "b2"),
    ]);
    const scopedA = new TenantScopedStore(ANCHOR, underlying);
    const got = scopedA.readAll();
    expect(got.map((e) => e.eventId).sort()).toEqual(["a1", "a2"]);
    // No tenant-B row leaked.
    expect(got.every((e) => e.tenantId === ANCHOR)).toBe(true);
  });

  it("counts cross-tenant bleed it drops (non-vacuous isolation)", () => {
    const underlying = memStore([evt(ANCHOR, "a1"), evt(OTHER, "b1"), evt(OTHER, "b2")]);
    const scopedA = new TenantScopedStore(ANCHOR, underlying);
    scopedA.readAll();
    const stats = scopedA.stats();
    expect(stats.admitted).toBe(1);
    expect(stats.bleedDropped).toBe(2);
  });

  it("refuses a cross-tenant write (fail-closed)", () => {
    const scopedA = new TenantScopedStore(ANCHOR, memStore());
    expect(() => scopedA.append(evt(OTHER, "b1"))).toThrow(/cross-tenant write blocked/);
  });

  it("admits a matching-tenant write", () => {
    const underlying = memStore();
    const scopedA = new TenantScopedStore(ANCHOR, underlying);
    scopedA.append(evt(ANCHOR, "a1"));
    expect(underlying.count()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Resolver — fail-closed routing
// ---------------------------------------------------------------------------

describe("tenant-store resolver", () => {
  it("eager default fails closed on EVERY tenant (enforcement active, not dark)", () => {
    // No resolver swapped in yet — the default rejects even the anchor.
    expect(() => resolveTenantStore(ANCHOR)).toThrow(UnknownTenantError);
    expect(() => resolveTenantStore(OTHER)).toThrow(UnknownTenantError);
  });

  it("anchor-only resolver resolves the anchor and rejects others", () => {
    const restore = swapTenantStoreResolver(makeAnchorOnlyResolver(memStore([evt(ANCHOR, "a1")])));
    try {
      const store = resolveTenantStore(ANCHOR);
      expect(store.tenantId).toBe(ANCHOR);
      expect(store.readAll().map((e) => e.eventId)).toEqual(["a1"]);
      expect(() => resolveTenantStore(OTHER)).toThrow(UnknownTenantError);
    } finally {
      restore.restore();
    }
  });

  it("registry resolver routes by tenantId and isolates the two stores", () => {
    const stores = new Map<TenantId, TenantEventStore>([
      [ANCHOR, memStore([evt(ANCHOR, "a1"), evt(ANCHOR, "a2")])],
      [OTHER, memStore([evt(OTHER, "b1")])],
    ]);
    const restore = swapTenantStoreResolver(makeRegistryResolver(stores));
    try {
      expect(
        resolveTenantStore(ANCHOR)
          .readAll()
          .map((e) => e.eventId),
      ).toEqual(["a1", "a2"]);
      expect(
        resolveTenantStore(OTHER)
          .readAll()
          .map((e) => e.eventId),
      ).toEqual(["b1"]);
      // A tenant absent from the registry fails closed.
      const ghost = tenantIdSchema.parse("tenant:ghost");
      expect(() => resolveTenantStore(ghost)).toThrow(UnknownTenantError);
    } finally {
      restore.restore();
    }
  });

  it("swap returns a restore handle that reinstates the previous resolver", () => {
    const before = resolveTenantStoreResolver();
    const restore = swapTenantStoreResolver(makeAnchorOnlyResolver(memStore()));
    expect(resolveTenantStoreResolver()).not.toBe(before);
    restore.restore();
    expect(resolveTenantStoreResolver()).toBe(before);
  });

  it("UnknownTenantError carries the offending tenantId", () => {
    try {
      resolveTenantStore(OTHER);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownTenantError);
      expect((e as UnknownTenantError).tenantId).toBe(OTHER);
    }
  });
});
