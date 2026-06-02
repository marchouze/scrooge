// tests/model-risk-validated-upgrade.test.ts
//
// Unit tests for seedValidatedModelRiskUpgrades() in
// seeds/products/npa-attestation-seed.ts.
//
// Assertions:
//   - No validations present → all 3 products blocked, 0 upgraded.
//   - All 3 models approved → all 3 products upgraded, 0 blocked.
//   - Partial approval (1 of 3) → 1 upgraded, 2 blocked.
//   - Idempotency: second call with approvals present → 3 skipped, 0 upgraded.
//   - Correct product↔model mapping verified via targeted approval.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { makeModelValidationApproved } from "../platform/event-store/event-types/model-risk";
import { EventStore } from "../platform/event-store/store";
import { seedValidatedModelRiskUpgrades } from "../platform/markets/products/npa-dimension-upgrades";

function newStore(): EventStore {
  return new EventStore();
}

function approveModel(store: EventStore, modelId: string): void {
  const ev = makeModelValidationApproved({
    asOf: "2026-05-27T06:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:nadia:test" },
    citations: ["D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
    payload: {
      modelId,
      version: "1.0.0",
      approvedBy: "agent:nadia:test",
      validationFindingsResolved: [],
      expiryDate: "2027-05-27",
    },
  });
  store.append(ev);
}

const BOND_PRODUCT = "prd:bank:bond:sagb-fixed-coupon";
const IRS_PRODUCT = "prd:bank:ird:vanilla-zar-fix-zaronia";
const FX_PRODUCT = "prd:bank:fx:fx-swap-usdzar";

const SAGB_MODEL = "model:sagb-dcf-v1";
const ZARONIA_MODEL = "model:zaronia-ois-irspv-v1";
const FX_MODEL = "model:fx-forward-irp-v1";

describe("seedValidatedModelRiskUpgrades — no validations present", () => {
  it("blocks all 3 products when no ModelValidationApproved events exist", () => {
    const store = newStore();
    const result = seedValidatedModelRiskUpgrades(store);

    expect(result.upgraded).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.blocked).toHaveLength(3);
    expect(result.blocked).toContain(BOND_PRODUCT);
    expect(result.blocked).toContain(IRS_PRODUCT);
    expect(result.blocked).toContain(FX_PRODUCT);
  });
});

describe("seedValidatedModelRiskUpgrades — all models approved", () => {
  it("upgrades all 3 products when all models are approved", () => {
    const store = newStore();
    approveModel(store, SAGB_MODEL);
    approveModel(store, ZARONIA_MODEL);
    approveModel(store, FX_MODEL);

    const result = seedValidatedModelRiskUpgrades(store);

    expect(result.upgraded).toHaveLength(3);
    expect(result.skipped).toHaveLength(0);
    expect(result.blocked).toHaveLength(0);
    expect(result.upgraded).toContain(BOND_PRODUCT);
    expect(result.upgraded).toContain(IRS_PRODUCT);
    expect(result.upgraded).toContain(FX_PRODUCT);
  });

  it("emits ProductDimensionAttested events for upgraded products", () => {
    const store = newStore();
    approveModel(store, SAGB_MODEL);
    approveModel(store, ZARONIA_MODEL);
    approveModel(store, FX_MODEL);
    seedValidatedModelRiskUpgrades(store);

    const attestations = Array.from(store.replay()).filter(
      (ev) =>
        ev.type === "ProductDimensionAttested" &&
        (ev.payload as Record<string, unknown>).dimension === "model-risk" &&
        (ev.payload as Record<string, unknown>).result === "implementation-attested",
    );

    expect(attestations).toHaveLength(3);
  });
});

describe("seedValidatedModelRiskUpgrades — partial approval", () => {
  it("upgrades only the approved product, blocks the rest", () => {
    const store = newStore();
    approveModel(store, SAGB_MODEL);

    const result = seedValidatedModelRiskUpgrades(store);

    expect(result.upgraded).toHaveLength(1);
    expect(result.upgraded).toContain(BOND_PRODUCT);
    expect(result.blocked).toHaveLength(2);
    expect(result.blocked).toContain(IRS_PRODUCT);
    expect(result.blocked).toContain(FX_PRODUCT);
  });

  it("upgrades only ZARONIA IRS when that model is approved", () => {
    const store = newStore();
    approveModel(store, ZARONIA_MODEL);

    const result = seedValidatedModelRiskUpgrades(store);

    expect(result.upgraded).toContain(IRS_PRODUCT);
    expect(result.blocked).toContain(BOND_PRODUCT);
    expect(result.blocked).toContain(FX_PRODUCT);
  });
});

describe("seedValidatedModelRiskUpgrades — idempotency", () => {
  it("second call skips all 3 already-upgraded products", () => {
    const store = newStore();
    approveModel(store, SAGB_MODEL);
    approveModel(store, ZARONIA_MODEL);
    approveModel(store, FX_MODEL);

    seedValidatedModelRiskUpgrades(store);
    const second = seedValidatedModelRiskUpgrades(store);

    expect(second.upgraded).toHaveLength(0);
    expect(second.blocked).toHaveLength(0);
    expect(second.skipped).toHaveLength(3);
  });

  it("emits no duplicate ProductDimensionAttested events on second call", () => {
    const store = newStore();
    approveModel(store, SAGB_MODEL);
    approveModel(store, ZARONIA_MODEL);
    approveModel(store, FX_MODEL);

    seedValidatedModelRiskUpgrades(store);
    seedValidatedModelRiskUpgrades(store);

    const attestations = Array.from(store.replay()).filter(
      (ev) =>
        ev.type === "ProductDimensionAttested" &&
        (ev.payload as Record<string, unknown>).dimension === "model-risk" &&
        (ev.payload as Record<string, unknown>).result === "implementation-attested",
    );

    expect(attestations).toHaveLength(3);
  });
});

describe("seedValidatedModelRiskUpgrades — late arrival", () => {
  it("upgrades blocked products on re-run after approval arrives", () => {
    const store = newStore();

    // First pass — no validations.
    const first = seedValidatedModelRiskUpgrades(store);
    expect(first.blocked).toHaveLength(3);

    // Validations arrive (Nadia PR-G lands).
    approveModel(store, SAGB_MODEL);
    approveModel(store, ZARONIA_MODEL);
    approveModel(store, FX_MODEL);

    // Second pass — should upgrade all 3.
    const second = seedValidatedModelRiskUpgrades(store);
    expect(second.upgraded).toHaveLength(3);
    expect(second.blocked).toHaveLength(0);
  });
});
