// tests/sla-treasury-lifecycle-interpreter.test.ts
//
// Interpreter-side leg-correctness regression for the treasury money-market
// product family (deposit / funding-line / interbank-loan / repo). The durable
// guard that the rules-as-data SLA interpreter (TREASURY_IFRS_RULES) produces the
// CORRECT double-entry legs for every treasury lifecycle stage. It replaces the
// retired byte-for-byte parallel-run suite (the legacy repo-mmd-ibl.ts posting-
// rule functions were the dead reference oracle, retired with the legacy GL
// posting engine in SLA full-retirement Stage 3). The expected legs below are the
// interpreter's own output — which the now-retired parallel-run proved equal to
// the legacy engine (the treasury family is predominantly ZAR, parity was exact).
//
// Stages covered, per instrument:
//   MMD:      recognition (4 categories) / accrual (non-zero, zero) /
//             maturity (interest, zero-interest) / early-withdrawal
//             (penalty, no-penalty, no-enrichment → no-GL).
//   FUNDING:  drawdown / repayment.
//   IBL:      recognition (call, fixed) / accrual / maturity (interest,
//             zero-interest) / recall (with enrichment, no-enrichment → no-GL).
//   REPO:     recognition / start-leg (memo) / accrual (non-zero, zero) /
//             end-leg / early-termination (with enrichment, no-enrichment →
//             no-GL).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Stage 3, CEO-approved —
//            standing decision; Marc in-session 2026-06-08).

import { describe, expect, it } from "bun:test";

import { type InterpretResult, interpret } from "../platform/accounting/sla/interpreter";
import { TREASURY_IFRS_RULES } from "../platform/accounting/sla/rules/treasury-index";

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
    TREASURY_IFRS_RULES,
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
// MMD / DEPOSIT
// ---------------------------------------------------------------------------

const DEPOSIT_CATEGORIES = [
  "retail-stable",
  "retail-less-stable",
  "wholesale-operational",
  "wholesale-non-operational",
] as const;

// Each deposit category books the liability to its own ledger account.
const MMD_LIABILITY_BY_CATEGORY: Record<(typeof DEPOSIT_CATEGORIES)[number], string> = {
  "retail-stable": "ACC-6100-001",
  "retail-less-stable": "ACC-6100-002",
  "wholesale-operational": "ACC-6100-003",
  "wholesale-non-operational": "ACC-6100-004",
};

describe("MMD recognition (PR-MMD-001) — per-category liability account", () => {
  for (const category of DEPOSIT_CATEGORIES) {
    it(`DepositTaken ${category}`, () => {
      const payload = {
        depositId: `D-${category}`,
        counterpartyLei: "LEI",
        principalZar: 7_500_000,
        interestRateDecimal: 0.0795,
        maturityDate: "2026-09-01",
        depositCategory: category,
        bookId: "MMD-BOOK",
        instrumentRef: "MMD-ZAR-001",
      };
      expectInterpreterLegs("DepositTaken", payload, [
        { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 7_500_000, currency: "ZAR" },
        {
          accountId: MMD_LIABILITY_BY_CATEGORY[category],
          debitCredit: "credit",
          amountMinor: 7_500_000,
          currency: "ZAR",
        },
      ]);
    });
  }
});

describe("MMD accrual (PR-MMD-ACCRUAL)", () => {
  it("non-zero accrual", () => {
    expectInterpreterLegs(
      "DepositInterestAccrued",
      { depositId: "D1", accruedInterestZar: 1_634, accrualDate: "2026-06-05" },
      [
        { accountId: "ACC-6100-006", debitCredit: "debit", amountMinor: 1_634, currency: "ZAR" },
        { accountId: "ACC-6100-005", debitCredit: "credit", amountMinor: 1_634, currency: "ZAR" },
      ],
    );
  });
  it("zero accrual — no posting (intentional-no-impact)", () => {
    expect(
      runOne("DepositInterestAccrued", {
        depositId: "D1",
        accruedInterestZar: 0,
        accrualDate: "2026-06-05",
      }).outcome,
    ).toBe("intentional-no-impact");
  });
});

describe("MMD maturity (PR-MMD-MAT) — category via enrichment", () => {
  for (const category of DEPOSIT_CATEGORIES) {
    it(`DepositMatured ${category} (with interest)`, () => {
      const payload = { depositId: "D1", principalZar: 7_500_000, interestPaidZar: 49_200 };
      expectInterpreterLegs(
        "DepositMatured",
        payload,
        [
          {
            accountId: MMD_LIABILITY_BY_CATEGORY[category],
            debitCredit: "debit",
            amountMinor: 7_500_000,
            currency: "ZAR",
          },
          { accountId: "ACC-6100-005", debitCredit: "debit", amountMinor: 49_200, currency: "ZAR" },
          {
            accountId: "ACC-1200-001",
            debitCredit: "credit",
            amountMinor: 7_549_200,
            currency: "ZAR",
          },
        ],
        { depositCategory: category },
      );
    });
  }
  it("DepositMatured zero-interest — no accrued-interest leg", () => {
    const payload = { depositId: "D1", principalZar: 7_500_000, interestPaidZar: 0 };
    expectInterpreterLegs(
      "DepositMatured",
      payload,
      [
        { accountId: "ACC-6100-004", debitCredit: "debit", amountMinor: 7_500_000, currency: "ZAR" },
        {
          accountId: "ACC-1200-001",
          debitCredit: "credit",
          amountMinor: 7_500_000,
          currency: "ZAR",
        },
      ],
      { depositCategory: "wholesale-non-operational" },
    );
  });
});

describe("MMD early withdrawal (PR-MMD-CANCEL)", () => {
  it("with penalty", () => {
    const payload = { depositId: "D1", penaltyZar: 22_500 };
    expectInterpreterLegs(
      "DepositWithdrawnEarly",
      payload,
      [
        { accountId: "ACC-6100-001", debitCredit: "debit", amountMinor: 7_500_000, currency: "ZAR" },
        {
          accountId: "ACC-1200-001",
          debitCredit: "credit",
          amountMinor: 7_477_500,
          currency: "ZAR",
        },
        { accountId: "ACC-6100-006", debitCredit: "credit", amountMinor: 22_500, currency: "ZAR" },
      ],
      { depositCategory: "retail-stable", openingPrincipalZar: 7_500_000 },
    );
  });
  it("no penalty", () => {
    const payload = { depositId: "D1", penaltyZar: 0 };
    expectInterpreterLegs(
      "DepositWithdrawnEarly",
      payload,
      [
        { accountId: "ACC-6100-003", debitCredit: "debit", amountMinor: 4_000_000, currency: "ZAR" },
        {
          accountId: "ACC-1200-001",
          debitCredit: "credit",
          amountMinor: 4_000_000,
          currency: "ZAR",
        },
      ],
      { depositCategory: "wholesale-operational", openingPrincipalZar: 4_000_000 },
    );
  });
  it("no enrichment — no posting (intentional-no-impact)", () => {
    expect(runOne("DepositWithdrawnEarly", { depositId: "D1", penaltyZar: 22_500 }).outcome).toBe(
      "intentional-no-impact",
    );
  });
});

// ---------------------------------------------------------------------------
// FUNDING LINE
// ---------------------------------------------------------------------------

describe("Funding line (PR-FUNDING-001 / PR-FUNDING-END)", () => {
  it("FundingLineDrawn", () => {
    expectInterpreterLegs(
      "FundingLineDrawn",
      { fundingLineId: "F1", drawnAmountZar: 25_000_000, maturityDate: "2026-12-01", rateDecimal: 0.085 },
      [
        { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 25_000_000, currency: "ZAR" },
        { accountId: "ACC-6100-004", debitCredit: "credit", amountMinor: 25_000_000, currency: "ZAR" },
      ],
    );
  });
  it("FundingLineRepaid", () => {
    expectInterpreterLegs(
      "FundingLineRepaid",
      { fundingLineId: "F1", repaidAmountZar: 25_000_000 },
      [
        { accountId: "ACC-6100-004", debitCredit: "debit", amountMinor: 25_000_000, currency: "ZAR" },
        { accountId: "ACC-1200-001", debitCredit: "credit", amountMinor: 25_000_000, currency: "ZAR" },
      ],
    );
  });
});

// ---------------------------------------------------------------------------
// INTERBANK LOAN
// ---------------------------------------------------------------------------

const IBL_ASSET_BY_TYPE: Record<"call" | "fixed-term", string> = {
  call: "ACC-7100-001",
  "fixed-term": "ACC-7100-002",
};

describe("IBL recognition (PR-IBL-001) — per-placement-type asset account", () => {
  for (const placementType of ["call", "fixed-term"] as const) {
    it(`InterbankLoanPlaced ${placementType}`, () => {
      const payload = {
        placementId: `P-${placementType}`,
        counterpartyLei: "LEI",
        principalZar: 9_000_000,
        rateDecimal: 0.0825,
        startDate: "2026-06-05",
        maturityDate: placementType === "call" ? null : "2026-09-05",
        placementType,
        bookId: "IBL-BOOK",
        instrumentRef: placementType === "call" ? "IBL-CALL-ZAR-001" : "IBL-FT-ZAR-001",
      };
      expectInterpreterLegs("InterbankLoanPlaced", payload, [
        {
          accountId: IBL_ASSET_BY_TYPE[placementType],
          debitCredit: "debit",
          amountMinor: 9_000_000,
          currency: "ZAR",
        },
        { accountId: "ACC-1200-001", debitCredit: "credit", amountMinor: 9_000_000, currency: "ZAR" },
      ]);
    });
  }
});

describe("IBL accrual (PR-IBL-ACCRUAL)", () => {
  it("non-zero accrual", () => {
    expectInterpreterLegs(
      "InterbankLoanInterestAccrued",
      { placementId: "P1", accruedInterestZar: 2_034, accrualDate: "2026-06-05" },
      [
        { accountId: "ACC-7100-003", debitCredit: "debit", amountMinor: 2_034, currency: "ZAR" },
        { accountId: "ACC-7100-004", debitCredit: "credit", amountMinor: 2_034, currency: "ZAR" },
      ],
    );
  });
  it("zero accrual — no posting (intentional-no-impact)", () => {
    expect(
      runOne("InterbankLoanInterestAccrued", {
        placementId: "P1",
        accruedInterestZar: 0,
        accrualDate: "2026-06-05",
      }).outcome,
    ).toBe("intentional-no-impact");
  });
});

describe("IBL maturity (PR-IBL-MAT) — placement type via enrichment", () => {
  for (const placementType of ["call", "fixed-term"] as const) {
    it(`InterbankLoanMatured ${placementType} (with interest)`, () => {
      const payload = { placementId: "P1", principalZar: 9_000_000, interestReceivedZar: 61_200 };
      expectInterpreterLegs(
        "InterbankLoanMatured",
        payload,
        [
          {
            accountId: "ACC-1200-001",
            debitCredit: "debit",
            amountMinor: 9_061_200,
            currency: "ZAR",
          },
          {
            accountId: IBL_ASSET_BY_TYPE[placementType],
            debitCredit: "credit",
            amountMinor: 9_000_000,
            currency: "ZAR",
          },
          { accountId: "ACC-7100-003", debitCredit: "credit", amountMinor: 61_200, currency: "ZAR" },
        ],
        { placementType },
      );
    });
  }
  it("InterbankLoanMatured zero-interest — no accrued-interest leg", () => {
    const payload = { placementId: "P1", principalZar: 9_000_000, interestReceivedZar: 0 };
    expectInterpreterLegs(
      "InterbankLoanMatured",
      payload,
      [
        { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 9_000_000, currency: "ZAR" },
        { accountId: "ACC-7100-002", debitCredit: "credit", amountMinor: 9_000_000, currency: "ZAR" },
      ],
      { placementType: "fixed-term" },
    );
  });
});

describe("IBL recall (PR-IBL-RECALL)", () => {
  it("no enrichment — no posting (intentional-no-impact)", () => {
    expect(runOne("InterbankLoanRecalledEarly", { placementId: "P1" }).outcome).toBe(
      "intentional-no-impact",
    );
  });
  it("with enrichment — principal returned (Dr nostro / Cr due-from-banks), balanced", () => {
    const interp = interpLegs(
      runOne("InterbankLoanRecalledEarly", { placementId: "P1" }, {
        placementType: "fixed-term",
        openingPrincipalZar: 9_000_000,
      }),
    );
    expect(interp).toEqual([
      { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 9_000_000, currency: "ZAR" },
      { accountId: "ACC-7100-002", debitCredit: "credit", amountMinor: 9_000_000, currency: "ZAR" },
    ]);
    assertBalances(interp);
  });
});

// ---------------------------------------------------------------------------
// REPO
// ---------------------------------------------------------------------------

describe("Repo (PR-REPO-*)", () => {
  const opened = {
    tradeId: "R1",
    counterpartyLei: "LEI",
    startLegSettlementDate: "2026-06-05",
    endLegSettlementDate: "2026-06-12",
    startLegCashZar: 12_000_000,
    repurchasePriceZar: 12_098_400,
    repoRateDecimal: 0.082,
    collateralIsin: "ZAG000000001",
    collateralFaceValue: 12_600_000,
    collateralHaircutPct: 2,
    bookId: "REPO-BOOK",
    traderRef: "trader-1",
    instrumentRef: "REPO-ZAR-001",
  };

  it("RepoTradeOpened", () => {
    expectInterpreterLegs("RepoTradeOpened", opened, [
      { accountId: "ACC-5100-001", debitCredit: "debit", amountMinor: 12_000_000, currency: "ZAR" },
      { accountId: "ACC-1200-001", debitCredit: "credit", amountMinor: 12_000_000, currency: "ZAR" },
    ]);
  });

  it("RepoStartLegSettled — no posting (intentional-no-impact memo)", () => {
    expect(runOne("RepoStartLegSettled", { tradeId: "R1", cashZar: 12_000_000 }).outcome).toBe(
      "intentional-no-impact",
    );
  });

  it("RepoInterestAccrued non-zero", () => {
    expectInterpreterLegs(
      "RepoInterestAccrued",
      { tradeId: "R1", accruedInterestZar: 14_057, accrualDate: "2026-06-06" },
      [
        { accountId: "ACC-5100-004", debitCredit: "debit", amountMinor: 14_057, currency: "ZAR" },
        { accountId: "ACC-5100-005", debitCredit: "credit", amountMinor: 14_057, currency: "ZAR" },
      ],
    );
  });
  it("RepoInterestAccrued zero — no posting (intentional-no-impact)", () => {
    expect(
      runOne("RepoInterestAccrued", {
        tradeId: "R1",
        accruedInterestZar: 0,
        accrualDate: "2026-06-06",
      }).outcome,
    ).toBe("intentional-no-impact");
  });

  it("RepoEndLegSettled", () => {
    expectInterpreterLegs(
      "RepoEndLegSettled",
      { tradeId: "R1", repurchasePriceZar: 12_098_400 },
      [
        { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 12_098_400, currency: "ZAR" },
        { accountId: "ACC-5100-001", debitCredit: "credit", amountMinor: 12_098_400, currency: "ZAR" },
      ],
    );
  });

  it("RepoTradeTerminatedEarly no enrichment — no posting (intentional-no-impact)", () => {
    expect(
      runOne("RepoTradeTerminatedEarly", { tradeId: "R1", reason: "counterparty unwind" }).outcome,
    ).toBe("intentional-no-impact");
  });
  it("RepoTradeTerminatedEarly with enrichment — reversal (Dr nostro / Cr repo asset), balanced", () => {
    const interp = interpLegs(
      runOne("RepoTradeTerminatedEarly", { tradeId: "R1", reason: "counterparty unwind" }, {
        unwindCashZar: 12_000_000,
      }),
    );
    expect(interp).toEqual([
      { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 12_000_000, currency: "ZAR" },
      { accountId: "ACC-5100-001", debitCredit: "credit", amountMinor: 12_000_000, currency: "ZAR" },
    ]);
    assertBalances(interp);
  });
});

// ---------------------------------------------------------------------------
// Schema conformance — every ported treasury rule satisfies the contract.
// ---------------------------------------------------------------------------

describe("TREASURY_IFRS_RULES schema conformance", () => {
  it("every rule carries the schema-required fields + valid enums", () => {
    for (const rule of TREASURY_IFRS_RULES) {
      expect(rule.rule_id.startsWith("PR-")).toBe(true);
      expect(["IFRS", "SARB-BA-RETURN", "ZA-TAX"]).toContain(rule.representation);
      expect(rule.version).toBeGreaterThanOrEqual(1);
      expect(rule.effective_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(rule.applies_to.event_type.length).toBeGreaterThan(0);
      expect(["always", "non-zero-delta", "non-zero-pnl", "intentional-no-impact"]).toContain(
        rule.condition.kind,
      );
      if (rule.condition.kind === "non-zero-delta" || rule.condition.kind === "non-zero-pnl") {
        expect(rule.condition.delta_path).toBeDefined();
      }
      expect(rule.balancing).toBe("assert_zero");
      expect(rule.cites.length).toBeGreaterThan(0);
    }
  });

  it("rule ids are unique", () => {
    const ids = TREASURY_IFRS_RULES.map((r) => r.rule_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
