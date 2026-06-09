// tests/ba-400-events-adapter.test.ts
//
// WS-BA-RETURNS-FOLLOWON — exit-criterion tests for the BA 400 (Operational
// Risk) events-first gross-income fold (`generateBa400OpRiskFromEvents`).
//
// Asserts:
//   1. Multi-business-line, multi-fiscal-year fold → expected per-line gross
//      income + BIA capital.
//   2. An unattributed P&L posting (no baselBusinessLine) surfaces in the
//      `unattributed` line + `unattributedGrossIncomeMinor`, and is excluded
//      from BIA / TSA capital (never dropped, never fabricated into a line).
//   3. Provision / impairment postings are NOT folded into gross income (§650).
//   4. The caller-supplied `generateBa300OpRisk` is unchanged and still usable.
//
// Authority: D-BA-RETURNS-FOLLOWON-BATCH; brief
//   brief:mira:ws-ba-returns-followon-ba-400-op-risk-events-fir:2026-06-09.
// Citations: BCBS D196 §645–§654; Regulations Relating to Banks Reg 33;
//   Principles/1-events-are-truth.md.
//
// Author: Mira (Regulatory reporting engineer, engineering — reports to Camille
//   CFO; BA-returns sourcing owner).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { newEventId } from "../platform/core/types";
import { EventStore } from "../platform/event-store/store";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";
import {
  UNATTRIBUTED_BUSINESS_LINE,
  generateBa300OpRisk,
  generateBa400OpRiskFromEvents,
} from "../platform/reporting";

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:Mira" };
const CITATIONS = ["D-BA-RETURNS-FOLLOWON-BATCH", "BCBS D196"];

// Real chart-of-accounts leaves (ACC-NNNN-NNN) classified as P&L:
//   ACC-4101-001 — Interest Income (EIR) — Bonds        (income-interest, credit)
//   ACC-2100-005 — FX trading realised P&L              (income-trading,  credit)
//   ACC-3200-006 — Dividend Income                      (income-other,    credit)
//   ACC-6100-006 — Deposit Interest Expense             (expense-impairment → excluded)
// Balancing (non-P&L) leg:
//   ACC-1100-001 — Central Bank Reserve Account         (asset-cash)
const ACC_INTEREST_INCOME = "ACC-4101-001";
const ACC_TRADING_PNL = "ACC-2100-005";
const ACC_OTHER_INCOME = "ACC-3200-006";
const ACC_IMPAIRMENT = "ACC-6100-006";
const ACC_CASH = "ACC-1100-001";

/**
 * Append a balanced SubLedgerPostingEmitted: a credit to the P&L account and an
 * equal debit to the cash account (income recognised). `baselBusinessLine` is
 * carried on the payload when supplied.
 */
function appendIncomePosting(
  store: EventStore,
  args: {
    asOf: string;
    pnlAccount: string;
    amountMinor: number;
    currency?: string;
    baselBusinessLine?: string;
    /** When true, the P&L leg is a DEBIT (e.g. expense / trading loss). */
    pnlDebit?: boolean;
  },
): void {
  const ccy = args.currency ?? "ZAR";
  const pnlSide = args.pnlDebit ? "debit" : "credit";
  const cashSide = args.pnlDebit ? "credit" : "debit";
  store.append({
    event_id: newEventId(),
    type: "SubLedgerPostingEmitted",
    as_of: args.asOf,
    entity: ENTITY_BANK,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      sourceEventId: `src-${newEventId()}`,
      postingType: "trade-date-booking",
      postedAt: args.asOf,
      legs: [
        {
          accountId: args.pnlAccount,
          debitCredit: pnlSide,
          amountMinor: args.amountMinor,
          currency: ccy,
        },
        {
          accountId: ACC_CASH,
          debitCredit: cashSide,
          amountMinor: args.amountMinor,
          currency: ccy,
        },
      ],
      ...(args.baselBusinessLine ? { baselBusinessLine: args.baselBusinessLine } : {}),
    },
  });
}

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ---------------------------------------------------------------------------
// 1. Multi-business-line, multi-fiscal-year fold.
// ---------------------------------------------------------------------------

describe("BA 400 events-first — multi-line, multi-year fold", () => {
  it("folds gross income per business line + fiscal year and feeds BIA", () => {
    const store = new EventStore(":memory:");

    // FY 2024:
    //   trading-and-sales : interest income 10m + trading 5m         = 15m
    //   retail-banking    : other income 4m                          =  4m
    // FY 2025:
    //   trading-and-sales : interest income 12m                      = 12m
    //   retail-banking    : other income 6m                          =  6m
    appendIncomePosting(store, {
      asOf: "2024-06-30T00:00:00.000Z",
      pnlAccount: ACC_INTEREST_INCOME,
      amountMinor: 10_000_000,
      baselBusinessLine: "trading-and-sales",
    });
    appendIncomePosting(store, {
      asOf: "2024-09-30T00:00:00.000Z",
      pnlAccount: ACC_TRADING_PNL,
      amountMinor: 5_000_000,
      baselBusinessLine: "trading-and-sales",
    });
    appendIncomePosting(store, {
      asOf: "2024-12-31T00:00:00.000Z",
      pnlAccount: ACC_OTHER_INCOME,
      amountMinor: 4_000_000,
      baselBusinessLine: "retail-banking",
    });
    appendIncomePosting(store, {
      asOf: "2025-06-30T00:00:00.000Z",
      pnlAccount: ACC_INTEREST_INCOME,
      amountMinor: 12_000_000,
      baselBusinessLine: "trading-and-sales",
    });
    appendIncomePosting(store, {
      asOf: "2025-12-31T00:00:00.000Z",
      pnlAccount: ACC_OTHER_INCOME,
      amountMinor: 6_000_000,
      baselBusinessLine: "retail-banking",
    });

    const out = generateBa400OpRiskFromEvents(
      store,
      "2025-12-31T23:59:59.999Z",
      ENTITY_BANK,
      "ZAR",
      "bia",
    );

    // Per-line folded gross income.
    const byKey = new Map(
      out.foldedGrossIncome.map((l) => [`${l.businessLine}::${l.fiscalYear}`, l.grossIncomeMinor]),
    );
    expect(byKey.get("trading-and-sales::2024")).toBe(15_000_000);
    expect(byKey.get("retail-banking::2024")).toBe(4_000_000);
    expect(byKey.get("trading-and-sales::2025")).toBe(12_000_000);
    expect(byKey.get("retail-banking::2025")).toBe(6_000_000);

    // No unattributed postings.
    expect(out.unattributedGrossIncomeMinor).toBe(0);
    expect(out.foldedGrossIncome.some((l) => l.unattributed)).toBe(false);

    // BIA: bank-aggregate gross income per year:
    //   2024 = 15m + 4m = 19m; 2025 = 12m + 6m = 18m.
    // Both positive → average = (19m + 18m) / 2 = 18.5m; capital = 15% × 18.5m.
    expect(out.bia).toBeDefined();
    expect(out.bia?.nPositiveYears).toBe(2);
    expect(out.bia?.sumPositiveYearsMinor).toBe(37_000_000);
    expect(out.bia?.averagePositiveMinor).toBe(18_500_000);
    const expectedBiaCapital = Math.round(0.15 * 18_500_000);
    expect(out.bia?.capitalMinor).toBe(expectedBiaCapital);
    expect(out.opRiskCapitalMinor).toBe(expectedBiaCapital);
    expect(out.opRiskRwaMinor).toBe(Math.round(12.5 * expectedBiaCapital));
    expect(out.meta.form).toBe("BA 400");
  });

  it("matches the caller-supplied generator for the same attributed table (TSA)", () => {
    const store = new EventStore(":memory:");
    appendIncomePosting(store, {
      asOf: "2024-06-30T00:00:00.000Z",
      pnlAccount: ACC_INTEREST_INCOME,
      amountMinor: 20_000_000,
      baselBusinessLine: "trading-and-sales",
    });
    appendIncomePosting(store, {
      asOf: "2024-12-31T00:00:00.000Z",
      pnlAccount: ACC_OTHER_INCOME,
      amountMinor: 8_000_000,
      baselBusinessLine: "retail-banking",
    });

    const eventsOut = generateBa400OpRiskFromEvents(
      store,
      "2024-12-31T23:59:59.999Z",
      ENTITY_BANK,
      "ZAR",
      "tsa",
      { periodId: "period:hoz-bank:year:2024" },
    );

    const pureOut = generateBa300OpRisk({
      entity: ENTITY_BANK,
      asOf: "2024-12-31T23:59:59.999Z",
      periodId: "period:hoz-bank:year:2024",
      functionalCurrency: "ZAR",
      grossIncome: [
        { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: 20_000_000 },
        { fiscalYear: "2024", businessLine: "retail-banking", grossIncomeMinor: 8_000_000 },
      ],
      approach: "tsa",
    });

    expect(eventsOut.opRiskCapitalMinor).toBe(pureOut.opRiskCapitalMinor);
    expect(eventsOut.tsa?.capitalMinor).toBe(pureOut.tsa?.capitalMinor);
  });
});

// ---------------------------------------------------------------------------
// 2. Unattributed posting surfaces (never dropped / fabricated).
// ---------------------------------------------------------------------------

describe("BA 400 events-first — unattributed postings", () => {
  it("surfaces a P&L posting with no baselBusinessLine in the unattributed line", () => {
    const store = new EventStore(":memory:");
    // Attributed.
    appendIncomePosting(store, {
      asOf: "2024-06-30T00:00:00.000Z",
      pnlAccount: ACC_INTEREST_INCOME,
      amountMinor: 10_000_000,
      baselBusinessLine: "trading-and-sales",
    });
    // Unattributed (no baselBusinessLine).
    appendIncomePosting(store, {
      asOf: "2024-09-30T00:00:00.000Z",
      pnlAccount: ACC_TRADING_PNL,
      amountMinor: 3_000_000,
    });

    const out = generateBa400OpRiskFromEvents(
      store,
      "2024-12-31T23:59:59.999Z",
      ENTITY_BANK,
      "ZAR",
      "tsa",
    );

    // Unattributed line surfaced.
    expect(out.unattributedGrossIncomeMinor).toBe(3_000_000);
    const unattrLine = out.foldedGrossIncome.find((l) => l.unattributed);
    expect(unattrLine).toBeDefined();
    expect(unattrLine?.businessLine).toBe(UNATTRIBUTED_BUSINESS_LINE);
    expect(unattrLine?.grossIncomeMinor).toBe(3_000_000);

    // A placeholder explicitly flags the attribution gap.
    expect(out.placeholders.some((p) => p.includes("no baselBusinessLine"))).toBe(true);

    // TSA capital reflects ONLY the attributed 10m (β=18%): year sum = 1.8m,
    // 3-year average over 1 observed year = 1.8m / 3 = 600,000.
    expect(out.tsa?.capitalMinor).toBe(Math.round((0.18 * 10_000_000) / 3));
  });
});

// ---------------------------------------------------------------------------
// 3. Provisions / impairment excluded from gross income (§650).
// ---------------------------------------------------------------------------

describe("BA 400 events-first — gross-income definition", () => {
  it("excludes impairment / provision postings from gross income", () => {
    const store = new EventStore(":memory:");
    appendIncomePosting(store, {
      asOf: "2024-06-30T00:00:00.000Z",
      pnlAccount: ACC_INTEREST_INCOME,
      amountMinor: 10_000_000,
      baselBusinessLine: "trading-and-sales",
    });
    // Impairment expense (debit to provision account) — must NOT reduce GI.
    appendIncomePosting(store, {
      asOf: "2024-07-31T00:00:00.000Z",
      pnlAccount: ACC_IMPAIRMENT,
      amountMinor: 2_000_000,
      baselBusinessLine: "trading-and-sales",
      pnlDebit: true,
    });

    const out = generateBa400OpRiskFromEvents(
      store,
      "2024-12-31T23:59:59.999Z",
      ENTITY_BANK,
      "ZAR",
      "bia",
    );

    // Gross income for trading-and-sales 2024 = 10m (impairment excluded).
    const line = out.foldedGrossIncome.find(
      (l) => l.businessLine === "trading-and-sales" && l.fiscalYear === "2024",
    );
    expect(line?.grossIncomeMinor).toBe(10_000_000);
    expect(out.bia?.sumPositiveYearsMinor).toBe(10_000_000);
  });

  it("nets a trading loss (debit to income-trading) against gross income", () => {
    const store = new EventStore(":memory:");
    appendIncomePosting(store, {
      asOf: "2024-06-30T00:00:00.000Z",
      pnlAccount: ACC_TRADING_PNL,
      amountMinor: 9_000_000,
      baselBusinessLine: "trading-and-sales",
    });
    // Trading loss: debit to the trading-P&L account, −4m.
    appendIncomePosting(store, {
      asOf: "2024-08-31T00:00:00.000Z",
      pnlAccount: ACC_TRADING_PNL,
      amountMinor: 4_000_000,
      baselBusinessLine: "trading-and-sales",
      pnlDebit: true,
    });

    const out = generateBa400OpRiskFromEvents(
      store,
      "2024-12-31T23:59:59.999Z",
      ENTITY_BANK,
      "ZAR",
      "bia",
    );
    const line = out.foldedGrossIncome.find(
      (l) => l.businessLine === "trading-and-sales" && l.fiscalYear === "2024",
    );
    expect(line?.grossIncomeMinor).toBe(5_000_000); // 9m − 4m
  });
});

// ---------------------------------------------------------------------------
// 4. Caller-supplied generator unchanged.
// ---------------------------------------------------------------------------

describe("BA 400 — caller-supplied generator retained", () => {
  it("generateBa300OpRisk still computes from a hand-built table", () => {
    const out = generateBa300OpRisk({
      entity: ENTITY_BANK,
      asOf: "2024-12-31T23:59:59.999Z",
      periodId: "period:hoz-bank:year:2024",
      functionalCurrency: "ZAR",
      grossIncome: [
        { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: 18_000_000 },
      ],
      approach: "bia",
    });
    expect(out.bia?.capitalMinor).toBe(Math.round(0.15 * 18_000_000));
  });
});
