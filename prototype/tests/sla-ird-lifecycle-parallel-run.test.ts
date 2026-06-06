// tests/sla-ird-lifecycle-parallel-run.test.ts
//
// Full-retirement Batch 3 — byte-for-byte parity regression (brief deliverable
// 3). Every IRD-swap (OTC interest-rate swap) lifecycle event is fed through BOTH
// the rules-as-data SLA interpreter (IRD_IFRS_RULES) and the legacy posting-rule
// functions (platform/accounting/posting-rules/ird-swaps.ts).
//
// Success criterion (CEO design call, Marc, 2026-06-05): legacy and interpreter
// MUST agree BYTE-FOR-BYTE at every lifecycle stage. Domestic OTC swaps are ZAR,
// so parity holds exactly. The cutover in
// runtime/agents/bea-gl-posting-engine.ts is only safe because this guard is
// green.
//
// Stages covered:
//   booking (PR-IRS-001):  at-market zero-NPV (no posting) / off-market asset
//                          (npv>0) / off-market liability (npv<0).
//   reval   (PR-IRS-002):  simple gain / simple loss / sign-flip asset→liability
//                          / sign-flip liability→asset / zero delta (no posting).
//   coupon  (PR-IRS-003):  net-receive (net>0) / net-pay (net<0) / zero net
//                          (no posting).
//   termination (PR-IRS-TERM): asset close-out (gain / loss) / liability close-out
//                          (gain / loss) / matured-at-zero (no posting).
//   memos   (PR-IRS-SCHED / PR-IRS-INSTRUCT): intentional-no-impact.
//
// Every IRD amount is an integer minor-unit field on the triggering event, so no
// enrichment is supplied (matching the production cutover bridge, which passes
// none).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 3, CEO-approved
//            2026-06-05).

import { describe, expect, it } from "bun:test";

import type { SubLedgerLeg } from "../platform/accounting/fx-accounting-types";
import {
  irdSwapCouponJournals,
  irdSwapRevaluationJournals,
  irdSwapTerminationJournals,
  irdSwapTradeBookingJournals,
} from "../platform/accounting/posting-rules/ird-swaps";
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

function normalise(legs: ReadonlyArray<SubLedgerLeg>): NormalLeg[] {
  return legs.map((l) => ({
    accountId: l.accountId,
    debitCredit: l.debitCredit,
    amountMinor: l.amountMinor,
    currency: l.currency,
  }));
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

/** Assert interpreter == legacy byte-for-byte (+ balanced). */
function expectParity(
  type: string,
  payload: unknown,
  legacyLegs: ReadonlyArray<SubLedgerLeg>,
): void {
  const legacy = normalise(legacyLegs);
  const interp = interpLegs(runOne(type, payload));
  expect(interp).toEqual(legacy);
  assertBalances(interp);
}

// ---------------------------------------------------------------------------
// PR-IRS-001 — initial recognition (booking)
// ---------------------------------------------------------------------------

describe("IRS booking (PR-IRS-001) — at-market / off-market parity", () => {
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
  it("at-market (zero NPV) — both produce no posting (intentional-no-impact)", () => {
    const p = trade(0);
    expect(irdSwapTradeBookingJournals(p as never)).toEqual([]);
    expect(runOne("IrdSwapTradeExecuted", p).outcome).toBe("intentional-no-impact");
  });
  it("off-market asset (npv>0) — byte-for-byte", () => {
    const p = trade(1_250_000);
    expectParity("IrdSwapTradeExecuted", p, irdSwapTradeBookingJournals(p as never));
  });
  it("off-market liability (npv<0) — byte-for-byte", () => {
    const p = trade(-980_000);
    expectParity("IrdSwapTradeExecuted", p, irdSwapTradeBookingJournals(p as never));
  });
});

// ---------------------------------------------------------------------------
// PR-IRS-002 — FVTPL NPV revaluation
// ---------------------------------------------------------------------------

describe("IRS revaluation (PR-IRS-002) — gain / loss / sign-flip parity", () => {
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
  it("simple gain (asset→bigger asset) — byte-for-byte", () => {
    const p = reval(500_000, 750_000);
    expectParity("IrdSwapPositionRevalued", p, irdSwapRevaluationJournals(p as never));
  });
  it("simple loss (liability→bigger liability) — byte-for-byte", () => {
    const p = reval(-300_000, -520_000);
    expectParity("IrdSwapPositionRevalued", p, irdSwapRevaluationJournals(p as never));
  });
  it("simple gain (liability→smaller liability) — byte-for-byte", () => {
    const p = reval(-500_000, -200_000);
    expectParity("IrdSwapPositionRevalued", p, irdSwapRevaluationJournals(p as never));
  });
  it("simple loss (asset→smaller asset) — byte-for-byte", () => {
    const p = reval(800_000, 350_000);
    expectParity("IrdSwapPositionRevalued", p, irdSwapRevaluationJournals(p as never));
  });
  it("sign-flip asset→liability — byte-for-byte", () => {
    const p = reval(400_000, -250_000);
    expectParity("IrdSwapPositionRevalued", p, irdSwapRevaluationJournals(p as never));
  });
  it("sign-flip liability→asset — byte-for-byte", () => {
    const p = reval(-350_000, 600_000);
    expectParity("IrdSwapPositionRevalued", p, irdSwapRevaluationJournals(p as never));
  });
  it("zero delta — both produce no posting (intentional-no-impact)", () => {
    const p = reval(500_000, 500_000);
    expect(irdSwapRevaluationJournals(p as never)).toEqual([]);
    expect(runOne("IrdSwapPositionRevalued", p).outcome).toBe("intentional-no-impact");
  });
});

// ---------------------------------------------------------------------------
// PR-IRS-003 — net coupon cash settlement
// ---------------------------------------------------------------------------

describe("IRS coupon settlement (PR-IRS-003) — net-receive / net-pay parity", () => {
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
  it("net-receive (net>0) — byte-for-byte", () => {
    const p = coupon(225_000);
    expectParity("IrdSwapCouponSettled", p, irdSwapCouponJournals(p as never));
  });
  it("net-pay (net<0) — byte-for-byte", () => {
    const p = coupon(-180_000);
    expectParity("IrdSwapCouponSettled", p, irdSwapCouponJournals(p as never));
  });
  it("zero net — both produce no posting (intentional-no-impact)", () => {
    const p = coupon(0);
    expect(irdSwapCouponJournals(p as never)).toEqual([]);
    expect(runOne("IrdSwapCouponSettled", p).outcome).toBe("intentional-no-impact");
  });
});

// ---------------------------------------------------------------------------
// PR-IRS-TERM — termination / derecognition
// ---------------------------------------------------------------------------

describe("IRS termination (PR-IRS-TERM) — asset / liability close-out parity", () => {
  function term(termPayment: number, carryingNpv: number) {
    return {
      tradeId: "IRS-T1",
      terminationPaymentMinor: termPayment,
      carryingNpvAtTerminationMinor: carryingNpv,
      // realisedPnl = terminationPayment − carryingNpv (consistent event).
      realisedPnlMinor: termPayment - carryingNpv,
      terminationDate: "2028-06-07",
      currency: "ZAR",
    };
  }
  it("asset close-out, gain (receive > carrying asset) — byte-for-byte", () => {
    const p = term(900_000, 800_000);
    expectParity("IrdSwapTerminated", p, irdSwapTerminationJournals(p as never));
  });
  it("asset close-out, loss (receive < carrying asset) — byte-for-byte", () => {
    const p = term(700_000, 800_000);
    expectParity("IrdSwapTerminated", p, irdSwapTerminationJournals(p as never));
  });
  it("liability close-out, loss (pay > carrying liability) — byte-for-byte", () => {
    const p = term(-600_000, -500_000);
    expectParity("IrdSwapTerminated", p, irdSwapTerminationJournals(p as never));
  });
  it("liability close-out, gain (pay < carrying liability) — byte-for-byte", () => {
    const p = term(-400_000, -500_000);
    expectParity("IrdSwapTerminated", p, irdSwapTerminationJournals(p as never));
  });
  it("asset close-out at zero termination payment (full P&L loss) — byte-for-byte", () => {
    const p = term(0, 600_000);
    expectParity("IrdSwapTerminated", p, irdSwapTerminationJournals(p as never));
  });
  it("matured at zero NPV (no cash, no carrying) — both produce no posting", () => {
    const p = term(0, 0);
    expect(irdSwapTerminationJournals(p as never)).toEqual([]);
    // PR-IRS-TERM is `always` but no line fires → balanced post with zero legs.
    const r = runOne("IrdSwapTerminated", p);
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
