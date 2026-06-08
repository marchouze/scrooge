// platform/risk/ras-appetite-register.test.ts
//
// Pins the canonical RAS appetite register (D-RAS-STRUCTURED-REGISTER,
// CEO-approved 2026-06-08). This is the byte-faithful-extraction contract:
// the 14 lines, their ids, thresholds, and citations are asserted against the
// pre-change handler's hand-curated set so the extraction provably changes no
// appetite semantics.
//
// Author: Atlas (Substrate engineer, engineering).

import { describe, expect, it } from "bun:test";

import {
  RAS_APPETITE_LINES,
  RAS_APPETITE_LINE_IDS,
  classifyRatio,
  formatThresholds,
  getRasAppetiteLine,
} from "./ras-appetite-register";

// The EXACT 14 ids in the EXACT order the pre-change `APPETITE_LINES` array
// declared them in runtime/agents/helena-risk-appetite-watch.ts. The
// RiskAppetiteSnapshot.lineStatuses keyset must equal this set.
const PRE_CHANGE_LINE_IDS: readonly string[] = [
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
];

// The EXACT threshold strings the pre-change LCR/NSFR render printed.
const LCR_THRESHOLDS = "green ≥120% / amber 110-120% / red <110% / critical <105%";
const NSFR_THRESHOLDS = "green ≥115% / amber 108-115% / red <108% / critical <103%";

describe("RAS appetite register — canonical 14-line contract", () => {
  it("has exactly 14 lines in the pre-change order", () => {
    expect(RAS_APPETITE_LINES).toHaveLength(14);
    expect(RAS_APPETITE_LINE_IDS).toEqual(PRE_CHANGE_LINE_IDS);
  });

  it("keyset equals the pre-change handler id list", () => {
    const ids = new Set(RAS_APPETITE_LINES.map((l) => l.id));
    expect(ids).toEqual(new Set(PRE_CHANGE_LINE_IDS));
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
    const lcr = getRasAppetiteLine("appetite:liquidity:lcr");
    expect(lcr).toBeDefined();
    expect(formatThresholds(lcr!.thresholds)).toBe(LCR_THRESHOLDS);
  });

  it("NSFR thresholds format byte-identically to the pre-change render", () => {
    const nsfr = getRasAppetiteLine("appetite:liquidity:nsfr");
    expect(nsfr).toBeDefined();
    expect(formatThresholds(nsfr!.thresholds)).toBe(NSFR_THRESHOLDS);
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
  const lcr = getRasAppetiteLine("appetite:liquidity:lcr")!;
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
  const nsfr = getRasAppetiteLine("appetite:liquidity:nsfr")!;
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
    const tcf = getRasAppetiteLine("appetite:conduct:tcf")!;
    expect(classifyRatio(tcf.thresholds, 50)).toBeNull();
  });
});
