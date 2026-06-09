// platform/reporting/ba-320-ir-maturity-bands.test.ts
//
// Tests for the Reg 28(3)(a) maturity-method vertical/horizontal disallowance
// algebra (B-IRS-DISALLOWANCES, WS-BA-RETURNS-FOLLOWON). Asserts each layer of
// the charge — vertical (within-band), horizontal within-zone, adjacent-zone,
// and zone 1↔3 — against hand-computed worked examples, and that the band→zone
// map matches the standard Basel partition.
//
// Authority: Regulations Relating to Banks Reg 28(3)(a); BCBS D352 §718(iv)–(x);
//   D-IRS-DV01-BUCKETING-CALIBRATION.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { describe, expect, it } from "bun:test";

import {
  ADJACENT_ZONE_DISALLOWANCE,
  BAND_ZONE,
  VERTICAL_DISALLOWANCE_RATE,
  WITHIN_ZONE_DISALLOWANCE,
  type WeightedBandPosition,
  ZONE_1_3_DISALLOWANCE,
  computeIrGeneralDisallowances,
} from "./ba-320-ir-maturity-bands";

describe("BA 320 IR-general disallowance algebra (Reg 28(3)(a))", () => {
  it("standard Basel calibration constants are the regulatory figures", () => {
    expect(VERTICAL_DISALLOWANCE_RATE).toBe(0.1);
    expect(WITHIN_ZONE_DISALLOWANCE.zone1).toBe(0.4);
    expect(WITHIN_ZONE_DISALLOWANCE.zone2).toBe(0.3);
    expect(WITHIN_ZONE_DISALLOWANCE.zone3).toBe(0.3);
    expect(ADJACENT_ZONE_DISALLOWANCE).toBe(0.4);
    expect(ZONE_1_3_DISALLOWANCE).toBe(1.0);
  });

  it("band→zone map is the standard Basel partition (zone1 ≤12m, zone2 1-4y, zone3 4y+)", () => {
    expect(BAND_ZONE["0-1m"]).toBe("zone1");
    expect(BAND_ZONE["6-12m"]).toBe("zone1");
    expect(BAND_ZONE["1-2y"]).toBe("zone2");
    expect(BAND_ZONE["3-4y"]).toBe("zone2");
    expect(BAND_ZONE["4-5y"]).toBe("zone3");
    expect(BAND_ZONE[">20y"]).toBe("zone3");
  });

  it("an empty ladder has zero disallowance", () => {
    expect(computeIrGeneralDisallowances([]).totalMinor).toBe(0);
  });

  it("a single one-sided band has zero disallowance (nothing to match)", () => {
    const ladder: WeightedBandPosition[] = [
      { band: "5-7y", weightedLongMinor: 2_000_000, weightedShortMinor: 0 },
    ];
    const b = computeIrGeneralDisallowances(ladder);
    expect(b.verticalMinor).toBe(0);
    expect(b.horizontalWithinZoneMinor).toBe(0);
    expect(b.horizontalAdjacentZoneMinor).toBe(0);
    expect(b.horizontalZone1And3Minor).toBe(0);
    expect(b.totalMinor).toBe(0);
  });

  it("VERTICAL: 10% of the matched (min long/short) within a band", () => {
    // matched = min(1_000_000, 600_000) = 600_000 → 10% = 60_000.
    const ladder: WeightedBandPosition[] = [
      { band: "1-2y", weightedLongMinor: 1_000_000, weightedShortMinor: 600_000 },
    ];
    const b = computeIrGeneralDisallowances(ladder);
    expect(b.verticalMinor).toBe(60_000);
    // The band net (+400k) is alone in zone2 → no horizontal match.
    expect(b.horizontalWithinZoneMinor).toBe(0);
    expect(b.totalMinor).toBe(60_000);
  });

  it("HORIZONTAL within-zone: zone2 matched band-nets at 30%", () => {
    // zone2: +400k (1-2y) and -800k (3-4y); matched = 400k → 30% = 120_000.
    // No vertical (each band one-sided). residual zone2 = -400k (no other zone).
    const ladder: WeightedBandPosition[] = [
      { band: "1-2y", weightedLongMinor: 400_000, weightedShortMinor: 0 },
      { band: "3-4y", weightedLongMinor: 0, weightedShortMinor: 800_000 },
    ];
    const b = computeIrGeneralDisallowances(ladder);
    expect(b.verticalMinor).toBe(0);
    expect(b.horizontalWithinZoneMinor).toBe(120_000);
    expect(b.horizontalAdjacentZoneMinor).toBe(0);
    expect(b.totalMinor).toBe(120_000);
  });

  it("HORIZONTAL adjacent-zone: zone2↔zone3 residuals matched at 40%", () => {
    // zone2 net = -400k, zone3 net = +2,000k; opposite → matched 400k → 40% = 160_000.
    const ladder: WeightedBandPosition[] = [
      { band: "3-4y", weightedLongMinor: 0, weightedShortMinor: 400_000 },
      { band: "5-7y", weightedLongMinor: 2_000_000, weightedShortMinor: 0 },
    ];
    const b = computeIrGeneralDisallowances(ladder);
    expect(b.horizontalAdjacentZoneMinor).toBe(160_000);
    expect(b.horizontalZone1And3Minor).toBe(0);
    expect(b.totalMinor).toBe(160_000);
  });

  it("HORIZONTAL zone 1↔3: residual after adjacents matched at 100%", () => {
    // zone1 = +1,000k, zone3 = -1,000k, zone2 = 0.
    // Adjacent 1↔2: zone2=0 → 0. Adjacent 2↔3: zone2=0 → 0.
    // zone1↔3: matched 1,000k → 100% = 1,000_000.
    const ladder: WeightedBandPosition[] = [
      { band: "0-1m", weightedLongMinor: 1_000_000, weightedShortMinor: 0 },
      { band: "5-7y", weightedLongMinor: 0, weightedShortMinor: 1_000_000 },
    ];
    const b = computeIrGeneralDisallowances(ladder);
    // 0-1m carries a 0% risk weight upstream, but the algebra operates on the
    // weighted amounts AS GIVEN — the caller has already applied band weights.
    expect(b.horizontalAdjacentZoneMinor).toBe(0);
    expect(b.horizontalZone1And3Minor).toBe(1_000_000);
    expect(b.totalMinor).toBe(1_000_000);
  });

  it("FULL worked example: vertical + within-zone + adjacent-zone compose", () => {
    // 1-2y: long 1,000k / short 600k → vertical 60k; band net +400k (zone2)
    // 3-4y: short 800k → band net -800k (zone2)
    // 5-7y: long 2,000k → band net +2,000k (zone3)
    //
    // vertical            = 10% * 600k                       =    60,000
    // within zone2        = 30% * min(400k, 800k) = 30%*400k =   120,000  (residual zone2 = -400k)
    // within zone3        = 0 (one-sided)                              0  (residual zone3 = +2,000k)
    // adjacent 1↔2        = 0 (zone1 = 0)                              0
    // adjacent 2↔3        = 40% * min(400k, 2,000k) = 40%*400k =  160,000
    // zone 1↔3            = 0                                          0
    // total                                                  =   340,000
    const ladder: WeightedBandPosition[] = [
      { band: "1-2y", weightedLongMinor: 1_000_000, weightedShortMinor: 600_000 },
      { band: "3-4y", weightedLongMinor: 0, weightedShortMinor: 800_000 },
      { band: "5-7y", weightedLongMinor: 2_000_000, weightedShortMinor: 0 },
    ];
    const b = computeIrGeneralDisallowances(ladder);
    expect(b.verticalMinor).toBe(60_000);
    expect(b.horizontalWithinZoneMinor).toBe(120_000);
    expect(b.horizontalAdjacentZoneMinor).toBe(160_000);
    expect(b.horizontalZone1And3Minor).toBe(0);
    expect(b.totalMinor).toBe(340_000);
  });

  it("a perfectly-hedged single band charges only the vertical (10% matched)", () => {
    // long == short within one band: net 0 (no horizontal anywhere) but the
    // matched position still carries the 10% vertical basis charge.
    const ladder: WeightedBandPosition[] = [
      { band: "7-10y", weightedLongMinor: 5_000_000, weightedShortMinor: 5_000_000 },
    ];
    const b = computeIrGeneralDisallowances(ladder);
    expect(b.verticalMinor).toBe(500_000);
    expect(b.horizontalWithinZoneMinor).toBe(0);
    expect(b.horizontalAdjacentZoneMinor).toBe(0);
    expect(b.horizontalZone1And3Minor).toBe(0);
    expect(b.totalMinor).toBe(500_000);
  });
});
