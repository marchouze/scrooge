// tests/npa-fx-dim-verification-pass-2.test.ts
//
// Verification pass v2 promotions (scripts/run-fx-npa-dim-verification-pass-2.ts):
// every promotion payload must parse through the ProductDimensionAttested
// schema (write-time gate for deferred-gap well-formedness), the promoted set
// must match the pass's stated scope, and held dimensions must NOT appear.
//
// Authority: D-FX-NPA-VERIFICATION-PASS-2-DISPATCH; D-FX-OTC-NPA-SCOPE-EXPANSION.
// Author: Saskia (Head of Global Markets, governance).

import { describe, expect, it } from "bun:test";

import {
  makeProductDimensionAttested,
  productDimensionAttestedPayloadSchema,
} from "../platform/event-store/event-types/product";
import { EventStore } from "../platform/event-store/store";
import {
  PASS2_AS_OF as AS_OF,
  PASS2_HELD_DIMENSIONS,
  PASS2_PROMOTIONS,
  PASS2_PRODUCT_ID as PRODUCT_ID,
  runFxNpaDimVerificationPass2,
} from "../platform/markets/products/npa-fx-verification-pass-2";

const PROMOTED = [
  "market-risk",
  "credit-risk",
  "liquidity-risk",
  "capital",
  "aml",
  "model-risk",
] as const;

const HELD = PASS2_HELD_DIMENSIONS;

describe("npa-fx-dim-verification-pass-2 promotions", () => {
  it("promotes exactly the six verified dimensions and none of the held six", () => {
    const dims = PASS2_PROMOTIONS.map((p) => p.dimension);
    expect([...dims].sort()).toEqual([...PROMOTED].sort());
    for (const held of HELD) {
      expect(dims).not.toContain(held);
    }
  });

  it("already-implementation-attested dimensions (accounting, op-readiness) are not re-emitted", () => {
    const dims = PASS2_PROMOTIONS.map((p) => p.dimension);
    expect(dims).not.toContain("accounting");
    expect(dims).not.toContain("operational-readiness");
  });

  it("every promotion payload parses through the write-time schema", () => {
    for (const promo of PASS2_PROMOTIONS) {
      const parsed = productDimensionAttestedPayloadSchema.parse({
        productId: PRODUCT_ID,
        dimension: promo.dimension,
        result: "implementation-attested",
        citationChain: [...promo.citationChain],
        ...(promo.deferredGaps ? { deferredGaps: promo.deferredGaps } : {}),
      });
      expect(parsed.result).toBe("implementation-attested");
      expect(parsed.citationChain.length).toBeGreaterThan(0);
    }
  });

  it("every deferred gap carries owner + trigger + at least one citation (no hollow deferrals)", () => {
    for (const promo of PASS2_PROMOTIONS) {
      for (const gap of promo.deferredGaps ?? []) {
        expect(gap.gapId.length).toBeGreaterThan(0);
        expect(gap.title.length).toBeGreaterThan(0);
        expect(gap.owner.length).toBeGreaterThan(0);
        expect(gap.targetTrigger.length).toBeGreaterThan(0);
        expect(gap.citations.length).toBeGreaterThan(0);
      }
    }
  });

  it("gapIds are unique within each dimension", () => {
    for (const promo of PASS2_PROMOTIONS) {
      const ids = (promo.deferredGaps ?? []).map((g) => g.gapId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("runFxNpaDimVerificationPass2 emits 6 promotions on a fresh store and is idempotent", () => {
    const store = new EventStore();

    const first = runFxNpaDimVerificationPass2(store);
    expect([...first.promoted].sort()).toEqual([...PROMOTED].sort());
    expect(first.skipped).toEqual([]);

    const events = [...store.replay({ type: "ProductDimensionAttested" })];
    expect(events.length).toBe(PROMOTED.length);
    for (const ev of events) {
      const p = ev.payload as { productId: string; result: string };
      expect(p.productId).toBe(PRODUCT_ID);
      expect(p.result).toBe("implementation-attested");
      expect(ev.as_of).toBe(AS_OF);
    }

    const second = runFxNpaDimVerificationPass2(store);
    expect(second.promoted).toEqual([]);
    expect([...second.skipped].sort()).toEqual([...PROMOTED].sort());
    expect([...store.replay({ type: "ProductDimensionAttested" })].length).toBe(PROMOTED.length);
  });

  it("makeProductDimensionAttested accepts each promotion (full event construction)", () => {
    for (const promo of PASS2_PROMOTIONS) {
      const ev = makeProductDimensionAttested({
        asOf: AS_OF,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:saskia:npa-dimension-verification" },
        citations: ["D-FX-NPA-VERIFICATION-PASS-2-DISPATCH"],
        payload: {
          productId: PRODUCT_ID,
          dimension: promo.dimension,
          result: "implementation-attested",
          citationChain: [...promo.citationChain],
          ...(promo.deferredGaps && promo.deferredGaps.length > 0
            ? {
                deferredGaps: promo.deferredGaps.map((g) => ({
                  ...g,
                  citations: [...g.citations],
                })),
              }
            : {}),
        },
      });
      expect(ev.type).toBe("ProductDimensionAttested");
      expect(ev.as_of).toBe(AS_OF);
    }
  });
});
