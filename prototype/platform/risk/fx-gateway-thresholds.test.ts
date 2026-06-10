// platform/risk/fx-gateway-thresholds.test.ts
//
// Breach + pass tests for the ratified FX pre-trade gateway capital-impact
// and funding thresholds (D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS,
// CRO-approved 2026-06-10; funding leg co-owned by Ravi, Treasury / ALM
// engineer, engineering).
//
// Author: Helena (Chief Risk Officer, governance).

import { describe, expect, it } from "bun:test";

import { getFinancialConstant } from "../config/financial-constants";
import {
  evaluateCapitalImpact,
  evaluateFundingImpact,
  fxGatewayThresholdSchedule,
} from "./fx-gateway-thresholds";

describe("fxGatewayThresholdSchedule — ratified derivation", () => {
  const schedule = fxGatewayThresholdSchedule();

  it("derives the pro-forma RWA ceiling from the cited constants", () => {
    const envelope = getFinancialConstant("capital.build-phase.total-capital-minor");
    const headroomFloor = getFinancialConstant("capital.threshold.ceo-escalation-minor");
    const ratio = getFinancialConstant("capital.gateway.operating-minimum-total-capital-ratio");
    // (R300m − R100m) / 12.0% = R1,666,666,666.66 (floored, conservative).
    expect(schedule.capitalImpact.proFormaRwaCeilingMinor).toBe(
      Math.floor((envelope - headroomFloor) / ratio),
    );
    expect(schedule.capitalImpact.proFormaRwaCeilingMinor).toBe(166_666_666_666);
  });

  it("sources the post-trade LCR floor from the RAS register red boundary (110%)", () => {
    expect(schedule.funding.postTradeLcrFloorPct).toBe(110);
    expect(schedule.funding.postTradeLcrFloorPct).toBeGreaterThanOrEqual(
      schedule.funding.regulatoryMinimumLcrPct,
    );
    expect(schedule.funding.regulatoryMinimumLcrPct).toBe(100);
  });

  it("is fail-closed posture with the decision citation", () => {
    expect(schedule.posture).toBe("fail-closed");
    expect(schedule.decisionId).toBe("D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS");
    expect(schedule.citations).toContain("D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS");
  });
});

describe("evaluateCapitalImpact — breach + pass", () => {
  const schedule = fxGatewayThresholdSchedule();

  it("PASSES a R10m FX-spot order from the ICAAP baseline", () => {
    const r = evaluateCapitalImpact({
      instrumentClass: "FX-spot",
      notionalMinor: 10_000_000_00,
      currentRwaMinor: null,
      schedule,
    });
    expect(r.outcome).toBe("approve");
  });

  it("REJECTS an order whose pro-forma RWA breaches the ceiling", () => {
    // R10bn FX-spot at weight 0.2 → R2bn proposed RWA > R1.667bn ceiling.
    const r = evaluateCapitalImpact({
      instrumentClass: "FX-spot",
      notionalMinor: 10_000_000_000_00,
      currentRwaMinor: null,
      schedule,
    });
    expect(r.outcome).toBe("reject");
    expect(r.rejectionReason).toContain("Capital RWA ceiling breached");
    expect(r.citationToRule).toBe("D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS");
  });

  it("uses the live current RWA when supplied (event-of-record preference)", () => {
    // Current RWA already at the ceiling → even a tiny order rejects.
    const r = evaluateCapitalImpact({
      instrumentClass: "FX-spot",
      notionalMinor: 1_000_00,
      currentRwaMinor: schedule.capitalImpact.proFormaRwaCeilingMinor,
      schedule,
    });
    expect(r.outcome).toBe("reject");
  });

  it("REJECTS an unknown instrument class (fail-closed, no silent default weight)", () => {
    const r = evaluateCapitalImpact({
      instrumentClass: "default",
      notionalMinor: 1_000_00,
      currentRwaMinor: null,
      schedule,
    });
    expect(r.outcome).toBe("reject");
    expect(r.rejectionReason).toContain("FAIL-CLOSED");
  });
});

describe("evaluateFundingImpact — breach + pass", () => {
  const schedule = fxGatewayThresholdSchedule();

  it("PASSES a R10m order from the build-phase LCR baseline", () => {
    // 150% − (10 × 0.5pp) = 145% ≥ 110% floor.
    const r = evaluateFundingImpact({
      notionalMinor: 10_000_000_00,
      currentLcrPct: null,
      schedule,
    });
    expect(r.outcome).toBe("approve");
  });

  it("REJECTS an order whose estimated post-trade LCR falls below the RAS floor", () => {
    // R100m → 50pp outflow: 150% − 50pp = 100% < 110% floor.
    const r = evaluateFundingImpact({
      notionalMinor: 100_000_000_00,
      currentLcrPct: null,
      schedule,
    });
    expect(r.outcome).toBe("reject");
    expect(r.rejectionReason).toContain("LCR headroom insufficient");
    expect(r.citationToRule).toBe("D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS");
  });

  it("uses the live current LCR when supplied", () => {
    // Current LCR 111%: a R4m order (2pp) lands at 109% < 110% floor.
    const r = evaluateFundingImpact({
      notionalMinor: 4_000_000_00,
      currentLcrPct: 111,
      schedule,
    });
    expect(r.outcome).toBe("reject");
  });

  it("enforces the RAS buffer, not just the 100% regulatory minimum", () => {
    // Post-trade 105% would satisfy BCBS 238 but breaches the RAS 110% floor.
    // R90m → 45pp outflow: 150% − 45pp = 105%.
    const r = evaluateFundingImpact({
      notionalMinor: 90_000_000_00,
      currentLcrPct: null,
      schedule,
    });
    expect(r.outcome).toBe("reject");
  });
});
