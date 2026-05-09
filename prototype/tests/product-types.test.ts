// tests/product-types.test.ts
//
// D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 1 — exit-criterion test.
//
// Round-trips the M1 listed-equity fixture through Zod parse and
// asserts:
//   - The single canonical Product type accepts a realistic M1 fixture
//     (Q1 single-type discipline).
//   - Multi-X discipline is type-level enforced: missing legalEntityId
//     / currency / jurisdiction is rejected.
//   - URN form on productId is enforced.
//   - Citations are non-empty (Principle 2 anchor).
//
// Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO approved 2026-05-10).
// Source brief: Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md §2
//
// Author: Atlas + Kai.

import { describe, expect, it } from "bun:test";

import {
  M1_JSE_EQUITY_CASH_FIXTURE,
  M2_SAGB_FIXED_COUPON_FIXTURE,
} from "../platform/markets/products/fixtures";
import { parseProduct, productSchema } from "../platform/markets/products/types";

describe("D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 1 — typed Product layer", () => {
  it("M1 listed-equity fixture round-trips through Zod parse", () => {
    const parsed = parseProduct(M1_JSE_EQUITY_CASH_FIXTURE);
    expect(parsed.productId).toBe("prd:bank:equity:jse-equity-cash");
    expect(parsed.family).toBe("listed-equity");
    expect(parsed.legalEntityId).toBe("LE-BANK-SA");
    expect(parsed.currency).toBe("ZAR");
    expect(parsed.jurisdiction).toBe("ZA");
  });

  it("M2 SAGB-bond fixture also round-trips through the single canonical schema (Q1)", () => {
    // Q1 resolution: one canonical Product type, NOT one per family.
    // The same parser handles equity AND bond fixtures.
    const parsed = parseProduct(M2_SAGB_FIXED_COUPON_FIXTURE);
    expect(parsed.family).toBe("listed-bond");
    expect(parsed.cdmComposition.primitives.length).toBeGreaterThan(0);
  });

  it("rejects a Product missing legalEntityId (Principle 5)", () => {
    const broken = {
      ...M1_JSE_EQUITY_CASH_FIXTURE,
      legalEntityId: undefined,
    };
    expect(() => productSchema.parse(broken)).toThrow();
  });

  it("rejects a Product missing currency (Principle 5)", () => {
    const broken = {
      ...M1_JSE_EQUITY_CASH_FIXTURE,
      currency: undefined,
    };
    expect(() => productSchema.parse(broken)).toThrow();
  });

  it("rejects a Product missing jurisdiction (Principle 5)", () => {
    const broken = {
      ...M1_JSE_EQUITY_CASH_FIXTURE,
      jurisdiction: undefined,
    };
    expect(() => productSchema.parse(broken)).toThrow();
  });

  it("rejects a Product whose currency is not 3-letter uppercase ISO 4217", () => {
    const broken = { ...M1_JSE_EQUITY_CASH_FIXTURE, currency: "zar" };
    expect(() => productSchema.parse(broken)).toThrow();
  });

  it("rejects a Product whose jurisdiction is not 2-letter uppercase ISO-3166-1", () => {
    const broken = { ...M1_JSE_EQUITY_CASH_FIXTURE, jurisdiction: "RSA" };
    expect(() => productSchema.parse(broken)).toThrow();
  });

  it("rejects a productId that does not match the URN form", () => {
    const broken = { ...M1_JSE_EQUITY_CASH_FIXTURE, productId: "not-a-urn" };
    expect(() => productSchema.parse(broken)).toThrow();
  });

  it("rejects a Product with empty citations (Principle 2)", () => {
    const broken = { ...M1_JSE_EQUITY_CASH_FIXTURE, citations: [] };
    expect(() => productSchema.parse(broken)).toThrow();
  });

  it("rejects a Product with non-semver version", () => {
    const broken = { ...M1_JSE_EQUITY_CASH_FIXTURE, version: "v1" };
    expect(() => productSchema.parse(broken)).toThrow();
  });

  it("accepts a Product with empty policyAttestations at conceptualisation", () => {
    expect(() => parseProduct(M1_JSE_EQUITY_CASH_FIXTURE)).not.toThrow();
    expect(M1_JSE_EQUITY_CASH_FIXTURE.policyAttestations).toEqual([]);
  });
});
