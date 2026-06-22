// dashboard/v2-bank-config-view.test.ts
//
// Coverage tests for the V2 Bank Config view + the store inventory it renders.
// Asserts the inventory covers every expected store, the load-bearing tier
// classification (event.db canonical, market-data.db OBSERVATION not events),
// and the view groups + advertises every store with a resolved path/source.
//
// Authority: D-BANK-CONFIG-STORE (centralized config, 2026-05-25).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";
import {
  STORE_INVENTORY,
  STORE_TIER_LABELS,
  STORE_TIER_ORDER,
  inventoryEnvVars,
} from "../platform/config/store-inventory";
import { buildBankConfigView } from "./v2-bank-config-view";

const EXPECTED_STORES = [
  "event.db",
  "market-data.db",
  "graph.db",
  "v2-anchor.db",
  "v2-control-plane.db",
  "documents/",
  "archive/",
] as const;

describe("store inventory", () => {
  it("covers every expected store exactly once", () => {
    const names = STORE_INVENTORY.map((s) => s.name).sort();
    expect(names).toEqual([...EXPECTED_STORES].sort());
  });

  it("classifies event.db as the canonical event store", () => {
    const event = STORE_INVENTORY.find((s) => s.name === "event.db");
    expect(event).toBeDefined();
    expect(event?.tier).toBe("canonical");
  });

  it("classifies market-data.db as OBSERVATION — not events", () => {
    const md = STORE_INVENTORY.find((s) => s.name === "market-data.db");
    expect(md).toBeDefined();
    expect(md?.tier).toBe("observation");
    // The load-bearing distinction is in the tier label + purpose wording.
    expect(STORE_TIER_LABELS.observation).toContain("NOT events");
    expect(md?.purpose).toContain("OBSERVATION");
    expect(md?.purpose).toContain("NOT events");
  });

  it("classifies the rebuildable stores as projections", () => {
    for (const name of ["graph.db", "v2-anchor.db", "v2-control-plane.db"]) {
      expect(STORE_INVENTORY.find((s) => s.name === name)?.tier).toBe("projection");
    }
  });

  it("classifies the document + archive stores as blob", () => {
    for (const name of ["documents/", "archive/"]) {
      expect(STORE_INVENTORY.find((s) => s.name === name)?.tier).toBe("blob");
    }
  });

  it("gives every store a non-empty env var + purpose + module", () => {
    for (const s of STORE_INVENTORY) {
      expect(s.envVar.length).toBeGreaterThan(0);
      expect(s.purpose.length).toBeGreaterThan(0);
      expect(s.module.length).toBeGreaterThan(0);
      expect(STORE_TIER_ORDER).toContain(s.tier);
    }
  });

  it("records the v2-control-plane de-dup gap (no silent divergence)", () => {
    const cp = STORE_INVENTORY.find((s) => s.name === "v2-control-plane.db");
    expect(cp?.dedupGap).toBeDefined();
    expect(cp?.dedupGap).toContain("v2-no-v1-import");
    // The de-dup-gap store carries no configKey (resolved by a standalone resolver).
    expect(cp?.configKey).toBeUndefined();
  });

  it("exposes the env-var list for the recon coverage gate", () => {
    expect(inventoryEnvVars()).toEqual(STORE_INVENTORY.map((s) => s.envVar));
  });
});

describe("buildBankConfigView", () => {
  it("groups stores by tier in canonical → observation → projection → blob order", () => {
    const view = buildBankConfigView();
    expect(view.tierGroups.map((g) => g.tier)).toEqual([...STORE_TIER_ORDER]);
    expect(view.storeCount).toBe(STORE_INVENTORY.length);
  });

  it("places event.db under canonical and market-data.db under observation", () => {
    const view = buildBankConfigView();
    const canonical = view.tierGroups.find((g) => g.tier === "canonical");
    const observation = view.tierGroups.find((g) => g.tier === "observation");
    expect(canonical?.stores.some((s) => s.name === "event.db")).toBe(true);
    expect(observation?.stores.some((s) => s.name === "market-data.db")).toBe(true);
    expect(observation?.label).toContain("NOT events");
  });

  it("advertises a resolved path + source for every config-resolved store", () => {
    const view = buildBankConfigView();
    const rows = view.tierGroups.flatMap((g) => g.stores);
    for (const row of rows) {
      // Every config-keyed store has a resolved path + a source badge.
      const store = STORE_INVENTORY.find((s) => s.name === row.name);
      if (store?.configKey) {
        expect(row.resolvedPath).not.toBeNull();
        expect(["env", "file", "default"]).toContain(row.source);
      }
      // status is best-effort but always present (never throws on a missing file).
      expect(typeof row.status.present).toBe("boolean");
    }
  });

  it("surfaces the read-only PATCH deferral + the de-dup gap as deferred gaps", () => {
    const view = buildBankConfigView();
    expect(view.deferredGaps.some((g) => /read-only/i.test(g))).toBe(true);
    expect(view.deferredGaps.some((g) => /v2-control-plane\.db/.test(g))).toBe(true);
  });
});
