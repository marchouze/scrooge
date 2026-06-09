// platform/recon/ba320-ir-general-weighting-basis.test.ts
//
// Tests for the BA 320 IR-general weighting-basis recon guard
// (WS-BA-RETURNS-FOLLOWON G1). Asserts the gate PASSES on the real fixed
// sources and FAILS on each reconstructed unit-mismatch defect:
//   (a) an adapter that produces ladder rows but stamps no weightingBasis;
//   (b) an adapter that stamps a FOREIGN basis (the raw-DV01 case);
//   (c) the IRS adapter feeding a raw `dv01` quantity into the band accumulator;
//   (d) a combiner missing the foreign-basis runtime guard.
//
// Authority: D-IRS-DV01-BUCKETING-CALIBRATION; Reg 28(3)(a) Table A;
//   BCBS D352 §718(b).
//
// Author: Mira (Regulatory reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import { run } from "./ba320-ir-general-weighting-basis";

// A minimal source that produces ladder rows on the CANONICAL basis + a
// well-formed combiner guard. Used as the "good" baseline for negative tests.
const GOOD_IRS_SOURCE = `
import { MATURITY_METHOD_WEIGHTED_NOMINAL } from "./ba-320-ir-maturity-bands";
function build() {
  const weightedAmount = Math.round(notionalMinor * bandDef.riskWeight);
  rows.push({
    band,
    weightedLongMinor: acc.weightedLong,
    weightedShortMinor: acc.weightedShort,
    weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,
  });
}
export function combineIrGeneralLadders() {
  if (row.weightingBasis !== undefined && row.weightingBasis !== MATURITY_METHOD_WEIGHTED_NOMINAL) {
    throw new Error("foreign weighting basis");
  }
}
`;

const GOOD_BOND_SOURCE = `
import { MATURITY_METHOD_WEIGHTED_NOMINAL } from "./ba-320-ir-maturity-bands";
function build() {
  const weightedAmount = Math.round(p.nominalMinor * bandDef.riskWeight);
  rows.push({
    band: bandDef.band,
    weightedLongMinor: acc.weightedLong,
    weightedShortMinor: acc.weightedShort,
    weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,
  });
}
`;

describe("ba320-ir-general-weighting-basis recon — real sources", () => {
  it("passes on the actual (fixed) adapter + combiner sources", () => {
    const r = run();
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.asserted).toBeGreaterThan(0);
  });
});

describe("ba320-ir-general-weighting-basis recon — reconstructed defects FAIL", () => {
  it("(a) FAILS when a row-producing adapter stamps no weightingBasis", () => {
    const noBasisIrs = GOOD_IRS_SOURCE.replace(
      "    weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,\n",
      "",
    );
    const r = run({ bondAdapterSource: GOOD_BOND_SOURCE, irsAdapterSource: noBasisIrs });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("stamps NO weightingBasis"))).toBe(true);
  });

  it("(b) FAILS when an adapter stamps a FOREIGN basis (the raw-DV01 case)", () => {
    const foreignIrs = GOOD_IRS_SOURCE.replace(
      "weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,",
      'weightingBasis: "raw-dv01-rand-per-bp",',
    );
    const r = run({ bondAdapterSource: GOOD_BOND_SOURCE, irsAdapterSource: foreignIrs });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("FOREIGN weighting basis"))).toBe(true);
  });

  it("(c) FAILS when the IRS adapter feeds a raw dv01 into the band accumulator", () => {
    // Reconstruct the original defect: a dv01 magnitude written into a weighted
    // accumulator (the pre-fix `weightedLong: current.weightedLong + Math.abs(dv01Raw)`).
    const dv01FeedIrs = GOOD_IRS_SOURCE.replace(
      "    weightedLongMinor: acc.weightedLong,",
      "    weightedLongMinor: acc.weightedLong + Math.abs(dv01Raw),",
    );
    const r = run({ bondAdapterSource: GOOD_BOND_SOURCE, irsAdapterSource: dv01FeedIrs });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("raw DV01 quantity"))).toBe(true);
  });

  it("(d) FAILS when combineIrGeneralLadders lacks the foreign-basis guard", () => {
    const noGuardIrs = GOOD_IRS_SOURCE.replace(
      /if \(row\.weightingBasis !== undefined[\s\S]*?\}\n/,
      "",
    ).replace("foreign weighting basis", "");
    const r = run({ bondAdapterSource: GOOD_BOND_SOURCE, irsAdapterSource: noGuardIrs });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.subject === "combineIrGeneralLadders")).toBe(true);
  });
});
