// platform/ftp/__tests__/attribution.test.ts
//
// Tests for attributeTransaction: correct spread calculation; event payload shape.
//
// Author: Ravi (Treasury/ALM Engineer, engineering)

import { describe, expect, it } from "bun:test";

import type { FtpCurvePublishedPayload } from "../../event-store/event-types/ftp";
import { attributeTransaction } from "../attribution";
import { FtpCurve } from "../curve";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const CURVE_PAYLOAD: FtpCurvePublishedPayload = {
  curveId: "FTP-ZAR-2026-05-15",
  currency: "ZAR",
  effectiveDate: "2026-05-15",
  tenors: [
    { tenor: "1D", rate: 0.081, basis: "ZARONIA" },
    { tenor: "1M", rate: 0.082, basis: "JIBAR" },
    { tenor: "3M", rate: 0.0858, basis: "JIBAR" },
    { tenor: "6M", rate: 0.089, basis: "JIBAR" },
    { tenor: "1Y", rate: 0.092, basis: "JIBAR" },
    { tenor: "2Y", rate: 0.095, basis: "SAGB-YIELD" },
    { tenor: "5Y", rate: 0.099, basis: "SAGB-YIELD" },
    { tenor: "10Y", rate: 0.103, basis: "SAGB-YIELD" },
  ],
  methodology: "matched-maturity",
  publishedBy: "ravi",
  publishedAt: "2026-05-15T05:45:00.000Z",
};

const CURVE = new FtpCurve(CURVE_PAYLOAD);

// ---------------------------------------------------------------------------
// Spread calculation
// ---------------------------------------------------------------------------

describe("attributeTransaction — spread calculation", () => {
  it("computes a positive spread when clientRate > ftpRate (profitable transaction)", () => {
    // 1Y loan at 10.50% vs FTP 9.20% → spread = +1.30%
    const result = attributeTransaction({
      attributionId: "FTP-ATTR-001",
      transactionId: "TRADE-001",
      transactionType: "loan",
      currency: "ZAR",
      notional: 100_000_000,
      maturityDays: 365,
      clientRate: 0.105,
      curve: CURVE,
      attributedAt: "2026-05-15T06:00:00.000Z",
    });

    expect(result.spread).toBeCloseTo(0.105 - 0.092, 8);
    expect(result.spread).toBeGreaterThan(0);
    expect(result.ftpRate).toBe(0.092);
    expect(result.clientRate).toBe(0.105);
  });

  it("computes a negative spread when clientRate < ftpRate (unprofitable transaction)", () => {
    // 3M bond at 8.00% vs FTP 8.58% → spread = -0.58%
    const result = attributeTransaction({
      attributionId: "FTP-ATTR-002",
      transactionId: "TRADE-002",
      transactionType: "bond",
      currency: "ZAR",
      notional: 50_000_000,
      maturityDays: 91,
      clientRate: 0.08,
      curve: CURVE,
      attributedAt: "2026-05-15T06:00:00.000Z",
    });

    expect(result.spread).toBeCloseTo(0.08 - 0.0858, 8);
    expect(result.spread).toBeLessThan(0);
    expect(result.ftpRate).toBe(0.0858);
  });

  it("computes zero spread when clientRate equals ftpRate", () => {
    // 3M deposit at exactly the FTP rate → spread = 0
    const result = attributeTransaction({
      attributionId: "FTP-ATTR-003",
      transactionId: "TRADE-003",
      transactionType: "deposit",
      currency: "ZAR",
      notional: 10_000_000,
      maturityDays: 91,
      clientRate: 0.0858,
      curve: CURVE,
      attributedAt: "2026-05-15T06:00:00.000Z",
    });

    expect(result.spread).toBeCloseTo(0, 10);
  });

  it("uses interpolated FTP rate for non-standard maturities", () => {
    // 180 days falls between 6M (182d) and 1Y (365d) — close to 6M
    // FTP at 182d = 0.0890; the interpolated rate for 180d is just below
    const result = attributeTransaction({
      attributionId: "FTP-ATTR-004",
      transactionId: "TRADE-004",
      transactionType: "swap",
      currency: "ZAR",
      notional: 200_000_000,
      maturityDays: 180,
      clientRate: 0.09,
      curve: CURVE,
      attributedAt: "2026-05-15T06:00:00.000Z",
    });

    // Interpolated rate for 180d (between 3M=91d=0.0858 and 6M=182d=0.0890)
    // t = (180 - 91) / (182 - 91) = 89/91 ≈ 0.978
    // rate ≈ 0.0858 + 0.978 * (0.0890 - 0.0858) ≈ 0.0889
    expect(result.ftpRate).toBeGreaterThan(0.0858);
    expect(result.ftpRate).toBeLessThanOrEqual(0.089);
    expect(result.spread).toBeCloseTo(0.09 - result.ftpRate, 6);
  });
});

// ---------------------------------------------------------------------------
// Event payload shape
// ---------------------------------------------------------------------------

describe("attributeTransaction — payload shape", () => {
  const result = attributeTransaction({
    attributionId: "FTP-ATTR-010",
    transactionId: "LOAN-999",
    transactionType: "loan",
    currency: "ZAR",
    notional: 75_000_000,
    maturityDays: 365,
    clientRate: 0.11,
    curve: CURVE,
    attributedAt: "2026-05-15T07:00:00.000Z",
  });

  it("includes attributionId", () => {
    expect(result.attributionId).toBe("FTP-ATTR-010");
  });

  it("includes transactionId", () => {
    expect(result.transactionId).toBe("LOAN-999");
  });

  it("includes transactionType", () => {
    expect(result.transactionType).toBe("loan");
  });

  it("includes currency", () => {
    expect(result.currency).toBe("ZAR");
  });

  it("includes notional", () => {
    expect(result.notional).toBe(75_000_000);
  });

  it("includes a tenor string", () => {
    expect(typeof result.tenor).toBe("string");
    expect(result.tenor.length).toBeGreaterThan(0);
  });

  it("includes clientRate", () => {
    expect(result.clientRate).toBe(0.11);
  });

  it("includes ftpRate as a number", () => {
    expect(typeof result.ftpRate).toBe("number");
  });

  it("includes spread = clientRate - ftpRate", () => {
    expect(result.spread).toBeCloseTo(result.clientRate - result.ftpRate, 10);
  });

  it("includes the curveId from the active curve", () => {
    expect(result.ftpCurveId).toBe("FTP-ZAR-2026-05-15");
  });

  it("includes attributedAt", () => {
    expect(result.attributedAt).toBe("2026-05-15T07:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// Tenor matching
// ---------------------------------------------------------------------------

describe("attributeTransaction — matched tenor", () => {
  it("matches the closest curve tenor for standard maturity", () => {
    // 365 days → closest tenor is 1Y
    const result = attributeTransaction({
      attributionId: "FTP-ATTR-T1",
      transactionId: "T1",
      transactionType: "bond",
      currency: "ZAR",
      notional: 1_000_000,
      maturityDays: 365,
      clientRate: 0.09,
      curve: CURVE,
      attributedAt: "2026-05-15T00:00:00.000Z",
    });
    expect(result.tenor).toBe("1Y");
  });

  it("matches the closest curve tenor for short-end maturity", () => {
    // 7 days — closest to 1M (30d) vs 1D (1d): |7-1|=6 vs |7-30|=23 → 1D wins
    const result = attributeTransaction({
      attributionId: "FTP-ATTR-T2",
      transactionId: "T2",
      transactionType: "repo",
      currency: "ZAR",
      notional: 1_000_000,
      maturityDays: 7,
      clientRate: 0.082,
      curve: CURVE,
      attributedAt: "2026-05-15T00:00:00.000Z",
    });
    // Closest to 1D (1 day) since |7-1|=6 < |7-30|=23
    expect(result.tenor).toBe("1D");
  });
});

// ---------------------------------------------------------------------------
// Transaction types
// ---------------------------------------------------------------------------

describe("attributeTransaction — all transaction types accepted", () => {
  const types: Array<"loan" | "bond" | "swap" | "deposit" | "repo"> = [
    "loan",
    "bond",
    "swap",
    "deposit",
    "repo",
  ];

  for (const txType of types) {
    it(`accepts transactionType '${txType}'`, () => {
      const result = attributeTransaction({
        attributionId: `FTP-ATTR-${txType}`,
        transactionId: `TX-${txType}`,
        transactionType: txType,
        currency: "ZAR",
        notional: 5_000_000,
        maturityDays: 91,
        clientRate: 0.09,
        curve: CURVE,
        attributedAt: "2026-05-15T00:00:00.000Z",
      });
      expect(result.transactionType).toBe(txType);
    });
  }
});
