// platform/alm/__tests__/eve.test.ts
//
// Zero-position baseline tests for the ΔEVE engine.
//
// In build phase the event store has no positions. All ΔEVE values should
// be 0 across all six BCBS d365 shock scenarios.
//
// Authority: D-TREASURY-GAPS-WAVE1; BCBS d365 §4.
// Author: Ravi (Treasury/ALM Engineer, engineering)

import { describe, expect, it } from "bun:test";

import {
  EVE_SHOCK_LABELS,
  computeEVE,
} from "../eve";
import { makeTestEventStore } from "./test-utils";

describe("computeEVE — zero-position baseline", () => {
  const store = makeTestEventStore();
  const asOf = "2026-05-19T05:00:00.000Z";
  const report = computeEVE(store, asOf);

  it("returns status=zero-positions when no trades exist", () => {
    expect(report.status).toBe("zero-positions");
  });

  it("returns currency=ZAR", () => {
    expect(report.currency).toBe("ZAR");
  });

  it("returns 6 results (one per BCBS d365 shock scenario)", () => {
    expect(report.results).toHaveLength(6);
  });

  it("shock labels match the canonical BCBS d365 order", () => {
    const labels = report.results.map((r) => r.shockLabel);
    expect(labels).toEqual([...EVE_SHOCK_LABELS]);
  });

  it("all base NPV values are zero", () => {
    for (const result of report.results) {
      expect(result.baseNpvZar).toBe(0);
    }
  });

  it("all shocked NPV values are zero", () => {
    for (const result of report.results) {
      expect(result.shockedNpvZar).toBe(0);
    }
  });

  it("all ΔEVE values are zero", () => {
    for (const result of report.results) {
      expect(result.deltaEveZar).toBe(0);
    }
  });

  it("worst-case ΔEVE is zero", () => {
    expect(report.worstCaseDeltaEveZar).toBe(0);
  });

  it("ΔEVE = shocked NPV − base NPV for each scenario", () => {
    for (const result of report.results) {
      expect(result.deltaEveZar).toBe(result.shockedNpvZar - result.baseNpvZar);
    }
  });
});
