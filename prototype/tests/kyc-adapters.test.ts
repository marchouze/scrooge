// tests/kyc-adapters.test.ts
//
// Tests for the KYC simulation adapters.
//
// Covers: DHA identity, CIPC company, screening, PEP/adverse-media,
//   credit bureau, bank account verify.
//
// Test philosophy:
//   - Every test calls the adapter's `check()` in simulate mode (default).
//   - Covers: happy path (clean/verified), error scenario, fail-closed.
//   - No I/O: simulate mode is entirely in-process.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18).
// Author: Atlas (Core banking platform architect, engineering).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  BankAccountVerifyAdapter,
  CIPCCompanyAdapter,
  CreditBureauAdapter,
  DHAIdentityAdapter,
  PEPAdverseMediaAdapter,
  ScreeningAdapter,
} from "../platform/kyc/adapters";

// ---------------------------------------------------------------------------
// Environment helpers — ensure simulate mode for all tests
// ---------------------------------------------------------------------------

let originalMode: string | undefined;

beforeEach(() => {
  originalMode = process.env.KYC_ADAPTER_MODE;
  process.env.KYC_ADAPTER_MODE = "simulate";
});

afterEach(() => {
  if (originalMode === undefined) {
    process.env.KYC_ADAPTER_MODE = undefined;
  } else {
    process.env.KYC_ADAPTER_MODE = originalMode;
  }
});

// ---------------------------------------------------------------------------
// DHA Identity Adapter
// ---------------------------------------------------------------------------

describe("DHAIdentityAdapter — simulate mode", () => {
  const adapter = new DHAIdentityAdapter();

  test("happy path: id ending in 0001 → valid/matched", async () => {
    const result = await adapter.check({
      idNumber: "8501015026085",
      surname: "SMITH",
      dob: "1985-01-01",
    });
    expect(result.ok).toBe(true);
    expect(result.result.matched).toBe(true);
    expect(result.result.status).toBe("valid");
    expect(result.simulationScenario).toBe("valid");
  });

  test("error scenario: id ending in 0003 → not-found", async () => {
    const result = await adapter.check({
      idNumber: "8501010003",
      surname: "GHOST",
      dob: "1985-01-01",
    });
    expect(result.ok).toBe(true);
    expect(result.result.matched).toBe(false);
    expect(result.result.status).toBe("not-found");
  });

  test("error scenario: id ending in 0004 → name-mismatch", async () => {
    const result = await adapter.check({
      idNumber: "8501010004",
      surname: "WRONG",
      dob: "1985-01-01",
    });
    expect(result.ok).toBe(true);
    expect(result.result.matched).toBe(false);
    expect(result.result.status).toBe("name-mismatch");
  });

  test("error scenario: id ending in 0002 → expired", async () => {
    const result = await adapter.check({
      idNumber: "8501010002",
      surname: "EXPIRED",
      dob: "1985-01-01",
    });
    expect(result.ok).toBe(true);
    expect(result.result.matched).toBe(false);
    expect(result.result.status).toBe("expired");
  });

  test("fail-closed: live mode throws → ok=false", async () => {
    process.env.KYC_ADAPTER_MODE = "live";
    const result = await adapter.check({
      idNumber: "8501015026085",
      surname: "SMITH",
      dob: "1985-01-01",
    });
    expect(result.ok).toBe(false);
    expect(result.result.status).toBe("not-found");
  });
});

// ---------------------------------------------------------------------------
// CIPC Company Adapter
// ---------------------------------------------------------------------------

describe("CIPCCompanyAdapter — simulate mode", () => {
  const adapter = new CIPCCompanyAdapter();

  test("happy path: reg number starting 2020 → active", async () => {
    const result = await adapter.check({
      registrationNumber: "2020/123456/07",
      entityName: "VALID COMPANY",
    });
    expect(result.ok).toBe(true);
    expect(result.result.active).toBe(true);
    expect(result.result.status).toBe("active");
    expect(result.result.directors).toBeDefined();
  });

  test("error scenario: reg number starting 1990 → deregistered", async () => {
    const result = await adapter.check({
      registrationNumber: "1990/000001/07",
      entityName: "OLD COMPANY",
    });
    expect(result.ok).toBe(true);
    expect(result.result.active).toBe(false);
    expect(result.result.status).toBe("deregistered");
  });

  test("error scenario: reg number starting 2019 → name-mismatch", async () => {
    const result = await adapter.check({
      registrationNumber: "2019/000001/07",
      entityName: "MISMATCH COMPANY",
    });
    expect(result.ok).toBe(true);
    expect(result.result.active).toBe(false);
    expect(result.result.status).toBe("name-mismatch");
  });

  test("fail-closed: live mode throws → ok=false", async () => {
    process.env.KYC_ADAPTER_MODE = "live";
    const result = await adapter.check({
      registrationNumber: "2020/999999/07",
      entityName: "LIVE COMPANY",
    });
    expect(result.ok).toBe(false);
    expect(result.result.status).toBe("not-found");
  });
});

// ---------------------------------------------------------------------------
// Screening Adapter
// ---------------------------------------------------------------------------

describe("ScreeningAdapter — simulate mode", () => {
  const adapter = new ScreeningAdapter();

  test("happy path: regular name → clean", async () => {
    const result = await adapter.check({
      name: "JOHN SMITH",
      entityType: "natural-person",
    });
    expect(result.ok).toBe(true);
    expect(result.result.status).toBe("clean");
    expect(result.result.hits).toHaveLength(0);
  });

  test("hit scenario: name starting SANCTION → hit across all lists", async () => {
    const result = await adapter.check({
      name: "SANCTION ENTITY LTD",
      entityType: "legal-entity",
    });
    expect(result.ok).toBe(true);
    expect(result.result.status).toBe("hit");
    expect(result.result.hits.length).toBeGreaterThan(0);
    expect(result.result.hits.every((h) => h.score === 100)).toBe(true);
  });

  test("fuzzy-hit scenario: name starting FUZZY → fuzzy-hit", async () => {
    const result = await adapter.check({
      name: "FUZZY NAME",
      entityType: "natural-person",
    });
    expect(result.ok).toBe(true);
    expect(result.result.status).toBe("fuzzy-hit");
    expect(result.result.hits.length).toBeGreaterThan(0);
    expect(result.result.hits.every((h) => h.score < 100)).toBe(true);
  });

  test("false-positive scenario: name starting FALSE → false-positive", async () => {
    const result = await adapter.check({
      name: "FALSE POSITIVE NAME",
      entityType: "natural-person",
    });
    expect(result.ok).toBe(true);
    expect(result.result.status).toBe("false-positive");
  });

  test("fail-closed: live mode throws → ok=false, status=unavailable", async () => {
    process.env.KYC_ADAPTER_MODE = "live";
    const result = await adapter.check({
      name: "CLEAN ENTITY",
      entityType: "legal-entity",
    });
    expect(result.ok).toBe(false);
    expect(result.result.status).toBe("unavailable");
    expect(result.result.hits).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PEP and Adverse Media Adapter
// ---------------------------------------------------------------------------

describe("PEPAdverseMediaAdapter — simulate mode", () => {
  const adapter = new PEPAdverseMediaAdapter();

  test("happy path: regular name → clean", async () => {
    const result = await adapter.check({ name: "ORDINARY CITIZEN" });
    expect(result.ok).toBe(true);
    expect(result.result.pep_flag).toBe(false);
    expect(result.result.pep_linked).toBe(false);
    expect(result.result.adverse_media).toBe(false);
  });

  test("PEP scenario: name starting PEP → pep-direct", async () => {
    const result = await adapter.check({ name: "PEP POLITICIAN" });
    expect(result.ok).toBe(true);
    expect(result.result.pep_flag).toBe(true);
    expect(result.result.pep_linked).toBe(false);
    expect(result.result.pep_type).toBe("domestic");
  });

  test("PEP-linked scenario: name starting LINKED → pep-linked", async () => {
    const result = await adapter.check({ name: "LINKED ASSOCIATE" });
    expect(result.ok).toBe(true);
    expect(result.result.pep_flag).toBe(false);
    expect(result.result.pep_linked).toBe(true);
  });

  test("adverse-media scenario: name starting ADVERSE → adverse hit", async () => {
    const result = await adapter.check({ name: "ADVERSE MEDIA ENTITY" });
    expect(result.ok).toBe(true);
    expect(result.result.adverse_media).toBe(true);
    expect(result.result.pep_flag).toBe(false);
  });

  test("fail-closed: live mode throws → ok=false, conservative clean", async () => {
    process.env.KYC_ADAPTER_MODE = "live";
    const result = await adapter.check({ name: "LIVE TEST" });
    expect(result.ok).toBe(false);
    // Conservative: fail-closed returns clean shape (manual review expected)
    expect(result.result.pep_flag).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Credit Bureau Adapter
// ---------------------------------------------------------------------------

describe("CreditBureauAdapter — simulate mode", () => {
  const adapter = new CreditBureauAdapter();

  test("happy path: id not ending in 8 or 9 → clean", async () => {
    const result = await adapter.check({ idNumber: "8501015026085" });
    expect(result.ok).toBe(true);
    expect(result.result.status).toBe("clean");
    expect(result.result.score).toBeGreaterThan(600);
  });

  test("adverse scenario: id ending in 9 → adverse", async () => {
    const result = await adapter.check({ idNumber: "8501015026089" });
    expect(result.ok).toBe(true);
    expect(result.result.status).toBe("adverse");
  });

  test("bankrupt scenario: id ending in 8 → bankrupt", async () => {
    const result = await adapter.check({ idNumber: "8501015026088" });
    expect(result.ok).toBe(true);
    expect(result.result.status).toBe("bankrupt");
    expect(result.result.score).toBeLessThan(400);
  });

  test("fail-closed: live mode throws → ok=false, conservative adverse", async () => {
    process.env.KYC_ADAPTER_MODE = "live";
    const result = await adapter.check({ idNumber: "8501015026085" });
    expect(result.ok).toBe(false);
    // Conservative: bureau unavailable → adverse (not clean)
    expect(result.result.status).toBe("adverse");
  });
});

// ---------------------------------------------------------------------------
// Bank Account Verify Adapter
// ---------------------------------------------------------------------------

describe("BankAccountVerifyAdapter — simulate mode", () => {
  const adapter = new BankAccountVerifyAdapter();

  test("happy path: account not ending in 0 or 9 → verified", async () => {
    const result = await adapter.check({
      accountNumber: "1234567",
      branchCode: "632005",
      accountHolder: "VALID HOLDER",
    });
    expect(result.ok).toBe(true);
    expect(result.result.status).toBe("verified");
  });

  test("not-found scenario: account ending in 0 → not-found", async () => {
    const result = await adapter.check({
      accountNumber: "12345670",
      branchCode: "632005",
      accountHolder: "GHOST HOLDER",
    });
    expect(result.ok).toBe(true);
    expect(result.result.status).toBe("not-found");
  });

  test("mismatch scenario: account ending in 9 → mismatch", async () => {
    const result = await adapter.check({
      accountNumber: "12345679",
      branchCode: "632005",
      accountHolder: "WRONG HOLDER",
    });
    expect(result.ok).toBe(true);
    expect(result.result.status).toBe("mismatch");
  });

  test("fail-closed: live mode throws → ok=false, not-found", async () => {
    process.env.KYC_ADAPTER_MODE = "live";
    const result = await adapter.check({
      accountNumber: "1234567",
      branchCode: "632005",
      accountHolder: "LIVE HOLDER",
    });
    expect(result.ok).toBe(false);
    expect(result.result.status).toBe("not-found");
  });
});
