// platform/markets/reference/sa-bond-reference.test.ts

import { describe, expect, it } from "bun:test";

import {
  SA_BOND_ISINS,
  SA_BOND_REFERENCE,
  accruedInterestZarMinor,
  bondReference,
  lastCouponDate,
} from "./sa-bond-reference";

describe("SA bond reference table", () => {
  it("carries the three benchmark bonds", () => {
    expect(SA_BOND_ISINS).toHaveLength(3);
    expect(bondReference("ZAG000030108")?.bondCode).toBe("R186");
    expect(SA_BOND_REFERENCE.ZAG000057547?.bondCode).toBe("R2030");
    expect(SA_BOND_REFERENCE.ZAG000074989?.bondCode).toBe("R2040");
  });

  it("R186 has the right coupon + maturity", () => {
    const r = bondReference("ZAG000030108");
    expect(r?.couponRate).toBeCloseTo(0.105);
    expect(r?.maturityDate).toBe("2026-12-21");
  });
});

describe("lastCouponDate", () => {
  it("steps back semi-annually from maturity (R186 — coupons 06-21 / 12-21)", () => {
    expect(lastCouponDate("2026-12-21", "2026-09-01")).toBe("2026-06-21");
    expect(lastCouponDate("2026-12-21", "2026-06-21")).toBe("2026-06-21");
    expect(lastCouponDate("2026-12-21", "2026-06-20")).toBe("2025-12-21");
  });

  it("reconstructs the schedule for a long bond (R2040)", () => {
    expect(lastCouponDate("2040-01-31", "2026-06-07")).toBe("2026-01-31");
  });
});

describe("accruedInterestZarMinor", () => {
  it("is zero on a coupon date", () => {
    expect(accruedInterestZarMinor("ZAG000030108", 100_000_000, "2026-06-21")).toBe(0);
  });

  it("is positive and below a full annual coupon", () => {
    const face = 100_000_000; // R1m in cents
    const accrued = accruedInterestZarMinor("ZAG000030108", face, "2026-12-20");
    expect(accrued).toBeGreaterThan(0);
    expect(accrued).toBeLessThanOrEqual(Math.round(face * 0.105));
  });

  it("returns 0 for an unknown ISIN", () => {
    expect(accruedInterestZarMinor("BAD", 100_000_000, "2026-06-07")).toBe(0);
  });
});
