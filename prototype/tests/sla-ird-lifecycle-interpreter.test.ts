// tests/sla-ird-lifecycle-interpreter.test.ts
//
// Interpreter-side leg-correctness regression for the IRD-swap (OTC interest-rate
// swap) product family (PR-IRS-001 / -002 / -003 / -TERM + memos). The durable
// guard that the rules-as-data SLA interpreter (IRD_IFRS_RULES) produces the
// CORRECT double-entry legs for every IRD-swap lifecycle stage. It replaces the
// retired byte-for-byte parallel-run suite (the legacy ird-swaps.ts posting-rule
// functions were the dead reference oracle, retired with the legacy GL posting
// engine in SLA full-retirement Stage 3). The expected legs below are the
// interpreter's own output — which the now-retired parallel-run proved equal to
// the legacy engine (domestic OTC swaps are ZAR, parity was exact).
//
// Stages covered: booking (at-market no-post / off-market asset / off-market
// liability), reval (gain / loss / sign-flips / zero-delta), coupon (net-receive /
// net-pay / zero), termination (asset / liability close-out, gain / loss /
// zero-payment / matured-at-zero), and the two memo events (no GL).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Stage 3, CEO-approved —
//            standing decision; Marc in-session 2026-06-08).

import { describe, expect, it } from "bun:test";

import { type InterpretResult, interpret } from "../platform/accounting/sla/interpreter";
import { IRD_IFRS_RULES } from "../platform/accounting/sla/rules/ird-index";

const ASOF = "2026-06-05T10:00:00.000Z";
const ENTITY = "LE-ZA-HOZ-BANK";

interface NormalLeg {
  accountId: string;
  debitCredit: string;
  amountMinor: number;
  currency: string;
}

function runOne(type: string, payload: unknown): InterpretResult {
  const results = interpret(
    { type, entity: ENTITY, as_of: ASOF, payload },
    IRD_IFRS_RULES,
    ["IFRS"],
    ASOF,
  );
  const r = results.find((x) => x.representation === "IFRS");
  if (!r) throw new Error(`no IFRS result for ${type}`);
  return r;
}

/** Interpreter legs as NormalLeg[] (empty when no-GL / intentional-no-impact). */
function interpLegs(r: InterpretResult): NormalLeg[] {
  if (r.outcome === "intentional-no-impact") return [];
  if (r.outcome !== "post") throw new Error(`expected post/no-impact, got ${r.outcome}`);
  return r.legs.map((l) => ({
    accountId: l.accountId,
    debitCredit: l.debitCredit,
    amountMinor: Number(l.amountMinor),
    currency: l.currency,
  }));
}

function assertBalances(legs: NormalLeg[]): void {
  const byCcy = new Map<string, number>();
  for (const l of legs) {
    const signed = l.debitCredit === "debit" ? l.amountMinor : -l.amountMinor;
    byCcy.set(l.currency, (byCcy.get(l.currency) ?? 0) + signed);
  }
  for (const [, net] of byCcy) expect(net).toBe(0);
}

/** Assert the interpreter produces exactly `expected` legs (+ balanced). */
function expectInterpreterLegs(type: string, payload: unknown, expected: NormalLeg[]): void {
  const interp = interpLegs(runOne(type, payload));
  expect(interp).toEqual(expected);
  assertBalances(interp);
}

// ---------------------------------------------------------------------------
// PR-IRS-001 — initial recognition (booking)
// ---------------------------------------------------------------------------

describe("IRS booking (PR-IRS-001) — at-market / off-market", () => {
  function trade(npvMinor: number) {
    return {
      tradeId: "IRS-T1",
      instrumentType: "irs" as const,
      role: "pay-fixed" as const,
      notionalMinor: 100_000_000,
      npvMinor,
      fixedRatePercent: 0.085,
      tradeDate: "2026-06-05",
      startDate: "2026-06-07",
      maturityDate: "2031-06-07",
      counterpartyLei: "LEI-CP",
      currency: "ZAR",
    };
  }
  it("at-market (zero NPV) — no posting (intentional-no-impact)", () => {
    expect(runOne("IrdSwapTradeExecuted", trade(0)).outcome).toBe("intentional-no-impact");
  });
  it("off-market asset (npv>0)", () => {
    expectInterpreterLegs("IrdSwapTradeExecuted", trade(1_250_000), [
      { accountId: "ACC-3300-001", debitCredit: "debit", amountMinor: 1_250_000, currency: "ZAR" },
      { accountId: "ACC-3300-003", debitCredit: "credit", amountMinor: 1_250_000, currency: "ZAR" },
    ]);
  });
  it("off-market liability (npv<0)", () => {
    expectInterpreterLegs("IrdSwapTradeExecuted", trade(-980_000), [
      { accountId: "ACC-3300-003", debitCredit: "debit", amountMinor: 980_000, currency: "ZAR" },
      { accountId: "ACC-3300-002", debitCredit: "credit", amountMinor: 980_000, currency: "ZAR" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// PR-IRS-002 — FVTPL NPV revaluation
// ---------------------------------------------------------------------------

describe("IRS revaluation (PR-IRS-002) — gain / loss / sign-flip", () => {
  function reval(opening: number, closing: number) {
    return {
      tradeId: "IRS-T1",
      npvDeltaMinor: closing - opening,
      npvClosingMinor: closing,
      npvOpeningMinor: opening,
      revalDate: "2026-06-05",
      currency: "ZAR",
    };
  }
  it("simple gain (asset→bigger asset)", () => {
    expectInterpreterLegs("IrdSwapPositionRevalued", reval(500_000, 750_000), [
      { accountId: "ACC-3300-001", debitCredit: "debit", amountMinor: 250_000, currency: "ZAR" },
      { accountId: "ACC-3300-003", debitCredit: "credit", amountMinor: 250_000, currency: "ZAR" },
    ]);
  });
  it("simple loss (liability→bigger liability)", () => {
    expectInterpreterLegs("IrdSwapPositionRevalued", reval(-300_000, -520_000), [
      { accountId: "ACC-3300-003", debitCredit: "debit", amountMinor: 220_000, currency: "ZAR" },
      { accountId: "ACC-3300-002", debitCredit: "credit", amountMinor: 220_000, currency: "ZAR" },
    ]);
  });
  it("simple gain (liability→smaller liability)", () => {
    expectInterpreterLegs("IrdSwapPositionRevalued", reval(-500_000, -200_000), [
      { accountId: "ACC-3300-001", debitCredit: "debit", amountMinor: 300_000, currency: "ZAR" },
      { accountId: "ACC-3300-003", debitCredit: "credit", amountMinor: 300_000, currency: "ZAR" },
    ]);
  });
  it("simple loss (asset→smaller asset)", () => {
    expectInterpreterLegs("IrdSwapPositionRevalued", reval(800_000, 350_000), [
      { accountId: "ACC-3300-003", debitCredit: "debit", amountMinor: 450_000, currency: "ZAR" },
      { accountId: "ACC-3300-002", debitCredit: "credit", amountMinor: 450_000, currency: "ZAR" },
    ]);
  });
  it("sign-flip asset→liability", () => {
    expectInterpreterLegs("IrdSwapPositionRevalued", reval(400_000, -250_000), [
      { accountId: "ACC-3300-003", debitCredit: "debit", amountMinor: 650_000, currency: "ZAR" },
      { accountId: "ACC-3300-001", debitCredit: "credit", amountMinor: 400_000, currency: "ZAR" },
      { accountId: "ACC-3300-002", debitCredit: "credit", amountMinor: 250_000, currency: "ZAR" },
    ]);
  });
  it("sign-flip liability→asset", () => {
    expectInterpreterLegs("IrdSwapPositionRevalued", reval(-350_000, 600_000), [
      { accountId: "ACC-3300-002", debitCredit: "debit", amountMinor: 350_000, currency: "ZAR" },
      { accountId: "ACC-3300-001", debitCredit: "debit", amountMinor: 600_000, currency: "ZAR" },
      { accountId: "ACC-3300-003", debitCredit: "credit", amountMinor: 950_000, currency: "ZAR" },
    ]);
  });
  it("zero delta — no posting (intentional-no-impact)", () => {
    expect(runOne("IrdSwapPositionRevalued", reval(500_000, 500_000)).outcome).toBe(
      "intentional-no-impact",
    );
  });
});

// ---------------------------------------------------------------------------
// PR-IRS-003 — net coupon cash settlement
// ---------------------------------------------------------------------------

describe("IRS coupon settlement (PR-IRS-003) — net-receive / net-pay", () => {
  function coupon(net: number) {
    return {
      tradeId: "IRS-T1",
      netCashMinor: net,
      fixedLegMinor: net >= 0 ? net + 100_000 : 100_000,
      floatingLegMinor: net >= 0 ? 100_000 : -net + 100_000,
      settlementDate: "2026-09-07",
      periodStartDate: "2026-06-07",
      periodEndDate: "2026-09-07",
      currency: "ZAR",
    };
  }
  it("net-receive (net>0)", () => {
    expectInterpreterLegs("IrdSwapCouponSettled", coupon(225_000), [
      { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 225_000, currency: "ZAR" },
      { accountId: "ACC-3300-001", debitCredit: "credit", amountMinor: 225_000, currency: "ZAR" },
    ]);
  });
  it("net-pay (net<0)", () => {
    expectInterpreterLegs("IrdSwapCouponSettled", coupon(-180_000), [
      { accountId: "ACC-3300-002", debitCredit: "debit", amountMinor: 180_000, currency: "ZAR" },
      { accountId: "ACC-1200-001", debitCredit: "credit", amountMinor: 180_000, currency: "ZAR" },
    ]);
  });
  it("zero net — no posting (intentional-no-impact)", () => {
    expect(runOne("IrdSwapCouponSettled", coupon(0)).outcome).toBe("intentional-no-impact");
  });
});

// ---------------------------------------------------------------------------
// PR-IRS-TERM — termination / derecognition
// ---------------------------------------------------------------------------

describe("IRS termination (PR-IRS-TERM) — asset / liability close-out", () => {
  function term(termPayment: number, carryingNpv: number) {
    return {
      tradeId: "IRS-T1",
      terminationPaymentMinor: termPayment,
      carryingNpvAtTerminationMinor: carryingNpv,
      realisedPnlMinor: termPayment - carryingNpv,
      terminationDate: "2028-06-07",
      currency: "ZAR",
    };
  }
  it("asset close-out, gain (receive > carrying asset)", () => {
    expectInterpreterLegs("IrdSwapTerminated", term(900_000, 800_000), [
      { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 900_000, currency: "ZAR" },
      { accountId: "ACC-3300-001", debitCredit: "credit", amountMinor: 800_000, currency: "ZAR" },
      { accountId: "ACC-3300-003", debitCredit: "credit", amountMinor: 100_000, currency: "ZAR" },
    ]);
  });
  it("asset close-out, loss (receive < carrying asset)", () => {
    expectInterpreterLegs("IrdSwapTerminated", term(700_000, 800_000), [
      { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 700_000, currency: "ZAR" },
      { accountId: "ACC-3300-001", debitCredit: "credit", amountMinor: 800_000, currency: "ZAR" },
      { accountId: "ACC-3300-003", debitCredit: "debit", amountMinor: 100_000, currency: "ZAR" },
    ]);
  });
  it("liability close-out, loss (pay > carrying liability)", () => {
    expectInterpreterLegs("IrdSwapTerminated", term(-600_000, -500_000), [
      { accountId: "ACC-1200-001", debitCredit: "credit", amountMinor: 600_000, currency: "ZAR" },
      { accountId: "ACC-3300-002", debitCredit: "debit", amountMinor: 500_000, currency: "ZAR" },
      { accountId: "ACC-3300-003", debitCredit: "debit", amountMinor: 100_000, currency: "ZAR" },
    ]);
  });
  it("liability close-out, gain (pay < carrying liability)", () => {
    expectInterpreterLegs("IrdSwapTerminated", term(-400_000, -500_000), [
      { accountId: "ACC-1200-001", debitCredit: "credit", amountMinor: 400_000, currency: "ZAR" },
      { accountId: "ACC-3300-002", debitCredit: "debit", amountMinor: 500_000, currency: "ZAR" },
      { accountId: "ACC-3300-003", debitCredit: "credit", amountMinor: 100_000, currency: "ZAR" },
    ]);
  });
  it("asset close-out at zero termination payment (full P&L loss)", () => {
    expectInterpreterLegs("IrdSwapTerminated", term(0, 600_000), [
      { accountId: "ACC-3300-001", debitCredit: "credit", amountMinor: 600_000, currency: "ZAR" },
      { accountId: "ACC-3300-003", debitCredit: "debit", amountMinor: 600_000, currency: "ZAR" },
    ]);
  });
  it("matured at zero NPV (no cash, no carrying) — no posting", () => {
    // PR-IRS-TERM is `always` but no line fires → balanced post with zero legs.
    const r = runOne("IrdSwapTerminated", term(0, 0));
    expect(interpLegs(r)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Memos — intentional-no-impact
// ---------------------------------------------------------------------------

describe("IRS memos (PR-IRS-SCHED / PR-IRS-INSTRUCT) — intentional-no-impact", () => {
  it("coupon schedule generated — intentional-no-impact", () => {
    expect(
      runOne("IrsCouponScheduleGenerated", { tradeId: "IRS-T1", currency: "ZAR" }).outcome,
    ).toBe("intentional-no-impact");
  });
  it("coupon payment instructed — intentional-no-impact", () => {
    expect(
      runOne("IrsCouponPaymentInstructed", { tradeId: "IRS-T1", currency: "ZAR" }).outcome,
    ).toBe("intentional-no-impact");
  });
});

// ---------------------------------------------------------------------------
// Schema conformance — every IRD rule satisfies the rules-as-data contract.
// ---------------------------------------------------------------------------

describe("IRD_IFRS_RULES schema conformance", () => {
  it("every rule carries the schema-required fields + valid enums", () => {
    for (const rule of IRD_IFRS_RULES) {
      expect(rule.rule_id.startsWith("PR-")).toBe(true);
      expect(["IFRS", "SARB-BA-RETURN", "ZA-TAX"]).toContain(rule.representation);
      expect(rule.version).toBeGreaterThanOrEqual(1);
      expect(rule.effective_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(rule.applies_to.event_type.length).toBeGreaterThan(0);
      expect(["always", "non-zero-delta", "non-zero-pnl", "intentional-no-impact"]).toContain(
        rule.condition.kind,
      );
      expect(rule.balancing).toBe("assert_zero");
      expect(rule.cites.length).toBeGreaterThan(0);
    }
  });

  it("rule ids are unique", () => {
    const ids = IRD_IFRS_RULES.map((r) => r.rule_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
