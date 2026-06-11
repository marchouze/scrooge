// platform/alm/cfp-ewi.test.ts
//
// Guardrails for the CFP EWI evaluation engine
// (WS-TREASURER-WAVE1-SUBSTRATE):
//
//   - BUILD-PHASE ZERO-POSITION POSTURE (the headline assertion): with no
//     positions, all-null measures, and empty feeds, the engine fires
//     NOTHING. No false CFP triggers in build phase.
//   - Each §5.2 trigger fires on its threshold crossing with the right
//     severity, tier, source measure, and threshold.
//   - Boundary semantics: LCR exactly 100 is critical (at or below);
//     LCR 119.9 is warning; LCR 120 is no fire; concentration exactly 15
//     fires; NSFR exactly 100 fires.
//   - Every §5.2 tier (1/2/3) is reachable through the wired trigger set.
//
// Authority: D-TREASURER-WAVE1-SUBSTRATE; LRM Policy v1 §5.2 + §4.5.
// Author: Ravi (Treasury and ALM engineer, engineering).

import { describe, expect, it } from "bun:test";

import {
  type CfpEwiInputs,
  EWI_WIRED_TRIGGER_TYPES,
  evaluateCfpEwis,
  wiredCfpTiers,
} from "./cfp-ewi";
import {
  type IntradayLiquidityMetricsResult,
  computeIntradayLiquidityMetrics,
} from "./intraday-liquidity-metrics";
import {
  type IntradayStressResult,
  type IntradayWindowResult,
  SETTLEMENT_WINDOWS,
} from "./intraday-stress";

const AS_OF = "2026-06-11T06:00:00.000Z";

function syntheticProjection(
  startingHQLAZar: number,
  flows: ReadonlyArray<readonly [number, number]>,
): IntradayStressResult {
  let cumulative = 0;
  const bau: IntradayWindowResult[] = SETTLEMENT_WINDOWS.map((windowLabel, i) => {
    const [inflowZar, outflowZar] = flows[i] ?? [0, 0];
    cumulative += inflowZar - outflowZar;
    return {
      windowLabel,
      scenario: "BAU",
      inflowZar,
      outflowZar,
      cumulativeNetZar: cumulative,
      startingHQLAZar,
      projectedHQLAZar: startingHQLAZar + cumulative,
      floorZar: 50_000_000,
      status: startingHQLAZar === 0 ? "no-positions" : "green",
      currency: "ZAR",
    };
  });
  return {
    asOf: AS_OF,
    bau,
    stress: bau.map((w) => ({ ...w, scenario: "stress" })),
    startingHQLAZar,
    floorZar: 50_000_000,
    currency: "ZAR",
  };
}

function zeroPositionMetrics(): IntradayLiquidityMetricsResult {
  return computeIntradayLiquidityMetrics(AS_OF, { projection: syntheticProjection(0, []) });
}

function baseInputs(overrides: Partial<CfpEwiInputs> = {}): CfpEwiInputs {
  return {
    lcrRatioPct: null,
    nsfrRatioPct: null,
    counterpartyConcentrationPct: null,
    intradayMetrics: zeroPositionMetrics(),
    timeSpecificObligations: [],
    externalCreditEvents: [],
    recoveryEwiTrips: [],
    ...overrides,
  };
}

describe("evaluateCfpEwis — build-phase zero-position posture", () => {
  it("fires NOTHING with no positions, null measures, and empty feeds", () => {
    expect(evaluateCfpEwis(AS_OF, baseInputs())).toEqual([]);
  });

  it("fires nothing when ratios are healthy", () => {
    const out = evaluateCfpEwis(
      AS_OF,
      baseInputs({ lcrRatioPct: 145, nsfrRatioPct: 130, counterpartyConcentrationPct: 8 }),
    );
    expect(out).toEqual([]);
  });

  it("LCR exactly at the 120% internal floor does not fire", () => {
    expect(evaluateCfpEwis(AS_OF, baseInputs({ lcrRatioPct: 120 }))).toEqual([]);
  });
});

describe("evaluateCfpEwis — LCR (§5.2 Tier 2 warning / Tier 3 critical)", () => {
  it("LCR 119.9 fires a Tier-2 warning against the 120% internal floor", () => {
    const out = evaluateCfpEwis(AS_OF, baseInputs({ lcrRatioPct: 119.9, lcrSourceEventId: "E1" }));
    expect(out).toHaveLength(1);
    const fire = out[0];
    expect(fire?.type).toBe("LcrRatioBreach");
    if (fire?.type !== "LcrRatioBreach") throw new Error("unreachable");
    expect(fire.payload.severity).toBe("warning");
    expect(fire.payload.cfpTier).toBe("tier-2");
    expect(fire.payload.threshold).toBe(120);
    expect(fire.payload.observed).toBe(119.9);
    expect(fire.payload.sourceMeasure).toBe("lcr-ratio-pct");
    expect(fire.payload.sourceEventId).toBe("E1");
  });

  it("LCR exactly 100 fires Tier-3 critical (at or below the PA minimum)", () => {
    const out = evaluateCfpEwis(AS_OF, baseInputs({ lcrRatioPct: 100 }));
    expect(out).toHaveLength(1);
    const fire = out[0];
    if (fire?.type !== "LcrRatioBreach") throw new Error("expected LcrRatioBreach");
    expect(fire.payload.severity).toBe("critical");
    expect(fire.payload.cfpTier).toBe("tier-3");
    expect(fire.payload.threshold).toBe(100);
  });
});

describe("evaluateCfpEwis — NSFR (§5.2 Tier 3 critical)", () => {
  it("NSFR exactly 100 fires Tier-3 critical", () => {
    const out = evaluateCfpEwis(AS_OF, baseInputs({ nsfrRatioPct: 100 }));
    expect(out).toHaveLength(1);
    const fire = out[0];
    if (fire?.type !== "NsfrRatioBreach") throw new Error("expected NsfrRatioBreach");
    expect(fire.payload.severity).toBe("critical");
    expect(fire.payload.cfpTier).toBe("tier-3");
  });

  it("NSFR 101 does not fire", () => {
    expect(evaluateCfpEwis(AS_OF, baseInputs({ nsfrRatioPct: 101 }))).toEqual([]);
  });
});

describe("evaluateCfpEwis — funding concentration (§5.2 Tier 2)", () => {
  it("single-counterparty at exactly 15% fires Tier 2", () => {
    const out = evaluateCfpEwis(
      AS_OF,
      baseInputs({ counterpartyConcentrationPct: 15, counterpartySubjectRef: "LEI-XYZ" }),
    );
    expect(out).toHaveLength(1);
    const fire = out[0];
    if (fire?.type !== "FundingConcentrationAlertTriggered")
      throw new Error("expected FundingConcentrationAlertTriggered");
    expect(fire.payload.cfpTier).toBe("tier-2");
    expect(fire.payload.dimension).toBe("counterparty");
    expect(fire.payload.subjectRef).toBe("LEI-XYZ");
    expect(fire.payload.threshold).toBe(15);
  });
});

describe("evaluateCfpEwis — intraday stress (§4.5 → §5.2 Tier 1)", () => {
  it("peak usage above 80% of available fires IntradayStressDetected", () => {
    // 100m available; outflows 85m in window 1 → usage 85% in all 4 windows
    // → persistent (≥ 2 stressed windows).
    const metrics = computeIntradayLiquidityMetrics(AS_OF, {
      projection: syntheticProjection(100_000_000, [[0, 85_000_000]]),
    });
    const out = evaluateCfpEwis(AS_OF, baseInputs({ intradayMetrics: metrics }));
    expect(out).toHaveLength(1);
    const fire = out[0];
    if (fire?.type !== "IntradayStressDetected") throw new Error("expected IntradayStressDetected");
    expect(fire.payload.cfpTier).toBe("tier-1");
    expect(fire.payload.severity).toBe("persistent");
    expect(fire.payload.threshold).toBe(80);
    expect(fire.payload.stressedWindows.length).toBeGreaterThanOrEqual(2);
  });

  it("transient stress (single stressed window) is classified transient", () => {
    // 100m available; 85m out in window 1, 84m back in window 2 → only
    // window 1 usage > 80%.
    const metrics = computeIntradayLiquidityMetrics(AS_OF, {
      projection: syntheticProjection(100_000_000, [
        [0, 85_000_000],
        [84_000_000, 0],
      ]),
    });
    const out = evaluateCfpEwis(AS_OF, baseInputs({ intradayMetrics: metrics }));
    const fire = out[0];
    if (fire?.type !== "IntradayStressDetected") throw new Error("expected IntradayStressDetected");
    expect(fire.payload.severity).toBe("transient");
    expect(fire.payload.stressedWindows).toEqual(["09:00"]);
  });

  it("usage at 80% or below does not fire", () => {
    const metrics = computeIntradayLiquidityMetrics(AS_OF, {
      projection: syntheticProjection(100_000_000, [[0, 80_000_000]]),
    });
    expect(evaluateCfpEwis(AS_OF, baseInputs({ intradayMetrics: metrics }))).toEqual([]);
  });
});

describe("evaluateCfpEwis — critical settlement obligations (§5.2 Tier 1)", () => {
  it("an obligation exceeding projected availability at its deadline window fires", () => {
    // 10m available all day; 25m due at 13:00 SAST (12:00 window).
    const metrics = computeIntradayLiquidityMetrics(AS_OF, {
      projection: syntheticProjection(10_000_000, []),
    });
    const out = evaluateCfpEwis(
      AS_OF,
      baseInputs({
        intradayMetrics: metrics,
        timeSpecificObligations: [
          {
            obligationRef: "BSV-SETTLE-42",
            deadline: "2026-06-11T11:00:00.000Z",
            requiredZar: 25_000_000,
          },
        ],
      }),
    );
    expect(out).toHaveLength(1);
    const fire = out[0];
    if (fire?.type !== "CriticalSettlementObligationAtRisk")
      throw new Error("expected CriticalSettlementObligationAtRisk");
    expect(fire.payload.cfpTier).toBe("tier-1");
    expect(fire.payload.obligationRef).toBe("BSV-SETTLE-42");
    expect(fire.payload.requiredZar).toBe(25_000_000);
    expect(fire.payload.projectedAvailableZar).toBe(10_000_000);
  });

  it("a covered obligation does not fire", () => {
    const metrics = computeIntradayLiquidityMetrics(AS_OF, {
      projection: syntheticProjection(100_000_000, []),
    });
    const out = evaluateCfpEwis(
      AS_OF,
      baseInputs({
        intradayMetrics: metrics,
        timeSpecificObligations: [
          {
            obligationRef: "BSV-SETTLE-43",
            deadline: "2026-06-11T11:00:00.000Z",
            requiredZar: 25_000_000,
          },
        ],
      }),
    );
    expect(out).toEqual([]);
  });
});

describe("evaluateCfpEwis — external feeds (§5.2 Tiers 2/3)", () => {
  it("material external credit events fire Tier 2; immaterial ones do not", () => {
    const out = evaluateCfpEwis(
      AS_OF,
      baseInputs({
        externalCreditEvents: [
          {
            impact: "immaterial",
            description: "Minor spread widening",
            detectionSource: "market-spread-watch",
          },
          {
            impact: "material",
            description: "Sovereign downgrade to sub-investment-grade",
            detectionSource: "rating-agency-feed",
          },
        ],
      }),
    );
    expect(out).toHaveLength(1);
    const fire = out[0];
    if (fire?.type !== "ExternalCreditEventDetected")
      throw new Error("expected ExternalCreditEventDetected");
    expect(fire.payload.cfpTier).toBe("tier-2");
    expect(fire.payload.impact).toBe("material");
  });

  it("recovery-plan EWI trips fire Tier 3", () => {
    const out = evaluateCfpEwis(
      AS_OF,
      baseInputs({
        recoveryEwiTrips: [
          {
            indicatorId: "REC-EWI-3",
            indicatorLabel: "Wholesale funding cost spike",
            observed: 250,
            thresholdDescription: "Funding spread > 200bp over 5 days",
          },
        ],
      }),
    );
    expect(out).toHaveLength(1);
    const fire = out[0];
    if (fire?.type !== "RecoveryEarlyWarningTriggered")
      throw new Error("expected RecoveryEarlyWarningTriggered");
    expect(fire.payload.cfpTier).toBe("tier-3");
    expect(fire.payload.indicatorId).toBe("REC-EWI-3");
  });
});

describe("CFP tier reachability (§5.2 — recon:cfp-trigger-coverage substrate)", () => {
  it("all seven §5.2 trigger types are wired", () => {
    const wired = new Set<string>(EWI_WIRED_TRIGGER_TYPES);
    const expected = new Set<string>([
      "CriticalSettlementObligationAtRisk",
      "ExternalCreditEventDetected",
      "FundingConcentrationAlertTriggered",
      "IntradayStressDetected",
      "LcrRatioBreach",
      "NsfrRatioBreach",
      "RecoveryEarlyWarningTriggered",
    ]);
    expect(wired).toEqual(expected);
  });

  it("every CFP tier is reachable through the wired trigger set", () => {
    const tiers = wiredCfpTiers();
    expect(tiers.has("tier-1")).toBe(true);
    expect(tiers.has("tier-2")).toBe(true);
    expect(tiers.has("tier-3")).toBe(true);
  });
});
