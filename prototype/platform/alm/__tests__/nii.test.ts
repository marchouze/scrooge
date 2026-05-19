// platform/alm/__tests__/nii.test.ts
//
// Zero-position baseline tests for the ΔNII engine.
//
// In build phase the event store has no positions. All ΔNII values should
// be 0 across all four parallel shock scenarios.
//
// Authority: D-TREASURY-GAPS-WAVE1; BCBS d365 §4.
// Author: Ravi (Treasury/ALM Engineer, engineering)

import { describe, expect, it } from "bun:test";

import {
  NII_SHOCK_LABELS,
  computeNII,
} from "../nii";
import { makeTestEventStore } from "./test-utils";

describe("computeNII — zero-position baseline", () => {
  const store = makeTestEventStore();
  const asOf = "2026-05-19T05:00:00.000Z";
  const report = computeNII(store, asOf);

  it("returns status=zero-positions when no trades exist", () => {
    expect(report.status).toBe("zero-positions");
  });

  it("returns currency=ZAR", () => {
    expect(report.currency).toBe("ZAR");
  });

  it("returns horizonMonths=12", () => {
    expect(report.horizonMonths).toBe(12);
  });

  it("returns 4 results (one per parallel shock scenario)", () => {
    expect(report.results).toHaveLength(4);
  });

  it("shock labels match the canonical NII order", () => {
    const labels = report.results.map((r) => r.shockLabel);
    expect(labels).toEqual([...NII_SHOCK_LABELS]);
  });

  it("all base NII values are zero", () => {
    for (const result of report.results) {
      expect(result.baseNiiZar).toBe(0);
    }
  });

  it("all shocked NII values are zero", () => {
    for (const result of report.results) {
      expect(result.shockedNiiZar).toBe(0);
    }
  });

  it("all ΔNII values are zero", () => {
    for (const result of report.results) {
      expect(result.deltaNiiZar).toBe(0);
    }
  });

  it("worst-case ΔNII is zero", () => {
    expect(report.worstCaseDeltaNiiZar).toBe(0);
  });

  it("ΔNII = shocked NII − base NII for each scenario", () => {
    for (const result of report.results) {
      expect(result.deltaNiiZar).toBe(result.shockedNiiZar - result.baseNiiZar);
    }
  });
});
