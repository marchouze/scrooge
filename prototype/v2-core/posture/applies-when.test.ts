// v2-core/posture/applies-when.test.ts
//
// Unit tests for the W8 `dimension` arm of the AppliesToScope predicate: the
// evaluator (match on key=value; false when absent/mismatched; nested in and/or)
// and the Zod schema arm. Pure, no v1 dependency.
//
// Author: Atlas (Core Banking Platform Architect, engineering).

import { describe, expect, it } from "bun:test";
import {
  type AppliesToScope,
  appliesToScopeSchema,
  evaluateAppliesToScope,
  postureContextSchema,
} from "./applies-when";

const dim = (dimensionKey: string, dimensionValue: string): AppliesToScope => ({
  kind: "dimension",
  dimensionKey,
  dimensionValue,
});

describe("evaluateAppliesToScope — dimension arm", () => {
  it("matches when context.dimensions has key=value", () => {
    const ctx = { dimensions: { "approach.credit-rwa": "standardised-approach" } };
    expect(evaluateAppliesToScope(dim("approach.credit-rwa", "standardised-approach"), ctx)).toBe(
      true,
    );
  });

  it("is false when the value mismatches", () => {
    const ctx = { dimensions: { "approach.credit-rwa": "standardised-approach" } };
    expect(evaluateAppliesToScope(dim("approach.credit-rwa", "advanced-irb"), ctx)).toBe(false);
  });

  it("is false when the key is absent (missing key → false → does-not-apply)", () => {
    const ctx = { dimensions: { "approach.market-risk": "standardised-approach" } };
    expect(evaluateAppliesToScope(dim("approach.credit-rwa", "standardised-approach"), ctx)).toBe(
      false,
    );
  });

  it("is false when context carries no dimensions map at all", () => {
    expect(evaluateAppliesToScope(dim("approach.credit-rwa", "advanced-irb"), {})).toBe(false);
  });

  it("nests inside an 'and' (ZA ∧ dimension)", () => {
    const scope: AppliesToScope = {
      kind: "and",
      conditions: [
        { kind: "jurisdiction", jurisdiction: "ZA" },
        dim("approach.credit-rwa", "advanced-irb"),
      ],
    };
    // bank holds standardised, not advanced-irb → does not hold
    expect(
      evaluateAppliesToScope(scope, {
        jurisdiction: "ZA",
        dimensions: { "approach.credit-rwa": "standardised-approach" },
      }),
    ).toBe(false);
    // bank holds advanced-irb → holds
    expect(
      evaluateAppliesToScope(scope, {
        jurisdiction: "ZA",
        dimensions: { "approach.credit-rwa": "advanced-irb" },
      }),
    ).toBe(true);
  });

  it("nests inside an 'or' (short-circuits true on a held dimension)", () => {
    const scope: AppliesToScope = {
      kind: "or",
      conditions: [dim("permission.supervisory", "irb-permission"), dim("entity.class", "bank")],
    };
    expect(evaluateAppliesToScope(scope, { dimensions: { "entity.class": "bank" } })).toBe(true);
    expect(evaluateAppliesToScope(scope, { dimensions: { "entity.class": "branch" } })).toBe(false);
  });
});

describe("appliesToScopeSchema — dimension arm", () => {
  it("parses a well-formed dimension scope", () => {
    const parsed = appliesToScopeSchema.safeParse({
      kind: "dimension",
      dimensionKey: "approach.credit-rwa",
      dimensionValue: "advanced-irb",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty dimensionKey/dimensionValue", () => {
    expect(
      appliesToScopeSchema.safeParse({ kind: "dimension", dimensionKey: "", dimensionValue: "x" })
        .success,
    ).toBe(false);
    expect(
      appliesToScopeSchema.safeParse({ kind: "dimension", dimensionKey: "x", dimensionValue: "" })
        .success,
    ).toBe(false);
  });

  it("parses a dimension scope nested in an and/or", () => {
    const parsed = appliesToScopeSchema.safeParse({
      kind: "and",
      conditions: [
        { kind: "jurisdiction", jurisdiction: "ZA" },
        {
          kind: "dimension",
          dimensionKey: "approach.market-risk",
          dimensionValue: "internal-models",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("postureContextSchema — dimensions field", () => {
  it("parses a context carrying a dimensions map", () => {
    const parsed = postureContextSchema.safeParse({
      jurisdiction: "ZA",
      dimensions: { "approach.credit-rwa": "standardised-approach" },
    });
    expect(parsed.success).toBe(true);
  });
});
