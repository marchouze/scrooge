// tests/kyc-risk-rating-engine.test.ts
//
// Tests for the KYC risk rating engine — both legacy `assignRiskRating`
// and the new typology-based `computeRiskScore`.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   PROC-FC-01; AML-CFT-POLICY-V1; FATF-REC-10, FATF-REC-12.
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import { assignRiskRating, computeRiskScore } from "../platform/kyc/risk-rating-engine";

// ---------------------------------------------------------------------------
// Legacy `assignRiskRating` tests
// ---------------------------------------------------------------------------

describe("assignRiskRating — legacy RBA function", () => {
  test("sanctions not clear → PROHIBITED, no further processing", () => {
    const { rating, factors } = assignRiskRating({
      entityType: "legal-entity",
      jurisdictionRisk: "low",
      pepStatus: false,
      sanctionsClear: false,
      uboChainDepth: 1,
      productTypes: [],
    });
    expect(rating).toBe("PROHIBITED");
    expect(factors.some((f) => f.includes("sanctions"))).toBe(true);
  });

  test("clean natural person, low jurisdiction → STANDARD", () => {
    const { rating } = assignRiskRating({
      entityType: "natural-person",
      jurisdictionRisk: "low",
      pepStatus: false,
      sanctionsClear: true,
      uboChainDepth: 1,
      productTypes: [],
    });
    expect(rating).toBe("STANDARD");
  });

  test("trust entity → HIGH", () => {
    const { rating } = assignRiskRating({
      entityType: "trust",
      jurisdictionRisk: "low",
      pepStatus: false,
      sanctionsClear: true,
      uboChainDepth: 1,
      productTypes: [],
    });
    expect(rating).toBe("HIGH");
  });

  test("high jurisdiction risk → HIGH", () => {
    const { rating } = assignRiskRating({
      entityType: "natural-person",
      jurisdictionRisk: "high",
      pepStatus: false,
      sanctionsClear: true,
      uboChainDepth: 1,
      productTypes: [],
    });
    expect(rating).toBe("HIGH");
  });

  test("PEP status → PEP (overrides HIGH)", () => {
    const { rating } = assignRiskRating({
      entityType: "trust",
      jurisdictionRisk: "high",
      pepStatus: true,
      sanctionsClear: true,
      uboChainDepth: 1,
      productTypes: [],
    });
    expect(rating).toBe("PEP");
  });

  test("deep UBO chain → HIGH", () => {
    const { rating } = assignRiskRating({
      entityType: "legal-entity",
      jurisdictionRisk: "low",
      pepStatus: false,
      sanctionsClear: true,
      uboChainDepth: 4,
      productTypes: [],
    });
    expect(rating).toBe("HIGH");
  });
});

// ---------------------------------------------------------------------------
// New `computeRiskScore` tests
// ---------------------------------------------------------------------------

describe("computeRiskScore — typology-based scoring", () => {
  test("clean company, ZA jurisdiction → low band", () => {
    const result = computeRiskScore({
      jurisdiction: "ZA",
      entityType: "company",
      pep_flag: false,
      pep_linked: false,
      adverse_media: false,
    });
    expect(result.band).toBe("low");
    expect(result.score).toBeLessThan(34);
    expect(result.requiresEDD).toBe(false);
    expect(result.factors).toHaveLength(4);
  });

  test("trust in medium-risk jurisdiction → medium band", () => {
    const result = computeRiskScore({
      jurisdiction: "RU", // Russia — medium risk
      entityType: "trust",
      pep_flag: false,
      pep_linked: false,
      adverse_media: false,
    });
    expect(result.band).toBe("medium");
    expect(result.score).toBeGreaterThanOrEqual(34);
    expect(result.score).toBeLessThan(67);
  });

  test("direct PEP in FATF grey-list jurisdiction with adverse media → high band", () => {
    const result = computeRiskScore({
      jurisdiction: "NG", // Nigeria — FATF grey list (country_risk = 90)
      entityType: "trust", // trust entity_type_risk = 60
      pep_flag: true, // pep_flag = 100
      pep_linked: false,
      adverse_media: true, // adverse_media = 80
      // score: 0.4*90 + 0.25*60 + 0.2*100 + 0.15*80 = 36+15+20+12 = 83
    });
    expect(result.band).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(67);
    expect(result.requiresEDD).toBe(true);
  });

  test("requiresEDD is true when score >= 67 (high band)", () => {
    const result = computeRiskScore({
      jurisdiction: "KP", // North Korea — FATF black list (country_risk = 90)
      entityType: "trust", // trust entity_type_risk = 60
      pep_flag: true, // pep_flag = 100
      pep_linked: false,
      adverse_media: false,
      // score: 0.4*90 + 0.25*60 + 0.2*100 + 0.15*0 = 36+15+20+0 = 71
    });
    expect(result.band).toBe("high");
    expect(result.requiresEDD).toBe(true);
  });

  test("requiresEDD is false for low/medium bands", () => {
    const result = computeRiskScore({
      jurisdiction: "ZA",
      entityType: "company",
      pep_flag: false,
      pep_linked: false,
      adverse_media: false,
    });
    expect(result.requiresEDD).toBe(false);
  });

  test("shell company indicator overrides entity score to 90", () => {
    const withoutShell = computeRiskScore({
      jurisdiction: "ZA",
      entityType: "company",
      pep_flag: false,
      pep_linked: false,
      adverse_media: false,
      shell_company_indicator: false,
    });
    const withShell = computeRiskScore({
      jurisdiction: "ZA",
      entityType: "company",
      pep_flag: false,
      pep_linked: false,
      adverse_media: false,
      shell_company_indicator: true,
    });
    expect(withShell.score).toBeGreaterThan(withoutShell.score);
    const shellEntityFactor = withShell.factors.find((f) => f.factor_name === "entity_type_risk");
    expect(shellEntityFactor?.value).toBe(90);
  });

  test("score is clamped to 0-100 range", () => {
    const result = computeRiskScore({
      jurisdiction: "KP", // highest country risk
      entityType: "trust",
      pep_flag: true,
      pep_linked: true,
      adverse_media: true,
      shell_company_indicator: true,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test("factors array always has 4 entries with correct weights summing to 1", () => {
    const result = computeRiskScore({
      jurisdiction: "ZA",
      entityType: "company",
      pep_flag: false,
      pep_linked: false,
      adverse_media: false,
    });
    expect(result.factors).toHaveLength(4);
    const totalWeight = result.factors.reduce((sum, f) => sum + f.weight, 0);
    expect(Math.abs(totalWeight - 1.0)).toBeLessThan(0.001);
  });

  test("pep_linked scores lower than pep_flag but both elevate risk", () => {
    const cleanResult = computeRiskScore({
      jurisdiction: "ZA",
      entityType: "company",
      pep_flag: false,
      pep_linked: false,
      adverse_media: false,
    });
    const linkedResult = computeRiskScore({
      jurisdiction: "ZA",
      entityType: "company",
      pep_flag: false,
      pep_linked: true,
      adverse_media: false,
    });
    const directResult = computeRiskScore({
      jurisdiction: "ZA",
      entityType: "company",
      pep_flag: true,
      pep_linked: false,
      adverse_media: false,
    });
    expect(linkedResult.score).toBeGreaterThan(cleanResult.score);
    expect(directResult.score).toBeGreaterThan(linkedResult.score);
  });
});
