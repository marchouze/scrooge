// tests/sla-securities-lifecycle-interpreter.test.ts
//
// Interpreter-side leg-correctness regression for the securities (bond + equity)
// product family. The durable guard that the rules-as-data SLA interpreter
// (SECURITIES_IFRS_RULES) produces the CORRECT double-entry legs for every
// securities lifecycle stage. It replaces the retired byte-for-byte parallel-run
// suite (the legacy bonds.ts / equities.ts posting-rule functions were the dead
// reference oracle, retired with the legacy GL posting engine in SLA
// full-retirement Stage 3). The expected legs below are the interpreter's own
// output — which the now-retired parallel-run proved equal to the legacy engine
// (JSE bonds + equities are ZAR, parity was exact).
//
// Stages covered:
//   BOND:   booking (banking-book buy/sell, trading-book buy/sell) /
//           EIR accrual (non-zero, zero) / FVTPL revaluation (gain, loss, zero) /
//           maturity (with final coupon, zero coupon; banking + trading) /
//           sale (gain, loss, break-even; banking + trading).
//   EQUITY: booking (FVTPL) / revaluation (gain, loss, zero) /
//           dividend (with WHT, without WHT, zero gross) /
//           sale (FVTPL P&L vs FVOCI OCI split, §5.7.5 no-recycling).
//
// The bond booking amount `Math.round(nominalMinor * dirtyPricePercent / 100)`
// is a float-derived integer the integer-only sandbox cannot compute; it is
// supplied as `enrichment.dirtyPriceAmountMinor` (via `bondDirtyPriceAmountMinor`)
// exactly as the production cutover bridge does.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Stage 3, CEO-approved —
//            standing decision; Marc in-session 2026-06-08).

import { describe, expect, it } from "bun:test";

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

/** Assert the interpreter produces exactly `expected` legs (+ balanced). */
function expectInterpreterLegs(
  type: string,
  payload: unknown,
  expected: NormalLeg[],
  enrichment?: unknown,
): void {
  const interp = interpLegs(runOne(type, payload, enrichment));
  expect(interp).toEqual(expected);
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

describe("BOND booking (PR-BOND-001) — banking vs trading, buy/sell", () => {
  it("banking-book buy", () => {
    const p = bondTrade({ portfolio: "banking-book", side: "buy", dirtyPricePercent: 98.0 });
    expectInterpreterLegs(
      "BondTradeExecuted",
      p,
      [
        {
          accountId: "ACC-3100-001",
          debitCredit: "debit",
          amountMinor: 9_800_000,
          currency: "ZAR",
        },
        {
          accountId: "ACC-1200-001",
          debitCredit: "credit",
          amountMinor: 9_800_000,
          currency: "ZAR",
        },
      ],
      bookingEnrichment(p),
    );
  });
  it("banking-book sell", () => {
    const p = bondTrade({ portfolio: "banking-book", side: "sell", dirtyPricePercent: 101.25 });
    expectInterpreterLegs(
      "BondTradeExecuted",
      p,
      [
        {
          accountId: "ACC-1200-001",
          debitCredit: "debit",
          amountMinor: 10_125_000,
          currency: "ZAR",
        },
        {
          accountId: "ACC-3100-001",
          debitCredit: "credit",
          amountMinor: 10_125_000,
          currency: "ZAR",
        },
      ],
      bookingEnrichment(p),
    );
  });
  it("trading-book buy", () => {
    const p = bondTrade({
      portfolio: "trading-book",
      side: "buy",
      nominalMinor: 5_000_000,
      dirtyPricePercent: 99.4,
    });
    expectInterpreterLegs(
      "BondTradeExecuted",
      p,
      [
        {
          accountId: "ACC-3100-002",
          debitCredit: "debit",
          amountMinor: 4_970_000,
          currency: "ZAR",
        },
        {
          accountId: "ACC-1200-001",
          debitCredit: "credit",
          amountMinor: 4_970_000,
          currency: "ZAR",
        },
      ],
      bookingEnrichment(p),
    );
  });
  it("trading-book sell", () => {
    const p = bondTrade({
      portfolio: "trading-book",
      side: "sell",
      nominalMinor: 5_000_000,
      dirtyPricePercent: 99.4,
    });
    expectInterpreterLegs(
      "BondTradeExecuted",
      p,
      [
        {
          accountId: "ACC-1200-001",
          debitCredit: "debit",
          amountMinor: 4_970_000,
          currency: "ZAR",
        },
        {
          accountId: "ACC-3100-002",
          debitCredit: "credit",
          amountMinor: 4_970_000,
          currency: "ZAR",
        },
      ],
      bookingEnrichment(p),
    );
  });
});

describe("BOND EIR accrual (PR-BOND-EIR)", () => {
  it("non-zero accrual", () => {
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
    expectInterpreterLegs("BondInterestAccrued", p, [
      { accountId: "ACC-3100-003", debitCredit: "debit", amountMinor: 23_288, currency: "ZAR" },
      { accountId: "ACC-4101-001", debitCredit: "credit", amountMinor: 23_288, currency: "ZAR" },
    ]);
  });
  it("zero accrual — no posting (intentional-no-impact)", () => {
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
    expect(runOne("BondInterestAccrued", p).outcome).toBe("intentional-no-impact");
  });
});

describe("BOND FVTPL revaluation (PR-BOND-002)", () => {
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
  it("gain", () => {
    expectInterpreterLegs("BondPositionRevalued", reval(60_000), [
      { accountId: "ACC-3100-002", debitCredit: "debit", amountMinor: 60_000, currency: "ZAR" },
      { accountId: "ACC-3100-005", debitCredit: "credit", amountMinor: 60_000, currency: "ZAR" },
    ]);
  });
  it("loss", () => {
    expectInterpreterLegs("BondPositionRevalued", reval(-42_500), [
      { accountId: "ACC-3100-005", debitCredit: "debit", amountMinor: 42_500, currency: "ZAR" },
      { accountId: "ACC-3100-002", debitCredit: "credit", amountMinor: 42_500, currency: "ZAR" },
    ]);
  });
  it("zero delta — no posting (intentional-no-impact)", () => {
    expect(runOne("BondPositionRevalued", reval(0)).outcome).toBe("intentional-no-impact");
  });
});

describe("BOND maturity (PR-BOND-MAT) — portfolio via enrichment", () => {
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
  it("banking-book with final coupon", () => {
    expectInterpreterLegs(
      "BondMatured",
      matured(425_000),
      [
        {
          accountId: "ACC-1200-001",
          debitCredit: "debit",
          amountMinor: 10_425_000,
          currency: "ZAR",
        },
        { accountId: "ACC-3100-003", debitCredit: "credit", amountMinor: 425_000, currency: "ZAR" },
        {
          accountId: "ACC-3100-001",
          debitCredit: "credit",
          amountMinor: 10_000_000,
          currency: "ZAR",
        },
      ],
      { portfolio: "banking-book" },
    );
  });
  it("trading-book with final coupon", () => {
    expectInterpreterLegs(
      "BondMatured",
      matured(425_000),
      [
        {
          accountId: "ACC-1200-001",
          debitCredit: "debit",
          amountMinor: 10_425_000,
          currency: "ZAR",
        },
        { accountId: "ACC-3100-003", debitCredit: "credit", amountMinor: 425_000, currency: "ZAR" },
        {
          accountId: "ACC-3100-002",
          debitCredit: "credit",
          amountMinor: 10_000_000,
          currency: "ZAR",
        },
      ],
      { portfolio: "trading-book" },
    );
  });
  it("banking-book zero coupon — no accrued-interest leg", () => {
    expectInterpreterLegs(
      "BondMatured",
      matured(0),
      [
        {
          accountId: "ACC-1200-001",
          debitCredit: "debit",
          amountMinor: 10_000_000,
          currency: "ZAR",
        },
        {
          accountId: "ACC-3100-001",
          debitCredit: "credit",
          amountMinor: 10_000_000,
          currency: "ZAR",
        },
      ],
      { portfolio: "banking-book" },
    );
  });
});

describe("BOND sale (PR-BOND-SALE) — portfolio via enrichment", () => {
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
  const ASSET_BY_PORTFOLIO: Record<"banking-book" | "trading-book", string> = {
    "banking-book": "ACC-3100-001",
    "trading-book": "ACC-3100-002",
  };
  for (const portfolio of ["banking-book", "trading-book"] as const) {
    it(`${portfolio} gain`, () => {
      expectInterpreterLegs(
        "BondSold",
        sold(9_900_000, 9_800_000, 100_000),
        [
          {
            accountId: "ACC-1200-001",
            debitCredit: "debit",
            amountMinor: 9_900_000,
            currency: "ZAR",
          },
          {
            accountId: ASSET_BY_PORTFOLIO[portfolio],
            debitCredit: "credit",
            amountMinor: 9_800_000,
            currency: "ZAR",
          },
          {
            accountId: "ACC-3100-006",
            debitCredit: "credit",
            amountMinor: 100_000,
            currency: "ZAR",
          },
        ],
        { portfolio },
      );
    });
    it(`${portfolio} loss`, () => {
      expectInterpreterLegs(
        "BondSold",
        sold(9_700_000, 9_800_000, -100_000),
        [
          {
            accountId: "ACC-1200-001",
            debitCredit: "debit",
            amountMinor: 9_700_000,
            currency: "ZAR",
          },
          {
            accountId: "ACC-3100-006",
            debitCredit: "debit",
            amountMinor: 100_000,
            currency: "ZAR",
          },
          {
            accountId: ASSET_BY_PORTFOLIO[portfolio],
            debitCredit: "credit",
            amountMinor: 9_800_000,
            currency: "ZAR",
          },
        ],
        { portfolio },
      );
    });
    it(`${portfolio} break-even`, () => {
      expectInterpreterLegs(
        "BondSold",
        sold(9_800_000, 9_800_000, 0),
        [
          {
            accountId: "ACC-1200-001",
            debitCredit: "debit",
            amountMinor: 9_800_000,
            currency: "ZAR",
          },
          {
            accountId: ASSET_BY_PORTFOLIO[portfolio],
            debitCredit: "credit",
            amountMinor: 9_800_000,
            currency: "ZAR",
          },
        ],
        { portfolio },
      );
    });
  }
});

// ---------------------------------------------------------------------------
// EQUITY — fixtures
// ---------------------------------------------------------------------------

describe("EQUITY booking (PR-EQ-001)", () => {
  it("FVTPL booking", () => {
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
    expectInterpreterLegs("EquityTradeExecuted", p, [
      { accountId: "ACC-3200-001", debitCredit: "debit", amountMinor: 18_500_000, currency: "ZAR" },
      {
        accountId: "ACC-1200-001",
        debitCredit: "credit",
        amountMinor: 18_500_000,
        currency: "ZAR",
      },
    ]);
  });
});

describe("EQUITY revaluation (PR-EQ-002)", () => {
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
  it("gain", () => {
    expectInterpreterLegs("EquityPositionRevalued", reval(500_000), [
      { accountId: "ACC-3200-001", debitCredit: "debit", amountMinor: 500_000, currency: "ZAR" },
      { accountId: "ACC-3200-003", debitCredit: "credit", amountMinor: 500_000, currency: "ZAR" },
    ]);
  });
  it("loss", () => {
    expectInterpreterLegs("EquityPositionRevalued", reval(-350_000), [
      { accountId: "ACC-3200-003", debitCredit: "debit", amountMinor: 350_000, currency: "ZAR" },
      { accountId: "ACC-3200-001", debitCredit: "credit", amountMinor: 350_000, currency: "ZAR" },
    ]);
  });
  it("zero delta — no posting (intentional-no-impact)", () => {
    expect(runOne("EquityPositionRevalued", reval(0)).outcome).toBe("intentional-no-impact");
  });
});

describe("EQUITY dividend (PR-EQ-CA)", () => {
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
  it("with WHT", () => {
    expectInterpreterLegs("EquityDividendAccrued", dividend(500_000, 100_000), [
      { accountId: "ACC-3200-005", debitCredit: "debit", amountMinor: 400_000, currency: "ZAR" },
      { accountId: "ACC-3200-007", debitCredit: "debit", amountMinor: 100_000, currency: "ZAR" },
      { accountId: "ACC-3200-006", debitCredit: "credit", amountMinor: 500_000, currency: "ZAR" },
    ]);
  });
  it("without WHT", () => {
    expectInterpreterLegs("EquityDividendAccrued", dividend(500_000, 0), [
      { accountId: "ACC-3200-005", debitCredit: "debit", amountMinor: 500_000, currency: "ZAR" },
      { accountId: "ACC-3200-006", debitCredit: "credit", amountMinor: 500_000, currency: "ZAR" },
    ]);
  });
  it("zero gross — no posting (intentional-no-impact)", () => {
    expect(runOne("EquityDividendAccrued", dividend(0, 0)).outcome).toBe("intentional-no-impact");
  });
});

describe("EQUITY sale (PR-EQ-004) — FVTPL P&L vs FVOCI OCI split", () => {
  function sold(
    classification: "fvtpl" | "fvoci",
    proceeds: number,
    carrying: number,
    pnl: number,
  ) {
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
  // FVTPL: realised P&L recycles to P&L (ACC-3200-003). FVOCI: §5.7.5 no-
  // recycling — the realised gain/loss is parked in OCI (ACC-3200-004) and
  // transferred within equity to retained earnings (ACC-5000-002), never P&L.
  it("fvtpl gain", () => {
    expectInterpreterLegs("EquitySold", sold("fvtpl", 19_000_000, 18_500_000, 500_000), [
      { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 19_000_000, currency: "ZAR" },
      {
        accountId: "ACC-3200-001",
        debitCredit: "credit",
        amountMinor: 18_500_000,
        currency: "ZAR",
      },
      { accountId: "ACC-3200-003", debitCredit: "credit", amountMinor: 500_000, currency: "ZAR" },
    ]);
  });
  it("fvtpl loss", () => {
    expectInterpreterLegs("EquitySold", sold("fvtpl", 18_100_000, 18_500_000, -400_000), [
      { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 18_100_000, currency: "ZAR" },
      {
        accountId: "ACC-3200-001",
        debitCredit: "credit",
        amountMinor: 18_500_000,
        currency: "ZAR",
      },
      { accountId: "ACC-3200-003", debitCredit: "debit", amountMinor: 400_000, currency: "ZAR" },
    ]);
  });
  it("fvtpl break-even", () => {
    expectInterpreterLegs("EquitySold", sold("fvtpl", 18_500_000, 18_500_000, 0), [
      { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 18_500_000, currency: "ZAR" },
      {
        accountId: "ACC-3200-001",
        debitCredit: "credit",
        amountMinor: 18_500_000,
        currency: "ZAR",
      },
    ]);
  });
  it("fvoci gain — OCI parked + transferred within equity (no P&L recycle)", () => {
    expectInterpreterLegs("EquitySold", sold("fvoci", 19_000_000, 18_500_000, 500_000), [
      { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 19_000_000, currency: "ZAR" },
      {
        accountId: "ACC-3200-002",
        debitCredit: "credit",
        amountMinor: 18_500_000,
        currency: "ZAR",
      },
      { accountId: "ACC-3200-004", debitCredit: "credit", amountMinor: 500_000, currency: "ZAR" },
      { accountId: "ACC-3200-004", debitCredit: "debit", amountMinor: 500_000, currency: "ZAR" },
      { accountId: "ACC-5000-002", debitCredit: "credit", amountMinor: 500_000, currency: "ZAR" },
    ]);
  });
  it("fvoci loss — OCI parked + transferred within equity (no P&L recycle)", () => {
    expectInterpreterLegs("EquitySold", sold("fvoci", 18_100_000, 18_500_000, -400_000), [
      { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 18_100_000, currency: "ZAR" },
      {
        accountId: "ACC-3200-002",
        debitCredit: "credit",
        amountMinor: 18_500_000,
        currency: "ZAR",
      },
      { accountId: "ACC-3200-004", debitCredit: "debit", amountMinor: 400_000, currency: "ZAR" },
      { accountId: "ACC-5000-002", debitCredit: "debit", amountMinor: 400_000, currency: "ZAR" },
      { accountId: "ACC-3200-004", debitCredit: "credit", amountMinor: 400_000, currency: "ZAR" },
    ]);
  });
  it("fvoci break-even", () => {
    expectInterpreterLegs("EquitySold", sold("fvoci", 18_500_000, 18_500_000, 0), [
      { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 18_500_000, currency: "ZAR" },
      {
        accountId: "ACC-3200-002",
        debitCredit: "credit",
        amountMinor: 18_500_000,
        currency: "ZAR",
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Schema conformance — every ported securities rule satisfies the contract.
// ---------------------------------------------------------------------------

describe("SECURITIES_IFRS_RULES schema conformance", () => {
  it("every rule carries the schema-required fields + valid enums", () => {
    for (const rule of SECURITIES_IFRS_RULES) {
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
    const ids = SECURITIES_IFRS_RULES.map((r) => r.rule_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
