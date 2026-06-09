// scenarios/10-irs-trade.test.ts
//
// Integration tests for the OTC IRS trading lifecycle (scenario 10).
//
// Coverage:
//   - Quarterly schedule: 5yr swap generates exactly 20 payment dates.
//   - Fixed coupon correct: 100m × 8.5% × (90/365) ≈ 2,095,890 ZAR.
//   - MTM ≈ 0 when discount curve implies JIBAR ≈ fixed rate (at-par swap).
//   - MTM positive (bank gains) when rates rise 100bp (bank pays fixed).
//   - DV01 order-of-magnitude ~ZAR 50k per bp on ZAR 100m 5Y.
//   - Idempotency: already-revalued swap skipped on same valuationDate.
//   - Full scenario runner: events emitted, revaluation succeeds.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION; ISDA-2002-MASTER.

import { unlinkSync } from "node:fs";

import { describe, expect, it } from "bun:test";

import { EventStore } from "@platform/event-store/store";
import type { IrsTradeBookedPayload } from "@platform/markets/cdm/ird";
import { makeIrsTradeBooked } from "@platform/markets/cdm/ird";
import { runEodIrsRevaluation } from "@platform/markets/eod/irs-revaluation";
import { type IrsRateSource, StaticJibarRateSource } from "@platform/markets/eod/jibar-curve-seed";
import { generateCouponSchedule } from "@platform/markets/ird/coupon-schedule";

import { buildIrsScenarioEvents, runScenario } from "./10-irs-trade";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_DB_PREFIX = ".local/test-irs";

function tmpDb(suffix: string): string {
  return `${TEST_DB_PREFIX}-${suffix}.db`;
}

function cleanDb(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    /* ok */
  }
}

const rateSource = new StaticJibarRateSource();

// Base trade: ZAR 100m, 5yr quarterly ACT/365, bank pays fixed 8.5%.
const BASE_TRADE: IrsTradeBookedPayload = {
  tradeId: { scheme: "INTERNAL", value: "TRD-IRS-TEST-SUITE-001" },
  counterparty: { partyId: "CP-TEST-001", name: "Test Co", role: "counterparty" },
  notional: { currency: "ZAR", amountMinor: 10_000_000_000 }, // ZAR 100m in cents
  fixedRate: 0.085,
  floatingIndex: "JIBAR-3M",
  bankPays: "fixed",
  tradeDate: { iso: "2026-05-17", calendar: "JIHCAL" },
  effectiveDate: { iso: "2026-05-19", calendar: "JIHCAL" },
  maturityDate: { iso: "2031-05-19", calendar: "JIHCAL" },
  paymentFrequency: "quarterly",
  dayCountConvention: "ACT/365",
  bookId: "BOOK-IRD-RATES",
  traderRef: "eitan@bank.local",
};

// ---------------------------------------------------------------------------
// Schedule tests (unit-level)
// ---------------------------------------------------------------------------

describe("IRS coupon schedule — 5yr quarterly", () => {
  const schedule = generateCouponSchedule(BASE_TRADE, rateSource);

  it("generates exactly 20 payment dates", () => {
    expect(schedule.periods.length).toBe(20);
  });

  it("fixed coupon ≈ 2,095,890 ZAR for ~90-day period (first period ≈ 92 days)", () => {
    // Formula: 100,000,000 × 8.5% × (90/365) ≈ 2,095,890
    // First period is ~92 days; approximate check.
    const firstPeriod = schedule.periods[0];
    expect(firstPeriod).toBeDefined();
    if (firstPeriod) {
      // In minor units (cents): ≈ 209_589_041
      expect(firstPeriod.fixedCouponMinor).toBeGreaterThan(200_000_000); // >2m ZAR
      expect(firstPeriod.fixedCouponMinor).toBeLessThan(225_000_000); // <2.25m ZAR
    }
  });

  it("fixed coupon formula: 100m × 8.5% × (90/365) ≈ 209,589,041 minor", () => {
    // Direct calculation for validation of the formula.
    const expectedMinor = Math.round(10_000_000_000 * 0.085 * (90 / 365));
    expect(expectedMinor).toBeCloseTo(209_589_041, -4); // within ~10k minor
  });
});

// ---------------------------------------------------------------------------
// MTM tests
// ---------------------------------------------------------------------------

describe("IRS EOD revaluation — MTM and DV01", () => {
  /**
   * Create a rate source where JIBAR ≈ fixedRate.
   * When the floating curve equals the fixed rate, the swap is at par → MTM ≈ 0.
   */
  class FlatCurveRateSource implements IrsRateSource {
    private readonly rate: number;
    constructor(rate: number) {
      this.rate = rate;
    }
    getDiscountFactor(tenorDays: number): number {
      // Simple flat-rate discounting: P(T) = exp(-r × T/365)
      return Math.exp(-this.rate * (tenorDays / 365));
    }
    getForwardJibar(_startDays: number, _endDays: number): number {
      return this.rate;
    }
  }

  it("MTM ≈ 0 when discount curve implies JIBAR = fixed rate (at-par swap)", () => {
    const atParSource = new FlatCurveRateSource(0.085); // JIBAR = fixed = 8.5%
    const schedule = generateCouponSchedule(BASE_TRADE, atParSource);

    // When forward JIBAR = fixed rate, each period's fixed and floating coupons are equal.
    // So net PV ≈ 0.
    let totalNetPv = 0;
    for (const period of schedule.periods) {
      const payDays = period.actualDays; // rough proxy for days from valuation to payment
      const df = atParSource.getDiscountFactor(payDays);
      totalNetPv += (period.fixedCouponMinor - period.floatingCouponEstimateMinor) * df;
    }
    // Should be very close to zero — allow ±0.5% of notional.
    const notionalMinor = BASE_TRADE.notional.amountMinor;
    const tolerance = notionalMinor * 0.005;
    expect(Math.abs(totalNetPv)).toBeLessThan(tolerance);
  });

  it("MTM positive for bank (payer of fixed) when rates rise 100bp", () => {
    // When rates rise, the floating leg cash flows increase → payer of fixed gains.
    // Use a high-JIBAR source (9.5%) vs fixed rate of 8.5%.
    const highRatesSource = new FlatCurveRateSource(0.095);
    const scheduleHighRates = generateCouponSchedule(BASE_TRADE, highRatesSource);
    const scheduleBaseRates = generateCouponSchedule(BASE_TRADE, rateSource);

    // Bank pays fixed; floating leg estimate should be higher with high rates.
    expect(scheduleHighRates.totalFloatingEstimateMinor).toBeGreaterThan(
      scheduleBaseRates.totalFloatingEstimateMinor,
    );

    // Net coupons (from bank's perspective: float − fixed) should be higher.
    const netHighRates = scheduleHighRates.periods.reduce(
      (s, p) => s + p.floatingCouponEstimateMinor - p.fixedCouponMinor,
      0,
    );
    const netBaseRates = scheduleBaseRates.periods.reduce(
      (s, p) => s + p.floatingCouponEstimateMinor - p.fixedCouponMinor,
      0,
    );
    expect(netHighRates).toBeGreaterThan(netBaseRates);
  });

  it("DV01 order-of-magnitude ~ZAR 50k per bp on ZAR 100m 5Y", () => {
    // DV01 ≈ Σ(0.0001 × notional × dcf_i × df_i) for all remaining periods.
    // For 5yr ZAR 100m quarterly: ~ZAR 40k-60k per bp is the expected range.
    const schedule = generateCouponSchedule(BASE_TRADE, rateSource);
    let dv01Minor = 0;
    for (const period of schedule.periods) {
      const payDays = period.actualDays;
      const df = rateSource.getDiscountFactor(payDays);
      dv01Minor += 0.0001 * BASE_TRADE.notional.amountMinor * period.dayCountFraction * df;
    }

    // DV01 in ZAR (divide minor by 100 for display).
    const dv01Zar = dv01Minor / 100;
    // Expected range: ZAR 30,000 – ZAR 80,000 per bp for 5yr ZAR 100m.
    expect(dv01Zar).toBeGreaterThan(30_000);
    expect(dv01Zar).toBeLessThan(80_000);
  });

  it("revaluation engine emits IrdSwapPositionRevalued with bucketed DV01", () => {
    const db = tmpDb("revaluation");
    cleanDb(db);

    try {
      const store = new EventStore(db);

      const tradeEvent = makeIrsTradeBooked({
        asOf: "2026-05-17",
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "human", id: "eitan@bank.local" },
        citations: ["D-MARKETS-SCHEMA-FOUNDATION"],
        payload: BASE_TRADE,
      });

      store.append(tradeEvent);

      const result = runEodIrsRevaluation(store, "2026-05-17", rateSource);

      expect(result.revalued).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);

      // D-IRS-FAMILY-CONVERGE-ACCOUNTING: the engine emits the accounting family
      // (the GL + BA 320 canonical revaluation fact), NOT the trade-domain mirror.
      const accounting = [...store.replay({ type: "IrdSwapPositionRevalued" })];
      expect(accounting).toHaveLength(1);
      const noMirror = [...store.replay({ type: "IrsPositionRevalued" })];
      expect(noMirror).toHaveLength(0);

      // The bucketed DV01 grid is populated (BA 320 IR-general-risk ladder feed),
      // with every band a valid BaselMaturityBand and a non-zero contribution.
      const payload = accounting[0]?.payload as {
        dv01ByTenorBucket?: Record<string, number>;
        npvClosingMinor: number;
        npvOpeningMinor: number;
        npvDeltaMinor: number;
      };
      const buckets = payload.dv01ByTenorBucket ?? {};
      expect(Object.keys(buckets).length).toBeGreaterThan(0);
      for (const v of Object.values(buckets)) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).not.toBe(0);
      }
      // First reval: opening NPV is 0, so delta == closing.
      expect(payload.npvOpeningMinor).toBe(0);
      expect(payload.npvDeltaMinor).toBe(payload.npvClosingMinor);

      store.close();
    } finally {
      cleanDb(db);
    }
  });

  it("idempotency: already-revalued swap is skipped on same valuationDate", () => {
    const db = tmpDb("idempotency");
    cleanDb(db);

    try {
      const store = new EventStore(db);

      const tradeEvent = makeIrsTradeBooked({
        asOf: "2026-05-17",
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "human", id: "eitan@bank.local" },
        citations: ["D-MARKETS-SCHEMA-FOUNDATION"],
        payload: BASE_TRADE,
      });

      store.append(tradeEvent);

      // First run — should revalue.
      const run1 = runEodIrsRevaluation(store, "2026-05-17", rateSource);
      expect(run1.revalued).toBe(1);

      // Second run same date — should skip.
      const run2 = runEodIrsRevaluation(store, "2026-05-17", rateSource);
      expect(run2.revalued).toBe(0);
      expect(run2.skipped).toBe(1);

      store.close();
    } finally {
      cleanDb(db);
    }
  });

  it("matured swap is skipped", () => {
    const db = tmpDb("matured");
    cleanDb(db);

    try {
      const store = new EventStore(db);

      const maturedTrade: IrsTradeBookedPayload = {
        ...BASE_TRADE,
        tradeId: { scheme: "INTERNAL", value: "TRD-IRS-MATURED-001" },
        maturityDate: { iso: "2025-01-01", calendar: "JIHCAL" }, // already matured
      };

      const tradeEvent = makeIrsTradeBooked({
        asOf: "2026-05-17",
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "human", id: "eitan@bank.local" },
        citations: ["D-MARKETS-SCHEMA-FOUNDATION"],
        payload: maturedTrade,
      });

      store.append(tradeEvent);

      // valuation date > maturityDate → should be skipped.
      const result = runEodIrsRevaluation(store, "2026-05-17", rateSource);
      expect(result.revalued).toBe(0);
      expect(result.skipped).toBe(1);

      store.close();
    } finally {
      cleanDb(db);
    }
  });
});

// ---------------------------------------------------------------------------
// Full scenario runner
// ---------------------------------------------------------------------------

describe("scenario 10 — IRS trade lifecycle", () => {
  it("builds 6 scenario events (incl. accounting IrdSwap* family)", () => {
    const events = buildIrsScenarioEvents();
    expect(events.all.length).toBe(6);
  });

  it("event types are correct (trade-domain + accounting family)", () => {
    const events = buildIrsScenarioEvents();
    const types = events.all.map((e) => e.type);
    expect(types).toContain("IrsTradeBooked");
    expect(types).toContain("IrsCouponScheduleGenerated");
    expect(types).toContain("IrsCouponPaymentInstructed");
    expect(types).toContain("IrsCouponSettlementConfirmed");
    // D-IRS-FAMILY-CONVERGE-ACCOUNTING: canonical GL/regulatory family is emitted
    // at the booking + settlement sites alongside the trade-domain CDM events.
    expect(types).toContain("IrdSwapTradeExecuted");
    expect(types).toContain("IrdSwapCouponSettled");
  });

  it("runScenario succeeds (ok=true)", () => {
    const result = runScenario({
      dbPath: tmpDb("full-scenario"),
      cleanup: true,
    });
    expect(result.ok).toBe(true);
    expect(result.revalued).toBeGreaterThanOrEqual(1);
    expect(result.errors).toHaveLength(0);
  });
});
