// platform/alm/__tests__/repricing-gap.test.ts
//
// Zero-position baseline tests for the repricing gap engine.
//
// In build phase the event store has no TradeBooked / TradeSettled events.
// The repricing gap schedule should have:
//   - status = "zero-positions"
//   - All RSA, RSL, gap, and cumulative gap values = 0 across all 10 buckets
//
// Authority: D-TREASURY-GAPS-WAVE1; BCBS d365; BCBS 319.
// Author: Ravi (Treasury/ALM Engineer, engineering)

import { describe, expect, it } from "bun:test";

import { makeDepositTaken } from "../../event-store/event-types/repo-mmd-ibl";
import { REPRICING_BUCKETS, computeRepricingGap } from "../repricing-gap";
import { makeTestEventStore } from "./test-utils";

describe("computeRepricingGap — zero-position baseline", () => {
  const store = makeTestEventStore();
  const asOf = "2026-05-19T05:00:00.000Z";
  const schedule = computeRepricingGap(store, asOf);

  it("returns status=zero-positions when no trades exist", () => {
    expect(schedule.status).toBe("zero-positions");
  });

  it("returns currency=ZAR", () => {
    expect(schedule.currency).toBe("ZAR");
  });

  it("returns 10 rows (one per BCBS 319 bucket)", () => {
    expect(schedule.rows).toHaveLength(10);
  });

  it("bucket labels match the canonical BCBS 319 order", () => {
    const labels = schedule.rows.map((r) => r.bucket);
    expect(labels).toEqual([...REPRICING_BUCKETS]);
  });

  it("all RSA values are zero", () => {
    for (const row of schedule.rows) {
      expect(row.rsaZar).toBe(0);
    }
  });

  it("all RSL values are zero", () => {
    for (const row of schedule.rows) {
      expect(row.rslZar).toBe(0);
    }
  });

  it("all gap values are zero", () => {
    for (const row of schedule.rows) {
      expect(row.gapZar).toBe(0);
    }
  });

  it("all cumulative gap values are zero", () => {
    for (const row of schedule.rows) {
      expect(row.cumulativeGapZar).toBe(0);
    }
  });

  it("gap equals RSA minus RSL for each row", () => {
    for (const row of schedule.rows) {
      expect(row.gapZar).toBe(row.rsaZar - row.rslZar);
    }
  });
});

describe("computeRepricingGap — minor-unit (cents) conversion", () => {
  // A single R10m deposit, principal carried in ZAR minor units (cents) per the
  // DepositTaken schema: 1_000_000_000 cents = R10,000,000. Maturing inside the
  // 3M bucket, it is a rate-sensitive liability. The gap schedule is presented
  // in whole rand, so RSL[3M] must read R10m — NOT the raw cents value
  // (R1.00bn), which is the 100× overstatement this test guards against.
  const asOf = "2026-06-02T05:00:00.000Z";

  function storeWithDeposit() {
    const store = makeTestEventStore();
    store.append(
      makeDepositTaken({
        asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "system", id: "test" },
        citations: ["ORG-TEST-01"],
        payload: {
          depositId: "DEP-TEST-001",
          counterpartyLei: "LEI-TEST-0000000000000000",
          principalZar: 1_000_000_000, // R10m in cents
          interestRateDecimal: 0.0795,
          maturityDate: "2026-08-15", // ~74 days out → 3M bucket
          depositCategory: "wholesale-non-operational",
          bookId: "TREASURY-MM",
          instrumentRef: "MMD-ZAR-001",
        },
      }),
    );
    return store;
  }

  it("converts cents to rand — R10m deposit reads R10m, not R1.00bn", () => {
    const schedule = computeRepricingGap(storeWithDeposit(), asOf);
    const threeM = schedule.rows.find((r) => r.bucket === "3M");
    expect(threeM?.rslZar).toBe(10_000_000);
    expect(threeM?.gapZar).toBe(-10_000_000);
  });

  it("status is computed when a live position exists", () => {
    const schedule = computeRepricingGap(storeWithDeposit(), asOf);
    expect(schedule.status).toBe("computed");
  });
});
