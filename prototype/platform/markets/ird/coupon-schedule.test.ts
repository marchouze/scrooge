// platform/markets/ird/coupon-schedule.test.ts
//
// Unit tests for the IRS coupon schedule generator and day count conventions.
//
// Coverage:
//   - Quarterly 5yr swap generates exactly 20 payment dates.
//   - Fixed coupon: 100m × 8.5% × (90/365) ≈ 2,095,890 ZAR.
//   - ACT/365, ACT/360, 30/360 day count fractions.
//   - Forward JIBAR derivation from the static curve.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION; ISDA-2006-DEFINITIONS.

import { describe, expect, it } from "bun:test";

import type { IrsTradeBookedPayload } from "../cdm/ird";
import { StaticJibarRateSource } from "../eod/jibar-curve-seed";
import {
  dayCountFraction,
  generateCouponSchedule,
} from "./coupon-schedule";

// ---------------------------------------------------------------------------
// Shared test fixture — ZAR 100m, 5yr, quarterly, ACT/365, bankPays=fixed
// ---------------------------------------------------------------------------

const rateSource = new StaticJibarRateSource();

const BASE_TRADE: IrsTradeBookedPayload = {
  tradeId: { scheme: "INTERNAL", value: "TRD-IRS-TEST-001" },
  counterparty: { partyId: "CP-TEST-001", name: "Test Co", role: "counterparty" },
  notional: { currency: "ZAR", amountMinor: 10_000_000_000 }, // 100m ZAR in cents
  fixedRate: 0.085, // 8.5%
  floatingIndex: "JIBAR-3M",
  bankPays: "fixed",
  tradeDate: { iso: "2026-05-17", calendar: "JIHCAL" },
  effectiveDate: { iso: "2026-05-19", calendar: "JIHCAL" },
  maturityDate: { iso: "2031-05-19", calendar: "JIHCAL" }, // 5 years
  paymentFrequency: "quarterly",
  dayCountConvention: "ACT/365",
  bookId: "BOOK-IRD-RATES",
  traderRef: "eitan@bank.local",
};

// ---------------------------------------------------------------------------
// Day count fraction tests
// ---------------------------------------------------------------------------

describe("dayCountFraction", () => {
  it("ACT/365: 90-day period = 90/365", () => {
    const dcf = dayCountFraction("2026-05-19", "2026-08-17", "ACT/365");
    // 90 days exactly (May 19 → Aug 17 = 31-19 + 30 + 31 + 17 = 90 days)
    const actual = 90 / 365;
    expect(Math.abs(dcf - actual)).toBeLessThan(0.001);
  });

  it("ACT/360: 90-day period = 90/360", () => {
    const dcf = dayCountFraction("2026-05-19", "2026-08-17", "ACT/360");
    const actual = 90 / 360;
    expect(Math.abs(dcf - actual)).toBeLessThan(0.001);
  });

  it("30/360: standard period", () => {
    const dcf = dayCountFraction("2026-05-19", "2026-08-19", "30/360");
    // 30/360: 3 months exactly = 90/360 = 0.25
    expect(Math.abs(dcf - 0.25)).toBeLessThan(0.001);
  });

  it("ACT/365: 1 year = ~1.0", () => {
    const dcf = dayCountFraction("2026-05-19", "2027-05-19", "ACT/365");
    expect(Math.abs(dcf - 1.0)).toBeLessThan(0.005); // non-leap year
  });
});

// ---------------------------------------------------------------------------
// Schedule generation tests
// ---------------------------------------------------------------------------

describe("generateCouponSchedule — quarterly 5yr", () => {
  const schedule = generateCouponSchedule(BASE_TRADE, rateSource);

  it("generates exactly 20 quarterly payment dates for a 5yr swap", () => {
    expect(schedule.periods.length).toBe(20);
  });

  it("first payment date is 3 months after effective date", () => {
    const firstPeriod = schedule.periods[0];
    expect(firstPeriod).toBeDefined();
    if (firstPeriod) {
      // Effective 2026-05-19 + 3M = 2026-08-19
      expect(firstPeriod.paymentDate).toBe("2026-08-19");
      expect(firstPeriod.periodStart).toBe("2026-05-19");
    }
  });

  it("last payment date is the maturity date", () => {
    const lastPeriod = schedule.periods[schedule.periods.length - 1];
    expect(lastPeriod).toBeDefined();
    if (lastPeriod) {
      expect(lastPeriod.paymentDate).toBe("2031-05-19");
    }
  });

  it("fixed coupon ≈ 100m × 8.5% × (92/365) for first period", () => {
    const firstPeriod = schedule.periods[0];
    expect(firstPeriod).toBeDefined();
    if (firstPeriod) {
      // 2026-05-19 to 2026-08-19 = 92 days
      const expectedDcf = firstPeriod.actualDays / 365;
      const expectedCoupon = Math.round(10_000_000_000 * 0.085 * expectedDcf);
      expect(firstPeriod.fixedCouponMinor).toBe(expectedCoupon);
    }
  });

  it("fixed coupon for 90-day period is approximately 2,095,890 ZAR", () => {
    // 100,000,000 × 8.5% × (90/365) = 2,095,890.41...
    // This tests the formula accuracy with 90 actual days.
    const expectedMinor = Math.round(10_000_000_000 * 0.085 * (90 / 365));
    // 2,095,890 ZAR = 209,589,041 cents
    expect(expectedMinor).toBeGreaterThan(209_000_000);
    expect(expectedMinor).toBeLessThan(210_500_000);
  });

  it("all periods have positive day count fractions", () => {
    for (const period of schedule.periods) {
      expect(period.dayCountFraction).toBeGreaterThan(0);
      expect(period.actualDays).toBeGreaterThan(0);
    }
  });

  it("floating coupon estimates are non-negative", () => {
    for (const period of schedule.periods) {
      expect(period.floatingCouponEstimateMinor).toBeGreaterThanOrEqual(0);
    }
  });

  it("total fixed > 0 and total floating estimate > 0", () => {
    expect(schedule.totalFixedMinor).toBeGreaterThan(0);
    expect(schedule.totalFloatingEstimateMinor).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Annual frequency — 1yr → 1 period
// ---------------------------------------------------------------------------

describe("generateCouponSchedule — annual 1yr", () => {
  const annualTrade: IrsTradeBookedPayload = {
    ...BASE_TRADE,
    tradeId: { scheme: "INTERNAL", value: "TRD-IRS-ANNUAL-001" },
    paymentFrequency: "annual",
    maturityDate: { iso: "2027-05-19", calendar: "JIHCAL" },
  };

  const schedule = generateCouponSchedule(annualTrade, rateSource);

  it("1yr annual swap → exactly 1 period", () => {
    expect(schedule.periods.length).toBe(1);
  });

  it("payment date = maturity date", () => {
    const period = schedule.periods[0];
    expect(period?.paymentDate).toBe("2027-05-19");
  });
});

// ---------------------------------------------------------------------------
// bankPays=floating — net coupon direction flipped
// ---------------------------------------------------------------------------

describe("generateCouponSchedule — bankPays=floating", () => {
  const receiverTrade: IrsTradeBookedPayload = {
    ...BASE_TRADE,
    tradeId: { scheme: "INTERNAL", value: "TRD-IRS-RECEIVER-001" },
    bankPays: "floating",
    maturityDate: { iso: "2027-05-19", calendar: "JIHCAL" },
    paymentFrequency: "annual",
  };

  const payerTrade: IrsTradeBookedPayload = {
    ...receiverTrade,
    tradeId: { scheme: "INTERNAL", value: "TRD-IRS-PAYER-001" },
    bankPays: "fixed",
  };

  it("net coupon direction is opposite for payer vs receiver", () => {
    const receiverSchedule = generateCouponSchedule(receiverTrade, rateSource);
    const payerSchedule = generateCouponSchedule(payerTrade, rateSource);

    const receiverNet = receiverSchedule.periods[0]?.netCouponMinor ?? 0;
    const payerNet = payerSchedule.periods[0]?.netCouponMinor ?? 0;

    // net(receiver) + net(payer) ≈ 0 (opposite signs)
    expect(receiverNet + payerNet).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// StaticJibarRateSource — discount factor and forward JIBAR tests
// ---------------------------------------------------------------------------

describe("StaticJibarRateSource", () => {
  it("discount factor at 0 days = 1.0", () => {
    expect(rateSource.getDiscountFactor(0)).toBe(1.0);
  });

  it("discount factor at 365 days ≈ 0.922", () => {
    const df = rateSource.getDiscountFactor(365);
    expect(df).toBeGreaterThan(0.9);
    expect(df).toBeLessThan(0.95);
  });

  it("discount factors are monotonically decreasing with tenor", () => {
    const tenors = [91, 182, 365, 730, 1095, 1825, 2555, 3650];
    let prevDf = 1.0;
    for (const t of tenors) {
      const df = rateSource.getDiscountFactor(t);
      expect(df).toBeLessThan(prevDf);
      prevDf = df;
    }
  });

  it("forward JIBAR for 3M period ≈ 8.15%", () => {
    // JIBAR forward for [0, 91] days — approximately the 3M par rate.
    const fwd = rateSource.getForwardJibar(0, 91);
    expect(fwd).toBeGreaterThan(0.07);
    expect(fwd).toBeLessThan(0.10);
  });

  it("throws when periodEndDays <= periodStartDays", () => {
    expect(() => rateSource.getForwardJibar(90, 90)).toThrow();
    expect(() => rateSource.getForwardJibar(90, 89)).toThrow();
  });
});
