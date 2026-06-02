// tests/model-registry-seed.test.ts
//
// Unit tests for seeds/models/model-registry-seed.ts.
//
// Assertions:
//   - Happy path: 3 models submitted, 3 tier-classified, 0 skipped.
//   - Idempotency: second call → 0 submitted, 0 tier-classified, 3 skipped.
//   - Model state: all 3 models have tierClassified=true after seed.
//   - Tier correctness: SAGB DCF → 3, ZARONIA IRS → 2, FX forward → 3.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import { LocalModelRegistry } from "../platform/model-registry/index";
import { seedModelRegistry } from "../platform/model-registry/pricing-model-definitions";

function newStore(): EventStore {
  return new EventStore();
}

describe("seedModelRegistry — happy path", () => {
  it("submits 3 models and classifies their tiers", () => {
    const store = newStore();
    const result = seedModelRegistry(store);

    expect(result.submitted).toHaveLength(3);
    expect(result.tierClassified).toHaveLength(3);
    expect(result.skipped).toHaveLength(0);

    expect(result.submitted).toContain("model:sagb-dcf-v1");
    expect(result.submitted).toContain("model:zaronia-ois-irspv-v1");
    expect(result.submitted).toContain("model:fx-forward-irp-v1");
  });

  it("all models are tier-classified after seed", () => {
    const store = newStore();
    seedModelRegistry(store);

    const registry = new LocalModelRegistry({ eventStore: store });
    const models = registry.list();

    expect(models).toHaveLength(3);
    for (const model of models) {
      expect(model.tierClassified).toBe(true);
    }
  });

  it("tier assignments match SR 11-7 classification", () => {
    const store = newStore();
    seedModelRegistry(store);

    const registry = new LocalModelRegistry({ eventStore: store });
    const byId = new Map(registry.list().map((m) => [m.modelId, m]));

    expect(byId.get("model:sagb-dcf-v1")?.tier).toBe(3);
    expect(byId.get("model:zaronia-ois-irspv-v1")?.tier).toBe(2);
    expect(byId.get("model:fx-forward-irp-v1")?.tier).toBe(3);
  });
});

describe("seedModelRegistry — idempotency", () => {
  it("second call skips all 3 models", () => {
    const store = newStore();
    seedModelRegistry(store);
    const second = seedModelRegistry(store);

    expect(second.submitted).toHaveLength(0);
    expect(second.tierClassified).toHaveLength(0);
    expect(second.skipped).toHaveLength(3);
  });

  it("model list unchanged after second call", () => {
    const store = newStore();
    seedModelRegistry(store);

    const registry = new LocalModelRegistry({ eventStore: store });
    const afterFirst = registry.list().length;

    seedModelRegistry(store);
    const afterSecond = registry.list().length;

    expect(afterSecond).toBe(afterFirst);
  });
});
