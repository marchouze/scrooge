// platform/alco/__tests__/pack.test.ts
//
// Tests for generateALCOPack.
//
// Build-phase posture: the event store is empty in tests, so all data
// sections will be null and `sectionsWithNoData` will be non-empty.
// The generator must never throw.
//
// Authority: D-TREASURY-GAPS-WAVE1.

import { describe, expect, it } from "bun:test";

import { generateALCOPack } from "../pack";

const TEST_AS_OF = "2026-05-19T00:00:00Z";

describe("generateALCOPack — build-phase (empty event store)", () => {
  it("runs without error", () => {
    expect(() => generateALCOPack(TEST_AS_OF)).not.toThrow();
  });

  it("returns an object with all 8 section keys", () => {
    const pack = generateALCOPack(TEST_AS_OF);
    expect(Object.keys(pack)).toContain("liquidity");
    expect(Object.keys(pack)).toContain("hqlaComposition");
    expect(Object.keys(pack)).toContain("almIRRBB");
    expect(Object.keys(pack)).toContain("intradayLiquidity");
    expect(Object.keys(pack)).toContain("ftpCurve");
    expect(Object.keys(pack)).toContain("ilaapSummary");
    expect(Object.keys(pack)).toContain("openRiskItems");
    expect(Object.keys(pack)).toContain("proposedResolutions");
  });

  it("has sectionsWithNoData as a non-empty array", () => {
    const pack = generateALCOPack(TEST_AS_OF);
    expect(Array.isArray(pack.sectionsWithNoData)).toBe(true);
    expect(pack.sectionsWithNoData.length).toBeGreaterThan(0);
  });

  it("sets overallTreasuryStatus to no-positions when all sections are null", () => {
    const pack = generateALCOPack(TEST_AS_OF);
    expect(pack.overallTreasuryStatus).toBe("no-positions");
  });

  it("returns null for data sections in build phase", () => {
    const pack = generateALCOPack(TEST_AS_OF);
    expect(pack.liquidity).toBeNull();
    expect(pack.hqlaComposition).toBeNull();
    expect(pack.almIRRBB).toBeNull();
    expect(pack.intradayLiquidity).toBeNull();
    expect(pack.ftpCurve).toBeNull();
    expect(pack.ilaapSummary).toBeNull();
  });

  it("always returns openRiskItems with an items array", () => {
    const pack = generateALCOPack(TEST_AS_OF);
    expect(pack.openRiskItems).toBeDefined();
    expect(Array.isArray(pack.openRiskItems.items)).toBe(true);
  });

  it("returns the asOf and cycleLabel from input", () => {
    const pack = generateALCOPack(TEST_AS_OF);
    expect(pack.asOf).toBe(TEST_AS_OF);
    expect(pack.cycleLabel).toBe("2026-05 Monthly");
  });

  it("returns proposedResolutions as a non-empty string", () => {
    const pack = generateALCOPack(TEST_AS_OF);
    expect(typeof pack.proposedResolutions).toBe("string");
    expect(pack.proposedResolutions.length).toBeGreaterThan(0);
  });
});
