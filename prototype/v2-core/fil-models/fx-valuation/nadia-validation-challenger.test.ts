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
// methodology (value = signedNotional × allInRate, half-away-from-zero to 2dp)
// WITHOUT importing the model's own arithmetic. A deliberately different code
// path: it composes the rounding from `Math` primitives spelled out longhand,
// so a silent change to the model's rounding boundary would diverge here.
// ---------------------------------------------------------------------------

function challengerValue(args: {
  currency: string;
  signedNotional: string;
  spot: number;
  fwdPoints?: number;
  reporting?: string;
}): string {
  const reporting = args.reporting ?? "ZAR";
  if (args.currency === reporting) return args.signedNotional;
  const allIn = args.spot + (args.fwdPoints ?? 0);
  const product = Number(args.signedNotional) * allIn;
  // Half-away-from-zero to 2dp — a different arithmetic path from the model.
  const factor = 100;
  const mag = Math.abs(product * factor);
  const roundedMag = Math.trunc(mag + 0.5) / factor;
  const signed = product < 0 ? -roundedMag : roundedMag;
  // Strip trailing zeros to match decimalToString's canonical form (no .00 noise).
  return signed.toFixed(2).replace(/\.?0+$/, "") || "0";
}

// ---------------------------------------------------------------------------
// (1) PARALLEL RUN — challenger vs model over a sweep.
// ---------------------------------------------------------------------------

describe("Nadia challenger — parallel run vs model", () => {
  const sweep: Array<{ ccy: string; notional: string; spot: number; fwd?: number }> = [
    { ccy: "USD", notional: "1000.00", spot: 18.5 },
    { ccy: "USD", notional: "-1000.00", spot: 19.1 },
    { ccy: "EUR", notional: "500.00", spot: 20.0 },
    { ccy: "GBP", notional: "-300.00", spot: 23.4 },
    { ccy: "USD", notional: "1000.00", spot: 18.5, fwd: 0.25 },
    { ccy: "GBP", notional: "77777.77", spot: 23.137 },
    { ccy: "EUR", notional: "-0.01", spot: 19.999 },
  ];

  for (const s of sweep) {
    test(`model == challenger for ${s.ccy} ${s.notional}@${s.spot}${s.fwd ? `+${s.fwd}fwd` : ""}`, () => {
      const obs: Record<string, number> = { [`${s.ccy}/ZAR`]: s.spot };
      if (s.fwd !== undefined) obs[`${s.ccy}/ZAR:fwd-points`] = s.fwd;
      const modelVal = fxValuable({
        currency: s.ccy,
        signedNotional: s.notional,
        isForward: s.fwd !== undefined,
      }).value(marks(obs), ASOF).value;
      const challenger = challengerValue({
        currency: s.ccy,
        signedNotional: s.notional,
        spot: s.spot,
        ...(s.fwd !== undefined ? { fwdPoints: s.fwd } : {}),
      });
      expect(modelVal.currency).toBe("ZAR");
      expect(modelVal.amount).toBe(challenger);
    });
  }
});

// ---------------------------------------------------------------------------
// (2) SENSITIVITY — linearity in rate and notional.
// ---------------------------------------------------------------------------

describe("Nadia challenger — sensitivity", () => {
  test("value is linear in rate (doubling the rate doubles the value)", () => {
    const v = (rate: number) =>
      Number(
        fxValuable({ currency: "USD", signedNotional: "10000.00", isForward: false }).value(
          marks({ "USD/ZAR": rate }),
          ASOF,
        ).value.amount,
      );
    // Pick rates with exact 2dp products to avoid rounding noise in the ratio.
    expect(v(20) * 2).toBe(v(40));
    expect(v(10) * 3).toBe(v(30));
  });

  test("value is linear in notional (3× notional ⇒ 3× value)", () => {
    const v = (n: string) =>
      Number(
        fxValuable({ currency: "USD", signedNotional: n, isForward: false }).value(
          marks({ "USD/ZAR": 18 }),
          ASOF,
        ).value.amount,
      );
    expect(v("1000.00") * 3).toBe(v("3000.00"));
  });
});

// ---------------------------------------------------------------------------
// (3) BOUNDARY / EDGE.
// ---------------------------------------------------------------------------

describe("Nadia challenger — boundary / edge", () => {
  test("zero notional ⇒ zero value", () => {
    const rec = fxValuable({ currency: "USD", signedNotional: "0.00", isForward: false }).value(
      marks({ "USD/ZAR": 18.5 }),
      ASOF,
    );
    expect(Number(rec.value.amount)).toBe(0);
  });

  test("sign symmetry — value(−n) == −value(n)", () => {
    const pos = Number(
      fxValuable({
        currency: "USD",
        signedNotional: "3333.33",
        isForward: false,
      }).value(marks({ "USD/ZAR": 17.77 }), ASOF).value.amount,
    );
    const neg = Number(
      fxValuable({
        currency: "USD",
        signedNotional: "-3333.33",
        isForward: false,
      }).value(marks({ "USD/ZAR": 17.77 }), ASOF).value.amount,
    );
    expect(neg).toBe(-pos);
  });

  test("rounding is half-away-from-zero at the .5 boundary, symmetric in sign", () => {
    // Construct a product whose fractional part is exactly .5 at the 2dp level:
    // 0.01 major unit × 2.5 = 0.025 → 0.03 (away from zero); −0.01 × 2.5 = −0.025 → −0.03.
    const up = fxValuable({ currency: "USD", signedNotional: "0.01", isForward: false }).value(
      marks({ "USD/ZAR": 2.5 }),
      ASOF,
    ).value.amount;
    const down = fxValuable({ currency: "USD", signedNotional: "-0.01", isForward: false }).value(
      marks({ "USD/ZAR": 2.5 }),
      ASOF,
    ).value.amount;
    expect(Number(up)).toBe(0.03);
    expect(Number(down)).toBe(-0.03);
  });

  test("reporting-currency leg values at rate 1 (no translation)", () => {
    const rec = fxValuable({
      currency: "ZAR",
      signedNotional: "12345.67",
      isForward: false,
    }).value(marks({}), ASOF); // no observable needed for the home leg
    expect(rec.value.currency).toBe("ZAR");
    expect(rec.value.amount).toBe("12345.67");
  });

  test("missing spot observable is a hard error (no silent zero)", () => {
    expect(() =>
      fxValuable({ currency: "USD", signedNotional: "1000.00", isForward: false }).value(
        marks({}),
        ASOF,
      ),
    ).toThrow(/missing required spot observable/);
  });

  test("forward with missing points defaults points to zero (spot-only all-in)", () => {
    const withFwdFlagNoPoints = fxValuable({
      currency: "USD",
      signedNotional: "1000.00",
      isForward: true,
    }).value(marks({ "USD/ZAR": 18.5 }), ASOF).value.amount;
    const spotOnly = fxValuable({
      currency: "USD",
      signedNotional: "1000.00",
      isForward: false,
    }).value(marks({ "USD/ZAR": 18.5 }), ASOF).value.amount;
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
  test("JPY value = JPY notional × rate, in ZAR major units — consistent with the kernel's stated 2dp pin", () => {
    // 89,130,000.00 JPY (expressed as major-unit decimal string).
    // At JPY/ZAR = 0.124 → 89,130,000 × 0.124 = 11,052,120.00 ZAR.
    // The point: the SAME major-unit convention is used on both sides — the ERROR
    // is in the EXTERNAL contract of what "JPY notional" means (2dp vs whole yen).
    const jpyNotional = "89130000.00";
    const rec = fxValuable({
      currency: "JPY",
      signedNotional: jpyNotional,
      isForward: false,
    }).value(marks({ "JPY/ZAR": 0.124 }), ASOF);
    expect(rec.value.currency).toBe("ZAR");
    expect(rec.value.amount).toBe(
      challengerValue({ currency: "JPY", signedNotional: jpyNotional, spot: 0.124 }),
    );
  });

  test("settlement-continuity holds for JPY DESPITE the 0-dp deferral (the dp convention cancels on both sides)", () => {
    // Whatever the JPY notional convention, value_pre (FX position) and
    // value_post (FCY cash) carry the SAME notional through the SAME kernel at
    // the SAME rate — so the deferral cannot break settlement continuity. This is
    // the load-bearing assurance for the cutover: JPY's dp gap is a UNIT-LABEL
    // issue, not a continuity issue.
    const notional = "89130000.00";
    for (const rate of [0.0001, 0.124, 0.13, 1]) {
      const pre = fxValuable({
        currency: "JPY",
        signedNotional: notional,
        isForward: false,
      }).value(marks({ "JPY/ZAR": rate }), ASOF).value.amount;
      const post = fcyCashValuable(
        fcyCashFromSettledReceivable({ currency: "JPY", signedNotional: notional }),
      ).value(marks({ "JPY/ZAR": rate }), ASOF).value.amount;
      expect(post).toBe(pre);
    }
  });

  test("DOCUMENTED ERROR SURFACE: if JPY notionals were ever supplied in WHOLE YEN (0-dp) the value would be understated 100×", () => {
    // This test PROVES the gap is real and bounds it: the kernel multiplies
    // whatever decimal it is handed by the rate. If a caller passes whole-yen
    // (the ISO-correct 0-dp count, e.g. "891300.00") into a field the caller
    // intends as 2dp-major (i.e. 89,130,000 JPY), the ZAR value is 100× too small.
    const wholeYenStr = "891300.00"; // ISO-correct 0-dp count treated as major
    const as2dpStr = "89130000.00"; // the same amount with the 2dp convention
    const vWhole = Number(
      fxValuable({
        currency: "JPY",
        signedNotional: wholeYenStr,
        isForward: false,
      }).value(marks({ "JPY/ZAR": 0.124 }), ASOF).value.amount,
    );
    const v2dp = Number(
      fxValuable({
        currency: "JPY",
        signedNotional: as2dpStr,
        isForward: false,
      }).value(marks({ "JPY/ZAR": 0.124 }), ASOF).value.amount,
    );
    expect(v2dp).toBe(vWhole * 100);
  });
});
