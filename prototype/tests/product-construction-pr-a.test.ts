// tests/product-construction-pr-a.test.ts
//
// PR-A exit-criterion tests: M3 OTC-IRD fixture + pricing-model registry.
//
// Asserts:
//   - composeFromProduct(M3_VANILLA_IRS_FIXTURE) returns a valid ProductTemplate
//   - lookupPricingModel("otc-ird").tier === "tier-1"
//   - lookupPricingModel("listed-equity").tier === "tier-3"
//   - lookupPricingModel("fx").tier === "tier-2"
//   - lookupPricingModel("structured" as any) throws PricingModelNotFoundError
//
// Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO approved 2026-05-10).
// Brief: brief:atlas:pr-a-m3-otc-ird-fixture-pricing-model-registry:2026-05-26
//
// Authors: Atlas (substrate authority) · Kai (trading systems engineer, engineering).

import { describe, expect, it } from "bun:test";

import { composeFromProduct } from "../platform/markets/products/composeProduct";
import { M3_VANILLA_IRS_FIXTURE } from "../platform/markets/products/fixtures";
import {
  PricingModelNotFoundError,
  lookupPricingModel,
} from "../platform/markets/pricing/registry";

describe("PR-A: M3 Vanilla IRS fixture — composeFromProduct", () => {
  it("composes to a valid ProductTemplate without throwing", () => {
    const t = composeFromProduct(M3_VANILLA_IRS_FIXTURE);
    expect(t.primitives.length).toBe(M3_VANILLA_IRS_FIXTURE.cdmComposition.primitives.length);
    expect(t.extensions.length).toBe(M3_VANILLA_IRS_FIXTURE.cdmComposition.extensions.length);
    expect(t.compositionRule.length).toBeGreaterThan(0);
    expect(t.fingerprint).toMatch(/^pt-v1-[0-9a-f]{8}-len\d+$/);
  });

  it("M3 composition is deterministic (same fingerprint on two calls)", () => {
    const t1 = composeFromProduct(M3_VANILLA_IRS_FIXTURE);
    const t2 = composeFromProduct(M3_VANILLA_IRS_FIXTURE);
    expect(t1.fingerprint).toBe(t2.fingerprint);
  });

  it("M3 fixture family is 'otc-ird'", () => {
    expect(M3_VANILLA_IRS_FIXTURE.family).toBe("otc-ird");
  });

  it("M3 fixture lifecycle is 'conceptualised'", () => {
    expect(M3_VANILLA_IRS_FIXTURE.lifecycle).toBe("conceptualised");
  });

  it("M3 productTemplate carries ISDA-2002-MASTER + ORG-MK-JIBAR extension citations", () => {
    const t = composeFromProduct(M3_VANILLA_IRS_FIXTURE);
    const urns = t.extensions.map((e) => e.citationUrn);
    expect(urns).toContain("ISDA-2002-MASTER");
    expect(urns).toContain("ORG-MK-JIBAR");
  });

  it("M3 primitives are sorted by address for stable output", () => {
    const t = composeFromProduct(M3_VANILLA_IRS_FIXTURE);
    const addresses = t.primitives.map((p) => p.address);
    expect(addresses).toEqual([...addresses].sort());
  });
});

describe("PR-A: pricing-model registry — lookupPricingModel", () => {
  it("otc-ird is tier-1 (DCF model; highest scrutiny per RAS §B7)", () => {
    expect(lookupPricingModel("otc-ird").tier).toBe("tier-1");
  });

  it("listed-equity is tier-3 (last-observed-price; no model complexity)", () => {
    expect(lookupPricingModel("listed-equity").tier).toBe("tier-3");
  });

  it("fx is tier-2 (spot + forward points; observable but not exchange quote)", () => {
    expect(lookupPricingModel("fx").tier).toBe("tier-2");
  });

  it("listed-bond is tier-2", () => {
    expect(lookupPricingModel("listed-bond").tier).toBe("tier-2");
  });

  it("repo is tier-2", () => {
    expect(lookupPricingModel("repo").tier).toBe("tier-2");
  });

  it("money-market is tier-3", () => {
    expect(lookupPricingModel("money-market").tier).toBe("tier-3");
  });

  it("interbank-loan is tier-3", () => {
    expect(lookupPricingModel("interbank-loan").tier).toBe("tier-3");
  });

  it("lookupPricingModel('structured' as any) throws PricingModelNotFoundError", () => {
    expect(() => lookupPricingModel("structured" as never)).toThrow(PricingModelNotFoundError);
  });

  it("PricingModelNotFoundError carries the unknown family in the message", () => {
    try {
      lookupPricingModel("structured" as never);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PricingModelNotFoundError);
      expect((e as PricingModelNotFoundError).message).toContain("structured");
    }
  });

  it("otc-ird model curveDependencies include JIBAR-3M and ZARONIA", () => {
    const entry = lookupPricingModel("otc-ird");
    expect(entry.curveDependencies).toContain("JIBAR-3M");
    expect(entry.curveDependencies).toContain("ZARONIA");
  });

  it("listed-equity model has no curveDependencies", () => {
    const entry = lookupPricingModel("listed-equity");
    expect(entry.curveDependencies.length).toBe(0);
  });
});
