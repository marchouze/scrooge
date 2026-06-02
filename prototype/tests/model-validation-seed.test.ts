// tests/model-validation-seed.test.ts
//
// PR-G exit-criterion tests: model-validation seed (Tier-2/3 methodology + sign-offs).
//
// Tests:
//   1. Happy path: after seedModelRegistry (submit+classifyTier for 3 models),
//      seedValidationMethodologies publishes 2, seedModelValidations approves 3.
//   2. Idempotency: second call returns all skipped.
//   3. Missing model: seedModelValidations on empty store skips gracefully (doesn't throw).
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10)
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10)
//
// Author: Nadia (Independent model-validation engineer)

import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";

import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";
import { LocalModelRegistry } from "../platform/model-registry/index";
import {
  seedModelValidations,
  seedValidationMethodologies,
} from "../platform/model-registry/pricing-model-definitions";

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

const AS_OF = "2026-05-27T00:00:00.000Z";
const ENTITY = "LE-ZA-HOZ-BANK";

const ROHAN_ACTOR: Actor = { type: "service", id: "agent:rohan:risk-run" };
const NADIA_ACTOR: Actor = { type: "service", id: "agent:nadia:model-validation" };

const SEED_CITATIONS = [
  "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
  "D-PRODUCT-CONSTRUCTION-SLICES-4-8",
];

// A valid SHA-256 hex string for methodologyHash in ModelSubmitted.
const DUMMY_HASH = createHash("sha256").update("test-seed-dummy-hash").digest("hex");

/** Three model definitions that match what the seed expects. */
const SEED_MODELS = [
  {
    modelId: "model:sagb-dcf-v1",
    version: "v1.0",
    tier: 3 as const,
    description: "SAGB DCF valuation — standard discounted-cash-flow for SA government bonds",
  },
  {
    modelId: "model:zaronia-ois-irspv-v1",
    version: "v1.0",
    tier: 2 as const,
    description:
      "ZARONIA OIS IRS present-value pricing engine — ZAR fixed vs ZARONIA OIS discounting",
  },
  {
    modelId: "model:fx-forward-irp-v1",
    version: "v1.0",
    tier: 3 as const,
    description: "FX forward pricing — interest-rate-parity formula (USD/ZAR, textbook IRP)",
  },
];

/**
 * Bootstrap the model registry for the three seed models — submit + classifyTier.
 * This simulates what PR-F (Rohan's model-submission seed) would do.
 */
function seedModelRegistry(store: EventStore): void {
  const registry = new LocalModelRegistry({ eventStore: store });
  for (const m of SEED_MODELS) {
    registry.submit({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ROHAN_ACTOR,
      citations: SEED_CITATIONS,
      modelId: m.modelId,
      submittedBy: "agent:rohan:risk-model-submission",
      version: m.version,
      tier: m.tier,
      methodologyHash: DUMMY_HASH,
      description: m.description,
    });
    registry.classifyTier({
      asOf: AS_OF,
      entity: ENTITY,
      actor: NADIA_ACTOR,
      citations: SEED_CITATIONS,
      modelId: m.modelId,
      classifiedBy: "agent:nadia:model-validation",
      tier: m.tier,
      rationale: `Tier-${m.tier} per _tier-definitions-v0.1.md classification criteria.`,
    });
  }
}

/** Count events of a given type from the store. */
function countEventsOfType(store: EventStore, type: string): number {
  let count = 0;
  for (const _ of store.replay({ type })) count++;
  return count;
}

// ---------------------------------------------------------------------------
// Test 1: Happy path
// ---------------------------------------------------------------------------

describe("seedValidationMethodologies — happy path", () => {
  it("publishes 2 methodology events when no prior events exist", () => {
    const store = new EventStore(":memory:");

    const result = seedValidationMethodologies(store);

    expect(result.published).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);

    expect(result.published).toContain("validation-methodology:tier-2:v0.1");
    expect(result.published).toContain("validation-methodology:tier-3:v0.1");

    expect(countEventsOfType(store, "ValidationMethodologyPublished")).toBe(2);

    store.close();
  });
});

describe("seedModelValidations — happy path", () => {
  it("approves 3 models after seedModelRegistry", () => {
    const store = new EventStore(":memory:");
    seedModelRegistry(store);

    const result = seedModelValidations(store);

    expect(result.approved).toHaveLength(3);
    expect(result.skipped).toHaveLength(0);

    expect(result.approved).toContain("model:sagb-dcf-v1");
    expect(result.approved).toContain("model:zaronia-ois-irspv-v1");
    expect(result.approved).toContain("model:fx-forward-irp-v1");

    // Three ModelValidationApproved events in the store.
    expect(countEventsOfType(store, "ModelValidationApproved")).toBe(3);

    // ZARONIA model also has a medium ValidationFindingRaised.
    expect(countEventsOfType(store, "ValidationFindingRaised")).toBe(1);
    const findingEvents = [...store.replay({ type: "ValidationFindingRaised" })];
    expect(findingEvents).toHaveLength(1);
    const finding = findingEvents[0]?.payload as Record<string, unknown>;
    expect(finding?.modelId).toBe("model:zaronia-ois-irspv-v1");
    expect(finding?.severity).toBe("medium");
    expect(finding?.findingId).toBe("finding:zaronia-ois-irspv-v1:sarb-data-feed");

    // All three models should be production-eligible (approved + non-expired).
    const registry = new LocalModelRegistry({ eventStore: store });
    const eligible = registry.productionEligible(new Date("2026-06-01T00:00:00Z"));
    const eligibleIds = eligible.map((m) => m.modelId).sort();
    expect(eligibleIds).toContain("model:sagb-dcf-v1");
    expect(eligibleIds).toContain("model:zaronia-ois-irspv-v1");
    expect(eligibleIds).toContain("model:fx-forward-irp-v1");

    store.close();
  });
});

// ---------------------------------------------------------------------------
// Test 2: Idempotency
// ---------------------------------------------------------------------------

describe("seedValidationMethodologies — idempotency", () => {
  it("second call returns all skipped, no new events emitted", () => {
    const store = new EventStore(":memory:");

    // First call.
    const first = seedValidationMethodologies(store);
    expect(first.published).toHaveLength(2);

    const countAfterFirst = countEventsOfType(store, "ValidationMethodologyPublished");
    expect(countAfterFirst).toBe(2);

    // Second call.
    const second = seedValidationMethodologies(store);
    expect(second.published).toHaveLength(0);
    expect(second.skipped).toHaveLength(2);

    // No new events.
    expect(countEventsOfType(store, "ValidationMethodologyPublished")).toBe(2);

    store.close();
  });
});

describe("seedModelValidations — idempotency", () => {
  it("second call returns all skipped, no new events emitted", () => {
    const store = new EventStore(":memory:");
    seedModelRegistry(store);

    // First call.
    const first = seedModelValidations(store);
    expect(first.approved).toHaveLength(3);

    const approvedCountAfterFirst = countEventsOfType(store, "ModelValidationApproved");
    const findingCountAfterFirst = countEventsOfType(store, "ValidationFindingRaised");

    // Second call.
    const second = seedModelValidations(store);
    expect(second.approved).toHaveLength(0);
    expect(second.skipped).toHaveLength(3);

    // No new events.
    expect(countEventsOfType(store, "ModelValidationApproved")).toBe(approvedCountAfterFirst);
    expect(countEventsOfType(store, "ValidationFindingRaised")).toBe(findingCountAfterFirst);

    store.close();
  });
});

// ---------------------------------------------------------------------------
// Test 3: Missing model — graceful skip
// ---------------------------------------------------------------------------

describe("seedModelValidations — missing model", () => {
  it("skips gracefully when models are not registered (doesn't throw)", () => {
    const store = new EventStore(":memory:");

    // Do NOT call seedModelRegistry — models are not in the store.
    let result: ReturnType<typeof seedModelValidations> | undefined;

    expect(() => {
      result = seedModelValidations(store);
    }).not.toThrow();

    // All three models should be skipped (not registered).
    expect(result?.approved).toHaveLength(0);
    expect(result?.skipped).toHaveLength(3);

    // No ModelValidationApproved events emitted.
    expect(countEventsOfType(store, "ModelValidationApproved")).toBe(0);

    store.close();
  });
});
