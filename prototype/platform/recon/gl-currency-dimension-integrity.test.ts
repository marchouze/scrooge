// platform/recon/gl-currency-dimension-integrity.test.ts
//
// Tests for recon:gl-currency-dimension-integrity — the GL/finance-view
// currency-dimension gate that institutionalizes the #1540 trial-balance
// near-miss (a shared multi-currency account collapsed to one "multi" row,
// summing incommensurable native minor units).
//
// THE GATE MUST BITE. The original #1540 unit test was pointed the WRONG way
// (it codified the bug as expected); these tests prove the control is pointed
// the RIGHT way:
//   - a synthetic view with a "multi" row ⇒ the checker FAILS;
//   - a synthetic view whose in-balance is a cross-currency native minor sum ⇒
//     the checker FAILS;
//   - the CORRECTED per-(account, currency) buildGlView output ⇒ the checker
//     PASSES;
//   - the live gate run() over the real builder ⇒ GREEN;
//   - the source-level sentinel ban catches a reintroduced literal.
//
// Author: Vera (Internal audit / continuous-assurance engineer, third-line).

import { describe, expect, test } from "bun:test";

import {
  type GlTrialBalanceRow,
  type GlView,
  buildGlView,
} from "../../dashboard/v2-finance-gl-view";
import {
  CURRENCY_SENTINELS,
  SCANNED_VIEW_FILES,
  assertViewCurrencyDimension,
  multiCurrencyFixtureStores,
  run,
} from "./gl-currency-dimension-integrity";

// ---------------------------------------------------------------------------
// Build a real, CORRECT multi-currency GlView from the fixture, then derive
// deliberately-broken variants from it for the negative tests.
// ---------------------------------------------------------------------------

function correctMultiCurrencyView(): GlView {
  const { eventStore, marketDataStore } = multiCurrencyFixtureStores();
  return buildGlView({ eventStore, marketDataStore, filter: { mode: "production-only" } });
}

describe("assertViewCurrencyDimension — the gate must BITE", () => {
  test("CORRECTED per-(account,currency) view PASSES (no violations)", () => {
    const view = correctMultiCurrencyView();
    // Precondition: the fixture genuinely spans ≥2 currencies (USD + ZAR).
    const currencies = new Set(view.rows.map((r) => r.currency));
    expect(currencies.size).toBeGreaterThanOrEqual(2);
    expect(currencies.has("USD")).toBe(true);
    expect(currencies.has("ZAR")).toBe(true);

    const violations = assertViewCurrencyDimension(view, "test:correct");
    expect(violations).toEqual([]);
  });

  test('NEGATIVE: a "multi" sentinel row ⇒ checker FAILS', () => {
    const view = correctMultiCurrencyView();
    // Collapse the two USD/ZAR rows of the shared account into ONE "multi" row,
    // summing native minor units — the EXACT #1540 defect.
    const shared = view.rows.filter((r) => r.accountId === "ACC-2100-006");
    expect(shared.length).toBe(2);
    const sample = shared[0] as GlTrialBalanceRow;
    const multiRow: GlTrialBalanceRow = {
      ...sample,
      currency: "multi", // the retired sentinel
      // native minor units of USD + ZAR naively summed (incommensurable):
      debitMinor: shared.reduce((s, r) => s + r.debitMinor, 0),
      creditMinor: shared.reduce((s, r) => s + r.creditMinor, 0),
    };
    const broken: GlView = {
      ...view,
      rows: [...view.rows.filter((r) => r.accountId !== "ACC-2100-006"), multiRow],
    };

    const violations = assertViewCurrencyDimension(broken, "test:multi");
    expect(violations.some((v) => v.severity === "fail")).toBe(true);
    expect(violations.some((v) => v.subject.includes("sentinel-currency"))).toBe(true);
  });

  test("NEGATIVE: in-balance asserted on a NATIVE cross-currency sum ⇒ checker FAILS", () => {
    const view = correctMultiCurrencyView();
    // Simulate the defect where `inBalance` is true but the FUNCTIONAL totals do
    // NOT agree (i.e. it was computed from native cross-currency minor sums, not
    // the ZAR-equivalent totals). Force the functional totals out of balance while
    // leaving `inBalance` true.
    const broken: GlView = {
      ...view,
      inBalance: true,
      zarTotalDebitMinor: view.zarTotalDebitMinor + 12345,
      zarTotalCreditMinor: view.zarTotalCreditMinor, // now ΣDr != ΣCr
    };

    const violations = assertViewCurrencyDimension(broken, "test:nativesum");
    expect(violations.some((v) => v.severity === "fail")).toBe(true);
    expect(violations.some((v) => v.subject.includes("non-functional-in-balance"))).toBe(true);
  });

  test("NEGATIVE: fake balanced zero (functional totals zero while native rows carry value) ⇒ FAILS", () => {
    const view = correctMultiCurrencyView();
    const broken: GlView = {
      ...view,
      inBalance: true,
      zarTotalDebitMinor: 0,
      zarTotalCreditMinor: 0,
    };
    const violations = assertViewCurrencyDimension(broken, "test:fakezero");
    expect(violations.some((v) => v.subject.includes("fake-balanced-zero"))).toBe(true);
  });

  test("NEGATIVE: a non-ISO currency string ⇒ checker FAILS", () => {
    const view = correctMultiCurrencyView();
    const sample = view.rows[0] as GlTrialBalanceRow;
    const broken: GlView = {
      ...view,
      rows: [...view.rows, { ...sample, accountId: "ACC-XXXX", currency: "XYZ" }],
    };
    const violations = assertViewCurrencyDimension(broken, "test:noniso");
    expect(violations.some((v) => v.subject.includes("non-iso-currency"))).toBe(true);
  });
});

describe("run() — live gate over the real builder", () => {
  test("is GREEN on the current (post-#1540) GL view", () => {
    const r = run();
    expect(r.pipeline).toBe("gl-currency-dimension-integrity");
    // The behavioural assertion actually ran on a multi-currency book.
    expect(r.asserted).toBeGreaterThan(0);
    const fails = r.violations.filter((v) => v.severity === "fail");
    if (fails.length > 0) {
      // Surface the messages so a regression is legible in the CI log.
      for (const f of fails) console.error(`UNEXPECTED FAIL: ${f.subject}: ${f.message}`);
    }
    expect(fails).toEqual([]);
    expect(r.ok).toBe(true);
  });

  test("scans the GL/finance view layer and finds NO reintroduced sentinel literal", () => {
    const r = run();
    const sourceFails = r.violations.filter((v) =>
      SCANNED_VIEW_FILES.some((f) => v.subject.startsWith(f)),
    );
    expect(sourceFails).toEqual([]);
  });
});

describe("sentinel set integrity", () => {
  test('"multi" — the #1540 near-miss value — is in the banned sentinel set', () => {
    expect(CURRENCY_SENTINELS).toContain("multi");
    expect(CURRENCY_SENTINELS).toContain("mixed");
    expect(CURRENCY_SENTINELS).toContain("various");
  });
});
