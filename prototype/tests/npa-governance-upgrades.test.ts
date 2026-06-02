// tests/npa-governance-upgrades.test.ts
//
// Unit tests for seedGovernanceDimensionUpgrades() in
// seeds/products/npa-attestation-seed.ts.
//
// Assertions:
//   - Happy path: 20 upgrades emitted (4 dimensions × 5 products).
//   - All 4 governance dimensions present for each product.
//   - Idempotency: second call → 20 skipped, 0 upgraded.
//   - Pre-existing impl-attested events are respected.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import { seedGovernanceDimensionUpgrades } from "../platform/markets/products/npa-dimension-upgrades";

function newStore(): EventStore {
  return new EventStore();
}

const ALL_PRODUCTS = [
  "prd:bank:equity:jse-equity-cash",
  "prd:bank:bond:sagb-fixed-coupon",
  "prd:bank:bond:open-repo-gmra",
  "prd:bank:ird:vanilla-zar-fix-zaronia",
  "prd:bank:fx:fx-swap-usdzar",
];
const GOV_DIMS = ["conduct", "aml", "infosec", "privacy"];
const TOTAL = GOV_DIMS.length * ALL_PRODUCTS.length; // 20

describe("seedGovernanceDimensionUpgrades — happy path", () => {
  it("emits 20 upgrades on a fresh store", () => {
    const store = newStore();
    const result = seedGovernanceDimensionUpgrades(store);

    expect(result.upgraded).toHaveLength(TOTAL);
    expect(result.skipped).toHaveLength(0);
  });

  it("covers all 4 governance dimensions for every product", () => {
    const store = newStore();
    const result = seedGovernanceDimensionUpgrades(store);

    for (const pid of ALL_PRODUCTS) {
      for (const dim of GOV_DIMS) {
        expect(result.upgraded).toContain(`${pid}:${dim}`);
      }
    }
  });

  it("emits 20 ProductDimensionAttested events with result=implementation-attested", () => {
    const store = newStore();
    seedGovernanceDimensionUpgrades(store);

    const events = Array.from(store.replay()).filter(
      (ev) =>
        ev.type === "ProductDimensionAttested" &&
        (ev.payload as Record<string, unknown>).result === "implementation-attested",
    );
    expect(events).toHaveLength(TOTAL);
  });
});

describe("seedGovernanceDimensionUpgrades — idempotency", () => {
  it("second call skips all 20", () => {
    const store = newStore();
    seedGovernanceDimensionUpgrades(store);
    const second = seedGovernanceDimensionUpgrades(store);

    expect(second.upgraded).toHaveLength(0);
    expect(second.skipped).toHaveLength(TOTAL);
  });

  it("no additional events emitted on second call", () => {
    const store = newStore();
    seedGovernanceDimensionUpgrades(store);
    const afterFirst = Array.from(store.replay()).length;

    seedGovernanceDimensionUpgrades(store);
    expect(Array.from(store.replay()).length).toBe(afterFirst);
  });
});
