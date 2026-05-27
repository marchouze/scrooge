// tests/model-registered-seed.test.ts
//
// Tests for seeds/models/model-registered-seed.ts — ModelRegistered × 3,
// ValidationMethodologyPublished × 2 (v1), ModelValidationApproved × 3
// for IRS ZARONIA and FX swap model-risk gap closure.
//
// Tests:
//   1. Happy path: fresh store → 3 ModelRegistered + 2 methodology + 3 approved emitted.
//   2. Idempotency: second call returns all skipped, no new events.
//   3. ModelRegistered event fields are correct (IRS + FX swap model IDs, tiers).
//   4. ValidationMethodologyPublished v1 events distinct from v0.1.
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SLICES-4-8 (CEO session-delegation 2026-05-26)
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10)
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import { seedModelRegisteredEvents } from "../seeds/models/model-registered-seed";

/** Count events of a given type in the store. */
function countEventsOfType(store: EventStore, type: string): number {
  let count = 0;
  for (const _ of store.replay({ type })) count++;
  return count;
}

// ---------------------------------------------------------------------------
// Test 1: Happy path
// ---------------------------------------------------------------------------

describe("seedModelRegisteredEvents — happy path", () => {
  it("emits 3 ModelRegistered + 2 ValidationMethodologyPublished (v1) + 3 ModelValidationApproved on a fresh store", () => {
    const store = new EventStore(":memory:");

    const result = seedModelRegisteredEvents(store);

    expect(result.modelRegistered).toHaveLength(3);
    expect(result.methodologiesPublished).toHaveLength(2);
    expect(result.validationsApproved).toHaveLength(3);
    expect(result.skipped).toHaveLength(0);

    expect(countEventsOfType(store, "ModelRegistered")).toBe(3);
    expect(countEventsOfType(store, "ValidationMethodologyPublished")).toBe(2);
    expect(countEventsOfType(store, "ModelValidationApproved")).toBe(3);

    store.close();
  });
});

// ---------------------------------------------------------------------------
// Test 2: Idempotency
// ---------------------------------------------------------------------------

describe("seedModelRegisteredEvents — idempotency", () => {
  it("second call returns all skipped with no new events emitted", () => {
    const store = new EventStore(":memory:");

    // First call.
    const first = seedModelRegisteredEvents(store);
    expect(first.modelRegistered).toHaveLength(3);
    expect(first.methodologiesPublished).toHaveLength(2);
    expect(first.validationsApproved).toHaveLength(3);

    const afterFirst = {
      registered: countEventsOfType(store, "ModelRegistered"),
      methodologies: countEventsOfType(store, "ValidationMethodologyPublished"),
      approvals: countEventsOfType(store, "ModelValidationApproved"),
    };

    // Second call — all should be skipped.
    const second = seedModelRegisteredEvents(store);
    expect(second.modelRegistered).toHaveLength(0);
    expect(second.methodologiesPublished).toHaveLength(0);
    expect(second.validationsApproved).toHaveLength(0);
    expect(second.skipped.length).toBeGreaterThan(0);

    // No new events.
    expect(countEventsOfType(store, "ModelRegistered")).toBe(afterFirst.registered);
    expect(countEventsOfType(store, "ValidationMethodologyPublished")).toBe(
      afterFirst.methodologies,
    );
    expect(countEventsOfType(store, "ModelValidationApproved")).toBe(afterFirst.approvals);

    store.close();
  });
});

// ---------------------------------------------------------------------------
// Test 3: Correct model IDs and tiers
// ---------------------------------------------------------------------------

describe("seedModelRegisteredEvents — ModelRegistered fields", () => {
  it("emits correct modelIds and tiers for IRS and FX swap models", () => {
    const store = new EventStore(":memory:");
    seedModelRegisteredEvents(store);

    const events = [...store.replay({ type: "ModelRegistered" })];
    expect(events).toHaveLength(3);

    const modelIds = events.map((ev) => (ev.payload as Record<string, unknown>).modelId as string);
    expect(modelIds).toContain("model:irs:zaronia-ois-curve");
    expect(modelIds).toContain("model:irs:pv-engine");
    expect(modelIds).toContain("model:fx:forward-irp");

    // IRS models should be Tier-2, FX should be Tier-3.
    for (const ev of events) {
      const p = ev.payload as Record<string, unknown>;
      const modelId = p.modelId as string;
      const tier = p.tier as number;
      if (modelId.startsWith("model:irs:")) {
        expect(tier).toBe(2);
      } else if (modelId.startsWith("model:fx:")) {
        expect(tier).toBe(3);
      }
    }

    store.close();
  });
});

// ---------------------------------------------------------------------------
// Test 4: ValidationMethodologyPublished v1 events are distinct
// ---------------------------------------------------------------------------

describe("seedModelRegisteredEvents — ValidationMethodologyPublished v1", () => {
  it("emits tier-2:v1 and tier-3:v1 — distinct from v0.1 series", () => {
    const store = new EventStore(":memory:");
    seedModelRegisteredEvents(store);

    const events = [...store.replay({ type: "ValidationMethodologyPublished" })];
    expect(events).toHaveLength(2);

    const methodologyIds = events.map(
      (ev) => (ev.payload as Record<string, unknown>).methodologyId as string,
    );
    expect(methodologyIds).toContain("validation-methodology:tier-2:v1");
    expect(methodologyIds).toContain("validation-methodology:tier-3:v1");

    // Version field should be "v1" not "v0.1"
    for (const ev of events) {
      expect((ev.payload as Record<string, unknown>).version).toBe("v1");
    }

    store.close();
  });
});
