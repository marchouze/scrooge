// tests/sla-securities-lifecycle-parallel-run.test.ts
//
// Full-retirement Batch 2 — byte-for-byte parity regression (brief deliverable
// 3). Every securities (bond + equity) lifecycle event is fed through BOTH the
// rules-as-data SLA interpreter (SECURITIES_IFRS_RULES) and the legacy
// posting-rule functions (platform/accounting/posting-rules/bonds.ts +
// equities.ts).
//
// Success criterion (CEO design call, Marc, 2026-06-05): legacy and interpreter
// MUST agree BYTE-FOR-BYTE at every lifecycle stage. JSE bonds + equities are
// ZAR, so parity holds exactly. The cutover in
// runtime/agents/bea-gl-posting-engine.ts is only safe because this guard is
// green.
//
// Stages covered:
//   BOND:   booking (banking-book buy/sell, trading-book buy/sell) /
//           EIR accrual (non-zero, zero) / FVTPL revaluation (gain, loss, zero) /
//           maturity (with final coupon, zero coupon; banking + trading) /
//           sale (gain, loss, break-even; banking + trading).
//   EQUITY: booking (FVTPL) / revaluation (gain, loss, zero) /
//           dividend (with WHT, without WHT, zero gross) /
//           sale (FVTPL gain/loss/break-even; FVOCI gain/loss/break-even — the
//           OCI-vs-P&L split, §5.7.5 no-recycling).
//
// The bond booking amount `Math.round(nominalMinor * dirtyPricePercent / 100)`
// is a float-derived integer the integer-only expression sandbox cannot compute;
// the test supplies it as `enrichment.dirtyPriceAmountMinor` (via
// `bondDirtyPriceAmountMinor`) exactly as the production cutover bridge does.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 2, CEO-approved
//            2026-06-05).

import { describe, expect, it } from "bun:test";

import type { SubLedgerLeg } from "../platform/accounting/fx-accounting-types";
import {
  bondBankingBookJournals,
  bondInterestAccrualJournals,
  bondMaturityJournals,
  bondRevaluationJournals,
  bondSaleJournals,
  bondTradingBookJournals,
} from "../platform/accounting/posting-rules/bonds";
import {
  equityDividendJournals,
  equityRevaluationJournals,
  equitySaleJournals,
  equityTradeBookingJournals,
} from "../platform/accounting/posting-rules/equities";
import { type InterpretResult, interpret } from "../platform/accounting/sla/interpreter";
import { SECURITIES_IFRS_RULES } from "../platform/accounting/sla/rules/securities-index";
import { bondDirtyPriceAmountMinor } from "../runtime/agents/bea-gl-securities-interpreter-cutover";

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

function runOne(type: string, payload: unknown, enrichment?: unknown): InterpretResult {
  const results = interpret(
    { type, entity: ENTITY, as_of: ASOF, payload, enrichment },
    SECURITIES_IFRS_RULES,
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
  enrichment?: unknown,
): void {
  const legacy = normalise(legacyLegs);
  const interp = interpLegs(runOne(type, payload, enrichment));
  expect(interp).toEqual(legacy);
  assertBalances(interp);
}

// ---------------------------------------------------------------------------
// BOND — fixtures
// ---------------------------------------------------------------------------

function bondTrade(over: Record<string, unknown>) {
  return {
    tradeId: "BND-T1",
    bondIsin: "ZAG000149037",
    side: "buy" as const,
    nominalMinor: 10_000_000,
    cleanPricePercent: 97.5,
    accruedInterestMinor: 50_000,
    dirtyPricePercent: 98.0,
    settlementDate: "2026-06-08",
    portfolio: "banking-book" as const,
    couponRate: 0.085,
    maturityDate: "2030-01-01",
    currency: "ZAR",
    counterpartyLei: "LEI-CP",
    executedAt: ASOF,
    ...over,
  };
}

/** Booking enrichment exactly as the production cutover bridge supplies it. */
function bookingEnrichment(payload: ReturnType<typeof bondTrade>) {
  return { dirtyPriceAmountMinor: bondDirtyPriceAmountMinor(payload as never) };
}

describe("BOND booking (PR-BOND-001) — banking vs trading, buy/sell parity", () => {
  it("banking-book buy — byte-for-byte", () => {
    const p = bondTrade({ portfolio: "banking-book", side: "buy", dirtyPricePercent: 98.0 });
    expectParity("BondTradeExecuted", p, bondBankingBookJournals(p as never), bookingEnrichment(p));
  });
  it("banking-book sell — byte-for-byte", () => {
    const p = bondTrade({ portfolio: "banking-book", side: "sell", dirtyPricePercent: 101.25 });
    expectParity("BondTradeExecuted", p, bondBankingBookJournals(p as never), bookingEnrichment(p));
  });
  it("trading-book buy — byte-for-byte", () => {
    const p = bondTrade({
      portfolio: "trading-book",
      side: "buy",
      nominalMinor: 5_000_000,
      dirtyPricePercent: 99.4,
    });
    expectParity("BondTradeExecuted", p, bondTradingBookJournals(p as never), bookingEnrichment(p));
  });
  it("trading-book sell — byte-for-byte", () => {
    const p = bondTrade({
      portfolio: "trading-book",
      side: "sell",
      nominalMinor: 5_000_000,
      dirtyPricePercent: 99.4,
    });
    expectParity("BondTradeExecuted", p, bondTradingBookJournals(p as never), bookingEnrichment(p));
  });
});

describe("BOND EIR accrual (PR-BOND-EIR) — parity", () => {
  it("non-zero accrual — byte-for-byte", () => {
    const p = {
      tradeId: "BND-T1",
      bondIsin: "ZAG000149037",
      accrualDate: "2026-06-05",
      accruedInterestMinor: 23_288,
      eirRate: 0.0873,
      openingCarryingAmountMinor: 9_800_000,
      closingCarryingAmountMinor: 9_810_000,
      currency: "ZAR",
    };
    expectParity("BondInterestAccrued", p, bondInterestAccrualJournals(p as never));
  });
  it("zero accrual — both produce no posting (intentional-no-impact)", () => {
    const p = {
      tradeId: "BND-T1",
      bondIsin: "ZAG000149037",
      accrualDate: "2026-06-05",
      accruedInterestMinor: 0,
      eirRate: 0.0873,
      openingCarryingAmountMinor: 9_800_000,
      closingCarryingAmountMinor: 9_800_000,
      currency: "ZAR",
    };
    expect(bondInterestAccrualJournals(p as never)).toEqual([]);
    expect(runOne("BondInterestAccrued", p).outcome).toBe("intentional-no-impact");
  });
});

describe("BOND FVTPL revaluation (PR-BOND-002) — parity", () => {
  function reval(pnl: number) {
    return {
      tradeId: "BND-T1",
      bondIsin: "ZAG000149037",
      revalDate: "2026-06-05",
      bookCleanPricePercent: 97.5,
      currentCleanPricePercent: 98.1,
      unrealisedPnlZarMinor: pnl,
      currency: "ZAR",
    };
  }
  it("gain — byte-for-byte", () => {
    const p = reval(60_000);
    expectParity("BondPositionRevalued", p, bondRevaluationJournals(p as never));
  });
  it("loss — byte-for-byte", () => {
    const p = reval(-42_500);
    expectParity("BondPositionRevalued", p, bondRevaluationJournals(p as never));
  });
  it("zero delta — both produce no posting (intentional-no-impact)", () => {
    const p = reval(0);
    expect(bondRevaluationJournals(p as never)).toEqual([]);
    expect(runOne("BondPositionRevalued", p).outcome).toBe("intentional-no-impact");
  });
});

describe("BOND maturity (PR-BOND-MAT) — parity (portfolio via enrichment)", () => {
  function matured(finalCoupon: number) {
    return {
      tradeId: "BND-T1",
      bondIsin: "ZAG000149037",
      maturityDate: "2030-01-01",
      nominalRepaidMinor: 10_000_000,
      finalCouponMinor: finalCoupon,
      currency: "ZAR",
    };
  }
  it("banking-book with final coupon — byte-for-byte", () => {
    const p = matured(425_000);
    expectParity("BondMatured", p, bondMaturityJournals(p as never, "banking-book"), {
      portfolio: "banking-book",
    });
  });
  it("trading-book with final coupon — byte-for-byte", () => {
    const p = matured(425_000);
    expectParity("BondMatured", p, bondMaturityJournals(p as never, "trading-book"), {
      portfolio: "trading-book",
    });
  });
  it("banking-book zero coupon — byte-for-byte (no accrued-interest leg)", () => {
    const p = matured(0);
    expectParity("BondMatured", p, bondMaturityJournals(p as never, "banking-book"), {
      portfolio: "banking-book",
    });
  });
});

describe("BOND sale (PR-BOND-SALE) — parity (portfolio via enrichment)", () => {
  function sold(proceeds: number, carrying: number, pnl: number) {
    return {
      tradeId: "BND-T1",
      bondIsin: "ZAG000149037",
      side: "sell" as const,
      saleProceedsMinor: proceeds,
      carryingAmountAtSaleMinor: carrying,
      realisedPnlMinor: pnl,
      settlementDate: "2026-06-08",
      currency: "ZAR",
    };
  }
  for (const portfolio of ["banking-book", "trading-book"] as const) {
    it(`${portfolio} gain — byte-for-byte`, () => {
      const p = sold(9_900_000, 9_800_000, 100_000);
      expectParity("BondSold", p, bondSaleJournals(p as never, portfolio), { portfolio });
    });
    it(`${portfolio} loss — byte-for-byte`, () => {
      const p = sold(9_700_000, 9_800_000, -100_000);
      expectParity("BondSold", p, bondSaleJournals(p as never, portfolio), { portfolio });
    });
    it(`${portfolio} break-even — byte-for-byte`, () => {
      const p = sold(9_800_000, 9_800_000, 0);
      expectParity("BondSold", p, bondSaleJournals(p as never, portfolio), { portfolio });
    });
  }
});

// ---------------------------------------------------------------------------
// EQUITY — fixtures
// ---------------------------------------------------------------------------

describe("EQUITY booking (PR-EQ-001) — parity", () => {
  it("FVTPL booking — byte-for-byte", () => {
    const p = {
      tradeId: { scheme: "internal", value: "EQ-T1" },
      orderId: "ORD-1",
      instrument: { class: "listed-equity", identifier: { value: "SBK" } },
      side: "buy" as const,
      quantity: { unit: "shares", value: 1000 },
      executionPrice: { amountMinor: 18_500, currency: "ZAR" },
      consideration: { amountMinor: 18_500_000, currency: "ZAR" },
      executedAt: ASOF,
      venue: "JSE" as const,
      bookId: "EQ-BOOK",
      counterparty: { scheme: "lei", value: "LEI-CP" },
      traderRef: "TRADER-1",
    };
    expectParity("EquityTradeExecuted", p, equityTradeBookingJournals(p as never));
  });
});

describe("EQUITY revaluation (PR-EQ-002) — parity", () => {
  function reval(pnl: number) {
    return {
      tradeId: { scheme: "internal", value: "EQ-T1" },
      instrument: { class: "listed-equity", identifier: { value: "SBK" } },
      valuationDate: "2026-06-05",
      closingPrice: { amountMinor: 19_000, currency: "ZAR" },
      quantity: { unit: "shares", value: 1000 },
      bookValue: { amountMinor: 18_500_000, currency: "ZAR" },
      marketValue: { amountMinor: 18_500_000 + pnl, currency: "ZAR" },
      unrealisedPnl: { amountMinor: pnl, currency: "ZAR" },
    };
  }
  it("gain — byte-for-byte", () => {
    const p = reval(500_000);
    expectParity("EquityPositionRevalued", p, equityRevaluationJournals(p as never));
  });
  it("loss — byte-for-byte", () => {
    const p = reval(-350_000);
    expectParity("EquityPositionRevalued", p, equityRevaluationJournals(p as never));
  });
  it("zero delta — both produce no posting (intentional-no-impact)", () => {
    const p = reval(0);
    expect(equityRevaluationJournals(p as never)).toEqual([]);
    expect(runOne("EquityPositionRevalued", p).outcome).toBe("intentional-no-impact");
  });
});

describe("EQUITY dividend (PR-EQ-CA) — parity", () => {
  function dividend(gross: number, wht: number) {
    return {
      tradeId: "EQ-T1",
      instrumentId: "SBK",
      quantity: 1000,
      grossDividendPerShareMinor: gross === 0 ? 0 : Math.round(gross / 1000),
      grossDividendTotalMinor: gross,
      withholdingTaxRate: 0.2,
      withholdingTaxMinor: wht,
      netDividendMinor: gross - wht,
      exDividendDate: "2026-06-04",
      paymentDate: "2026-06-20",
      currency: "ZAR",
    };
  }
  it("with WHT — byte-for-byte", () => {
    const p = dividend(500_000, 100_000);
    expectParity("EquityDividendAccrued", p, equityDividendJournals(p as never));
  });
  it("without WHT — byte-for-byte", () => {
    const p = dividend(500_000, 0);
    expectParity("EquityDividendAccrued", p, equityDividendJournals(p as never));
  });
  it("zero gross — both produce no posting (intentional-no-impact)", () => {
    const p = dividend(0, 0);
    expect(equityDividendJournals(p as never)).toEqual([]);
    expect(runOne("EquityDividendAccrued", p).outcome).toBe("intentional-no-impact");
  });
});

describe("EQUITY sale (PR-EQ-004) — parity (FVTPL P&L vs FVOCI OCI split)", () => {
  function sold(classification: "fvtpl" | "fvoci", proceeds: number, carrying: number, pnl: number) {
    return {
      tradeId: "EQ-T1",
      instrumentId: "SBK",
      classification,
      quantity: 1000,
      salePricePerShareMinor: Math.round(proceeds / 1000),
      saleProceedsMinor: proceeds,
      carryingAmountAtSaleMinor: carrying,
      realisedPnlMinor: pnl,
      settlementDate: "2026-06-08",
      currency: "ZAR",
    };
  }
  for (const cls of ["fvtpl", "fvoci"] as const) {
    it(`${cls} gain — byte-for-byte`, () => {
      const p = sold(cls, 19_000_000, 18_500_000, 500_000);
      expectParity("EquitySold", p, equitySaleJournals(p as never));
    });
    it(`${cls} loss — byte-for-byte`, () => {
      const p = sold(cls, 18_100_000, 18_500_000, -400_000);
      expectParity("EquitySold", p, equitySaleJournals(p as never));
    });
    it(`${cls} break-even — byte-for-byte`, () => {
      const p = sold(cls, 18_500_000, 18_500_000, 0);
      expectParity("EquitySold", p, equitySaleJournals(p as never));
    });
  }
});
