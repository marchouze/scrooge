// tests/ba-350-nsfr.test.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN — BA 350 (NSFR) engine tests.
//
// Asserts:
//   1. Well-funded bank: retail deposits 95m → ASF 90.25m vs HQLA RSF 4.5m
//      + equity RSF 25m → NSFR ≈ 3.06 (compliant).
//   2. Breached: interbank-only funding → ASF ≈ 0 → NSFR < 1.0.
//   3. NSFRRatioProjection event appended to the store after each run.
//   4. Components sum to ASF and RSF totals.
//   5. Zero RSF → NSFR = Infinity (graceful divide-by-zero).
//   6. Negative input rejected with NsfrGeneratorError.
//   7. NSFR ratio = 1.0 → status "at-minimum".
//
// Authority:
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
//   BCBS 295; Regulations Relating to Banks Reg 26A; BA-300.
//
// Author: Ravi (ALM / treasury engineer, engineering)

import { describe, expect, it } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import { NsfrGeneratorError, generateNsfrProjection } from "../platform/reporting/ba-350-nsfr";

const PERIOD_END = "2026-05-31T23:59:59.999Z";

function makeStore(): EventStore {
  return new EventStore(":memory:");
}

// =====================================================================
// 1. Well-funded bank: NSFR compliant.
// =====================================================================

describe("BA-350 NSFR — well-funded scenario", () => {
  it("retail deposits 95m + HQLA 90m + equity book 50m → NSFR compliant", async () => {
    const store = makeStore();

    const result = await generateNsfrProjection(store, {
      periodEnd: PERIOD_END,
      retailDepositsZAR: 95_000_000 * 100, // R95m = 9,500,000,000 cents
      institutionalDepositsZAR: 0,
      interbankLiabilitiesZAR: 0,
      hqlaLevel1ZAR: 90_000_000 * 100, // R90m
      corporateLoansZAR: 0,
      equityBookZAR: 50_000_000 * 100, // R50m
      otcDerivativesNetZAR: 0,
    });

    // ASF = 9,500,000,000 × 0.95 = 9,025,000,000
    expect(result.availableStableFundingZAR).toBeCloseTo(9_500_000_000 * 0.95, 0);
    expect(result.components.asfRetail).toBeCloseTo(9_500_000_000 * 0.95, 0);

    // RSF = 9,000,000,000 × 0.05 + 5,000,000,000 × 0.50 = 450,000,000 + 2,500,000,000 = 2,950,000,000
    expect(result.requiredStableFundingZAR).toBeCloseTo(
      9_000_000_000 * 0.05 + 5_000_000_000 * 0.5,
      0,
    );
    expect(result.components.rsfHqla).toBeCloseTo(9_000_000_000 * 0.05, 0);
    expect(result.components.rsfEquity).toBeCloseTo(5_000_000_000 * 0.5, 0);

    // NSFR = 9,025,000,000 / 2,950,000,000 ≈ 3.06
    expect(result.nsfrRatio).toBeGreaterThan(1.0);
    expect(result.breached).toBe(false);
    expect(result.minimumThreshold).toBe(1.0);
  });

  it("components sum correctly to ASF and RSF totals", async () => {
    const store = makeStore();

    const result = await generateNsfrProjection(store, {
      periodEnd: PERIOD_END,
      retailDepositsZAR: 100_000,
      institutionalDepositsZAR: 50_000,
      interbankLiabilitiesZAR: 20_000,
      hqlaLevel1ZAR: 80_000,
      corporateLoansZAR: 30_000,
      equityBookZAR: 10_000,
      otcDerivativesNetZAR: 5_000,
    });

    // ASF components should sum to total ASF.
    const asfSum =
      result.components.asfRetail +
      result.components.asfInstitutional +
      result.components.asfInterbank;
    expect(asfSum).toBeCloseTo(result.availableStableFundingZAR, 5);

    // RSF components should sum to total RSF.
    const rsfSum =
      result.components.rsfHqla +
      result.components.rsfLoans +
      result.components.rsfEquity +
      result.components.rsfDerivatives;
    expect(rsfSum).toBeCloseTo(result.requiredStableFundingZAR, 5);
  });
});

// =====================================================================
// 2. Breached: interbank-only funding → ASF ≈ 0.
// =====================================================================

describe("BA-350 NSFR — breached scenario", () => {
  it("interbank-only funding → ASF = 0 → NSFR = 0 → breached", async () => {
    const store = makeStore();

    const result = await generateNsfrProjection(store, {
      periodEnd: PERIOD_END,
      retailDepositsZAR: 0,
      institutionalDepositsZAR: 0,
      // Interbank at 0% ASF factor.
      interbankLiabilitiesZAR: 500_000_000,
      hqlaLevel1ZAR: 10_000,
      corporateLoansZAR: 50_000,
      equityBookZAR: 20_000,
      otcDerivativesNetZAR: 0,
    });

    // ASF = 500m × 0 = 0 → NSFR = 0 / RSF < 1.0.
    expect(result.availableStableFundingZAR).toBe(0);
    expect(result.components.asfInterbank).toBe(0);
    expect(result.nsfrRatio).toBe(0);
    expect(result.breached).toBe(true);
  });

  it("institutional deposits contribute 50% ASF", async () => {
    const store = makeStore();

    const result = await generateNsfrProjection(store, {
      periodEnd: PERIOD_END,
      retailDepositsZAR: 0,
      institutionalDepositsZAR: 200_000,
      interbankLiabilitiesZAR: 0,
      hqlaLevel1ZAR: 0,
      corporateLoansZAR: 0,
      equityBookZAR: 0,
      otcDerivativesNetZAR: 0,
    });

    // ASF = 200,000 × 0.50 = 100,000; RSF = 0 → infinite.
    expect(result.components.asfInstitutional).toBe(100_000);
    expect(result.availableStableFundingZAR).toBe(100_000);
    expect(result.nsfrRatio).toBe(Number.POSITIVE_INFINITY);
    expect(result.breached).toBe(false);
  });
});

// =====================================================================
// 3. NSFRRatioProjection event appended to the store.
// =====================================================================

describe("BA-350 NSFR — event emission", () => {
  it("appends NSFRRatioProjection event to the event store", async () => {
    const store = makeStore();

    await generateNsfrProjection(store, {
      periodEnd: PERIOD_END,
      retailDepositsZAR: 200_000,
      institutionalDepositsZAR: 0,
      interbankLiabilitiesZAR: 0,
      hqlaLevel1ZAR: 50_000,
      corporateLoansZAR: 0,
      equityBookZAR: 10_000,
      otcDerivativesNetZAR: 0,
    });

    let found = false;
    for (const event of store.replay({ type: "NSFRRatioProjection" })) {
      found = true;
      expect(event.type).toBe("NSFRRatioProjection");
      const payload = event.payload as {
        nsfrRatioPct: number;
        regulatoryMinimumPct: number;
        projectionHorizonDays: number;
        status: string;
      };
      expect(payload.regulatoryMinimumPct).toBe(100);
      expect(payload.projectionHorizonDays).toBe(365);
      expect(["above-minimum", "at-minimum", "below-minimum"]).toContain(payload.status);
    }
    expect(found).toBe(true);
  });

  it("compliant run emits status=above-minimum", async () => {
    const store = makeStore();

    await generateNsfrProjection(store, {
      periodEnd: PERIOD_END,
      retailDepositsZAR: 500_000,
      institutionalDepositsZAR: 0,
      interbankLiabilitiesZAR: 0,
      hqlaLevel1ZAR: 10_000,
      corporateLoansZAR: 0,
      equityBookZAR: 0,
      otcDerivativesNetZAR: 0,
    });

    for (const event of store.replay({ type: "NSFRRatioProjection" })) {
      const payload = event.payload as { status: string };
      expect(payload.status).toBe("above-minimum");
    }
  });

  it("breached run emits status=below-minimum", async () => {
    const store = makeStore();

    await generateNsfrProjection(store, {
      periodEnd: PERIOD_END,
      retailDepositsZAR: 0,
      institutionalDepositsZAR: 0,
      interbankLiabilitiesZAR: 100_000,
      hqlaLevel1ZAR: 10_000,
      corporateLoansZAR: 50_000,
      equityBookZAR: 20_000,
      otcDerivativesNetZAR: 0,
    });

    for (const event of store.replay({ type: "NSFRRatioProjection" })) {
      const payload = event.payload as { status: string };
      expect(payload.status).toBe("below-minimum");
    }
  });
});

// =====================================================================
// 4. Edge cases.
// =====================================================================

describe("BA-350 NSFR — edge cases", () => {
  it("zero RSF → NSFR = Infinity (no illiquid assets to fund)", async () => {
    const store = makeStore();

    const result = await generateNsfrProjection(store, {
      periodEnd: PERIOD_END,
      retailDepositsZAR: 100_000,
      institutionalDepositsZAR: 0,
      interbankLiabilitiesZAR: 0,
      hqlaLevel1ZAR: 0,
      corporateLoansZAR: 0,
      equityBookZAR: 0,
      otcDerivativesNetZAR: 0,
    });

    expect(result.requiredStableFundingZAR).toBe(0);
    expect(result.nsfrRatio).toBe(Number.POSITIVE_INFINITY);
    expect(result.breached).toBe(false);
  });

  it("negative input rejected with NsfrGeneratorError", async () => {
    const store = makeStore();

    await expect(
      generateNsfrProjection(store, {
        periodEnd: PERIOD_END,
        retailDepositsZAR: -100,
        institutionalDepositsZAR: 0,
        interbankLiabilitiesZAR: 0,
        hqlaLevel1ZAR: 0,
        corporateLoansZAR: 0,
        equityBookZAR: 0,
        otcDerivativesNetZAR: 0,
      }),
    ).rejects.toBeInstanceOf(NsfrGeneratorError);
  });

  it("OTC derivatives contribute 100% RSF (conservative build-phase posture)", async () => {
    const store = makeStore();

    const result = await generateNsfrProjection(store, {
      periodEnd: PERIOD_END,
      retailDepositsZAR: 1_000_000,
      institutionalDepositsZAR: 0,
      interbankLiabilitiesZAR: 0,
      hqlaLevel1ZAR: 0,
      corporateLoansZAR: 0,
      equityBookZAR: 0,
      otcDerivativesNetZAR: 50_000,
    });

    expect(result.components.rsfDerivatives).toBe(50_000);
    expect(result.requiredStableFundingZAR).toBe(50_000);
  });

  it("corporate loans contribute 85% RSF", async () => {
    const store = makeStore();

    const result = await generateNsfrProjection(store, {
      periodEnd: PERIOD_END,
      retailDepositsZAR: 1_000_000,
      institutionalDepositsZAR: 0,
      interbankLiabilitiesZAR: 0,
      hqlaLevel1ZAR: 0,
      corporateLoansZAR: 100_000,
      equityBookZAR: 0,
      otcDerivativesNetZAR: 0,
    });

    expect(result.components.rsfLoans).toBe(85_000);
  });

  it("NSFR exactly at 1.0 threshold → status at-minimum, not breached", async () => {
    // Make ASF exactly equal RSF.
    // ASF = retail × 0.95; RSF = corporate × 0.85.
    // retail × 0.95 = corporate × 0.85 → retail = corporate × (0.85/0.95) ≈ 0.894736 × corporate.
    // Use corporate = 95_000 → RSF = 80_750; retail = 85_000 → ASF = 80_750.
    const store = makeStore();

    const result = await generateNsfrProjection(store, {
      periodEnd: PERIOD_END,
      retailDepositsZAR: 85_000,
      institutionalDepositsZAR: 0,
      interbankLiabilitiesZAR: 0,
      hqlaLevel1ZAR: 0,
      corporateLoansZAR: 95_000,
      equityBookZAR: 0,
      otcDerivativesNetZAR: 0,
    });

    // ASF = 85,000 × 0.95 = 80,750; RSF = 95,000 × 0.85 = 80,750 → NSFR = 1.0.
    expect(result.availableStableFundingZAR).toBe(80_750);
    expect(result.requiredStableFundingZAR).toBe(80_750);
    expect(result.nsfrRatio).toBeCloseTo(1.0, 10);
    expect(result.breached).toBe(false);

    // Event status.
    for (const event of store.replay({ type: "NSFRRatioProjection" })) {
      const payload = event.payload as { status: string };
      expect(payload.status).toBe("at-minimum");
    }
  });

  it("multiple runs each emit one NSFRRatioProjection event", async () => {
    const store = makeStore();

    await generateNsfrProjection(store, {
      periodEnd: "2026-04-30T23:59:59.999Z",
      retailDepositsZAR: 100_000,
      institutionalDepositsZAR: 0,
      interbankLiabilitiesZAR: 0,
      hqlaLevel1ZAR: 5_000,
      corporateLoansZAR: 0,
      equityBookZAR: 0,
      otcDerivativesNetZAR: 0,
    });

    await generateNsfrProjection(store, {
      periodEnd: PERIOD_END,
      retailDepositsZAR: 200_000,
      institutionalDepositsZAR: 0,
      interbankLiabilitiesZAR: 0,
      hqlaLevel1ZAR: 10_000,
      corporateLoansZAR: 0,
      equityBookZAR: 0,
      otcDerivativesNetZAR: 0,
    });

    let count = 0;
    for (const _event of store.replay({ type: "NSFRRatioProjection" })) {
      count++;
    }
    expect(count).toBe(2);
  });
});
