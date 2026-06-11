// platform/risk/ras-appetite-register.test.ts
//
// Pins the canonical RAS appetite register (D-RAS-STRUCTURED-REGISTER,
// CEO-approved 2026-06-08; D-BOND-RAS-APPETITE, CRO-approved 2026-06-08;
// D-INTRADAY-RAS-APPETITE, CRO-approved 2026-06-11).
// This is the byte-faithful-extraction contract:
// the 14 original lines + 2 bond-trading lines + 1 intraday-liquidity line
// (17 total), their ids, thresholds, and citations are asserted against the
// canonical set so the extraction provably changes no appetite semantics.
//
// Author: Atlas (Substrate engineer, engineering) ·
//         Helena (Chief Risk Officer, governance) — intraday line.

import { describe, expect, it } from "bun:test";

import {
  RAS_APPETITE_LINES,
  RAS_APPETITE_LINE_IDS,
  classifyRatio,
  classifyUsageRatio,
  formatThresholds,
  requireRasAppetiteLine,
} from "./ras-appetite-register";

// The canonical 17 ids in the canonical order:
//   - 14 original lines extracted from the pre-change handler (D-RAS-STRUCTURED-REGISTER)
//   - 2 bond-trading lines added 2026-06-08 (D-BOND-RAS-APPETITE)
//   - 1 intraday-liquidity line added 2026-06-11 (D-INTRADAY-RAS-APPETITE)
// The RiskAppetiteSnapshot.lineStatuses keyset must equal this set.
const CANONICAL_LINE_IDS: readonly string[] = [
  "appetite:liquidity:lcr",
  "appetite:liquidity:nsfr",
  "appetite:capital:cet1-buffer",
  "appetite:capital:leverage-ratio",
  "appetite:credit:single-name-concentration",
  "appetite:credit:sector-concentration",
  "appetite:market:trading-var",
  "appetite:market:counterparty-concentration",
  "appetite:financial-crime:sanctions-match",
  "appetite:financial-crime:str-filing-judgement",
  "appetite:operational:cyber-severity-tiers",
  "appetite:model:tier-discipline",
  "appetite:climate:guidance-note-1-2024",
  "appetite:conduct:tcf",
  // Bond-trading lines — D-BOND-RAS-APPETITE (CRO-approved 2026-06-08)
  "appetite:market:bond-inventory-face-value",
  "appetite:irrbb:delta-eve-outlier",
  // Intraday-liquidity line — D-INTRADAY-RAS-APPETITE (CRO-approved 2026-06-11)
  "appetite:liquidity:intraday",
];

// The EXACT threshold strings the pre-change LCR/NSFR render printed.
const LCR_THRESHOLDS = "green ≥120% / amber 110-120% / red <110% / critical <105%";
const NSFR_THRESHOLDS = "green ≥115% / amber 108-115% / red <108% / critical <103%";

describe("RAS appetite register — canonical 17-line contract", () => {
  it("has exactly 17 lines (14 original + 2 bond-trading + 1 intraday) in the canonical order", () => {
    expect(RAS_APPETITE_LINES).toHaveLength(17);
    expect(RAS_APPETITE_LINE_IDS).toEqual(CANONICAL_LINE_IDS);
  });

  it("keyset equals the canonical id list", () => {
    const ids = new Set(RAS_APPETITE_LINES.map((l) => l.id));
    expect(ids).toEqual(new Set(CANONICAL_LINE_IDS));
    // No duplicate ids.
    expect(RAS_APPETITE_LINES.map((l) => l.id)).toHaveLength(ids.size);
  });

  it("every line carries structured thresholds + a rasSection + ≥1 citation", () => {
    for (const line of RAS_APPETITE_LINES) {
      expect(line.thresholds).toBeDefined();
      expect(typeof formatThresholds(line.thresholds)).toBe("string");
      expect(formatThresholds(line.thresholds).length).toBeGreaterThan(0);
      expect(line.rasSection.length).toBeGreaterThan(0);
      expect(line.citations.length).toBeGreaterThanOrEqual(1);
      // D-RAS is the standing authority on every line.
      expect(line.citations).toContain("D-RAS");
    }
  });

  it("every line carries an explicit measurementBinding (string or null)", () => {
    for (const line of RAS_APPETITE_LINES) {
      const b = line.measurementBinding;
      expect(b === null || (typeof b === "string" && b.length > 0)).toBe(true);
      // A null binding must name a measurementOwner — the gap is checkable.
      expect(line.measurementOwner.length).toBeGreaterThan(0);
    }
  });
});

describe("RAS appetite register — structured thresholds round-trip the legacy strings", () => {
  it("LCR thresholds format byte-identically to the pre-change render", () => {
    const lcr = requireRasAppetiteLine("appetite:liquidity:lcr");
    expect(formatThresholds(lcr.thresholds)).toBe(LCR_THRESHOLDS);
  });

  it("NSFR thresholds format byte-identically to the pre-change render", () => {
    const nsfr = requireRasAppetiteLine("appetite:liquidity:nsfr");
    expect(formatThresholds(nsfr.thresholds)).toBe(NSFR_THRESHOLDS);
  });

  it("ratio printed string equals the joined band tokens", () => {
    for (const line of RAS_APPETITE_LINES) {
      if (line.thresholds.kind === "ratio") {
        const joined = line.thresholds.bands.map((b) => b.formatted).join(" / ");
        expect(line.thresholds.printed).toBe(joined);
      }
    }
  });
});

describe("RAS appetite register — classifier reproduces legacy LCR/NSFR band logic", () => {
  // Legacy statusForLcrRatio: null→green; <105→red; <110→red; <120→amber; else green.
  const lcr = requireRasAppetiteLine("appetite:liquidity:lcr");
  it.each([
    [null, "green"],
    [200, "green"],
    [120, "green"],
    [119.9, "amber"],
    [110, "amber"],
    [109.9, "red"],
    [104.9, "red"],
  ] as const)("LCR ratio %p classifies as %p", (ratio, expected) => {
    expect(classifyRatio(lcr.thresholds, ratio)).toBe(expected);
  });

  // Legacy statusForNsfrRatio: null→green; <103→red; <108→red; <115→amber; else green.
  const nsfr = requireRasAppetiteLine("appetite:liquidity:nsfr");
  it.each([
    [null, "green"],
    [200, "green"],
    [115, "green"],
    [114.9, "amber"],
    [108, "amber"],
    [107.9, "red"],
    [102.9, "red"],
  ] as const)("NSFR ratio %p classifies as %p", (ratio, expected) => {
    expect(classifyRatio(nsfr.thresholds, ratio)).toBe(expected);
  });

  it("posture thresholds classify to null (no numeric band)", () => {
    const tcf = requireRasAppetiteLine("appetite:conduct:tcf");
    expect(classifyRatio(tcf.thresholds, 50)).toBeNull();
  });
});

describe("RAS appetite register — intraday-liquidity line (D-INTRADAY-RAS-APPETITE)", () => {
  const intraday = requireRasAppetiteLine("appetite:liquidity:intraday");

  it("carries the CRO calibration: tier-1, liquidity, §B3, binding + R50m floor", () => {
    expect(intraday.tier).toBe("tier-1");
    expect(intraday.category).toBe("liquidity");
    expect(intraday.rasSection).toBe("RAS §B3");
    expect(intraday.measurementBinding).toBe("computeIntradayLiquidityMetrics");
    expect(intraday.floorZar).toBe(50_000_000);
    expect(intraday.citations).toContain("D-INTRADAY-RAS-APPETITE");
  });

  it("threshold ladder prints the calibrated bands", () => {
    expect(formatThresholds(intraday.thresholds)).toBe(
      "green <60% / amber 60-80% / red ≥80% / critical ≥100%",
    );
  });

  // classifyUsageRatio is higher-is-worse: null→green (build-phase no-usage);
  // ≥80 (the LRM Policy v1 §4.5 stress trigger) → red; ≥100 (critical
  // sub-band) → red; ≥60 → amber; else green.
  it.each([
    [null, "green"],
    [0, "green"],
    [59.9, "green"],
    [60, "amber"],
    [79.9, "amber"],
    [80, "red"],
    [99.9, "red"],
    [100, "red"],
    [150, "red"],
  ] as const)("peak usage %p%% of available classifies as %p", (usage, expected) => {
    expect(classifyUsageRatio(intraday.thresholds, usage)).toBe(expected);
  });

  it("classifyUsageRatio returns null for posture thresholds", () => {
    const tcf = requireRasAppetiteLine("appetite:conduct:tcf");
    expect(classifyUsageRatio(tcf.thresholds, 50)).toBeNull();
  });
});
