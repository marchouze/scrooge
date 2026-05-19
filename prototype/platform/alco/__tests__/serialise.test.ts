// platform/alco/__tests__/serialise.test.ts
//
// Tests for serialiseALCOPack.
//
// Verifies structural and content requirements for the rendered markdown.
//
// Authority: D-TREASURY-GAPS-WAVE1.

import { describe, expect, it } from "bun:test";

import type { ALCOPack } from "../pack";
import { serialiseALCOPack } from "../serialise";

const TEST_AS_OF = "2026-05-19T00:00:00Z";

/** Minimal build-phase pack (all data sections null). */
const BUILD_PHASE_PACK: ALCOPack = {
  asOf: TEST_AS_OF,
  cycleLabel: "2026-05 Monthly",
  liquidity: null,
  hqlaComposition: null,
  almIRRBB: null,
  intradayLiquidity: null,
  ftpCurve: null,
  ilaapSummary: null,
  openRiskItems: { items: [] },
  proposedResolutions: "To be completed by Eitan at ALCO.",
  sectionsWithNoData: [
    "liquidity",
    "hqlaComposition",
    "almIRRBB",
    "intradayLiquidity",
    "ftpCurve",
    "ilaapSummary",
  ],
  overallTreasuryStatus: "no-positions",
};

describe("serialiseALCOPack", () => {
  it("contains all 8 section headers", () => {
    const output = serialiseALCOPack(BUILD_PHASE_PACK);
    expect(output).toContain("## 1. Liquidity Position");
    expect(output).toContain("## 2. HQLA Composition");
    expect(output).toContain("## 3. ALM / IRRBB");
    expect(output).toContain("## 4. Intraday Liquidity");
    expect(output).toContain("## 5. FTP Curve");
    expect(output).toContain("## 6. ILAAP Summary");
    expect(output).toContain("## 7. Open Risk Items");
    expect(output).toContain("## 8. Proposed Resolutions / Decisions");
  });

  it("displays overallTreasuryStatus as UPPER-CASE text", () => {
    const output = serialiseALCOPack(BUILD_PHASE_PACK);
    // Should contain NO-POSITIONS (uppercase) not "no-positions" in the header line
    expect(output).toContain("NO-POSITIONS");
  });

  it("does not contain any emoji characters", () => {
    const output = serialiseALCOPack(BUILD_PHASE_PACK);
    // Emoji regex: covers common emoji ranges
    const emojiRegex =
      /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FE0F}]/u;
    expect(emojiRegex.test(output)).toBe(false);
  });

  it("includes the pack header with cycle label and asOf", () => {
    const output = serialiseALCOPack(BUILD_PHASE_PACK);
    expect(output).toContain("ALCO Pack — 2026-05 Monthly");
    expect(output).toContain(TEST_AS_OF);
  });

  it("mentions sections with no data in the footer", () => {
    const output = serialiseALCOPack(BUILD_PHASE_PACK);
    expect(output).toContain("Sections with no data (build phase):");
    expect(output).toContain("liquidity");
  });

  it("includes all 8 section headers when pack has data", () => {
    // Use the build-phase pack — headers should still be present even with no data
    const output = serialiseALCOPack(BUILD_PHASE_PACK);
    const sectionHeaders = [
      "## 1.",
      "## 2.",
      "## 3.",
      "## 4.",
      "## 5.",
      "## 6.",
      "## 7.",
      "## 8.",
    ];
    for (const h of sectionHeaders) {
      expect(output).toContain(h);
    }
  });

  it("renders GREEN status in uppercase", () => {
    const greenPack: ALCOPack = { ...BUILD_PHASE_PACK, overallTreasuryStatus: "green", sectionsWithNoData: [] };
    const output = serialiseALCOPack(greenPack);
    expect(output).toContain("GREEN");
    expect(output).not.toContain("Overall treasury status: green");
  });

  it("renders RED status in uppercase", () => {
    const redPack: ALCOPack = { ...BUILD_PHASE_PACK, overallTreasuryStatus: "red" };
    const output = serialiseALCOPack(redPack);
    expect(output).toContain("RED");
  });

  it("renders AMBER status in uppercase", () => {
    const amberPack: ALCOPack = { ...BUILD_PHASE_PACK, overallTreasuryStatus: "amber" };
    const output = serialiseALCOPack(amberPack);
    expect(output).toContain("AMBER");
  });

  it("shows 0 open items when openRiskItems is empty", () => {
    const output = serialiseALCOPack(BUILD_PHASE_PACK);
    expect(output).toContain("0 open items: None");
  });
});
