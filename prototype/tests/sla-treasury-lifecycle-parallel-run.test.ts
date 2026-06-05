// tests/sla-treasury-lifecycle-parallel-run.test.ts
//
// Full-retirement Batch 1 — byte-for-byte parity regression (brief deliverable
// 3). Every treasury money-market lifecycle event (deposit / funding-line /
// interbank-loan / repo) is fed through BOTH the rules-as-data SLA interpreter
// (TREASURY_IFRS_RULES) and the legacy posting-rule functions
// (platform/accounting/posting-rules/repo-mmd-ibl.ts).
//
// Success criterion (CEO design call, Marc, 2026-06-05): legacy and interpreter
// MUST agree BYTE-FOR-BYTE at every lifecycle stage. The treasury family is
// predominantly ZAR, so parity holds exactly. The cutover in
// runtime/agents/bea-gl-posting-engine.ts is only safe because this guard is
// green.
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
// Authority: D-SLA-ENGINE-RULES-AS-DATA (full-retirement Batch 1, CEO-approved
//            2026-06-05).

import { describe, expect, it } from "bun:test";

import type { SubLedgerLeg } from "../platform/accounting/fx-accounting-types";
import {
  prFunding001,
  prFundingEnd,
  prIbl001,
  prIblAccrual,
  prIblMat,
  prIblRecall,
  prMmd001,
  prMmdAccrual,
  prMmdCancel,
  prMmdMat,
  prRepo001,
  prRepoAccrual,
  prRepoCancel,
  prRepoEnd,
  prRepoSettleStart,
} from "../platform/accounting/posting-rules/repo-mmd-ibl";
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
// MMD / DEPOSIT
// ---------------------------------------------------------------------------

const DEPOSIT_CATEGORIES = [
  "retail-stable",
  "retail-less-stable",
  "wholesale-operational",
  "wholesale-non-operational",
] as const;

describe("MMD recognition (PR-MMD-001) — per-category parity", () => {
  for (const category of DEPOSIT_CATEGORIES) {
    it(`DepositTaken ${category} — byte-for-byte`, () => {
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
      expectParity("DepositTaken", payload, prMmd001(payload as never));
    });
  }
});

describe("MMD accrual (PR-MMD-ACCRUAL) — parity", () => {
  it("non-zero accrual — byte-for-byte", () => {
    const payload = { depositId: "D1", accruedInterestZar: 1_634, accrualDate: "2026-06-05" };
    expectParity("DepositInterestAccrued", payload, prMmdAccrual(payload as never));
  });
  it("zero accrual — both produce no posting (intentional-no-impact)", () => {
    const payload = { depositId: "D1", accruedInterestZar: 0, accrualDate: "2026-06-05" };
    expect(prMmdAccrual(payload as never)).toEqual([]);
    expect(runOne("DepositInterestAccrued", payload).outcome).toBe("intentional-no-impact");
  });
});

describe("MMD maturity (PR-MMD-MAT) — parity (category via enrichment)", () => {
  for (const category of DEPOSIT_CATEGORIES) {
    it(`DepositMatured ${category} (with interest) — byte-for-byte`, () => {
      const payload = { depositId: "D1", principalZar: 7_500_000, interestPaidZar: 49_200 };
      expectParity("DepositMatured", payload, prMmdMat(payload as never, category), {
        depositCategory: category,
      });
    });
  }
  it("DepositMatured zero-interest — byte-for-byte (no accrued-interest leg)", () => {
    const payload = { depositId: "D1", principalZar: 7_500_000, interestPaidZar: 0 };
    expectParity(
      "DepositMatured",
      payload,
      prMmdMat(payload as never, "wholesale-non-operational"),
      {
        depositCategory: "wholesale-non-operational",
      },
    );
  });
});

describe("MMD early withdrawal (PR-MMD-CANCEL) — parity", () => {
  it("with penalty — byte-for-byte", () => {
    const payload = { depositId: "D1", penaltyZar: 22_500 };
    expectParity(
      "DepositWithdrawnEarly",
      payload,
      prMmdCancel(payload as never, "retail-stable", 7_500_000),
      {
        depositCategory: "retail-stable",
        openingPrincipalZar: 7_500_000,
      },
    );
  });
  it("no penalty — byte-for-byte", () => {
    const payload = { depositId: "D1", penaltyZar: 0 };
    expectParity(
      "DepositWithdrawnEarly",
      payload,
      prMmdCancel(payload as never, "wholesale-operational", 4_000_000),
      { depositCategory: "wholesale-operational", openingPrincipalZar: 4_000_000 },
    );
  });
  it("no enrichment — both produce no posting (legacy [] / interpreter no-GL)", () => {
    const payload = { depositId: "D1", penaltyZar: 22_500 };
    expect(prMmdCancel(payload as never)).toEqual([]);
    expect(runOne("DepositWithdrawnEarly", payload).outcome).toBe("intentional-no-impact");
  });
});

// ---------------------------------------------------------------------------
// FUNDING LINE
// ---------------------------------------------------------------------------

describe("Funding line (PR-FUNDING-001 / PR-FUNDING-END) — parity", () => {
  it("FundingLineDrawn — byte-for-byte", () => {
    const payload = {
      fundingLineId: "F1",
      drawnAmountZar: 25_000_000,
      maturityDate: "2026-12-01",
      rateDecimal: 0.085,
    };
    expectParity("FundingLineDrawn", payload, prFunding001(payload as never));
  });
  it("FundingLineRepaid — byte-for-byte", () => {
    const payload = { fundingLineId: "F1", repaidAmountZar: 25_000_000 };
    expectParity("FundingLineRepaid", payload, prFundingEnd(payload as never));
  });
});

// ---------------------------------------------------------------------------
// INTERBANK LOAN
// ---------------------------------------------------------------------------

describe("IBL recognition (PR-IBL-001) — per-placement-type parity", () => {
  for (const placementType of ["call", "fixed-term"] as const) {
    it(`InterbankLoanPlaced ${placementType} — byte-for-byte`, () => {
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
      expectParity("InterbankLoanPlaced", payload, prIbl001(payload as never));
    });
  }
});

describe("IBL accrual (PR-IBL-ACCRUAL) — parity", () => {
  it("non-zero accrual — byte-for-byte", () => {
    const payload = { placementId: "P1", accruedInterestZar: 2_034, accrualDate: "2026-06-05" };
    expectParity("InterbankLoanInterestAccrued", payload, prIblAccrual(payload as never));
  });
  it("zero accrual — both produce no posting", () => {
    const payload = { placementId: "P1", accruedInterestZar: 0, accrualDate: "2026-06-05" };
    expect(prIblAccrual(payload as never)).toEqual([]);
    expect(runOne("InterbankLoanInterestAccrued", payload).outcome).toBe("intentional-no-impact");
  });
});

describe("IBL maturity (PR-IBL-MAT) — parity (placement type via enrichment)", () => {
  for (const placementType of ["call", "fixed-term"] as const) {
    it(`InterbankLoanMatured ${placementType} (with interest) — byte-for-byte`, () => {
      const payload = { placementId: "P1", principalZar: 9_000_000, interestReceivedZar: 61_200 };
      expectParity("InterbankLoanMatured", payload, prIblMat(payload as never, placementType), {
        placementType,
      });
    });
  }
  it("InterbankLoanMatured zero-interest — byte-for-byte (no accrued-interest leg)", () => {
    const payload = { placementId: "P1", principalZar: 9_000_000, interestReceivedZar: 0 };
    expectParity("InterbankLoanMatured", payload, prIblMat(payload as never, "fixed-term"), {
      placementType: "fixed-term",
    });
  });
});

describe("IBL recall (PR-IBL-RECALL) — parity", () => {
  it("no enrichment — both produce no posting (legacy stub [] / interpreter no-GL)", () => {
    const payload = { placementId: "P1" };
    expect(prIblRecall(payload as never)).toEqual([]);
    expect(runOne("InterbankLoanRecalledEarly", payload).outcome).toBe("intentional-no-impact");
  });
  it("with enrichment — principal returned (Dr nostro / Cr due-from-banks), balanced", () => {
    const payload = { placementId: "P1" };
    const interp = interpLegs(
      runOne("InterbankLoanRecalledEarly", payload, {
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

describe("Repo (PR-REPO-*) — parity", () => {
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

  it("RepoTradeOpened — byte-for-byte", () => {
    expectParity("RepoTradeOpened", opened, prRepo001(opened as never));
  });

  it("RepoStartLegSettled — both produce no posting (intentional-no-impact memo)", () => {
    const payload = { tradeId: "R1", cashZar: 12_000_000 };
    expect(prRepoSettleStart(payload)).toEqual([]);
    expect(runOne("RepoStartLegSettled", payload).outcome).toBe("intentional-no-impact");
  });

  it("RepoInterestAccrued non-zero — byte-for-byte", () => {
    const payload = { tradeId: "R1", accruedInterestZar: 14_057, accrualDate: "2026-06-06" };
    expectParity("RepoInterestAccrued", payload, prRepoAccrual(payload as never));
  });
  it("RepoInterestAccrued zero — both produce no posting", () => {
    const payload = { tradeId: "R1", accruedInterestZar: 0, accrualDate: "2026-06-06" };
    expect(prRepoAccrual(payload as never)).toEqual([]);
    expect(runOne("RepoInterestAccrued", payload).outcome).toBe("intentional-no-impact");
  });

  it("RepoEndLegSettled — byte-for-byte", () => {
    const payload = { tradeId: "R1", repurchasePriceZar: 12_098_400 };
    expectParity("RepoEndLegSettled", payload, prRepoEnd(payload as never));
  });

  it("RepoTradeTerminatedEarly no enrichment — both produce no posting (legacy stub [])", () => {
    const payload = { tradeId: "R1", reason: "counterparty unwind" };
    expect(prRepoCancel(payload as never)).toEqual([]);
    expect(runOne("RepoTradeTerminatedEarly", payload).outcome).toBe("intentional-no-impact");
  });
  it("RepoTradeTerminatedEarly with enrichment — reversal (Dr nostro / Cr repo asset), balanced", () => {
    const payload = { tradeId: "R1", reason: "counterparty unwind" };
    const interp = interpLegs(
      runOne("RepoTradeTerminatedEarly", payload, { unwindCashZar: 12_000_000 }),
    );
    expect(interp).toEqual([
      { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 12_000_000, currency: "ZAR" },
      {
        accountId: "ACC-5100-001",
        debitCredit: "credit",
        amountMinor: 12_000_000,
        currency: "ZAR",
      },
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
