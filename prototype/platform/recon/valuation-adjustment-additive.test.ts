// platform/recon/valuation-adjustment-additive.test.ts
//
// Tests for recon:valuation-adjustment-additive. Uses synthetic umbrella
// overrides so the assertions run without touching the live store.
// Authority: Camille (CFO) R2; CRR Art 105; D-TRUSTED-FIGURES-PROGRAM-V1.

import { describe, expect, it } from "bun:test";

import { run } from "./valuation-adjustment-additive";

describe("recon:valuation-adjustment-additive", () => {
  it("passes when total == Σ present categories and absent lines carry a reason", () => {
    const result = run({
      umbrellaOverrides: [
        {
          aggregationId: "AVA-1",
          valuationDate: "2026-05-31",
          totalAvaZarMinor: 50_000,
          categories: [
            { adjustmentType: "close-out-bid-offer", present: true, amountZarMinor: 50_000 },
            {
              adjustmentType: "model-risk",
              present: false,
              amountZarMinor: 0,
              absentReason: "no eventised input yet",
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("fails when total does not equal the sum of present categories (additivity)", () => {
    const result = run({
      umbrellaOverrides: [
        {
          aggregationId: "AVA-BAD",
          valuationDate: "2026-05-31",
          totalAvaZarMinor: 99_999, // wrong — should be 50,000
          categories: [
            { adjustmentType: "close-out-bid-offer", present: true, amountZarMinor: 50_000 },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.message.includes("additivity violated"))).toBe(true);
  });

  it("fails when an absent category carries no reason (no silent zero)", () => {
    const result = run({
      umbrellaOverrides: [
        {
          aggregationId: "AVA-NOZERO",
          valuationDate: "2026-05-31",
          totalAvaZarMinor: 0,
          categories: [
            { adjustmentType: "concentration", present: false, amountZarMinor: 0 }, // no reason
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.message.includes("no absentReason"))).toBe(true);
  });

  it("fails the IPV linkage when variances exist but market-price-uncertainty is absent", () => {
    const result = run({
      ipvVariancesExistOverride: true,
      umbrellaOverrides: [
        {
          aggregationId: "AVA-IPV",
          valuationDate: "2026-05-31",
          totalAvaZarMinor: 0,
          categories: [
            {
              adjustmentType: "market-price-uncertainty",
              present: false,
              amountZarMinor: 0,
              absentReason: "no IPV variance data",
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.message.includes("broken linkage"))).toBe(true);
  });

  it("passes the IPV linkage when variances exist and market-price-uncertainty is present", () => {
    const result = run({
      ipvVariancesExistOverride: true,
      umbrellaOverrides: [
        {
          aggregationId: "AVA-IPV-OK",
          valuationDate: "2026-05-31",
          totalAvaZarMinor: 3_000_000,
          categories: [
            {
              adjustmentType: "market-price-uncertainty",
              present: true,
              amountZarMinor: 3_000_000,
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
  });
});
