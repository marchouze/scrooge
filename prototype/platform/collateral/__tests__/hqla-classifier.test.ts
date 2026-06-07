// platform/collateral/__tests__/hqla-classifier.test.ts
//
// Unit tests for the HQLA classifier.
// Authority: BA 110 Annex 1; Banks Act Reg 26; D-TREASURY-GAPS-WAVE1.

import { describe, expect, it } from "bun:test";
import { classifyHQLA } from "../hqla-classifier";
import type { SecurityDescriptor } from "../hqla-classifier";

describe("classifyHQLA", () => {
  // -----------------------------------------------------------------------
  // L1 cases
  // -----------------------------------------------------------------------

  it("SA government bond (0% RW, ZAR) → L1, 0% haircut", () => {
    const sec: SecurityDescriptor = {
      isin: "ZAG000123456",
      issuer: "Republic of South Africa",
      assetClass: "sovereign-bond",
      riskWeight: 0,
      currency: "ZAR",
    };
    const result = classifyHQLA(sec);
    expect(result.level).toBe("L1");
    expect(result.haircut).toBe(0);
    expect(result.eligibilityRationale).toContain("L1");
  });

  it("SA government bond (ZAR, no riskWeight) → L1, 0% haircut (default ZAR sovereign)", () => {
    const sec: SecurityDescriptor = {
      isin: "ZAG000999001",
      issuer: "Republic of South Africa",
      assetClass: "sovereign-bond",
      currency: "ZAR",
    };
    const result = classifyHQLA(sec);
    expect(result.level).toBe("L1");
    expect(result.haircut).toBe(0);
  });

  it("ZAR cash equivalent → L1, 0% haircut", () => {
    const sec: SecurityDescriptor = {
      isin: "ZA-CASH-001",
      issuer: "SARB",
      assetClass: "cash",
      currency: "ZAR",
    };
    const result = classifyHQLA(sec);
    expect(result.level).toBe("L1");
    expect(result.haircut).toBe(0);
  });

  // -----------------------------------------------------------------------
  // L2a cases
  // -----------------------------------------------------------------------

  it("SA government bond (20% RW, ZAR) → L2a, 15% haircut", () => {
    const sec: SecurityDescriptor = {
      isin: "ZAG000555001",
      issuer: "Republic of South Africa",
      assetClass: "sovereign-bond",
      riskWeight: 20,
      currency: "ZAR",
    };
    const result = classifyHQLA(sec);
    expect(result.level).toBe("L2a");
    expect(result.haircut).toBe(0.15);
    expect(result.eligibilityRationale).toContain("L2a");
  });

  it("Corporate bond rated AA+ → L2a, 15% haircut", () => {
    const sec: SecurityDescriptor = {
      isin: "ZAE000111001",
      issuer: "FirstRand Bank",
      assetClass: "corporate-bond",
      creditRating: "AA+",
      currency: "ZAR",
    };
    const result = classifyHQLA(sec);
    expect(result.level).toBe("L2a");
    expect(result.haircut).toBe(0.15);
    expect(result.eligibilityRationale).toContain("AA+");
  });

  it("Corporate bond rated AA- → L2a, 15% haircut (boundary)", () => {
    const sec: SecurityDescriptor = {
      isin: "ZAE000111002",
      issuer: "Standard Bank",
      assetClass: "corporate-bond",
      creditRating: "AA-",
      currency: "ZAR",
    };
    const result = classifyHQLA(sec);
    expect(result.level).toBe("L2a");
    expect(result.haircut).toBe(0.15);
  });

  it("Covered bond → L2a, 15% haircut", () => {
    const sec: SecurityDescriptor = {
      isin: "ZA-COV-001",
      issuer: "SA Home Loans",
      assetClass: "covered-bond",
      currency: "ZAR",
    };
    const result = classifyHQLA(sec);
    expect(result.level).toBe("L2a");
    expect(result.haircut).toBe(0.15);
  });

  // -----------------------------------------------------------------------
  // L2b cases
  // -----------------------------------------------------------------------

  it("JSE equity (ZAR) → L2b, 50% haircut", () => {
    const sec: SecurityDescriptor = {
      isin: "ZAE000084952",
      issuer: "Naspers Limited",
      assetClass: "equity",
      currency: "ZAR",
    };
    const result = classifyHQLA(sec);
    expect(result.level).toBe("L2b");
    expect(result.haircut).toBe(0.5);
    expect(result.eligibilityRationale).toContain("L2b");
  });

  it("Corporate bond rated A+ → L2b, 25% haircut (boundary: A+ is L2b not L2a)", () => {
    const sec: SecurityDescriptor = {
      isin: "ZAE000222001",
      issuer: "Nedbank",
      assetClass: "corporate-bond",
      creditRating: "A+",
      currency: "ZAR",
    };
    const result = classifyHQLA(sec);
    expect(result.level).toBe("L2b");
    expect(result.haircut).toBe(0.25);
  });

  it("Corporate bond rated BBB- → L2b, 25% haircut (lower boundary)", () => {
    const sec: SecurityDescriptor = {
      isin: "ZAE000333001",
      issuer: "Investec",
      assetClass: "corporate-bond",
      creditRating: "BBB-",
      currency: "ZAR",
    };
    const result = classifyHQLA(sec);
    expect(result.level).toBe("L2b");
    expect(result.haircut).toBe(0.25);
  });

  // -----------------------------------------------------------------------
  // non-HQLA cases
  // -----------------------------------------------------------------------

  it("Unrated corporate bond → non-HQLA", () => {
    const sec: SecurityDescriptor = {
      isin: "ZAE000444001",
      issuer: "Acme Corp",
      assetClass: "corporate-bond",
      // no creditRating
      currency: "ZAR",
    };
    const result = classifyHQLA(sec);
    expect(result.level).toBe("non-HQLA");
    expect(result.haircut).toBe(1.0);
    expect(result.eligibilityRationale).toContain("no credit rating");
  });

  it("Corporate bond rated BB+ → non-HQLA (below BBB-)", () => {
    const sec: SecurityDescriptor = {
      isin: "ZAE000555001",
      issuer: "High Yield Corp",
      assetClass: "corporate-bond",
      creditRating: "BB+",
      currency: "ZAR",
    };
    const result = classifyHQLA(sec);
    expect(result.level).toBe("non-HQLA");
    expect(result.haircut).toBe(1.0);
  });

  it("Non-ZAR equity → non-HQLA", () => {
    const sec: SecurityDescriptor = {
      isin: "US0378331005",
      issuer: "Apple Inc",
      assetClass: "equity",
      currency: "USD",
    };
    const result = classifyHQLA(sec);
    expect(result.level).toBe("non-HQLA");
    expect(result.haircut).toBe(1.0);
  });

  it("Other asset class → non-HQLA", () => {
    const sec: SecurityDescriptor = {
      isin: "ZA-OTHER-001",
      issuer: "Some Issuer",
      assetClass: "other",
      currency: "ZAR",
    };
    const result = classifyHQLA(sec);
    expect(result.level).toBe("non-HQLA");
    expect(result.haircut).toBe(1.0);
  });
});
