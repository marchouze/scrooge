// platform/ilaap/__tests__/summary.test.ts
//
// Tests for ILAAP summary computation.
//
// Coverage:
//   1. Aggregate picks worst-case survival correctly
//   2. Status thresholds: >30 adequate, 15–30 marginal, <15 inadequate
//   3. All no-positions → overallStatus "no-positions"
//   4. Mixed scenarios — worst-case is identified correctly
//   5. Empty results array edge case
//
// Authority: D-TREASURY-GAPS-WAVE1.

import { describe, expect, it } from "bun:test";

import type { ILAAPScenarioResult } from "../stress-scenarios";
import { computeILAAPSummary } from "../summary";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(
  scenario: ILAAPScenarioResult["scenario"],
  survivalHorizonDays: number,
  status: ILAAPScenarioResult["status"],
): ILAAPScenarioResult {
  return {
    scenario,
    stressedHQLAZar: 100_000_000,
    stressedNetOutflow30dZar: 10_000_000,
    survivalHorizonDays,
    stressedLCRPct: 150,
    status,
  };
}

function makeNoPositionResult(scenario: ILAAPScenarioResult["scenario"]): ILAAPScenarioResult {
  return {
    scenario,
    stressedHQLAZar: 0,
    stressedNetOutflow30dZar: 0,
    survivalHorizonDays: 0,
    stressedLCRPct: null,
    status: "no-positions",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ILAAP summary — empty results", () => {
  const summary = computeILAAPSummary([]);

  it("should return no-positions for empty array", () => {
    expect(summary.overallStatus).toBe("no-positions");
  });

  it("should return 0 worst-case survival for empty array", () => {
    expect(summary.worstCaseSurvivalDays).toBe(0);
  });
});

describe("ILAAP summary — all no-positions", () => {
  const results = [
    makeNoPositionResult("idiosyncratic"),
    makeNoPositionResult("market-wide"),
    makeNoPositionResult("combined"),
    makeNoPositionResult("reverse-stress"),
  ];
  const summary = computeILAAPSummary(results);

  it("overall status should be no-positions", () => {
    expect(summary.overallStatus).toBe("no-positions");
  });

  it("worst-case survival should be 0", () => {
    expect(summary.worstCaseSurvivalDays).toBe(0);
  });

  it("should include recommended action", () => {
    expect(summary.recommendedAction).toBe("Monitor — zero-position baseline until licence-day.");
  });
});

describe("ILAAP summary — adequate (worst > 30 days)", () => {
  const results = [
    makeResult("idiosyncratic", 60, "adequate"),
    makeResult("market-wide", 120, "adequate"),
    makeResult("combined", 45, "adequate"),
    makeResult("reverse-stress", 365, "adequate"),
  ];
  const summary = computeILAAPSummary(results);

  it("overall status should be adequate", () => {
    expect(summary.overallStatus).toBe("adequate");
  });

  it("worst-case survival should be 45 (combined)", () => {
    expect(summary.worstCaseSurvivalDays).toBe(45);
  });

  it("worst-case scenario should be combined", () => {
    expect(summary.worstCaseScenario).toBe("combined");
  });
});

describe("ILAAP summary — marginal (worst 15–30 days)", () => {
  const results = [
    makeResult("idiosyncratic", 20, "marginal"),
    makeResult("market-wide", 45, "adequate"),
    makeResult("combined", 25, "marginal"),
    makeResult("reverse-stress", 60, "adequate"),
  ];
  const summary = computeILAAPSummary(results);

  it("overall status should be marginal", () => {
    expect(summary.overallStatus).toBe("marginal");
  });

  it("worst-case survival should be 20 (idiosyncratic)", () => {
    expect(summary.worstCaseSurvivalDays).toBe(20);
  });

  it("worst-case scenario should be idiosyncratic", () => {
    expect(summary.worstCaseScenario).toBe("idiosyncratic");
  });
});

describe("ILAAP summary — inadequate (worst < 15 days)", () => {
  const results = [
    makeResult("idiosyncratic", 10, "inadequate"),
    makeResult("market-wide", 30, "marginal"),
    makeResult("combined", 5, "inadequate"),
    makeResult("reverse-stress", 20, "marginal"),
  ];
  const summary = computeILAAPSummary(results);

  it("overall status should be inadequate", () => {
    expect(summary.overallStatus).toBe("inadequate");
  });

  it("worst-case survival should be 5 (combined)", () => {
    expect(summary.worstCaseSurvivalDays).toBe(5);
  });

  it("worst-case scenario should be combined", () => {
    expect(summary.worstCaseScenario).toBe("combined");
  });
});

describe("ILAAP summary — status threshold boundaries", () => {
  it("survival = 31 days → adequate", () => {
    const results = [makeResult("idiosyncratic", 31, "adequate")];
    const summary = computeILAAPSummary(results);
    expect(summary.overallStatus).toBe("adequate");
  });

  it("survival = 30 days → marginal", () => {
    const results = [makeResult("idiosyncratic", 30, "marginal")];
    const summary = computeILAAPSummary(results);
    expect(summary.overallStatus).toBe("marginal");
  });

  it("survival = 15 days → marginal", () => {
    const results = [makeResult("idiosyncratic", 15, "marginal")];
    const summary = computeILAAPSummary(results);
    expect(summary.overallStatus).toBe("marginal");
  });

  it("survival = 14.9 days → inadequate", () => {
    const results = [makeResult("idiosyncratic", 14.9, "inadequate")];
    const summary = computeILAAPSummary(results);
    expect(summary.overallStatus).toBe("inadequate");
  });
});

describe("ILAAP summary — worst-case selection with ties", () => {
  it("when two scenarios have equal survival, first in array wins", () => {
    const results = [
      makeResult("idiosyncratic", 20, "marginal"),
      makeResult("combined", 20, "marginal"),
    ];
    const summary = computeILAAPSummary(results);
    // First encountered (idiosyncratic) should be the worst-case scenario
    expect(summary.worstCaseScenario).toBe("idiosyncratic");
    expect(summary.worstCaseSurvivalDays).toBe(20);
  });
});
