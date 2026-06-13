// v2-core/fil-models/fx-valuation/nadia-validation-challenger.test.ts
//
// INDEPENDENT model-validation challenger for the FX `Valuable` + FCY-cash
// FIL-Models (V2 A2) — authored by Nadia (Independent model-validation engineer,
// second line) as a DISTINCT plane from implementation (Atlas / Bea). This file
// does NOT modify the model under review; it is the validator's OWN re-
// implementation + adversarial probes. Mirrors the SA-CCR cutover validation
// (file-nadia-v2-saccr-model-validation.ts) at the model level.
//
// What it proves, independently of the model's own arithmetic:
//   (1) PARALLEL RUN — a from-scratch reference value (computed with a different
//       arithmetic path: float-then-round vs the model's bigint kernel) matches
//       the model's `Valuable.value` over a sweep, to the cent.
//   (2) SENSITIVITY — value is linear in rate and in notional (∂value/∂rate and
//       ∂value/∂notional behave as a single-multiply mark-to-market should).
//   (3) BOUNDARY / EDGE — zero notional, sign symmetry, rounding half-away-from-
//       zero at the .5 boundary, reporting-currency leg (rate 1), missing-mark
//       hard error.
//   (4) JPY NON-2dp PROBE (named A2 deferred gap a) — quantifies the model's
//       treatment of a 0-dp ISO currency carried as 2dp minor units, and proves
//       the settlement-continuity invariant holds for JPY DESPITE the deferral
//       (the dp convention cancels identically on both sides of the boundary).
//   (5) FORWARD-POINTS — additive all-in rate, and the missing-points default-to-
//       zero fallback behaviour.
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD; D-MODEL-BINDING-CONTRACT-V1;
//   brief:nadia:independent-validation-fx-valuable-fil-model-a4-:2026-06-13.
// Author: Nadia (Independent model-validation engineer, second line).

import { describe, expect, test } from "bun:test";

import type { Instant, MarketDataSlice } from "../../../v2-core";
import { fcyCashFromSettledReceivable, fcyCashValuable, fxValuable } from "../../../v2-core";

const ASOF = "2026-06-13T00:00:00.000Z" as Instant;

function marks(observables: Record<string, number>): MarketDataSlice {
  return { asOf: ASOF, observables };
}

// ---------------------------------------------------------------------------
// The CHALLENGER reference kernel — re-implemented from the documented
// methodology (value = signedNotionalMinor × allInRate, half-away-from-zero to a
// whole minor unit, 2dp-cancels translation) WITHOUT importing the model's own
// `scaleMinorByRate`. A deliberately different code path: it composes the
// rounding from `Math` primitives spelled out longhand, so a silent change to
// the model's rounding boundary would diverge here.
// ---------------------------------------------------------------------------

function challengerScale(signedMinor: bigint, rate: number): bigint {
  const product = Number(signedMinor) * rate;
  // Half-away-from-zero, spelled out independently of the model's branch.
  const mag = Math.abs(product);
  const roundedMag = Math.trunc(mag + 0.5);
  const signed = product < 0 ? -roundedMag : roundedMag;
  return BigInt(signed);
}

function challengerValueMinor(args: {
  currency: string;
  signedNotionalMinor: bigint;
  spot: number;
  fwdPoints?: number;
  reporting?: string;
}): bigint {
  const reporting = args.reporting ?? "ZAR";
  if (args.currency === reporting) return args.signedNotionalMinor;
  const allIn = args.spot + (args.fwdPoints ?? 0);
  return challengerScale(args.signedNotionalMinor, allIn);
}

// ---------------------------------------------------------------------------
// (1) PARALLEL RUN — challenger vs model over a sweep.
// ---------------------------------------------------------------------------

describe("Nadia challenger — parallel run vs model", () => {
  const sweep: Array<{ ccy: string; notional: bigint; spot: number; fwd?: number }> = [
    { ccy: "USD", notional: 100_000n, spot: 18.5 },
    { ccy: "USD", notional: -100_000n, spot: 19.1 },
    { ccy: "EUR", notional: 50_000n, spot: 20.0 },
    { ccy: "GBP", notional: -30_000n, spot: 23.4 },
    { ccy: "USD", notional: 100_000n, spot: 18.5, fwd: 0.25 },
    { ccy: "GBP", notional: 7_777_777n, spot: 23.137 },
    { ccy: "EUR", notional: -1n, spot: 19.999 },
  ];

  for (const s of sweep) {
    test(`model == challenger for ${s.ccy} ${s.notional}@${s.spot}${s.fwd ? `+${s.fwd}fwd` : ""}`, () => {
      const obs: Record<string, number> = { [`${s.ccy}/ZAR`]: s.spot };
      if (s.fwd !== undefined) obs[`${s.ccy}/ZAR:fwd-points`] = s.fwd;
      const modelVal = fxValuable({
        currency: s.ccy,
        signedNotionalMinor: s.notional,
        isForward: s.fwd !== undefined,
      }).value(marks(obs), ASOF).value;
      const challenger = challengerValueMinor({
        currency: s.ccy,
        signedNotionalMinor: s.notional,
        spot: s.spot,
        ...(s.fwd !== undefined ? { fwdPoints: s.fwd } : {}),
      });
      expect(modelVal.currency).toBe("ZAR");
      expect(modelVal.minorUnits).toBe(challenger);
    });
  }
});

// ---------------------------------------------------------------------------
// (2) SENSITIVITY — linearity in rate and notional.
// ---------------------------------------------------------------------------

describe("Nadia challenger — sensitivity", () => {
  test("value is linear in rate (doubling the rate doubles the value)", () => {
    const v = (rate: number) =>
      fxValuable({ currency: "USD", signedNotionalMinor: 1_000_000n, isForward: false }).value(
        marks({ "USD/ZAR": rate }),
        ASOF,
      ).value.minorUnits;
    // Pick rates with exact 2dp products to avoid rounding noise in the ratio.
    expect(v(20) * 2n).toBe(v(40));
    expect(v(10) * 3n).toBe(v(30));
  });

  test("value is linear in notional (3× notional ⇒ 3× value)", () => {
    const v = (n: bigint) =>
      fxValuable({ currency: "USD", signedNotionalMinor: n, isForward: false }).value(
        marks({ "USD/ZAR": 18 }),
        ASOF,
      ).value.minorUnits;
    expect(v(100_000n) * 3n).toBe(v(300_000n));
  });
});

// ---------------------------------------------------------------------------
// (3) BOUNDARY / EDGE.
// ---------------------------------------------------------------------------

describe("Nadia challenger — boundary / edge", () => {
  test("zero notional ⇒ zero value", () => {
    const rec = fxValuable({ currency: "USD", signedNotionalMinor: 0n, isForward: false }).value(
      marks({ "USD/ZAR": 18.5 }),
      ASOF,
    );
    expect(rec.value.minorUnits).toBe(0n);
  });

  test("sign symmetry — value(−n) == −value(n)", () => {
    const pos = fxValuable({
      currency: "USD",
      signedNotionalMinor: 333_333n,
      isForward: false,
    }).value(marks({ "USD/ZAR": 17.77 }), ASOF).value.minorUnits;
    const neg = fxValuable({
      currency: "USD",
      signedNotionalMinor: -333_333n,
      isForward: false,
    }).value(marks({ "USD/ZAR": 17.77 }), ASOF).value.minorUnits;
    expect(neg).toBe(-pos);
  });

  test("rounding is half-away-from-zero at the .5 boundary, symmetric in sign", () => {
    // Construct a product whose fractional part is exactly .5:
    // 1 minor unit × 2.5 = 2.5 → 3 (away from zero); −1 × 2.5 = −2.5 → −3.
    const up = fxValuable({ currency: "USD", signedNotionalMinor: 1n, isForward: false }).value(
      marks({ "USD/ZAR": 2.5 }),
      ASOF,
    ).value.minorUnits;
    const down = fxValuable({ currency: "USD", signedNotionalMinor: -1n, isForward: false }).value(
      marks({ "USD/ZAR": 2.5 }),
      ASOF,
    ).value.minorUnits;
    expect(up).toBe(3n);
    expect(down).toBe(-3n);
  });

  test("reporting-currency leg values at rate 1 (no translation)", () => {
    const rec = fxValuable({
      currency: "ZAR",
      signedNotionalMinor: 1_234_567n,
      isForward: false,
    }).value(marks({}), ASOF); // no observable needed for the home leg
    expect(rec.value.currency).toBe("ZAR");
    expect(rec.value.minorUnits).toBe(1_234_567n);
  });

  test("missing spot observable is a hard error (no silent zero)", () => {
    expect(() =>
      fxValuable({ currency: "USD", signedNotionalMinor: 100_000n, isForward: false }).value(
        marks({}),
        ASOF,
      ),
    ).toThrow(/missing required spot observable/);
  });

  test("forward with missing points defaults points to zero (spot-only all-in)", () => {
    const withFwdFlagNoPoints = fxValuable({
      currency: "USD",
      signedNotionalMinor: 100_000n,
      isForward: true,
    }).value(marks({ "USD/ZAR": 18.5 }), ASOF).value.minorUnits;
    const spotOnly = fxValuable({
      currency: "USD",
      signedNotionalMinor: 100_000n,
      isForward: false,
    }).value(marks({ "USD/ZAR": 18.5 }), ASOF).value.minorUnits;
    expect(withFwdFlagNoPoints).toBe(spotOnly);
  });
});

// ---------------------------------------------------------------------------
// (4) JPY NON-2dp PROBE (named A2 deferred gap a).
//
// JPY is a 0-dp ISO currency; the v1 FX book carries it as 2dp minor units and
// the v2 kernel pins dp=2. The probe quantifies the consequence and proves the
// settlement-continuity invariant is UNAFFECTED by the deferral.
// ---------------------------------------------------------------------------

describe("Nadia challenger — JPY non-2dp deferred-gap probe", () => {
  test("JPY value = (2dp-minor JPY notional) × rate, in ZAR minor units — consistent with the kernel's stated 2dp pin", () => {
    // 89,130,000 JPY carried as 2dp minor = 8_913_000_000n minor units.
    // At JPY/ZAR = 0.124 → 8_913_000_000 × 0.124 = 1_105_212_000 ZAR minor
    // (= ZAR 11,052,120.00). The point: the SAME 2dp scale is used on the JPY
    // notional and the ZAR result, so the per-unit translation is internally
    // consistent — the ERROR is not in the multiply, it is in the EXTERNAL
    // contract of what "JPY minor units" means (cents vs whole yen).
    const jpyNotionalAs2dpMinor = 8_913_000_000n;
    const rec = fxValuable({
      currency: "JPY",
      signedNotionalMinor: jpyNotionalAs2dpMinor,
      isForward: false,
    }).value(marks({ "JPY/ZAR": 0.124 }), ASOF);
    expect(rec.value.currency).toBe("ZAR");
    expect(rec.value.minorUnits).toBe(challengerScale(jpyNotionalAs2dpMinor, 0.124));
  });

  test("settlement-continuity holds for JPY DESPITE the 0-dp deferral (the dp convention cancels on both sides)", () => {
    // Whatever the JPY minor-unit convention, value_pre (FX position) and
    // value_post (FCY cash) carry the SAME notional through the SAME kernel at
    // the SAME rate — so the deferral cannot break settlement continuity. This is
    // the load-bearing assurance for the cutover: JPY's dp gap is a UNIT-LABEL
    // issue, not a continuity issue.
    const notional = 8_913_000_000n;
    for (const rate of [0.0001, 0.124, 0.13, 1]) {
      const pre = fxValuable({
        currency: "JPY",
        signedNotionalMinor: notional,
        isForward: false,
      }).value(marks({ "JPY/ZAR": rate }), ASOF).value.minorUnits;
      const post = fcyCashValuable(
        fcyCashFromSettledReceivable({ currency: "JPY", signedNotionalMinor: notional }),
      ).value(marks({ "JPY/ZAR": rate }), ASOF).value.minorUnits;
      expect(post).toBe(pre);
    }
  });

  test("DOCUMENTED ERROR SURFACE: if JPY notionals were ever supplied in WHOLE YEN (0-dp) the value would be understated 100×", () => {
    // This test PROVES the gap is real and bounds it: the kernel multiplies
    // whatever integer it is handed by the rate. If a caller passes whole-yen
    // (the ISO-correct 0-dp count) into a field the kernel treats as 2dp-minor,
    // the ZAR value is 100× too small. The mitigation is that the live v1 FX
    // book feeds 2dp-minor consistently (byte-parity), so the gap is DORMANT on
    // the anchor book — but it is a live trap for any non-2dp-consistent feed.
    const wholeYen = 89_130_000n; // ISO-correct 0-dp count of the same 89.13m JPY
    const as2dp = 8_913_000_000n; // the same amount as 2dp-minor
    const vWhole = fxValuable({
      currency: "JPY",
      signedNotionalMinor: wholeYen,
      isForward: false,
    }).value(marks({ "JPY/ZAR": 0.124 }), ASOF).value.minorUnits;
    const v2dp = fxValuable({
      currency: "JPY",
      signedNotionalMinor: as2dp,
      isForward: false,
    }).value(marks({ "JPY/ZAR": 0.124 }), ASOF).value.minorUnits;
    expect(v2dp).toBe(vWhole * 100n);
  });
});
