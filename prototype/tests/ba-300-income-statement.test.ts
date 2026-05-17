// tests/ba-300-income-statement.test.ts
//
// WS-FINANCE-BA-RETURNS-QUINTET — exit-criterion tests for the BA 300
// (Income Statement) generator + JSON renderer.
//
// Asserts:
//   1. Per-entity isolation — Hoz Securities + Hoz Group rejected.
//   2. End-to-end from synthetic events.
//   3. Net Interest Income = interestIncome − interestExpense.
//   4. Profit-before-tax composition.
//   5. Trading-PnL sign-preservation (loss possible).
//   6. Sign-convention warnings.
//   7. Classification gaps.
//   8. Determinism.
//   9. Schema validation.
//  10. Generator boundary errors.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
//   2026-05-10) extended 2026-05-17 by Marc's directive
//   (WS-FINANCE-BA-RETURNS-QUINTET).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO) + Anya (Data / analytics engineer,
//   engineering — reports to Devon COO).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { closePeriod, openPeriod } from "../platform/accounting/period-close";
import { newEventId } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";
import {
  BA_300_BANK_ENTITIES,
  BA_300_SCHEMA_URL,
  Ba300GeneratorError,
  type Ba300LineClassification,
  Ba300RenderSchema,
  canonicaliseBa300,
  generateBa300IncomeStatement,
  renderBa300Canonical,
  renderBa300ToJson,
} from "../platform/reporting";

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const ENTITY_GROUP = "LE-ZA-HOZ-GROUP";

const ACTOR = { type: "service" as const, id: "agent:Bea" };
const CITATIONS = ["D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN", "WS-FINANCE-BA-RETURNS-QUINTET"];

const PERIOD_START = "2026-05-01T00:00:00.000Z";
const PERIOD_END = "2026-05-31T23:59:59.999Z";

const PERIOD_OPEN = {
  periodId: "period:hoz-bank:month:2026-05",
  periodKind: "month" as const,
  periodStart: PERIOD_START,
  periodEnd: PERIOD_END,
  openedAt: PERIOD_START,
  functionalCurrency: "ZAR",
};

function appendPosting(
  store: EventStore,
  args: {
    entity: string;
    asOf: string;
    legs: ReadonlyArray<{
      debit: string;
      credit: string;
      currency: string;
      amountMinor: number;
    }>;
  },
): void {
  store.append({
    event_id: newEventId(),
    type: "SubLedgerPostingEmitted",
    as_of: args.asOf,
    entity: args.entity,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeId: `trade-${newEventId()}`,
      postingType: "trade-date-booking",
      legs: args.legs.map((l) => ({ ...l, memo: "test" })),
      asOfDate: args.asOf,
      citations: CITATIONS,
    },
  });
}

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ---------------------------------------------------------------------------
// 1. Per-entity isolation.
// ---------------------------------------------------------------------------

describe("BA 300 — per-entity isolation", () => {
  it("BA_300_BANK_ENTITIES contains only LE-ZA-HOZ-BANK", () => {
    expect(BA_300_BANK_ENTITIES).toEqual(["LE-ZA-HOZ-BANK"]);
  });

  it("rejects LE-ZA-HOZ-SECURITIES", () => {
    expect(() =>
      generateBa300IncomeStatement({
        entity: ENTITY_SECURITIES,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [],
      }),
    ).toThrow(Ba300GeneratorError);
  });

  it("rejects LE-ZA-HOZ-GROUP", () => {
    expect(() =>
      generateBa300IncomeStatement({
        entity: ENTITY_GROUP,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [],
      }),
    ).toThrow(Ba300GeneratorError);
  });

  it("rejects invalid functional currency", () => {
    expect(() =>
      generateBa300IncomeStatement({
        entity: ENTITY_BANK,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        periodId: "x",
        functionalCurrency: "ZARS",
        trialBalance: [],
        classifications: [],
      }),
    ).toThrow(/ISO-4217/);
  });

  it("rejects period inversion (start ≥ end)", () => {
    expect(() =>
      generateBa300IncomeStatement({
        entity: ENTITY_BANK,
        periodStart: PERIOD_END,
        periodEnd: PERIOD_START,
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [],
      }),
    ).toThrow(/must precede/);
  });
});

// ---------------------------------------------------------------------------
// 2. End-to-end with synthetic P&L postings.
// ---------------------------------------------------------------------------

describe("BA 300 — end-to-end", () => {
  function setupClose(): {
    trialBalanceSnapshotEventId: string;
    rows: ReadonlyArray<{ leafAccountId: string; currency: string; amountMinor: number }>;
  } {
    const store = new EventStore(":memory:");
    openPeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: PERIOD_OPEN,
    });
    // Interest income: cash debit / interest-income credit. R1m.
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-10T00:00:00.000Z",
      legs: [
        {
          debit: "ACC-cash",
          credit: "ACC-interest-income",
          currency: "ZAR",
          amountMinor: 100_000_000,
        },
      ],
    });
    // Interest expense: interest-expense debit / cash credit. R200k.
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-15T00:00:00.000Z",
      legs: [
        {
          debit: "ACC-interest-expense",
          credit: "ACC-cash",
          currency: "ZAR",
          amountMinor: 20_000_000,
        },
      ],
    });
    // Operating expense: opex debit / cash credit. R300k.
    appendPosting(store, {
      entity: ENTITY_BANK,
      asOf: "2026-05-20T00:00:00.000Z",
      legs: [
        {
          debit: "ACC-opex",
          credit: "ACC-cash",
          currency: "ZAR",
          amountMinor: 30_000_000,
        },
      ],
    });
    const close = closePeriod({
      eventStore: store,
      entity: ENTITY_BANK,
      periodId: PERIOD_OPEN.periodId,
      closedAt: "2026-06-01T00:00:00.000Z",
      actor: ACTOR,
      citations: CITATIONS,
    });
    return {
      trialBalanceSnapshotEventId: close.trialBalanceSnapshotEvent.event_id,
      rows: close.trialBalance.rows,
    };
  }

  it("computes NII + profit-before-tax correctly", () => {
    const { trialBalanceSnapshotEventId, rows } = setupClose();
    const classifications: Ba300LineClassification[] = [
      {
        leafAccountId: "ACC-interest-income",
        category: "interest-income",
        lineLabel: "interest-income.loans-and-advances",
      },
      {
        leafAccountId: "ACC-interest-expense",
        category: "interest-expense",
        lineLabel: "interest-expense.deposits",
      },
      {
        leafAccountId: "ACC-opex",
        category: "operating-expense",
        lineLabel: "operating-expense.staff-costs",
      },
    ];
    const out = generateBa300IncomeStatement({
      entity: ENTITY_BANK,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      trialBalance: rows,
      classifications,
      trialBalanceSnapshotEventId,
    });

    expect(out.interestIncome.totalMinor).toBe(100_000_000);
    expect(out.interestExpense.totalMinor).toBe(20_000_000);
    expect(out.netInterestIncomeMinor).toBe(80_000_000);
    expect(out.operatingExpenses.totalMinor).toBe(30_000_000);
    // PBT = 80m + 0 (fee) + 0 (trading) + 0 (other-income) − 30m − 0 (other-exp) = 50m
    expect(out.profitBeforeTaxMinor).toBe(50_000_000);
    expect(out.meta.trialBalanceSnapshotEventId).toBe(trialBalanceSnapshotEventId);
    expect(out.citations).toContain("Banks Act 94 of 1990 §75");
    expect(out.citations).toContain("IAS 1 §82–§87 — Statement of Comprehensive Income");
  });

  it("renders to canonical JSON validating against Ba300RenderSchema", () => {
    const { trialBalanceSnapshotEventId, rows } = setupClose();
    const out = generateBa300IncomeStatement({
      entity: ENTITY_BANK,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      periodId: PERIOD_OPEN.periodId,
      functionalCurrency: "ZAR",
      trialBalance: rows,
      classifications: [
        {
          leafAccountId: "ACC-interest-income",
          category: "interest-income",
          lineLabel: "interest-income.loans-and-advances",
        },
      ],
      trialBalanceSnapshotEventId,
    });
    const renderedAt = "2026-05-17T15:00:00.000Z";
    const render = renderBa300ToJson(out, { renderedAt });
    expect(() => Ba300RenderSchema.parse(render)).not.toThrow();
    expect(render.$schema).toBe(BA_300_SCHEMA_URL);
    expect(render.meta.renderedAt).toBe(renderedAt);
  });
});

// ---------------------------------------------------------------------------
// 3. Trading-PnL sign preservation.
// ---------------------------------------------------------------------------

describe("BA 300 — trading-pnl sign preservation", () => {
  it("credit balance on trading account ⇒ positive profit", () => {
    const out = generateBa300IncomeStatement({
      entity: ENTITY_BANK,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [
        // Credit balance (profit) = -100,000 in TB; should render as +100,000.
        { leafAccountId: "ACC-trading", currency: "ZAR", amountMinor: -100_000 },
      ],
      classifications: [
        {
          leafAccountId: "ACC-trading",
          category: "trading-pnl",
          lineLabel: "trading-pnl.fx-revaluation",
        },
      ],
    });
    expect(out.tradingProfitLoss.totalMinor).toBe(100_000);
    expect(out.profitBeforeTaxMinor).toBe(100_000);
  });

  it("debit balance on trading account ⇒ negative (loss)", () => {
    const out = generateBa300IncomeStatement({
      entity: ENTITY_BANK,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [{ leafAccountId: "ACC-trading", currency: "ZAR", amountMinor: 75_000 }],
      classifications: [
        {
          leafAccountId: "ACC-trading",
          category: "trading-pnl",
          lineLabel: "trading-pnl.fx-revaluation",
        },
      ],
    });
    expect(out.tradingProfitLoss.totalMinor).toBe(-75_000);
    expect(out.profitBeforeTaxMinor).toBe(-75_000);
  });
});

// ---------------------------------------------------------------------------
// 4. Sign-convention warnings + classification gaps.
// ---------------------------------------------------------------------------

describe("BA 300 — sign warnings + gaps", () => {
  it("flags income account with debit balance", () => {
    const out = generateBa300IncomeStatement({
      entity: ENTITY_BANK,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [{ leafAccountId: "ACC-weird-income", currency: "ZAR", amountMinor: 1_000 }],
      classifications: [
        {
          leafAccountId: "ACC-weird-income",
          category: "interest-income",
          lineLabel: "interest-income.loans-and-advances",
        },
      ],
    });
    const line = out.interestIncome.lineItems[0];
    expect(line?.note).toContain("sign convention violated");
  });

  it("classification gaps surface", () => {
    const out = generateBa300IncomeStatement({
      entity: ENTITY_BANK,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [{ leafAccountId: "ACC-unknown", currency: "ZAR", amountMinor: 100 }],
      classifications: [],
    });
    expect(out.classificationGaps.length).toBe(1);
    expect(out.classificationGaps[0]?.leafAccountId).toBe("ACC-unknown");
    expect(out.placeholders.some((p) => p.includes("no line classification"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Determinism.
// ---------------------------------------------------------------------------

describe("BA 300 — canonicaliser determinism", () => {
  it("identical inputs ⇒ identical bytes; $schema first", () => {
    const input = {
      entity: ENTITY_BANK,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [{ leafAccountId: "ACC-ii", currency: "ZAR", amountMinor: -1_000 }],
      classifications: [
        {
          leafAccountId: "ACC-ii",
          category: "interest-income" as const,
          lineLabel: "interest-income.loans-and-advances",
        },
      ],
    };
    const a = renderBa300Canonical(generateBa300IncomeStatement(input), {
      renderedAt: "2026-05-17T15:00:00.000Z",
    });
    const b = renderBa300Canonical(generateBa300IncomeStatement(input), {
      renderedAt: "2026-05-17T15:00:00.000Z",
    });
    expect(a.canonicalJson).toBe(b.canonicalJson);
    const lines = a.canonicalJson.split("\n");
    expect(lines[1]?.trim().startsWith('"$schema"')).toBe(true);
  });

  it("canonicaliseBa300 idempotent", () => {
    const out = generateBa300IncomeStatement({
      entity: ENTITY_BANK,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      periodId: "x",
      functionalCurrency: "ZAR",
      trialBalance: [{ leafAccountId: "ACC-ii", currency: "ZAR", amountMinor: -100 }],
      classifications: [
        {
          leafAccountId: "ACC-ii",
          category: "interest-income",
          lineLabel: "interest-income.loans-and-advances",
        },
      ],
    });
    const r = renderBa300ToJson(out, { renderedAt: "2026-05-17T15:00:00.000Z" });
    expect(canonicaliseBa300(r)).toBe(canonicaliseBa300(r));
  });
});

// ---------------------------------------------------------------------------
// 6. Generator boundary errors.
// ---------------------------------------------------------------------------

describe("BA 300 — boundary errors", () => {
  it("rejects duplicate classifications", () => {
    expect(() =>
      generateBa300IncomeStatement({
        entity: ENTITY_BANK,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        periodId: "x",
        functionalCurrency: "ZAR",
        trialBalance: [],
        classifications: [
          {
            leafAccountId: "ACC-X",
            category: "interest-income",
            lineLabel: "x",
          },
          {
            leafAccountId: "ACC-X",
            category: "fee-income",
            lineLabel: "x",
          },
        ],
      }),
    ).toThrow(/duplicate classification/);
  });
});
