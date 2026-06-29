// v2-core/posting-rules/fx-settlement.test.ts
//
// Balancing unit tests for the FX completeness posting rules (WS-ACCT-FX-
// COMPLETENESS Slice 3). Each rule's legs MUST sum to zero per currency — the
// Definition of Done for a posting rule (Engineering Charter; D-ACCT-FX-IFRS-
// POSTING-COMPLETENESS). A debit is +amount, a credit is −amount; the per-
// currency net of every rule's leg set must be exactly zero.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, test } from "bun:test";

import type { FxPostingLeg } from "./fx";
import {
  FX_REALISED_PNL_ACCOUNT,
  FX_SETTLEMENT_CLEARING_ACCOUNT,
  FX_SETTLEMENT_DEFERRED_GAPS,
  FX_UNREALISED_PNL_ACCOUNT,
  activeFxSettlementDeferredGaps,
  postFxConversionLegs,
  postFxDerecognitionLegs,
  postFxFvociReclassLegs,
  postFxNdfFixingLegs,
  postFxSettlementLegs,
  postFxSwapFarLegLegs,
  postFxSwapNearLegLegs,
} from "./fx-settlement";

// ---------------------------------------------------------------------------
// Helper: net every currency across a leg set; assert each nets to exactly 0.
// Exact decimal arithmetic via BigInt — never float (Charter cmd 4/6).
// ---------------------------------------------------------------------------

function scaled(amount: string): { v: bigint; scale: number } {
  const neg = amount.startsWith("-");
  const body = neg ? amount.slice(1) : amount;
  const dot = body.indexOf(".");
  if (dot === -1) return { v: (neg ? -1n : 1n) * BigInt(body || "0"), scale: 0 };
  const frac = body.slice(dot + 1);
  const digits = BigInt(`${body.slice(0, dot)}${frac}` || "0");
  return { v: (neg ? -1n : 1n) * digits, scale: frac.length };
}

/** Map currency → net signed scaled BigInt (debit +, credit −), at a common scale. */
function netByCurrency(legs: readonly FxPostingLeg[]): Map<string, bigint> {
  // Normalise everything to scale 12 (more than enough for FX amounts).
  const SCALE = 12;
  const net = new Map<string, bigint>();
  for (const leg of legs) {
    const { v, scale } = scaled(leg.amount.amount);
    const norm = v * 10n ** BigInt(SCALE - scale);
    const signed = leg.creditDebit === "debit" ? norm : -norm;
    net.set(leg.amount.currency, (net.get(leg.amount.currency) ?? 0n) + signed);
  }
  return net;
}

function expectBalanced(legs: readonly FxPostingLeg[]): void {
  const net = netByCurrency(legs);
  for (const [currency, sum] of net) {
    expect(`${currency}:${sum.toString()}`).toBe(`${currency}:0`);
  }
}

/**
 * Assert a CROSS-currency leg set balances in the FUNCTIONAL currency (ZAR) — IAS 21
 * §21. After D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1 a deliverable spot settles
 * nostro-to-nostro (Dr FCY-cash / Cr ZAR-cash, no clearing contra) and the FCY→ZAR
 * conversion draws the FCY nostro down in its OWN currency — neither balances in
 * native minor units, but both balance once each currency's net is translated to ZAR
 * at `zarPer` (ZAR per 1 unit; ZAR is the identity). This mirrors the trial-balance
 * functional in-balance invariant (trialBalanceFunctionalCurrencyBalance).
 */
function expectFunctionalBalanced(
  legs: readonly FxPostingLeg[],
  zarPer: Readonly<Record<string, number>>,
): void {
  // Translate each currency's net to ZAR at `zarPer` and sum. The rate may be
  // fractional (e.g. 18.5), so scale it to an integer numerator/denominator and do
  // exact BigInt arithmetic — never float (Charter cmd 6).
  let zarMicroNet = 0n; // ZAR net at an extra ×1e6 rate scale
  for (const [currency, sum] of netByCurrency(legs)) {
    const rate = currency === "ZAR" ? 1 : zarPer[currency];
    if (rate === undefined) throw new Error(`no functional rate supplied for ${currency}`);
    const rateMicro = BigInt(Math.round(rate * 1_000_000)); // exact for ≤6dp rates
    zarMicroNet += sum * rateMicro;
  }
  expect(`ZAR-functional-net:${zarMicroNet}`).toBe("ZAR-functional-net:0");
}

/**
 * Assert an FCY→ZAR conversion balances in the FUNCTIONAL currency. The FCY nostro
 * leg is denominated in the FCY (face amount) but its functional (ZAR) value is its
 * `zarCostBasis` by construction (the FCY cash is carried at its ZAR cost). So the
 * ZAR-denominated legs (proceeds, realised, unrealised) plus the FCY nostro leg
 * VALUED AT `zarCostBasis` must net to zero in ZAR. This avoids an inexact implied
 * rate (zarCostBasis/fcyAmount may not be a clean decimal) by using the exact ZAR
 * carrying value the rule itself uses.
 */
function expectConversionFunctionalBalanced(
  legs: readonly FxPostingLeg[],
  fcyCurrency: string,
  zarCostBasis: string,
): void {
  let zarNet = 0n; // scale-12 ZAR minor, Dr +, Cr −
  const costScaled = scaled(zarCostBasis);
  const costNorm = costScaled.v * 10n ** BigInt(12 - costScaled.scale);
  for (const leg of legs) {
    const { v, scale } = scaled(leg.amount.amount);
    const norm = v * 10n ** BigInt(12 - scale);
    if (leg.amount.currency === fcyCurrency) {
      // Value the FCY nostro leg at its ZAR cost basis (its functional carrying value).
      const signed = leg.creditDebit === "debit" ? costNorm : -costNorm;
      zarNet += signed;
    } else {
      // ZAR-denominated legs at face.
      expect(leg.amount.currency).toBe("ZAR");
      zarNet += leg.creditDebit === "debit" ? norm : -norm;
    }
  }
  expect(`ZAR-conversion-functional-net:${zarNet}`).toBe("ZAR-conversion-functional-net:0");
}

const COMMON = {
  instanceId: "fil:inst:LE-ZA-HOZ-BANK:t1",
  tenantId: "LE-ZA-HOZ-BANK",
  postingDate: "2026-06-18",
};

describe("PR-FX-SETTLE-V2 — P&L-neutral settlement (IAS 21 §23; D-FX-PNL-FCY-EXPOSURE-REVALUATION)", () => {
  test("FAILS CLOSED when a settled amount differs from booked in the same currency (F3)", () => {
    // A deliverable FX settlement exchanges the contractual notional, so settled ==
    // booked PER CURRENCY. A same-currency difference is an IAS 21 §28/§29 exchange
    // difference the P&L-neutral rule cannot represent — it must NOT be silently
    // dropped (it would net to zero by construction). The rule fails closed
    // (D-FX-IFRS-REVIEW-FOUNDATION, F3) rather than absorbing it.
    expect(() =>
      postFxSettlementLegs({
        ...COMMON,
        boughtCurrency: "USD",
        boughtBookedAmount: "1000000.00",
        boughtSettledAmount: "1005000.00", // received more than booked → exchange difference
        soldCurrency: "ZAR",
        soldBookedAmount: "18000000.00",
        soldSettledAmount: "18000000.00",
      }),
    ).toThrow(/settled amount .* ≠ booked amount/);
  });

  test("a deliverable PvP spot balances in the FUNCTIONAL currency (no clearing contra)", () => {
    // EUR 500k bought @ rate 20 ⇒ ZAR 10m sold. Dr EUR-cash / Cr ZAR-cash: NOT
    // balanced natively (EUR vs ZAR are incommensurable), balanced in ZAR at 20.
    const legs = postFxSettlementLegs({
      ...COMMON,
      boughtCurrency: "EUR",
      boughtBookedAmount: "500000.00",
      boughtSettledAmount: "500000.00",
      soldCurrency: "ZAR",
      soldBookedAmount: "10000000.00",
      soldSettledAmount: "10000000.00",
    });
    // PvP: two nostro legs only, NO clearing contra.
    expect(legs.length).toBe(2);
    expect(legs.some((l) => l.accountCode === FX_SETTLEMENT_CLEARING_ACCOUNT)).toBe(false);
    expectFunctionalBalanced(legs, { EUR: 20 });
  });

  // P&L-NEUTRAL PvP settlement (D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1; refines
  // D-FX-PNL-FCY-EXPOSURE-REVALUATION): settlement is a change of FORM, not a
  // realisation. It NEVER touches an on-balance-sheet FX trading receivable/payable
  // (trade-date is OBS-only) and NEVER posts realised P&L (ACC-2100-006). A
  // deliverable spot settles nostro-to-nostro with NO clearing contra (the trade
  // balances in the functional currency); the clearing account is reserved for
  // genuinely sequential-leg settlement (swap near/far).
  test("touches NO receivable/payable and NO realised P&L; nostro-to-nostro only (no clearing)", () => {
    const legs = postFxSettlementLegs({
      ...COMMON,
      boughtCurrency: "USD",
      boughtBookedAmount: "1000000.00",
      boughtSettledAmount: "1000000.00",
      soldCurrency: "ZAR",
      soldBookedAmount: "18500000.00",
      soldSettledAmount: "18500000.00",
    });
    const recvPay = new Set(["ACC-2100-001", "ACC-2100-002", "ACC-2100-003", "ACC-2100-004"]);
    for (const leg of legs) expect(recvPay.has(leg.accountCode)).toBe(false);
    // NO realised-P&L leg — settlement is P&L-neutral.
    for (const leg of legs) expect(leg.accountCode).not.toBe(FX_REALISED_PNL_ACCOUNT);
    // NO clearing contra — a deliverable PvP spot settles nostro-to-nostro.
    for (const leg of legs) expect(leg.accountCode).not.toBe(FX_SETTLEMENT_CLEARING_ACCOUNT);
    // Every leg is a cash (nostro, ACC-1200-*) leg, one per settled currency.
    for (const leg of legs) expect(leg.accountCode.startsWith("ACC-1200-")).toBe(true);
    expect(legs.length).toBe(2);
    expectFunctionalBalanced(legs, { USD: 18.5 });
  });

  test("a SEQUENTIAL swap leg (near/far) DOES use the clearing account (reserved for inter-leg windows)", () => {
    // A swap near-leg settles BEFORE the far leg — a genuine inter-leg PvP window —
    // so it bridges via the FX settlement clearing account (ACC-2100-027), which
    // carries one balancing contra per settled currency and empties when the far
    // leg lands. (Spot does NOT; only sequential legs do.)
    const near = postFxSwapNearLegLegs({
      ...COMMON,
      boughtCurrency: "USD",
      boughtBookedAmount: "1000000.00",
      boughtSettledAmount: "1000000.00",
      soldCurrency: "ZAR",
      soldBookedAmount: "18500000.00",
      soldSettledAmount: "18500000.00",
    });
    const clearingLegs = near.filter((l) => l.accountCode === FX_SETTLEMENT_CLEARING_ACCOUNT);
    const clearingCurrencies = new Set(clearingLegs.map((l) => l.amount.currency));
    expect(clearingCurrencies).toEqual(new Set(["USD", "ZAR"]));
    // The bought (received) leg credits clearing (Dr cash); the sold (paid) leg debits it.
    expect(clearingLegs.find((l) => l.amount.currency === "USD")?.creditDebit).toBe("credit");
    expect(clearingLegs.find((l) => l.amount.currency === "ZAR")?.creditDebit).toBe("debit");
    // A sequential-clearing leg DOES balance natively per currency (cash vs clearing).
    expectBalanced(near);
  });
});

describe("PR-FX-CONVERT-V2 — FCY→ZAR conversion / realisation (D-FX-PNL-FCY-EXPOSURE-REVALUATION)", () => {
  // Worked example from the decision: convert USD 7m (ZAR cost basis R129.95m) →
  // ZAR @ 19.00. ZAR proceeds = 133,000,000; realised = +R3,050,000.
  test("realises proceeds − cost basis and reclassifies cumulative unrealised", () => {
    const legs = postFxConversionLegs({
      instanceId: "fil:inst:LE-ZA-HOZ-BANK:t1",
      tenantId: "LE-ZA-HOZ-BANK",
      postingDate: "2026-06-25",
      fcyCurrency: "USD",
      reportingCurrency: "ZAR",
      fcyAmount: "7000000.00",
      zarProceeds: "133000000.00",
      zarCostBasis: "129950000.00",
      // The cumulative unrealised that accrued as spot moved 18.565 → 19.00 (same
      // +3,050,000) is reclassified into realised — total P&L unchanged.
      accumulatedUnrealised: "3050000.00",
    });
    // Balances in the FUNCTIONAL currency (the FCY nostro leg is in USD at face;
    // its ZAR value is the cost basis). It does NOT balance natively (USD vs ZAR).
    expectConversionFunctionalBalanced(legs, "USD", "129950000.00");
    // Item 3 fix: the FCY nostro (ACC-1200-002, USD-designated) is credited in USD
    // at the FCY FACE amount — NOT a ZAR amount (no cross-currency contamination).
    const fcyNostro = legs.find((l) => l.accountCode === "ACC-1200-002");
    expect(fcyNostro).toBeDefined();
    expect(fcyNostro?.amount.currency).toBe("USD");
    expect(fcyNostro?.amount.amount).toBe("7000000.00");
    expect(fcyNostro?.creditDebit).toBe("credit");
    // Realised P&L (ACC-2100-006) net = realisation (+3.05m) + reclassified
    // unrealised (+3.05m) = +6.1m credit; the unrealised account is reversed by 3.05m.
    const realised = legs.filter((l) => l.accountCode === FX_REALISED_PNL_ACCOUNT);
    expect(realised.length).toBeGreaterThan(0);
    // Cumulative unrealised is reversed (a debit to ACC-2100-005).
    const unrealised = legs.filter((l) => l.accountCode === FX_UNREALISED_PNL_ACCOUNT);
    expect(unrealised.length).toBe(1);
    expect(unrealised[0]?.creditDebit).toBe("debit");
  });

  test("a realised LOSS (proceeds < cost basis) balances and reverses correctly", () => {
    const legs = postFxConversionLegs({
      instanceId: "fil:inst:LE-ZA-HOZ-BANK:t2",
      tenantId: "LE-ZA-HOZ-BANK",
      postingDate: "2026-06-25",
      fcyCurrency: "USD",
      reportingCurrency: "ZAR",
      fcyAmount: "7000000.00",
      zarProceeds: "127000000.00",
      zarCostBasis: "129950000.00",
      accumulatedUnrealised: "-2950000.00",
    });
    expectConversionFunctionalBalanced(legs, "USD", "129950000.00");
  });

  test("no legs when the converted amount is zero", () => {
    expect(
      postFxConversionLegs({
        instanceId: "fil:inst:LE-ZA-HOZ-BANK:t3",
        tenantId: "LE-ZA-HOZ-BANK",
        postingDate: "2026-06-25",
        fcyCurrency: "USD",
        reportingCurrency: "ZAR",
        fcyAmount: "0",
        zarProceeds: "0",
        zarCostBasis: "0",
        accumulatedUnrealised: "0",
      }),
    ).toEqual([]);
  });
});

describe("PR-FX-CLOSE-V2 — derecognition reversal (IFRS 9 §3.2.3)", () => {
  test("balances reversing an accumulated unrealised gain into realised", () => {
    const legs = postFxDerecognitionLegs({
      ...COMMON,
      currency: "ZAR",
      accumulatedUnrealised: "250000.00",
    });
    expect(legs.length).toBe(2);
    expectBalanced(legs);
  });
  test("balances reversing an accumulated unrealised loss", () => {
    const legs = postFxDerecognitionLegs({
      ...COMMON,
      currency: "USD",
      accumulatedUnrealised: "-75000.00",
    });
    expectBalanced(legs);
  });
  test("returns no legs when nothing accumulated", () => {
    expect(
      postFxDerecognitionLegs({ ...COMMON, currency: "ZAR", accumulatedUnrealised: "0" }),
    ).toEqual([]);
  });
});

describe("PR-FX-SWAP-NEAR/FAR-V2 — swap-leg settlement (IAS 21 §23)", () => {
  // Deliverable swap legs exchange the contractual notional → settled == booked per
  // currency (F3: a same-currency booked≠settled difference fails closed).
  const swapInput = {
    ...COMMON,
    boughtCurrency: "GBP",
    boughtBookedAmount: "800000.00",
    boughtSettledAmount: "800000.00",
    soldCurrency: "ZAR",
    soldBookedAmount: "19000000.00",
    soldSettledAmount: "19000000.00",
  };
  test("near leg balances per currency", () => {
    const legs = postFxSwapNearLegLegs(swapInput);
    expect(legs.every((l) => l.postingRuleId === "PR-FX-SWAP-NEAR-V2")).toBe(true);
    expectBalanced(legs);
  });
  test("far leg balances per currency", () => {
    const legs = postFxSwapFarLegLegs(swapInput);
    expect(legs.every((l) => l.postingRuleId === "PR-FX-SWAP-FAR-V2")).toBe(true);
    expectBalanced(legs);
  });
});

describe("PR-FX-NDF-FIX-V2 — NDF fixing P&L, cash-only (IFRS 9 §5.7.1 / IAS 21 §28)", () => {
  test("balances a fixing gain with no principal legs", () => {
    const legs = postFxNdfFixingLegs({
      ...COMMON,
      settlementCurrency: "USD",
      netCashDifference: "42000.00",
    });
    expect(legs.length).toBe(2); // cash + P&L only — NO principal legs
    expectBalanced(legs);
  });
  test("balances a fixing loss", () => {
    const legs = postFxNdfFixingLegs({
      ...COMMON,
      settlementCurrency: "USD",
      netCashDifference: "-13500.00",
    });
    expectBalanced(legs);
  });
  test("returns no legs on a zero fixing difference", () => {
    expect(
      postFxNdfFixingLegs({ ...COMMON, settlementCurrency: "USD", netCashDifference: "0" }),
    ).toEqual([]);
  });
});

describe("PR-FX-FVOCI-RECLASS-V2 — FVOCI → P&L reclassification (IFRS 9 §5.7.10–11)", () => {
  test("balances recycling an accumulated OCI gain into P&L", () => {
    const legs = postFxFvociReclassLegs({
      ...COMMON,
      currency: "ZAR",
      accumulatedOci: "320000.00",
    });
    expect(legs.length).toBe(2);
    expectBalanced(legs);
  });
  test("balances recycling an accumulated OCI loss", () => {
    const legs = postFxFvociReclassLegs({
      ...COMMON,
      currency: "EUR",
      accumulatedOci: "-90000.00",
    });
    expectBalanced(legs);
  });
});

describe("FX_SETTLEMENT_DEFERRED_GAPS — tracked, well-formed deferrals", () => {
  test("every historical deferred gap is well-formed (no hollow deferral)", () => {
    // The inventory is append-only — all five remain as the historical record of
    // what was deferred, even after WS-FIL-FX-SETTLEMENT-EVENTS resolved them.
    expect(FX_SETTLEMENT_DEFERRED_GAPS.length).toBe(5);
    for (const g of FX_SETTLEMENT_DEFERRED_GAPS) {
      expect(g.gapId.length).toBeGreaterThan(0);
      expect(g.title.length).toBeGreaterThan(0);
      expect(g.owner).toContain("Bea");
      expect(g.targetTrigger.length).toBeGreaterThan(0);
      expect(g.citations.length).toBeGreaterThan(0);
    }
  });

  test("no OPEN deferred gap remains: four resolved by wiring + FVOCI invalid-for-FX (F1)", () => {
    // Four gaps are resolved by WS-FIL-FX-SETTLEMENT-EVENTS trigger-wiring; the
    // FVOCI-reclass gap is closed by EXCLUSION (IFRS-invalid for FX, F1), NOT by
    // wiring. Every gap is closed one way or the other, so the active (still-open)
    // subset is empty → the NPA-page badge renders every LIVE FX posting rule
    // `active` and the FVOCI rule is excluded as invalid-for-FX.
    for (const g of FX_SETTLEMENT_DEFERRED_GAPS) {
      const closed = g.resolvedBy !== undefined || g.invalidForFx !== undefined;
      expect(closed).toBe(true);
      // Exactly one of the two closure markers, never both.
      expect(g.resolvedBy !== undefined && g.invalidForFx !== undefined).toBe(false);
    }
    // The four wiring-resolved gaps cite the resolving event family.
    const resolvedByWiring = FX_SETTLEMENT_DEFERRED_GAPS.filter((g) => g.resolvedBy !== undefined);
    expect(resolvedByWiring.length).toBe(4);
    for (const g of resolvedByWiring) {
      expect(g.resolvedBy).toContain("D-FIL-FX-SETTLEMENT-EVENTS");
    }
    // The FVOCI-reclass gap is invalid-for-FX, not deferred (F1).
    const fvoci = FX_SETTLEMENT_DEFERRED_GAPS.find((g) => g.gapId === "fx-fvoci-reclass-trigger");
    expect(fvoci?.invalidForFx).toContain("D-FX-IFRS-REVIEW-FOUNDATION");
    expect(fvoci?.resolvedBy).toBeUndefined();

    expect(activeFxSettlementDeferredGaps().length).toBe(0);
  });
});
