// v2-core/fil-models/fx-valuation/nadia-cash-validation-challenger.test.ts
//
// INDEPENDENT model-validation challenger for the renamed Cash `Valuable`
// FIL-Model (`cash`, `fil:type:cash:balance:vanilla@1.0`) — the second-line
// validation re-opened by the `fcy-cash` → `cash` rename (D-MODEL-BINDING-
// CONTRACT-V1 §3 re-anchors the methodology hash). Authored by Nadia
// (Independent-validation engineer, second line) as a DISTINCT plane from
// implementation (Atlas / Bea). This file does NOT modify the model under
// review; it is the validator's own re-implementation + adversarial probes.
//
// It complements `nadia-validation-challenger.test.ts` (the A2 FX/cash sweep)
// with the cash-rename-specific probes:
//   (1) CURRENCY-AGNOSTIC — the cash Valuable holds the reporting/domestic
//       currency (ZAR) at rate 1 EXACTLY as it holds USD/EUR/GBP at the closing
//       rate. No `fcy`/foreign assumption leaked into the maths: a ZAR cash
//       balance values to itself with NO observable required.
//   (2) METHODOLOGY-HASH RE-ANCHOR — the rename `fcy-cash` → `cash` changed the
//       declared `modelId`, so the FNV-1a methodology hash MUST differ from the
//       legacy `fcy-cash` hash. This is the integrity anchor that re-opened
//       validation; the test pins it so a silent revert to `fcy-cash` (or any
//       id/version drift) is caught.
//   (3) SETTLEMENT-CONTINUITY (model level) — value_pre (FX position) ==
//       value_post (cash) at the same rate, over a foreign-currency rate sweep,
//       INDEPENDENTLY of the recon gate.
//   (4) DEGENERATE-MATCH DEFECT PIN (MV-CASH-001) — the backfill fixture
//       produces an FX instance denominated in the REPORTING currency (ZAR) with
//       cash legs in BOTH the foreign (received) and reporting (paid) currencies.
//       The history-proof matches the cash leg to the FX position BY CURRENCY;
//       when the FX `currency` is the reporting currency it pairs with the
//       OPPOSITE-DIRECTION reporting-currency paid leg → a sign mismatch. This
//       test PROVES that defect surface exists at the model/data level (it is a
//       seed/recon-pairing defect, NOT a cash-model methodology defect) and bounds
//       it, so the fix can be regression-guarded.
//
// Authority: D-CASH-ASSET-CLASS-V1; D-MODEL-BINDING-CONTRACT-V1;
//   D-FIL-FRAMEWORK-UNIFICATION; IAS-21-§23; Principle 1;
//   brief:nadia:independent-validation-of-the-cash-valuable-mode:2026-06-18.
// Author: Nadia (Independent-validation engineer, second line).

import { describe, expect, test } from "bun:test";

import type { Instant, MarketDataSlice } from "../../../v2-core";
import {
  CASH_MODEL_ID,
  CASH_MODEL_METHODOLOGY_HASH,
  CASH_MODEL_VERSION,
  cashFromSettledReceivable,
  cashValuable,
  computeFxMethodologyHash,
  fxValuable,
} from "../../../v2-core";

const ASOF = "2026-06-18T00:00:00.000Z" as Instant;
const REPORTING = "ZAR";

function marks(observables: Record<string, number>): MarketDataSlice {
  return { asOf: ASOF, observables };
}

// ---------------------------------------------------------------------------
// (1) CURRENCY-AGNOSTIC — ZAR holds at rate 1; USD/EUR/GBP at the closing rate.
// ---------------------------------------------------------------------------

describe("Nadia cash-rename challenger — currency-agnostic Valuable", () => {
  test("a reporting-currency (ZAR) cash balance values to ITSELF at rate 1, NO observable needed", () => {
    const rec = cashValuable(
      cashFromSettledReceivable({
        currency: REPORTING,
        signedNotional: "1852000.00",
        reporting: REPORTING,
      }),
    ).value(marks({}), ASOF); // deliberately empty marks — a domestic leg needs none
    expect(rec.value.currency).toBe("ZAR");
    expect(rec.value.amount).toBe("1852000");
    // The domestic leg requires NO observable — proves no foreign assumption.
    expect(rec.observablesUsed.length).toBe(0);
  });

  test("a domestic (ZAR) RiskMeasurable carries NO FX risk factor (rate 1, not foreign)", async () => {
    const { cashRiskMeasurable } = await import("../../../v2-core");
    const rm = cashRiskMeasurable({
      currency: REPORTING,
      balance: "1852000.00",
      reporting: REPORTING,
    });
    expect(rm.riskFactors().length).toBe(0);
  });

  test("a foreign (USD) cash balance requires the USD/ZAR observable and values at the closing rate", () => {
    const rec = cashValuable(
      cashFromSettledReceivable({
        currency: "USD",
        signedNotional: "100000.00",
        reporting: REPORTING,
      }),
    ).value(marks({ "USD/ZAR": 18.52 }), ASOF);
    expect(rec.value.currency).toBe("ZAR");
    // 100,000 × 18.52 = 1,852,000.00
    expect(rec.value.amount).toBe("1852000");
    expect(rec.observablesUsed.length).toBe(1);
  });

  test("ZAR and USD use the SAME kernel — a USD leg at rate 1.0 equals a ZAR leg of the same notional", () => {
    const zar = cashValuable(
      cashFromSettledReceivable({ currency: "ZAR", signedNotional: "500.00", reporting: REPORTING }),
    ).value(marks({}), ASOF).value.amount;
    const usdAtRate1 = cashValuable(
      cashFromSettledReceivable({ currency: "USD", signedNotional: "500.00", reporting: REPORTING }),
    ).value(marks({ "USD/ZAR": 1 }), ASOF).value.amount;
    expect(usdAtRate1).toBe(zar);
  });
});

// ---------------------------------------------------------------------------
// (2) METHODOLOGY-HASH RE-ANCHOR — the rename changed the hash; pin it.
// ---------------------------------------------------------------------------

describe("Nadia cash-rename challenger — methodology-hash re-anchor", () => {
  test("the declared cash model id is the currency-neutral `cash`, NOT the legacy `fcy-cash`", () => {
    expect(CASH_MODEL_ID).toBe("cash");
  });

  test("the cash methodology hash is re-anchored away from the legacy `fcy-cash` hash", () => {
    const legacyHash = computeFxMethodologyHash("fcy-cash", CASH_MODEL_VERSION);
    const renamedHash = computeFxMethodologyHash(CASH_MODEL_ID, CASH_MODEL_VERSION);
    // The id is part of the FNV-1a pin string, so the rename MUST move the hash —
    // that movement is exactly what re-opened this validation (D-MODEL-BINDING-
    // CONTRACT-V1 §3). A silent revert to `fcy-cash` would fail here.
    expect(renamedHash).not.toBe(legacyHash);
    expect(CASH_MODEL_METHODOLOGY_HASH).toBe(renamedHash);
  });
});

// ---------------------------------------------------------------------------
// (3) SETTLEMENT-CONTINUITY (model level), independent of the recon gate.
// ---------------------------------------------------------------------------

describe("Nadia cash-rename challenger — settlement continuity (model level)", () => {
  for (const { ccy, notional } of [
    { ccy: "USD", notional: "100000.00" },
    { ccy: "EUR", notional: "-50000.00" },
    { ccy: "GBP", notional: "30000.00" },
  ]) {
    test(`value_pre (FX ${ccy}) == value_post (cash ${ccy}) over a rate sweep`, () => {
      for (const rate of [0.5, 1, 18.52, 23.4, 0.0001]) {
        const pre = fxValuable({
          currency: ccy,
          signedNotional: notional,
          isForward: false,
          reporting: REPORTING,
        }).value(marks({ [`${ccy}/ZAR`]: rate }), ASOF).value.amount;
        const post = cashValuable(
          cashFromSettledReceivable({ currency: ccy, signedNotional: notional, reporting: REPORTING }),
        ).value(marks({ [`${ccy}/ZAR`]: rate }), ASOF).value.amount;
        expect(post).toBe(pre);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// (4) DEGENERATE-MATCH DEFECT PIN (MV-CASH-001).
//
// This is NOT a cash-model methodology defect — the kernel is correct. It is a
// SEED/RECON-PAIRING defect surfaced by validation: the backfill fixture
// (`scripts/backfill-fil-instances.ts`) denominates the settled FX instance in
// the REPORTING currency (ZAR) and materialises BOTH a foreign (received) and a
// reporting (paid) cash leg. recon:fx-settlement-continuity's HISTORY proof pairs
// the cash leg to the FX position by `economicTerms.currency`; when that currency
// IS the reporting currency, the matched leg is the opposite-direction ZAR PAID
// leg, so value_pre (long +) and value_post (short −) have opposite signs. The
// test reproduces both legs of the math to bound the defect.
// ---------------------------------------------------------------------------

describe("Nadia cash-rename challenger — MV-CASH-001 degenerate-match defect surface", () => {
  test("FX position in reporting ccy (long) pairs by-currency with the reporting PAID leg (short) → opposite sign", () => {
    // The fixture FX instance: long ZAR 1,852,000 (reporting-currency-denominated).
    const fxValuePre = fxValuable({
      currency: REPORTING,
      signedNotional: "1852000.00",
      isForward: false,
      reporting: REPORTING,
    }).value(marks({}), ASOF).value;
    // The reporting (paid) cash leg the by-currency match selects: short ZAR.
    const zarPaidValuePost = cashValuable(
      cashFromSettledReceivable({
        currency: REPORTING,
        signedNotional: "-1852000.00", // direction short ⇒ negated
        reporting: REPORTING,
      }),
    ).value(marks({}), ASOF).value;

    // The model arithmetic is faithful on EACH side; the defect is the PAIRING —
    // the by-currency match against a reporting-ccy FX instance picks the funding
    // leg, not the foreign received leg. So the two values are equal-and-opposite,
    // which the history proof reports as a continuity breach.
    expect(fxValuePre.amount).toBe("1852000");
    expect(zarPaidValuePost.amount).toBe("-1852000");
    expect(Number(zarPaidValuePost.amount)).toBe(-Number(fxValuePre.amount));
  });

  test("the CORRECT continuity pairing is FX-foreign-leg ↔ foreign-received cash leg (USD ↔ USD)", () => {
    // When the FX position is denominated in the FOREIGN currency (the economically
    // correct instrument-of-record), continuity holds with the received leg.
    const fxUsdPre = fxValuable({
      currency: "USD",
      signedNotional: "100000.00",
      isForward: false,
      reporting: REPORTING,
    }).value(marks({ "USD/ZAR": 18.52 }), ASOF).value.amount;
    const usdReceivedPost = cashValuable(
      cashFromSettledReceivable({ currency: "USD", signedNotional: "100000.00", reporting: REPORTING }),
    ).value(marks({ "USD/ZAR": 18.52 }), ASOF).value.amount;
    expect(usdReceivedPost).toBe(fxUsdPre);
  });
});
