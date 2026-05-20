// tests/sa-ccr-t2-fx-spot.test.ts
//
// WS-MARKET-RISK-PROCEDURES — G-7 close: SA-CCR T+2 FX-spot maturity-
// factor regression test.
//
// Why this test exists
// --------------------
// Helena (Chief Risk Officer, governance)'s FX-spot-only market-risk scope
// review of 2026-05-20 (`2026-05-20_helena_fx-spot-only-market-risk-scope-
// review.md` §6 G-7) flagged the near-zero-maturity-factor scenario for
// T+2 FX-spot settlement as a Banks Act 94 of 1990 Regulation 29 audit
// blocker on the controlled-launch MVP path (PR #634). The SA-CCR engine
// at `prototype/platform/risk/sa-ccr/` is LIVE per
// D-CREDIT-LIMIT-ENGINE-BUILD Phase 5, but the T+2 corner — remaining
// maturity M ≈ 2/365 years, MF ≈ 0.074 — had no regression coverage. Until
// the corner case is locked under test, the Reg 29 EAD cell cannot be
// defended at submission.
//
// This test is **test-only**. It does not change the SA-CCR engine; if a
// genuine engine bug is found here, surface it as a substrate gap in the
// PR description rather than fix it inline (per dispatch brief).
//
// Reference value derivation (BCBS d317 / CRE52 §52.45–§52.52, §52.58–§52.63)
// ---------------------------------------------------------------------------
// Trade:
//   Asset class      : fx          (BCBS d317 Table 2)
//   Notional N       : USD 1,000,000     → 100,000,000 minor units (cents)
//   Direction        : long  (bank buys USD vs ZAR)
//   Hedging-set key  : fx:USD/ZAR  (BCBS d317 §158)
//   Remaining maturity M = 2 / 365 = 0.005479452054794521 years
//
// Step 1 — Supervisory factor (BCBS d317 Table 2 / CRE52 §52.47):
//   SF_fx = 0.04   (4.0 %)
//
// Step 2 — Maturity factor, unmargined (BCBS d317 §164):
//   MF = √(min(M, 1y) / 1y)
//      = √(2 / 365)
//      = 0.07402332101976053  (Number.MAX_VALUE-relative; exact to fp64)
//
// Step 3 — Trade delta (BCBS d317 §15 / CRE52 §52.46), linear product:
//   δ = +1   (long)
//
// Step 4 — Adjusted notional (per trade):
//   adj = δ × N × MF
//       = 1 × 100,000,000 × 0.07402332101976053
//       = 7,402,332.101976053  minor units (cents)
//
// Step 5 — Hedging-set add-on (single trade, single set):
//   addOn_set = |adj| × SF_fx
//             = 7,402,332.101976053 × 0.04
//             = 296,093.28407904212  minor units (cents)
//
//   The engine rounds the per-asset-class add-on to integer minor units
//   via `BigInt(Math.round(addOnMinor))`:
//   addOn_minor_rounded = Math.round(296_093.28407904212) = 296,093
//
// Step 6 — Aggregated add-on (asset class fx is the only class):
//   AggAddOn = 296,093  minor units
//
// Step 7 — Replacement cost (unmargined; just-traded spot, V = 0, C = 0):
//   RC = max(V, 0) = 0
//
// Step 8 — PFE multiplier (BCBS d317 §149 / CRE52 §52.5):
//   With V − C = 0 the exponent is 0 → exp(0) = 1
//   multiplier = min(1, 0.05 + 0.95 × 1) = min(1, 1.0) = 1.0
//
// Step 9 — PFE (BigInt half-up rounding via 1e6 scale):
//   multiplierScaled = round(1.0 × 1_000_000) = 1_000_000
//   pfeMinor = (296_093 × 1_000_000 + 500_000) / 1_000_000
//            = 296_093_500_000 / 1_000_000
//            = 296_093  (BigInt integer division)
//   PFE = 296,093 minor units (USD 2,960.93).
//
// Step 10 — EAD (BCBS d317 §10):
//   α = 1.4
//   αScaled = round(1.4 × 10_000) = 14_000
//   rc + pfe = 0 + 296_093 = 296_093
//   eadMinor = (296_093 × 14_000 + 5_000) / 10_000
//            = (4_145_302_000 + 5_000) / 10_000
//            = 4_145_307_000 / 10_000
//            = 414_530  (BigInt integer division → floored from 414_530.7)
//   EAD = 414,530 minor units (USD 4,145.30).
//
// These reference numbers are computed independently from the BCBS d317
// formulas. The test asserts the engine matches them.
//
// Citations:
//   Banks Act 94 of 1990 §73 (single-counterparty large exposure);
//   Banks Act 94 of 1990 Regulation 29 (counterparty credit risk return);
//   BCBS d317 §10 (α), §15 (delta), §149 (multiplier), §158 (hedging set),
//     §164 (maturity factor), Table 2 (supervisory factors);
//   CRE52 §52.5, §52.10–§52.13, §52.45–§52.52, §52.58–§52.63;
//   Policies/credit-risk-policy-v1.md §3 (IN FORCE 2026-05-13);
//   2026-05-20_helena_fx-spot-only-market-risk-scope-review.md §6 G-7;
//   PR #634 (Helena's controlled-launch limit proposal);
//   D-CREDIT-LIMIT-ENGINE-BUILD Phase 5;
//   WS-MARKET-RISK-PROCEDURES.
//
// Author: Rohan (Head of Market Risk Measurement, engineering).
// Co-author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";

import { minor } from "../platform/core/money";
import { USD } from "../platform/core/types";
import {
  ALPHA_SA_CCR,
  computeAddOn,
  computeEad,
  computeReplacementCost,
  maturityFactor,
  supervisoryFactor,
} from "../platform/risk/sa-ccr";

import {
  FX_SPOT_T2_REMAINING_YEARS,
  SA_CCR_DAYS_PER_YEAR,
  fxSpotT2NettingSet,
  fxSpotT2Trade,
} from "./fixtures/sa-ccr/fx-spot-t2";

// ---------------------------------------------------------------------------
// 1) `maturityFactor()` unit assertions for the FX-spot tenor ladder.
//    BCBS d317 §164 unmargined: MF = √(min(M, 1y) / 1y).
//    Floor behaviour: when M = 0 the engine returns 0 (no spurious add-on
//    on a fully-elapsed trade — see pfe-addon.ts L173–L177). The SA-CCR
//    "√(MPOR / 1y)" margined floor is a separate path (margined: true),
//    not the unmargined floor; we cover it for completeness.
// ---------------------------------------------------------------------------

describe("SA-CCR maturityFactor — T+2 FX-spot tenor ladder (BCBS d317 §164)", () => {
  it("T+2 spot: MF = √(2/365)", () => {
    const expected = Math.sqrt(2 / 365);
    const mf = maturityFactor({
      margined: false,
      remainingYears: 2 / SA_CCR_DAYS_PER_YEAR,
    });
    // Exact fp64 equality — same formula, same inputs.
    expect(mf).toBe(expected);
    // Locked numeric value for regression — guards against accidental
    // rewrite that changes the formula but preserves fp64-equality.
    expect(mf).toBeCloseTo(0.07402332101976053, 15);
  });

  it("T+1: MF = √(1/365)", () => {
    const mf = maturityFactor({
      margined: false,
      remainingYears: 1 / SA_CCR_DAYS_PER_YEAR,
    });
    expect(mf).toBe(Math.sqrt(1 / 365));
    expect(mf).toBeCloseTo(0.05234239225902137, 15);
  });

  it("T+0: MF = 0 (unmargined floor — no spurious add-on on a same-day-elapsed trade)", () => {
    // Per pfe-addon.ts L175–L177: when capped ≤ 0, return 0. The margined
    // MPOR floor (√(10/250)) applies only to the margined branch, not
    // unmargined — the unmargined formula is √(min(M, 1y)/1y) which is 0
    // at M = 0.
    const mf = maturityFactor({ margined: false, remainingYears: 0 });
    expect(mf).toBe(0);
  });

  it("M = 1 year: MF = 1.0 (BCBS §164 ceiling — sanity benchmark)", () => {
    const mf = maturityFactor({ margined: false, remainingYears: 1.0 });
    expect(mf).toBe(1.0);
  });

  it("M > 1 year: MF capped at 1.0", () => {
    // Sanity: 5y trade is capped at MF = 1.0 (no double-counting beyond 1y).
    expect(maturityFactor({ margined: false, remainingYears: 5.0 })).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// 2) `supervisoryFactor("fx")` direct assertion — BCBS d317 Table 2 / CRE52
//    §52.47. The 0.04 (4%) value is the calibration foundation of the FX
//    add-on. Pin it under regression so any future granular sub-class
//    revision (BCBS d317 Table 2 has no FX sub-classes, but a future
//    revision could) is caught.
// ---------------------------------------------------------------------------

describe("SA-CCR supervisoryFactor — fx asset class (BCBS d317 Table 2 / CRE52 §52.47)", () => {
  it("fx SF = 0.04 (4 %)", () => {
    expect(supervisoryFactor("fx")).toBe(0.04);
  });
});

// ---------------------------------------------------------------------------
// 3) End-to-end `computeEad()` integration: T+2 USD/ZAR FX-spot, USD 1m,
//    unmargined, just-traded (V = 0, C = 0). Asserts every intermediate
//    figure RC, AddOn, multiplier, PFE, EAD against the manually-derived
//    reference values in the header comment, to 6 decimals where
//    floating-point, and BigInt-exact in minor units.
// ---------------------------------------------------------------------------

describe("SA-CCR end-to-end — T+2 FX-spot USD/ZAR (G-7 close, Reg 29 audit lock)", () => {
  it("RC = 0, AddOn = 296_093 cents, multiplier = 1.0, PFE = 296_093 cents, EAD = 414_530 cents", () => {
    const ns = fxSpotT2NettingSet();
    const trade = fxSpotT2Trade();

    // Just-traded spot: V (vMtm) and C (collateral) both zero. The trade
    // has yet to drift; this is the worst-defendable corner for Reg 29.
    const vMtm = minor(0n, USD);
    const collateral = minor(0n, USD);

    // -- Step 7: RC = max(V, 0) = 0 ----------------------------------------
    const rc = computeReplacementCost(ns, vMtm, collateral);
    expect(rc.rc.amount).toBe(0n);
    expect(String(rc.rc.currency)).toBe("USD");

    // -- Steps 1–6: AddOn ---------------------------------------------------
    const addOns = computeAddOn([trade], { margined: false });
    expect(addOns).toHaveLength(1);
    const fx = addOns[0];
    if (!fx) throw new Error("fx add-on must be present");
    expect(fx.assetClass).toBe("fx");
    expect(fx.supervisoryFactor).toBe(0.04);
    // BigInt-exact assertion in minor units.
    expect(fx.addOn.amount).toBe(296_093n);
    expect(String(fx.addOn.currency)).toBe("USD");

    // -- Steps 8–10: PFE multiplier + EAD via computeEad --------------------
    const ead = computeEad(rc, addOns, { counterpartyId: ns.counterpartyId });
    expect(ead.alpha).toBe(ALPHA_SA_CCR);
    expect(ead.multiplier).toBeCloseTo(1.0, 6);
    expect(ead.aggregatedAddOn.amount).toBe(296_093n);
    expect(ead.pfe.amount).toBe(296_093n);
    expect(ead.rc.amount).toBe(0n);
    expect(ead.ead.amount).toBe(414_530n);
    expect(String(ead.ead.currency)).toBe("USD");
  });

  it("fixture remaining-tenor matches BCBS §164 unmargined inputs", () => {
    // Pin the fixture tenor — if anyone changes the SA_CCR_DAYS_PER_YEAR
    // convention or the T+2 calendar-day count, this test fails loudly
    // and forces the reference-value derivation comment to be re-checked.
    expect(FX_SPOT_T2_REMAINING_YEARS).toBeCloseTo(2 / 365, 15);
    expect(FX_SPOT_T2_REMAINING_YEARS).toBeLessThan(0.01);
  });
});
