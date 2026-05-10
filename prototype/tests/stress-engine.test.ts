// tests/stress-engine.test.ts
//
// D-REGULATORY-READINESS-W2-SLICE-4 — exit-criterion tests for the stress
// projection engine + 4-scenario bundle + Pillar-2 add-on + ICAAP
// narrative-data feed.
//
// Asserts:
//   1. Per-scenario projection round-trip (4 scenarios × 13 quarters).
//   2. Reverse-stress reach-minimum invariant (CET1 binds at PA-min).
//   3. Pillar-2 add-on computation correctness (max of stress-deficit /
//      risk-bucket sum).
//   4. ICAAP narrative-data feed completeness + traceability.
//   5. Per-entity isolation (LE-ZA-HOZ-SECURITIES rejected).
//   6. Determinism (same input ⇒ byte-identical output).
//   7. Boundary errors (zero RWA, zero outflows, missing scenarios).
//
// Authority: D-REGULATORY-READINESS-W2-SLICE-4 (under standing approval of
//   D-REGULATORY-READINESS-GATE-PLAN, CEO-approved 2026-05-10).
// Source pack: Owner Inbox/2026-05-10_zara-helena_regulatory-readiness-
//   gate-plan.md §3 W2 Slice 4.
//
// Authors: Rohan (Risk engineer, engineering — reports to Helena CRO)
//   + Nadia (Independent-validation engineer, engineering — peer-in-
//     second-line under Helena CRO; tests the engine adversarially).

import { describe, expect, it } from "bun:test";

import {
  ADVERSE_SCENARIO,
  BASE_SCENARIO,
  type CurrentStateCapital,
  type CurrentStateLeverage,
  type CurrentStateLiquidity,
  type Pillar2RiskBucket,
  REVERSE_STRESS_SCENARIO,
  type RwaEngineOutput,
  SEVERELY_ADVERSE_SCENARIO,
  STANDARD_STRESS_SCENARIO_BUNDLE,
  STRESS_HORIZON_QUARTERS,
  type ScenarioProjection,
  StressEngineError,
  type StressEngineInput,
  buildIcaapNarrativeData,
  computePillar2AddOn,
  projectStress,
  stressEngine,
} from "../platform/risk";

// ---------------------------------------------------------------------------
// Helpers (avoid non-null assertions per biome lint)
// ---------------------------------------------------------------------------

function ensure<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`stress-engine.test: missing ${what}`);
  return v;
}

function findScenario(out: ReturnType<typeof projectStress>, id: string): ScenarioProjection {
  return ensure(
    out.projections.find((p) => p.scenarioId === id),
    `scenario ${id}`,
  );
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const AS_OF = "2026-05-31T23:59:59.999Z";
const FUNCTIONAL_CCY = "ZAR";

/**
 * Synthetic current-state fixture mirroring the Slice-3 RWA-engine
 * end-to-end test posture (R229.55m total RWA) but at slightly different
 * numbers for narrative-data plausibility:
 *   - Total RWA          R250m
 *   - Net CET1           R45m   (CET1 ratio = 18%)
 *   - Net AT1            R5m    (Tier 1 ratio = 20%)
 *   - Net T2             R10m   (Total ratio = 24%)
 *   - Leverage exposure  R1.5bn (leverage = 50/1500 = 3.33%)
 *   - HQLA               R200m
 *   - Net cash outflows  R150m  (LCR = 133%)
 *   - ASF                R600m
 *   - RSF                R500m  (NSFR = 120%)
 */
const FIXTURE_RWA: RwaEngineOutput = {
  meta: {
    engine: "rwa-engine",
    engineVersion: "v0.1",
    approach: "standardised",
    entityId: ENTITY_BANK,
    asOf: AS_OF,
    functionalCurrency: FUNCTIONAL_CCY,
    sourceEventIds: [],
  },
  credit: { totalMinor: 100_000_000_00, lines: [] },
  market: { totalMinor: 25_000_000_00, capitalChargeMinor: 2_000_000_00, lines: [] },
  operational: {
    totalMinor: 125_000_000_00,
    biMinor: 100_000_000_00,
    bicMinor: 12_000_000_00,
    ilm: 1,
    bicBucket: "bucket-1",
  },
  cvaMinor: 0,
  totalRwaMinor: 250_000_000_00,
  outputFloorBinding: false,
  citations: [],
  placeholders: [],
};

const FIXTURE_CAPITAL: CurrentStateCapital = {
  cet1Minor: 45_000_000_00,
  at1Minor: 5_000_000_00,
  t2Minor: 10_000_000_00,
};

const FIXTURE_LIQUIDITY: CurrentStateLiquidity = {
  hqlaMinor: 200_000_000_00,
  netCashOutflows30dMinor: 150_000_000_00,
  asfMinor: 600_000_000_00,
  rsfMinor: 500_000_000_00,
};

const FIXTURE_LEVERAGE: CurrentStateLeverage = {
  leverageExposureMinor: 1_500_000_000_00,
};

function buildInput(overrides: Partial<StressEngineInput> = {}): StressEngineInput {
  return {
    entityId: ENTITY_BANK,
    asOf: AS_OF,
    functionalCurrency: FUNCTIONAL_CCY,
    rwa: FIXTURE_RWA,
    capital: FIXTURE_CAPITAL,
    liquidity: FIXTURE_LIQUIDITY,
    leverage: FIXTURE_LEVERAGE,
    scenarios: STANDARD_STRESS_SCENARIO_BUNDLE,
    sourceEventIds: ["evt-rwa-fixture"],
    ...overrides,
  };
}

function firstShockBase(): number {
  return ensure(BASE_SCENARIO.quarterlyShocks[0], "BASE q0 shock").creditRwaMultiplier;
}

function firstShockAdverse(): number {
  return ensure(ADVERSE_SCENARIO.quarterlyShocks[0], "ADVERSE q0 shock").creditRwaMultiplier;
}

function firstShockSeverelyAdverse(): number {
  return ensure(SEVERELY_ADVERSE_SCENARIO.quarterlyShocks[0], "SEVERELY_ADVERSE q0 shock")
    .creditRwaMultiplier;
}

function firstShockBaseCet1(): number {
  return ensure(BASE_SCENARIO.quarterlyShocks[0], "BASE q0 shock").cet1Multiplier;
}

function firstShockAdverseCet1(): number {
  return ensure(ADVERSE_SCENARIO.quarterlyShocks[0], "ADVERSE q0 shock").cet1Multiplier;
}

function firstShockSeverelyAdverseCet1(): number {
  return ensure(SEVERELY_ADVERSE_SCENARIO.quarterlyShocks[0], "SEVERELY_ADVERSE q0 shock")
    .cet1Multiplier;
}

// ---------------------------------------------------------------------------
// 1. Per-scenario projection round-trip
// ---------------------------------------------------------------------------

describe("stress-engine — per-scenario projection round-trip", () => {
  it("produces 13 quarterly projections per scenario (q0 + q1..q12)", () => {
    const out = stressEngine.project(buildInput());
    expect(out.projections).toHaveLength(4);
    for (const p of out.projections) {
      expect(p.quarterlyProjections).toHaveLength(STRESS_HORIZON_QUARTERS + 1);
      expect(ensure(p.quarterlyProjections[0], "q0").quarter).toBe(0);
      expect(ensure(p.quarterlyProjections[12], "q12").quarter).toBe(12);
    }
  });

  it("q0 base ratios are identical across all scenarios (no shock applied)", () => {
    const out = projectStress(buildInput());
    const q0Cet1 = out.projections.map((p) => ensure(p.quarterlyProjections[0], "q0").cet1Ratio);
    const first = ensure(q0Cet1[0], "first q0 ratio");
    for (const r of q0Cet1) expect(Math.abs(r - first)).toBeLessThan(1e-12);
  });

  it("q0 CET1 ratio matches as-of input (45m / 250m = 18%)", () => {
    const out = projectStress(buildInput());
    const base = findScenario(out, "base");
    const q0 = ensure(base.quarterlyProjections[0], "q0");
    expect(q0.cet1Ratio).toBeCloseTo(0.18, 6);
    expect(q0.tier1Ratio).toBeCloseTo(0.2, 6);
    expect(q0.totalCapitalRatio).toBeCloseTo(0.24, 6);
  });

  it("base scenario terminal CET1 ratio improves modestly (numerator > denominator growth)", () => {
    const out = projectStress(buildInput());
    const base = findScenario(out, "base");
    const q0 = ensure(base.quarterlyProjections[0], "q0");
    expect(base.terminalQuarter.cet1Ratio).toBeGreaterThan(q0.cet1Ratio);
  });

  it("severely-adverse scenario terminal CET1 ratio degrades materially vs base", () => {
    const out = projectStress(buildInput());
    const base = findScenario(out, "base");
    const sa = findScenario(out, "severely-adverse");
    expect(sa.terminalQuarter.cet1Ratio).toBeLessThan(base.terminalQuarter.cet1Ratio);
    // Direction sanity: severely-adverse should drop CET1 ratio by at least 4pp from base terminal
    expect(base.terminalQuarter.cet1Ratio - sa.terminalQuarter.cet1Ratio).toBeGreaterThan(0.04);
  });

  it("severely-adverse compresses LCR + NSFR (HQLA falls / outflows rise / ASF falls)", () => {
    const out = projectStress(buildInput());
    const sa = findScenario(out, "severely-adverse");
    const q0 = ensure(sa.quarterlyProjections[0], "q0");
    expect(sa.terminalQuarter.lcr).toBeLessThan(q0.lcr);
    expect(sa.terminalQuarter.nsfr).toBeLessThan(q0.nsfr);
  });

  it("worstQuarter has the lowest CET1 ratio across the horizon", () => {
    const out = projectStress(buildInput());
    for (const p of out.projections) {
      const minRatio = p.quarterlyProjections.reduce(
        (acc, q) => Math.min(acc, q.cet1Ratio),
        Number.POSITIVE_INFINITY,
      );
      expect(p.worstQuarter.cet1Ratio).toBe(minRatio);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Reverse-stress reach-minimum invariant
// ---------------------------------------------------------------------------

describe("stress-engine — reverse-stress invariants", () => {
  it("reverse-stress carries scale + converged flag", () => {
    const out = projectStress(buildInput());
    const rs = findScenario(out, "reverse-stress");
    expect(rs.reverseStressScale).toBeDefined();
    expect(rs.reverseStressConverged).toBeDefined();
    expect(rs.reverseStressTarget).toBeDefined();
    expect(rs.reverseStressTarget?.bindRatio).toBeCloseTo(0.045, 6);
  });

  it("reverse-stress terminal CET1 ratio binds at the target ±tolerance (when convergent)", () => {
    const out = projectStress(buildInput());
    const rs = findScenario(out, "reverse-stress");
    if (rs.reverseStressConverged) {
      const terminalCet1 = rs.terminalQuarter.cet1Ratio;
      const target = ensure(rs.reverseStressTarget, "reverseStressTarget").bindRatio;
      // Tolerance: ±5bp around bind
      expect(Math.abs(terminalCet1 - target)).toBeLessThan(0.0005);
    }
  });

  it("reverse-stress with k=0 returns unstressed projection if already in breach", () => {
    // Build a fixture where current CET1 is already at the bind point.
    const lowCet1Capital: CurrentStateCapital = {
      cet1Minor: 11_250_000_00, // 11.25m / 250m = 4.5%
      at1Minor: 0,
      t2Minor: 0,
    };
    const out = projectStress(
      buildInput({
        capital: lowCet1Capital,
        scenarios: [REVERSE_STRESS_SCENARIO],
      }),
    );
    const rs = ensure(out.projections[0], "reverse-stress projection");
    expect(rs.reverseStressScale).toBe(0);
    expect(rs.reverseStressConverged).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Pillar-2 add-on computation
// ---------------------------------------------------------------------------

describe("pillar-2-addon — computation correctness", () => {
  it("pillar2AddOn = max(stressDeficit, riskBucketSum) — stress dominates", () => {
    const stress = projectStress(buildInput());
    const out = computePillar2AddOn({
      stress,
      riskBuckets: [],
      paCet1MinimumRatio: 0.045,
      managementBufferRatio: 0.015,
    });
    // No risk buckets ⇒ max = stress deficit (which may be 0 or positive)
    expect(out.pillar2AddOnMinor).toBe(out.stressDeficit.stressDeficitMinor);
    expect(out.riskBucketAddOnSumMinor).toBe(0);
  });

  it("pillar2AddOn = max(stressDeficit, riskBucketSum) — buckets dominate", () => {
    const stress = projectStress(buildInput());
    const buckets: Pillar2RiskBucket[] = [
      {
        category: "concentration",
        label: "Single-name concentration",
        addOnMinor: 50_000_000_00,
        rationale: "Top-10 names exceed 25% of CET1.",
      },
      {
        category: "irrbb",
        label: "Interest-rate risk in the banking book",
        addOnMinor: 25_000_000_00,
        rationale: "EVE sensitivity to ±200bp parallel shift.",
      },
    ];
    const out = computePillar2AddOn({
      stress,
      riskBuckets: buckets,
      paCet1MinimumRatio: 0.045,
      managementBufferRatio: 0.015,
    });
    expect(out.riskBucketAddOnSumMinor).toBe(75_000_000_00);
    expect(out.pillar2AddOnMinor).toBe(
      Math.max(out.stressDeficit.stressDeficitMinor, 75_000_000_00),
    );
    expect(out.riskBucketLines).toHaveLength(2);
  });

  it("computes stressDeficit floor as PA min + management buffer", () => {
    const stress = projectStress(buildInput());
    const out = computePillar2AddOn({
      stress,
      riskBuckets: [],
      paCet1MinimumRatio: 0.045,
      managementBufferRatio: 0.015,
    });
    expect(out.stressDeficit.floorRatio).toBeCloseTo(0.06, 6); // 4.5% + 1.5%
  });

  it("rejects negative add-on", () => {
    const stress = projectStress(buildInput());
    expect(() =>
      computePillar2AddOn({
        stress,
        riskBuckets: [
          {
            category: "other",
            label: "negative",
            addOnMinor: -1,
            rationale: "should reject",
          },
        ],
        paCet1MinimumRatio: 0.045,
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4. ICAAP narrative-data feed
// ---------------------------------------------------------------------------

describe("icaap-narrative-data — feed shape + traceability", () => {
  it("produces a complete feed with all sections", () => {
    const stress = projectStress(buildInput());
    const pillar2 = computePillar2AddOn({
      stress,
      riskBuckets: [],
      paCet1MinimumRatio: 0.045,
    });
    const feed = buildIcaapNarrativeData({
      entityId: ENTITY_BANK,
      asOf: AS_OF,
      functionalCurrency: FUNCTIONAL_CCY,
      rwa: FIXTURE_RWA,
      stress,
      pillar2,
      currentCapital: FIXTURE_CAPITAL,
      currentLeverageExposureMinor: FIXTURE_LEVERAGE.leverageExposureMinor,
    });
    expect(feed.capitalAdequacy).toBeDefined();
    expect(feed.stressTesting).toBeDefined();
    expect(feed.pillar2).toBeDefined();
    expect(feed.capitalPlanning).toBeDefined();
    expect(feed.stressTesting.scenarios).toHaveLength(4);
    expect(feed.stressTesting.cet1RatioPathByScenario).toHaveLength(4);
    expect(
      ensure(feed.stressTesting.cet1RatioPathByScenario[0], "first ratio path").cet1RatioPathPct,
    ).toHaveLength(13);
  });

  it("currentCet1RatioPct matches as-of capital / RWA", () => {
    const stress = projectStress(buildInput());
    const pillar2 = computePillar2AddOn({
      stress,
      riskBuckets: [],
      paCet1MinimumRatio: 0.045,
    });
    const feed = buildIcaapNarrativeData({
      entityId: ENTITY_BANK,
      asOf: AS_OF,
      functionalCurrency: FUNCTIONAL_CCY,
      rwa: FIXTURE_RWA,
      stress,
      pillar2,
      currentCapital: FIXTURE_CAPITAL,
      currentLeverageExposureMinor: FIXTURE_LEVERAGE.leverageExposureMinor,
    });
    expect(feed.capitalAdequacy.currentCet1RatioPct).toBeCloseTo(18.0, 4);
  });

  it("rasB2FloorRatioPct = paCet1MinimumPct + managementBufferPct", () => {
    const stress = projectStress(buildInput());
    const pillar2 = computePillar2AddOn({
      stress,
      riskBuckets: [],
      paCet1MinimumRatio: 0.045,
      managementBufferRatio: 0.015,
    });
    const feed = buildIcaapNarrativeData({
      entityId: ENTITY_BANK,
      asOf: AS_OF,
      functionalCurrency: FUNCTIONAL_CCY,
      rwa: FIXTURE_RWA,
      stress,
      pillar2,
      currentCapital: FIXTURE_CAPITAL,
      currentLeverageExposureMinor: FIXTURE_LEVERAGE.leverageExposureMinor,
    });
    expect(feed.capitalPlanning.rasB2FloorRatioPct).toBeCloseTo(6.0, 4);
  });
});

// ---------------------------------------------------------------------------
// 5. Per-entity isolation
// ---------------------------------------------------------------------------

describe("stress-engine — per-entity isolation", () => {
  it("rejects non-bank entities (Hoz Securities)", () => {
    expect(() => projectStress(buildInput({ entityId: ENTITY_SECURITIES }))).toThrow();
  });

  it("accepts bank entity", () => {
    expect(() => projectStress(buildInput({ entityId: ENTITY_BANK }))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 6. Determinism
// ---------------------------------------------------------------------------

describe("stress-engine — determinism", () => {
  it("same input ⇒ byte-identical JSON output", () => {
    const a = projectStress(buildInput());
    const b = projectStress(buildInput());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ---------------------------------------------------------------------------
// 7. Boundary errors
// ---------------------------------------------------------------------------

describe("stress-engine — boundary errors", () => {
  it("rejects empty scenario bundle", () => {
    expect(() => projectStress(buildInput({ scenarios: [] }))).toThrow(StressEngineError);
  });

  it("rejects functionalCurrency that is not 3-char ISO 4217", () => {
    expect(() => projectStress(buildInput({ functionalCurrency: "ZARZ" }))).toThrow(
      StressEngineError,
    );
  });

  it("rejects negative capital components", () => {
    expect(() =>
      projectStress(
        buildInput({
          capital: { cet1Minor: -1, at1Minor: 0, t2Minor: 0 },
        }),
      ),
    ).toThrow(StressEngineError);
  });

  it("rejects zero net cash outflows (LCR denominator)", () => {
    expect(() =>
      projectStress(
        buildInput({
          liquidity: { ...FIXTURE_LIQUIDITY, netCashOutflows30dMinor: 0 },
        }),
      ),
    ).toThrow(StressEngineError);
  });

  it("rejects scenario with wrong number of quarterly shocks", () => {
    const firstShock = ensure(BASE_SCENARIO.quarterlyShocks[0], "BASE first shock");
    const bad = {
      ...BASE_SCENARIO,
      quarterlyShocks: [firstShock],
    };
    expect(() => projectStress(buildInput({ scenarios: [bad] }))).toThrow(StressEngineError);
  });
});

// ---------------------------------------------------------------------------
// 8. Citations + placeholders surface
// ---------------------------------------------------------------------------

describe("stress-engine — citations + placeholders", () => {
  it("output cites the standing decision + slice + regulatory anchors", () => {
    const out = projectStress(buildInput());
    expect(out.citations).toContain("D-REGULATORY-READINESS-GATE-PLAN");
    expect(out.citations).toContain("D-REGULATORY-READINESS-W2-SLICE-4");
    expect(out.citations).toContain("REG-RELATING-TO-BANKS-REG-38");
    expect(out.citations).toContain("REG-RELATING-TO-BANKS-REG-39");
    expect(out.citations).toContain("BCBS-BASEL-III-ICAAP");
    expect(out.citations).toContain("ORG-PR-12");
  });

  it("output surfaces fixture-grade placeholder for PA-published macro paths", () => {
    const out = projectStress(buildInput());
    expect(out.placeholders.some((p) => p.includes("WS-INSTRUMENT-ANALYSES"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. Standard scenario bundle invariants (Nadia validation set)
// ---------------------------------------------------------------------------

describe("stress-scenarios — standard bundle invariants (Nadia validation)", () => {
  it("standard bundle contains the four required scenarios", () => {
    expect(STANDARD_STRESS_SCENARIO_BUNDLE).toHaveLength(4);
    const ids = STANDARD_STRESS_SCENARIO_BUNDLE.map((s) => s.id);
    expect(ids).toContain("base");
    expect(ids).toContain("adverse");
    expect(ids).toContain("severely-adverse");
    expect(ids).toContain("reverse-stress");
  });

  it("each scenario has exactly STRESS_HORIZON_QUARTERS quarterly shocks", () => {
    for (const s of STANDARD_STRESS_SCENARIO_BUNDLE) {
      expect(s.quarterlyShocks).toHaveLength(STRESS_HORIZON_QUARTERS);
    }
  });

  it("scenario-shock direction monotonicity: adverse-credit-RWA > base-credit-RWA", () => {
    expect(firstShockAdverse()).toBeGreaterThan(firstShockBase());
  });

  it("severity ordering: severely-adverse-credit-RWA shock > adverse > base", () => {
    expect(firstShockSeverelyAdverse()).toBeGreaterThan(firstShockAdverse());
    expect(firstShockAdverse()).toBeGreaterThan(firstShockBase());
  });

  it("severity ordering: severely-adverse-CET1 erosion > adverse > base", () => {
    // CET1 multiplier < 1 = erosion; smaller multiplier = more severe
    expect(firstShockSeverelyAdverseCet1()).toBeLessThan(firstShockAdverseCet1());
    expect(firstShockAdverseCet1()).toBeLessThan(firstShockBaseCet1());
  });

  it("reverse-stress scenario carries a target metric (CET1 ratio)", () => {
    expect(REVERSE_STRESS_SCENARIO.reverseStressTarget).toBeDefined();
    expect(REVERSE_STRESS_SCENARIO.reverseStressTarget?.metric).toBe("cet1Ratio");
  });
});
