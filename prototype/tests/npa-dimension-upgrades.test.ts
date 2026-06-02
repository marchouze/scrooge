// tests/npa-dimension-upgrades.test.ts
//
// Unit tests for seedSubstrateReadyDimensionUpgrades() in
// seeds/products/npa-attestation-seed.ts.
//
// Assertions:
//   - Happy path: 18 upgrades emitted (4 products × mixed dimensions).
//   - Correct product/dimension coverage per product.
//   - IRS capital + legal excluded (already implementation-attested upstream).
//   - Idempotency: second call → 18 skipped, 0 upgraded.
//   - No duplicate ProductDimensionAttested events emitted.
//   - Upgrade respects pre-existing impl-attested events (skips them).
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { makeProductDimensionAttested } from "../platform/event-store/event-types/product";
import { EventStore } from "../platform/event-store/store";
import { seedSubstrateReadyDimensionUpgrades } from "../platform/markets/products/npa-dimension-upgrades";

function newStore(): EventStore {
  return new EventStore();
}

const BOND = "prd:bank:bond:sagb-fixed-coupon";
const REPO = "prd:bank:bond:open-repo-gmra";
const IRS = "prd:bank:ird:vanilla-zar-fix-zaronia";
const FX = "prd:bank:fx:fx-swap-usdzar";

// Expected upgrades per product
const BOND_DIMS = ["market-risk", "operational-readiness", "accounting", "capital", "legal"];
const REPO_DIMS = ["market-risk", "operational-readiness", "accounting", "capital", "legal"];
const IRS_DIMS = ["market-risk", "operational-readiness", "accounting"]; // capital+legal already attested
const FX_DIMS = ["market-risk", "operational-readiness", "accounting", "capital", "legal"];
const TOTAL = BOND_DIMS.length + REPO_DIMS.length + IRS_DIMS.length + FX_DIMS.length; // 18

describe("seedSubstrateReadyDimensionUpgrades — happy path", () => {
  it("emits 18 upgrades on a fresh store", () => {
    const store = newStore();
    const result = seedSubstrateReadyDimensionUpgrades(store);

    expect(result.upgraded).toHaveLength(TOTAL);
    expect(result.skipped).toHaveLength(0);
  });

  it("upgrades expected dimensions for each product", () => {
    const store = newStore();
    const result = seedSubstrateReadyDimensionUpgrades(store);

    for (const dim of BOND_DIMS) expect(result.upgraded).toContain(`${BOND}:${dim}`);
    for (const dim of REPO_DIMS) expect(result.upgraded).toContain(`${REPO}:${dim}`);
    for (const dim of IRS_DIMS) expect(result.upgraded).toContain(`${IRS}:${dim}`);
    for (const dim of FX_DIMS) expect(result.upgraded).toContain(`${FX}:${dim}`);
  });

  it("IRS capital and legal are NOT in the upgrade list", () => {
    const store = newStore();
    const result = seedSubstrateReadyDimensionUpgrades(store);

    expect(result.upgraded).not.toContain(`${IRS}:capital`);
    expect(result.upgraded).not.toContain(`${IRS}:legal`);
  });

  it("emits exactly 18 ProductDimensionAttested events with result=implementation-attested", () => {
    const store = newStore();
    seedSubstrateReadyDimensionUpgrades(store);

    const events = Array.from(store.replay()).filter(
      (ev) =>
        ev.type === "ProductDimensionAttested" &&
        (ev.payload as Record<string, unknown>).result === "implementation-attested",
    );
    expect(events).toHaveLength(TOTAL);
  });
});

describe("seedSubstrateReadyDimensionUpgrades — idempotency", () => {
  it("second call skips all 18 — no duplicates", () => {
    const store = newStore();
    seedSubstrateReadyDimensionUpgrades(store);
    const second = seedSubstrateReadyDimensionUpgrades(store);

    expect(second.upgraded).toHaveLength(0);
    expect(second.skipped).toHaveLength(TOTAL);
  });

  it("event count unchanged after second call", () => {
    const store = newStore();
    seedSubstrateReadyDimensionUpgrades(store);
    const afterFirst = Array.from(store.replay()).length;

    seedSubstrateReadyDimensionUpgrades(store);
    const afterSecond = Array.from(store.replay()).length;

    expect(afterSecond).toBe(afterFirst);
  });
});

describe("seedSubstrateReadyDimensionUpgrades — pre-existing attestations", () => {
  it("skips a dimension already at implementation-attested", () => {
    const store = newStore();

    // Pre-attest bond market-risk
    store.append(
      makeProductDimensionAttested({
        asOf: "2026-05-27T00:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:test" },
        citations: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        payload: {
          productId: BOND,
          dimension: "market-risk",
          result: "implementation-attested",
          citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        },
      }),
    );

    const result = seedSubstrateReadyDimensionUpgrades(store);

    expect(result.skipped).toContain(`${BOND}:market-risk`);
    expect(result.upgraded).not.toContain(`${BOND}:market-risk`);
    expect(result.upgraded).toHaveLength(TOTAL - 1);
  });
});
