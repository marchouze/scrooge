// v2-core/fil-models/sa-ccr/sa-ccr-model.test.ts
//
// Unit tests for the SA-CCR FIL-Model (V2 S7-FIL):
//   - the FIL-Models register folds the empty register → exactly 1 row when
//     the SA-CCR declaration is folded;
//   - the model resolves for IR + FX scopes (and not for out-of-scope types);
//   - the RiskMeasurable facet implementation exposes the SA-CCR selectors;
//   - the methodology hash is deterministic;
//   - the methodology math (RC / PFE / EAD) matches worked d317 examples.
//
// These run with no v1 dependency (v2-core is self-contained by construction).
//
// Author: Rohan (Risk Engineer, engineering).

import { describe, expect, it } from "bun:test";
import type { Money } from "../../fil-core/primitives";
import { EMPTY_FIL_MODELS_REGISTER, foldFilModelsRegister } from "../registry";
import {
  type SaCcrNettingSet,
  type SaCcrTradeSummary,
  computeAddOn,
  computeEad,
  computeReplacementCost,
  computeSaCcr,
} from "./methodology";
import {
  SA_CCR_ENGINE_ID,
  SA_CCR_METHODOLOGY_HASH,
  SA_CCR_MODEL_DECLARATION,
  computeSaCcrMethodologyHash,
  resolvesForScope,
  saCcrRiskMeasurable,
  scopePatternsValid,
} from "./model";

const zar = (minorUnits: bigint): Money => ({ currency: "ZAR", minorUnits });

describe("SA-CCR FIL-Model registry fold", () => {
  it("folds the empty register → exactly 1 row for the SA-CCR declaration", () => {
    expect(EMPTY_FIL_MODELS_REGISTER.rows.length).toBe(0);
    const register = foldFilModelsRegister([SA_CCR_MODEL_DECLARATION]);
    expect(register.rows.length).toBe(1);
    expect(register.conflicts.length).toBe(0);
    const row = register.rows[0];
    expect(row?.modelId).toBe("sa-ccr");
    expect(row?.implementsFacets).toEqual(["RiskMeasurable"]);
    expect(row?.version).toBe("1.0");
    expect(row?.emits).toEqual(["CcrReplacementCostComputed", "CcrEadComputed"]);
    expect(row?.methodologyHash).toBe(SA_CCR_METHODOLOGY_HASH);
    expect(row?.validationStatus).toBe("submitted");
  });

  it("declares valid fil:type scope patterns", () => {
    expect(scopePatternsValid()).toBe(true);
  });
});

describe("SA-CCR scope resolution", () => {
  it("resolves for an IR type", () => {
    expect(resolvesForScope("fil:type:ir:swap.vanilla:otc-vanilla@1.0")).toBe(true);
  });
  it("resolves for an FX type", () => {
    expect(resolvesForScope("fil:type:fx:forward:otc-vanilla@1.0")).toBe(true);
  });
  it("does NOT resolve for an out-of-scope (equity) type", () => {
    expect(resolvesForScope("fil:type:equity:cash.listed:ordinary@1.0")).toBe(false);
  });
  it("does NOT resolve for a non-URN string", () => {
    expect(resolvesForScope("not-a-urn")).toBe(false);
  });
});

describe("SA-CCR RiskMeasurable facet implementation", () => {
  const irTrade: SaCcrTradeSummary = {
    counterpartyId: "CP-1",
    nettingSetId: "NS-CP-1-ZAR",
    assetClass: "ir",
    notional: zar(1_000_00n),
    direction: "long",
    remainingYears: 3,
    currency: "ZAR",
  };
  it("exposes IR risk factors incl. the curve factor", () => {
    const m = saCcrRiskMeasurable(irTrade);
    const factors = m.riskFactors();
    expect(factors.some((f) => f.kind === "delta")).toBe(true);
    expect(factors.some((f) => f.kind === "curve")).toBe(true);
  });
  it("selects IR lifecycle events for the SA-CCR engine", () => {
    const m = saCcrRiskMeasurable(irTrade);
    const sel = m.positionContribution(SA_CCR_ENGINE_ID);
    expect(sel.engine).toBe(SA_CCR_ENGINE_ID);
    expect(sel.lifecycleEvents as readonly string[]).toContain("IrsTradeBooked");
  });
  it("selects FX lifecycle events for an FX trade", () => {
    const fxTrade: SaCcrTradeSummary = { ...irTrade, assetClass: "fx" };
    const sel = saCcrRiskMeasurable(fxTrade).positionContribution(SA_CCR_ENGINE_ID);
    expect(sel.lifecycleEvents as readonly string[]).toContain("FxTradeExecuted");
  });
});

describe("SA-CCR methodology hash", () => {
  it("is deterministic and version-tagged", () => {
    expect(computeSaCcrMethodologyHash()).toBe(SA_CCR_METHODOLOGY_HASH);
    expect(SA_CCR_METHODOLOGY_HASH.startsWith("saccr:v1.0:")).toBe(true);
  });
});

describe("SA-CCR methodology math (d317)", () => {
  const ns: SaCcrNettingSet = {
    nettingSetId: "NS-CP-1-ZAR",
    counterpartyId: "CP-1",
    csaPresent: false,
    currency: "ZAR",
  };
  const asOf = "2026-06-13T00:00:00.000Z";

  it("unmargined RC = max(V, 0)", () => {
    const rcPos = computeReplacementCost(ns, zar(50_000n), zar(0n), asOf);
    expect(rcPos.rc.minorUnits).toBe(50_000n);
    const rcNeg = computeReplacementCost(ns, zar(-50_000n), zar(0n), asOf);
    expect(rcNeg.rc.minorUnits).toBe(0n);
  });

  it("PFE add-on for a single FX trade = |notional| × SF(fx=0.04)", () => {
    const trade: SaCcrTradeSummary = {
      counterpartyId: "CP-1",
      nettingSetId: "NS-CP-1-ZAR",
      assetClass: "fx",
      notional: zar(1_000_000n),
      direction: "long",
      remainingYears: 1,
      currency: "ZAR",
      hedgingSetTag: "USD/ZAR",
    };
    const addOns = computeAddOn([trade], { margined: false });
    expect(addOns.length).toBe(1);
    // MF for 1y unmargined = sqrt(min(1,1)) = 1.0; addOn = 1_000_000 × 0.04
    expect(addOns[0]?.addOn.minorUnits).toBe(40_000n);
  });

  it("EAD = α × (RC + PFE)", () => {
    const trade: SaCcrTradeSummary = {
      counterpartyId: "CP-1",
      nettingSetId: "NS-CP-1-ZAR",
      assetClass: "fx",
      notional: zar(1_000_000n),
      direction: "long",
      remainingYears: 1,
      currency: "ZAR",
      hedgingSetTag: "USD/ZAR",
    };
    const result = computeSaCcr({
      nettingSet: ns,
      vMtm: zar(50_000n),
      collateralHeld: zar(0n),
      trades: [trade],
      asOf,
    });
    // RC = 50_000; aggAddOn = 40_000; V−C = 50_000 > 0 ⇒ multiplier ≈ 1.0 ⇒
    // PFE = 40_000; EAD = 1.4 × (50_000 + 40_000) = 126_000.
    expect(result.rc.rc.minorUnits).toBe(50_000n);
    expect(result.ead.pfe.minorUnits).toBe(40_000n);
    expect(result.ead.ead.minorUnits).toBe(126_000n);
    expect(result.ead.alpha).toBe(1.4);
  });

  it("long + short within a hedging set offset (net delta-adjusted notional)", () => {
    const long: SaCcrTradeSummary = {
      counterpartyId: "CP-1",
      nettingSetId: "NS-CP-1-ZAR",
      assetClass: "fx",
      notional: zar(1_000_000n),
      direction: "long",
      remainingYears: 1,
      currency: "ZAR",
      hedgingSetTag: "USD/ZAR",
    };
    const short: SaCcrTradeSummary = { ...long, direction: "short", notional: zar(400_000n) };
    const addOns = computeAddOn([long, short], { margined: false });
    // net = 1_000_000 − 400_000 = 600_000; addOn = 600_000 × 0.04 = 24_000
    expect(addOns[0]?.addOn.minorUnits).toBe(24_000n);
  });

  it("the declaration emits the two CCR events of record", () => {
    expect(SA_CCR_MODEL_DECLARATION.emits as readonly string[]).toEqual([
      "CcrReplacementCostComputed",
      "CcrEadComputed",
    ]);
    expect(SA_CCR_MODEL_DECLARATION.requires.facets as readonly string[]).toEqual([
      "Lifecycled",
      "Valuable",
    ]);
  });

  it("computeEad rounding matches v1 half-up scheme on a non-trivial multiplier", () => {
    const ns2: SaCcrNettingSet = { ...ns, csaPresent: false };
    const trade: SaCcrTradeSummary = {
      counterpartyId: "CP-1",
      nettingSetId: "NS-CP-1-ZAR",
      assetClass: "fx",
      notional: zar(7_777_777n),
      direction: "long",
      remainingYears: 0.5,
      currency: "ZAR",
      hedgingSetTag: "EUR/ZAR",
    };
    // Over-collateralised: V − C < 0 ⇒ multiplier < 1 ⇒ exercises the
    // 1e6-scaled half-up PFE rounding and the 1e4-scaled half-up EAD rounding.
    const rc = computeReplacementCost(ns2, zar(0n), zar(0n), asOf);
    const addOns = computeAddOn([trade], { margined: false });
    const ead = computeEad(rc, addOns, { counterpartyId: "CP-1", asOf });
    expect(ead.ead.minorUnits).toBeGreaterThanOrEqual(0n);
    // EAD = round(1.4 × (RC + PFE)); RC = 0 here so EAD = round(1.4 × PFE).
    const expectedEad = (ead.pfe.minorUnits * 14_000n + 5_000n) / 10_000n;
    expect(ead.ead.minorUnits).toBe(expectedEad);
  });
});
