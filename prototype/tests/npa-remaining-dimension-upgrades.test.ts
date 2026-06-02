// tests/npa-remaining-dimension-upgrades.test.ts
//
// Unit tests for seedRemainingDimensionUpgrades() in
// seeds/products/npa-attestation-seed.ts.
//
// Assertions:
//   - Happy path: 15 upgrades emitted (3 dimensions × 5 products).
//   - All 3 remaining dimensions present for each product.
//   - Tax is NOT included (deferred to revenue-start).
//   - Idempotency: second call → 15 skipped, 0 upgraded.
//   - Pre-existing impl-attested events are respected.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { makeProductDimensionAttested } from "../platform/event-store/event-types/product";
import { EventStore } from "../platform/event-store/store";
import { seedRemainingDimensionUpgrades } from "../platform/markets/products/npa-dimension-upgrades";

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
const REMAINING_DIMS = ["credit-risk", "liquidity-risk", "operational-risk"];
const TOTAL = REMAINING_DIMS.length * ALL_PRODUCTS.length; // 15

describe("seedRemainingDimensionUpgrades — happy path", () => {
  it("emits 15 upgrades on a fresh store", () => {
    const store = newStore();
    const result = seedRemainingDimensionUpgrades(store);

    expect(result.upgraded).toHaveLength(TOTAL);
    expect(result.skipped).toHaveLength(0);
  });

  it("covers all 3 remaining dimensions for every product", () => {
    const store = newStore();
    const result = seedRemainingDimensionUpgrades(store);

    for (const pid of ALL_PRODUCTS) {
      for (const dim of REMAINING_DIMS) {
        expect(result.upgraded).toContain(`${pid}:${dim}`);
      }
    }
  });

  it("does not include tax (deferred to revenue-start)", () => {
    const store = newStore();
    const result = seedRemainingDimensionUpgrades(store);

    for (const pid of ALL_PRODUCTS) {
      expect(result.upgraded).not.toContain(`${pid}:tax`);
    }
  });

  it("emits 15 ProductDimensionAttested events with result=implementation-attested", () => {
    const store = newStore();
    seedRemainingDimensionUpgrades(store);

    const events = Array.from(store.replay()).filter(
      (ev) =>
        ev.type === "ProductDimensionAttested" &&
        (ev.payload as Record<string, unknown>).result === "implementation-attested",
    );
    expect(events).toHaveLength(TOTAL);
  });
});

describe("seedRemainingDimensionUpgrades — idempotency", () => {
  it("second call skips all 15", () => {
    const store = newStore();
    seedRemainingDimensionUpgrades(store);
    const second = seedRemainingDimensionUpgrades(store);

    expect(second.upgraded).toHaveLength(0);
    expect(second.skipped).toHaveLength(TOTAL);
  });

  it("event count unchanged after second call", () => {
    const store = newStore();
    seedRemainingDimensionUpgrades(store);
    const afterFirst = Array.from(store.replay()).length;

    seedRemainingDimensionUpgrades(store);
    expect(Array.from(store.replay()).length).toBe(afterFirst);
  });
});

describe("seedRemainingDimensionUpgrades — pre-existing attestations", () => {
  it("skips a dimension already at implementation-attested", () => {
    const store = newStore();

    store.append(
      makeProductDimensionAttested({
        asOf: "2026-05-27T00:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:test" },
        citations: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        payload: {
          productId: "prd:bank:equity:jse-equity-cash",
          dimension: "credit-risk",
          result: "implementation-attested",
          citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        },
      }),
    );

    const result = seedRemainingDimensionUpgrades(store);

    expect(result.skipped).toContain("prd:bank:equity:jse-equity-cash:credit-risk");
    expect(result.upgraded).not.toContain("prd:bank:equity:jse-equity-cash:credit-risk");
    expect(result.upgraded).toHaveLength(TOTAL - 1);
  });
});
