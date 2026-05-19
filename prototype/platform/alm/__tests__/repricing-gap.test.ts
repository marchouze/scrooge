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

import {
  REPRICING_BUCKETS,
  computeRepricingGap,
} from "../repricing-gap";
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
