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

const COMMON = {
  instanceId: "fil:inst:LE-ZA-HOZ-BANK:t1",
  tenantId: "LE-ZA-HOZ-BANK",
  postingDate: "2026-06-18",
};

describe("PR-FX-SETTLE-V2 — P&L-neutral settlement (IAS 21 §23; D-FX-PNL-FCY-EXPOSURE-REVALUATION)", () => {
  test("balances per currency even when the settled amount differs from booked", () => {
    const legs = postFxSettlementLegs({
      ...COMMON,
      boughtCurrency: "USD",
      boughtBookedAmount: "1000000.00",
      boughtSettledAmount: "1005000.00", // received more than booked
      soldCurrency: "ZAR",
      soldBookedAmount: "18000000.00",
      soldSettledAmount: "18000000.00",
    });
    expect(legs.length).toBeGreaterThan(0);
    expectBalanced(legs);
  });

  test("balances when both legs settle exactly at the booked rate", () => {
    const legs = postFxSettlementLegs({
      ...COMMON,
      boughtCurrency: "EUR",
      boughtBookedAmount: "500000.00",
      boughtSettledAmount: "500000.00",
      soldCurrency: "ZAR",
      soldBookedAmount: "10000000.00",
      soldSettledAmount: "10000000.00",
    });
    expectBalanced(legs);
  });

  // P&L-NEUTRAL settlement (D-FX-PNL-FCY-EXPOSURE-REVALUATION): settlement is a
  // change of FORM, not a realisation. It NEVER touches an on-balance-sheet FX
  // trading receivable/payable (trade-date is OBS-only) and NEVER posts realised
  // P&L (ACC-2100-006) — it recognises cash (nostro) against the FX settlement
  // clearing account (ACC-2100-027).
  test("touches NO receivable/payable and NO realised P&L; cash vs settlement clearing only", () => {
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
    // Every leg is a cash (nostro, ACC-1200-*) or settlement-clearing leg.
    const allowed = (code: string) =>
      code.startsWith("ACC-1200-") || code === FX_SETTLEMENT_CLEARING_ACCOUNT;
    for (const leg of legs) expect(allowed(leg.accountCode)).toBe(true);
    // Both currencies recognise cash + clearing → four legs, balanced per ccy.
    expect(legs.length).toBe(4);
    expectBalanced(legs);
  });

  test("the settlement clearing account carries one leg per settled currency", () => {
    const legs = postFxSettlementLegs({
      ...COMMON,
      boughtCurrency: "USD",
      boughtBookedAmount: "1000000.00",
      boughtSettledAmount: "1000000.00",
      soldCurrency: "ZAR",
      soldBookedAmount: "18500000.00",
      soldSettledAmount: "18500000.00",
    });
    const clearingLegs = legs.filter((l) => l.accountCode === FX_SETTLEMENT_CLEARING_ACCOUNT);
    const clearingCurrencies = new Set(clearingLegs.map((l) => l.amount.currency));
    expect(clearingCurrencies).toEqual(new Set(["USD", "ZAR"]));
    // The bought (received) leg credits clearing (Dr cash); the sold (paid) leg debits it.
    const usd = clearingLegs.find((l) => l.amount.currency === "USD");
    const zar = clearingLegs.find((l) => l.amount.currency === "ZAR");
    expect(usd?.creditDebit).toBe("credit");
    expect(zar?.creditDebit).toBe("debit");
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
    expectBalanced(legs);
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
    expectBalanced(legs);
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
  const swapInput = {
    ...COMMON,
    boughtCurrency: "GBP",
    boughtBookedAmount: "800000.00",
    boughtSettledAmount: "802000.00",
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

  test("WS-FIL-FX-SETTLEMENT-EVENTS resolved all five — no OPEN deferred gap remains", () => {
    // Every gap carries a resolvedBy marker; the active (still-open) subset is
    // empty → the NPA-page badge renders every FX posting rule `active`.
    for (const g of FX_SETTLEMENT_DEFERRED_GAPS) {
      expect(g.resolvedBy).toBeDefined();
      expect(g.resolvedBy).toContain("D-FIL-FX-SETTLEMENT-EVENTS");
    }
    expect(activeFxSettlementDeferredGaps().length).toBe(0);
  });
});
