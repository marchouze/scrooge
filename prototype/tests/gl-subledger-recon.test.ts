// tests/gl-subledger-recon.test.ts
//
// Unit tests for the five GL ↔ sub-ledger reconciliation functions.
// Implements test coverage for PROC-FIN-BSS-01 steps 3a–3d + 4.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, it } from "bun:test";

import { moneyWireFromMinor } from "../platform/core/money-codec";

import type { ChartOfAccountsEntry } from "../platform/accounting/gl-subledger-recon";
import {
  assertZeroBalance,
  checkAgedItems,
  tracePostingToSourceEvent,
  triageException,
  verifyIfrsClassification,
} from "../platform/accounting/gl-subledger-recon";
import type { TrialBalance } from "../platform/accounting/period-close";
import type { SubLedgerPostingEmittedPayload } from "../platform/event-store/event-types/fx-accounting";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Build a SubLedgerLeg-shaped object for fixtures. */
function leg(
  accountId: string,
  debitCredit: "debit" | "credit",
  amountMinor: number,
  currency: string,
) {
  return {
    accountId,
    debitCredit,
    currency,
    amount: moneyWireFromMinor(amountMinor, currency),
  };
}

function makeTB(
  rows: Array<{ leafAccountId: string; currency: string; amountMinor: number }>,
): TrialBalance {
  return {
    rows,
    perCurrencyTotals: [],
    uptoSequence: rows.length,
  };
}

const COA_FIXTURES: ChartOfAccountsEntry[] = [
  {
    accountId: "ACC-1100-001",
    name: "Cash and balances at SARB",
    currency: "ZAR",
    ifrsClassification: "amortised-cost",
    ifrsClassificationStatus: "in-force",
    shouldNetToZeroAtPeriodEnd: false,
    sourceEventTypes: ["BankAccountOpened", "TradeMatured"],
  },
  {
    accountId: "ACC-1100-002",
    name: "Nostro — USD",
    currency: "USD",
    ifrsClassification: "amortised-cost",
    ifrsClassificationStatus: "in-force",
    clearanceHorizonDays: 0,
    shouldNetToZeroAtPeriodEnd: false,
    sourceEventTypes: ["TradeMatured"],
  },
  {
    accountId: "ACC-1100-004",
    name: "FX Settlement Suspense — ZAR",
    currency: "ZAR",
    ifrsClassification: "amortised-cost",
    ifrsClassificationStatus: "in-force",
    clearanceHorizonDays: 2,
    shouldNetToZeroAtPeriodEnd: true,
    sourceEventTypes: ["FxTradeExecuted", "TradeMatured"],
  },
  {
    accountId: "ACC-1100-005",
    name: "FX Settlement Suspense — USD",
    currency: "USD",
    ifrsClassification: "amortised-cost",
    ifrsClassificationStatus: "in-force",
    clearanceHorizonDays: 2,
    shouldNetToZeroAtPeriodEnd: true,
    sourceEventTypes: ["FxTradeExecuted", "TradeMatured"],
  },
  {
    accountId: "ACC-2100-001",
    name: "FX Trading Receivable — ZAR",
    currency: "ZAR",
    ifrsClassification: "fvtpl",
    ifrsClassificationStatus: "in-force",
    clearanceHorizonDays: 2,
    shouldNetToZeroAtPeriodEnd: false,
    sourceEventTypes: ["FxTradeExecuted", "SubLedgerPostingEmitted"],
  },
  {
    accountId: "ACC-2100-005",
    name: "Unrealised FX P&L — FVTPL",
    currency: "ZAR",
    ifrsClassification: "fvtpl",
    ifrsClassificationStatus: "superseded",
    shouldNetToZeroAtPeriodEnd: false,
    sourceEventTypes: ["FxPositionRevalued", "TradeMatured"],
  },
];

function makePosting(
  sourceEventId: string,
  accountIds: Array<{
    accountId: string;
    debitCredit: "debit" | "credit";
    currency: string;
    amountMinor: number;
  }>,
  postedAt = "2026-05-01T10:00:00.000Z",
): SubLedgerPostingEmittedPayload {
  return {
    sourceEventId,
    postingType: "trade-booking",
    postedAt,
    legs: accountIds.map((l) => ({
      accountId: l.accountId,
      debitCredit: l.debitCredit,
      currency: l.currency,
      amount: moneyWireFromMinor(l.amountMinor, l.currency),
    })),
  };
}

// ---------------------------------------------------------------------------
// tracePostingToSourceEvent
// ---------------------------------------------------------------------------

describe("tracePostingToSourceEvent", () => {
  it("ok=true when all postings trace to known source events with matching types", () => {
    const tb = makeTB([{ leafAccountId: "ACC-2100-001", currency: "ZAR", amountMinor: 100_000 }]);
    const posting = makePosting("evt-001", [
      { accountId: "ACC-2100-001", debitCredit: "debit", currency: "ZAR", amountMinor: 100_000 },
      { accountId: "ACC-2100-001", debitCredit: "credit", currency: "ZAR", amountMinor: 100_000 },
    ]);
    const primaryEvents = new Map([["evt-001", { type: "FxTradeExecuted", payload: {} }]]);
    const accountSourceMap = new Map([
      ["ACC-2100-001", ["FxTradeExecuted", "SubLedgerPostingEmitted"]],
    ]);

    const result = tracePostingToSourceEvent({
      trialBalance: tb,
      postingEvents: [posting],
      primaryEvents,
      accountSourceMap,
    });

    expect(result.ok).toBe(true);
    expect(result.traced.length).toBeGreaterThan(0);
    expect(result.untraced.length).toBe(0);
  });

  it("flags posting with null sourceEventId as untraced with reason null-source-id", () => {
    const tb = makeTB([{ leafAccountId: "ACC-2100-001", currency: "ZAR", amountMinor: 50_000 }]);
    const posting: SubLedgerPostingEmittedPayload = {
      sourceEventId: "",
      postingType: "trade-booking",
      postedAt: "2026-05-01T10:00:00.000Z",
      legs: [
        leg("ACC-2100-001", "debit", 50_000, "ZAR"),
        leg("ACC-2100-001", "credit", 50_000, "ZAR"),
      ],
    };
    const result = tracePostingToSourceEvent({
      trialBalance: tb,
      postingEvents: [posting],
      primaryEvents: new Map(),
      accountSourceMap: new Map([["ACC-2100-001", ["FxTradeExecuted"]]]),
    });

    expect(result.ok).toBe(false);
    expect(result.untraced[0]?.reason).toBe("null-source-id");
  });

  it("flags posting with phantom sourceEventId as untraced with reason phantom-source-event", () => {
    const tb = makeTB([{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 200_000 }]);
    const posting = makePosting("evt-phantom", [
      { accountId: "ACC-1100-001", debitCredit: "debit", currency: "ZAR", amountMinor: 200_000 },
      { accountId: "ACC-1100-001", debitCredit: "credit", currency: "ZAR", amountMinor: 200_000 },
    ]);
    const result = tracePostingToSourceEvent({
      trialBalance: tb,
      postingEvents: [posting],
      primaryEvents: new Map(), // evt-phantom not in map
      accountSourceMap: new Map([["ACC-1100-001", ["BankAccountOpened"]]]),
    });

    expect(result.ok).toBe(false);
    expect(result.untraced[0]?.reason).toBe("phantom-source-event");
  });

  it("flags posting with unrecognised source type as untraced with reason unrecognised-source-type", () => {
    const tb = makeTB([{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 50_000 }]);
    const posting = makePosting("evt-002", [
      { accountId: "ACC-1100-001", debitCredit: "debit", currency: "ZAR", amountMinor: 50_000 },
      { accountId: "ACC-1100-001", debitCredit: "credit", currency: "ZAR", amountMinor: 50_000 },
    ]);
    const primaryEvents = new Map([["evt-002", { type: "UnexpectedEventType", payload: {} }]]);
    const result = tracePostingToSourceEvent({
      trialBalance: tb,
      postingEvents: [posting],
      primaryEvents,
      accountSourceMap: new Map([["ACC-1100-001", ["BankAccountOpened", "TradeMatured"]]]),
    });

    expect(result.ok).toBe(false);
    expect(result.untraced[0]?.reason).toBe("unrecognised-source-type");
  });

  it("skips postings that don't touch any active TB account", () => {
    const tb = makeTB([{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 10_000 }]);
    const posting = makePosting("evt-003", [
      // Different account — not in TB
      { accountId: "ACC-2100-003", debitCredit: "debit", currency: "ZAR", amountMinor: 10_000 },
      { accountId: "ACC-2100-003", debitCredit: "credit", currency: "ZAR", amountMinor: 10_000 },
    ]);
    const result = tracePostingToSourceEvent({
      trialBalance: tb,
      postingEvents: [posting],
      primaryEvents: new Map([["evt-003", { type: "FxTradeExecuted", payload: {} }]]),
      accountSourceMap: new Map(),
    });

    expect(result.ok).toBe(true);
    expect(result.traced.length).toBe(0);
    expect(result.untraced.length).toBe(0);
  });

  it("ok=true for empty TB (no active accounts)", () => {
    const result = tracePostingToSourceEvent({
      trialBalance: makeTB([]),
      postingEvents: [],
      primaryEvents: new Map(),
      accountSourceMap: new Map(),
    });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// verifyIfrsClassification
// ---------------------------------------------------------------------------

describe("verifyIfrsClassification", () => {
  it("passes all accounts with in-force classification", () => {
    const tb = makeTB([
      { leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 500_000 },
      { leafAccountId: "ACC-2100-001", currency: "ZAR", amountMinor: 200_000 },
    ]);
    const result = verifyIfrsClassification({ trialBalance: tb, chartOfAccounts: COA_FIXTURES });

    expect(result.ok).toBe(true);
    expect(result.failed.length).toBe(0);
    expect(result.passed).toContain("ACC-1100-001");
    expect(result.passed).toContain("ACC-2100-001");
  });

  it("fails accounts with superseded classification", () => {
    const tb = makeTB([{ leafAccountId: "ACC-2100-005", currency: "ZAR", amountMinor: 10_000 }]);
    const result = verifyIfrsClassification({ trialBalance: tb, chartOfAccounts: COA_FIXTURES });

    expect(result.ok).toBe(false);
    expect(result.failed[0]?.accountId).toBe("ACC-2100-005");
    expect(result.failed[0]?.reason).toBe("classification-superseded");
  });

  it("fails accounts not found in the chart of accounts", () => {
    const tb = makeTB([{ leafAccountId: "ACC-9999-999", currency: "ZAR", amountMinor: 1_000 }]);
    const result = verifyIfrsClassification({ trialBalance: tb, chartOfAccounts: COA_FIXTURES });

    expect(result.ok).toBe(false);
    expect(result.failed[0]?.reason).toBe("account-not-in-chart");
  });

  it("fails accounts with under-review classification", () => {
    const underReviewCoa: ChartOfAccountsEntry[] = [
      {
        accountId: "ACC-2100-002",
        name: "FX Trading Receivable — USD",
        currency: "USD",
        ifrsClassification: "fvtpl",
        ifrsClassificationStatus: "under-review",
        sourceEventTypes: ["FxTradeExecuted"],
      },
    ];
    const tb = makeTB([{ leafAccountId: "ACC-2100-002", currency: "USD", amountMinor: 300_000 }]);
    const result = verifyIfrsClassification({ trialBalance: tb, chartOfAccounts: underReviewCoa });

    expect(result.ok).toBe(false);
    expect(result.failed[0]?.reason).toBe("classification-under-review");
  });

  it("skips zero-balance rows", () => {
    const tb = makeTB([{ leafAccountId: "ACC-2100-005", currency: "ZAR", amountMinor: 0 }]);
    const result = verifyIfrsClassification({ trialBalance: tb, chartOfAccounts: COA_FIXTURES });
    // Zero balance row skipped — no failure
    expect(result.ok).toBe(true);
    expect(result.failed.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// checkAgedItems
// ---------------------------------------------------------------------------

describe("checkAgedItems", () => {
  it("returns ok=true when no open item exceeds clearance horizon", () => {
    const tb = makeTB([{ leafAccountId: "ACC-1100-004", currency: "ZAR", amountMinor: 50_000 }]);
    // Open one-sided suspense item: DR suspense / CR receivable — net open
    // residual on the suspense account is +50_000. Posting 1 day before asOf,
    // horizon 2 → within window → clean.
    const posting = makePosting(
      "evt-010",
      [
        { accountId: "ACC-1100-004", debitCredit: "debit", currency: "ZAR", amountMinor: 50_000 },
        { accountId: "ACC-2100-001", debitCredit: "credit", currency: "ZAR", amountMinor: 50_000 },
      ],
      "2026-05-15T10:00:00.000Z",
    );
    const result = checkAgedItems({
      trialBalance: tb,
      postingEvents: [posting],
      chartOfAccounts: COA_FIXTURES,
      asOf: "2026-05-16",
    });

    expect(result.ok).toBe(true);
    expect(result.aged.length).toBe(0);
  });

  it("flags accounts where an open item exceeds clearance horizon", () => {
    const tb = makeTB([{ leafAccountId: "ACC-1100-004", currency: "ZAR", amountMinor: 50_000 }]);
    // Open suspense item posted 5 days before asOf — exceeds 2-day horizon.
    const posting = makePosting(
      "evt-011",
      [
        { accountId: "ACC-1100-004", debitCredit: "debit", currency: "ZAR", amountMinor: 50_000 },
        { accountId: "ACC-2100-001", debitCredit: "credit", currency: "ZAR", amountMinor: 50_000 },
      ],
      "2026-05-10T08:00:00.000Z",
    );
    const result = checkAgedItems({
      trialBalance: tb,
      postingEvents: [posting],
      chartOfAccounts: COA_FIXTURES,
      asOf: "2026-05-15",
    });

    expect(result.ok).toBe(false);
    expect(result.aged.length).toBe(1);
    expect(result.aged[0]?.accountId).toBe("ACC-1100-004");
    expect(result.aged[0]?.ageCalendarDays).toBe(5);
    expect(result.aged[0]?.clearanceHorizonDays).toBe(2);
    // amountMinor now reports the OPEN residual, not the net account balance.
    expect(result.aged[0]?.amountMinor).toBe(50_000);
  });

  it("does not flag accounts with no clearance horizon defined", () => {
    const tb = makeTB([{ leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 1_000_000 }]);
    // Very old OPEN posting — but ACC-1100-001 has no clearance horizon.
    const posting = makePosting(
      "evt-012",
      [
        {
          accountId: "ACC-1100-001",
          debitCredit: "debit",
          currency: "ZAR",
          amountMinor: 1_000_000,
        },
        {
          accountId: "ACC-2100-001",
          debitCredit: "credit",
          currency: "ZAR",
          amountMinor: 1_000_000,
        },
      ],
      "2025-01-01T00:00:00.000Z",
    );
    const result = checkAgedItems({
      trialBalance: tb,
      postingEvents: [posting],
      chartOfAccounts: COA_FIXTURES,
      asOf: "2026-05-15",
    });

    expect(result.ok).toBe(true);
    expect(result.aged.length).toBe(0);
  });

  it("uses oldest OPEN posting date when multiple open postings exist for same account", () => {
    const tb = makeTB([{ leafAccountId: "ACC-2100-001", currency: "ZAR", amountMinor: 100_000 }]);
    const postings = [
      makePosting(
        "evt-013a",
        [
          { accountId: "ACC-2100-001", debitCredit: "debit", currency: "ZAR", amountMinor: 60_000 },
          {
            accountId: "ACC-1100-004",
            debitCredit: "credit",
            currency: "ZAR",
            amountMinor: 60_000,
          },
        ],
        "2026-05-12T08:00:00.000Z", // Older
      ),
      makePosting(
        "evt-013b",
        [
          { accountId: "ACC-2100-001", debitCredit: "debit", currency: "ZAR", amountMinor: 40_000 },
          {
            accountId: "ACC-1100-004",
            debitCredit: "credit",
            currency: "ZAR",
            amountMinor: 40_000,
          },
        ],
        "2026-05-14T12:00:00.000Z", // Newer
      ),
    ];
    const result = checkAgedItems({
      trialBalance: tb,
      postingEvents: postings,
      chartOfAccounts: COA_FIXTURES,
      asOf: "2026-05-15",
    });

    // ACC-2100-001 open residual = +100_000; oldest open posting May 12;
    // asOf May 15 = 3 days; horizon = 2 days → aged.
    expect(result.ok).toBe(false);
    expect(result.aged[0]?.accountId).toBe("ACC-2100-001");
    expect(result.aged[0]?.oldestPostingDate).toBe("2026-05-12");
    expect(result.aged[0]?.ageCalendarDays).toBe(3);
  });

  // -------------------------------------------------------------------------
  // Confirmation-aware redesign (PROC-FIN-BSS-01 §5 step 3c).
  // SubstrateAlert alert:integrity:bss-aged-items-confirmed-leg-blind;
  // retires D-CFO-BSS-2026-05-SEED-NOSTRO-AGED-EXCEPTION.
  // -------------------------------------------------------------------------

  it("(a) does NOT flag a confirmed standing nostro cash balance past horizon", () => {
    // Nostro ACC-1100-002 (USD, horizon 0) holds a standing confirmed balance
    // posted 9 days ago. The cash movement is a CONFIRMED settlement leg
    // (postingType fx-principal-payment) — the old logic flagged this as a
    // false positive; the confirmation-aware logic must not.
    const tb = makeTB([{ leafAccountId: "ACC-1100-002", currency: "USD", amountMinor: 1_000_000 }]);
    const posting: SubLedgerPostingEmittedPayload = {
      sourceEventId: "evt-conf-settle",
      postingType: "fx-principal-payment",
      postedAt: "2026-05-06T12:00:00.000Z", // 9 days before asOf
      legs: [
        leg("ACC-1100-002", "debit", 1_000_000, "USD"),
        leg("ACC-2100-001", "credit", 1_000_000, "ZAR"),
      ],
    };
    const result = checkAgedItems({
      trialBalance: tb,
      postingEvents: [posting],
      chartOfAccounts: COA_FIXTURES,
      asOf: "2026-05-15",
    });

    expect(result.ok).toBe(true);
    expect(result.aged.length).toBe(0);
    expect(result.clean).toContain("ACC-1100-002|USD");
  });

  it("(a') treats a posting as confirmed when its source resolves to a SettlementConfirmed event", () => {
    // Same nostro balance, but the posting type is a generic trade-booking
    // (not itself a settlement type). It is confirmed via confirmedSourceEventIds.
    const tb = makeTB([{ leafAccountId: "ACC-1100-002", currency: "USD", amountMinor: 1_000_000 }]);
    const posting: SubLedgerPostingEmittedPayload = {
      sourceEventId: "evt-settlement-confirmed-1",
      postingType: "trade-booking",
      postedAt: "2026-05-06T12:00:00.000Z", // 9 days before asOf
      legs: [
        leg("ACC-1100-002", "debit", 1_000_000, "USD"),
        leg("ACC-2100-001", "credit", 1_000_000, "ZAR"),
      ],
    };
    const result = checkAgedItems({
      trialBalance: tb,
      postingEvents: [posting],
      chartOfAccounts: COA_FIXTURES,
      asOf: "2026-05-15",
      confirmedSourceEventIds: new Set(["evt-settlement-confirmed-1"]),
    });

    expect(result.ok).toBe(true);
    expect(result.aged.length).toBe(0);
  });

  it("(b) DOES flag an unconfirmed nostro item past horizon", () => {
    // Same nostro, same age, but the posting is an OPEN/unconfirmed item
    // (postingType trade-booking, no confirmation signal). Horizon 0 → aged.
    const tb = makeTB([{ leafAccountId: "ACC-1100-002", currency: "USD", amountMinor: 1_000_000 }]);
    const posting: SubLedgerPostingEmittedPayload = {
      sourceEventId: "evt-open-nostro",
      postingType: "trade-booking",
      postedAt: "2026-05-06T12:00:00.000Z", // 9 days before asOf, horizon 0
      legs: [
        leg("ACC-1100-002", "debit", 1_000_000, "USD"),
        leg("ACC-2100-001", "credit", 1_000_000, "ZAR"),
      ],
    };
    const result = checkAgedItems({
      trialBalance: tb,
      postingEvents: [posting],
      chartOfAccounts: COA_FIXTURES,
      asOf: "2026-05-15",
    });

    expect(result.ok).toBe(false);
    expect(result.aged.length).toBe(1);
    expect(result.aged[0]?.accountId).toBe("ACC-1100-002");
    expect(result.aged[0]?.ageCalendarDays).toBe(9);
    expect(result.aged[0]?.clearanceHorizonDays).toBe(0);
  });

  it("(b') ages only the unconfirmed residual when confirmed and open legs coexist", () => {
    // A nostro with a large CONFIRMED inflow (settlement) and a small OPEN
    // outflow. Only the open residual ages — the confirmed cash is clean.
    const tb = makeTB([{ leafAccountId: "ACC-1100-002", currency: "USD", amountMinor: 900_000 }]);
    const confirmed: SubLedgerPostingEmittedPayload = {
      sourceEventId: "evt-conf",
      postingType: "settlement-confirmation",
      postedAt: "2026-05-06T12:00:00.000Z",
      legs: [
        leg("ACC-1100-002", "debit", 1_000_000, "USD"),
        leg("ACC-2100-001", "credit", 1_000_000, "ZAR"),
      ],
    };
    const open: SubLedgerPostingEmittedPayload = {
      sourceEventId: "evt-open",
      postingType: "trade-booking",
      postedAt: "2026-05-04T12:00:00.000Z", // 11 days before asOf
      legs: [
        leg("ACC-1100-002", "credit", 100_000, "USD"),
        leg("ACC-2100-001", "debit", 100_000, "ZAR"),
      ],
    };
    const result = checkAgedItems({
      trialBalance: tb,
      postingEvents: [confirmed, open],
      chartOfAccounts: COA_FIXTURES,
      asOf: "2026-05-15",
    });

    expect(result.ok).toBe(false);
    expect(result.aged.length).toBe(1);
    // Only the OPEN −100_000 residual ages — not the 900_000 net balance.
    expect(result.aged[0]?.amountMinor).toBe(-100_000);
    expect(result.aged[0]?.oldestPostingDate).toBe("2026-05-04");
  });

  it("(c) still flags a suspense item outstanding > 2 business days", () => {
    // Genuine open suspense item: DR suspense / CR receivable, posted 4 days
    // before asOf, horizon 2 → aged. Suspense aging is preserved.
    const tb = makeTB([{ leafAccountId: "ACC-1100-005", currency: "USD", amountMinor: 75_000 }]);
    const posting = makePosting(
      "evt-suspense-open",
      [
        { accountId: "ACC-1100-005", debitCredit: "debit", currency: "USD", amountMinor: 75_000 },
        { accountId: "ACC-2100-001", debitCredit: "credit", currency: "ZAR", amountMinor: 75_000 },
      ],
      "2026-05-11T08:00:00.000Z",
    );
    const result = checkAgedItems({
      trialBalance: tb,
      postingEvents: [posting],
      chartOfAccounts: COA_FIXTURES,
      asOf: "2026-05-15",
    });

    expect(result.ok).toBe(false);
    expect(result.aged.length).toBe(1);
    expect(result.aged[0]?.accountId).toBe("ACC-1100-005");
    expect(result.aged[0]?.ageCalendarDays).toBe(4);
    expect(result.aged[0]?.clearanceHorizonDays).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// assertZeroBalance
// ---------------------------------------------------------------------------

describe("assertZeroBalance", () => {
  it("passes when suspense accounts have zero balance (not in TB)", () => {
    // Empty TB — suspense accounts not present = zero balance
    const result = assertZeroBalance({
      trialBalance: makeTB([]),
      chartOfAccounts: COA_FIXTURES,
    });

    expect(result.ok).toBe(true);
    expect(result.failed.length).toBe(0);
    expect(result.passed).toContain("ACC-1100-004");
    expect(result.passed).toContain("ACC-1100-005");
  });

  it("fails when a suspense account has non-zero balance", () => {
    const tb = makeTB([{ leafAccountId: "ACC-1100-004", currency: "ZAR", amountMinor: 25_000 }]);
    const result = assertZeroBalance({ trialBalance: tb, chartOfAccounts: COA_FIXTURES });

    expect(result.ok).toBe(false);
    expect(result.failed.length).toBe(1);
    expect(result.failed[0]?.accountId).toBe("ACC-1100-004");
    // amount is decimal-native Money; minor units = 25_000 → ZAR 250
    expect(String(result.failed[0]?.amount.currency)).toBe("ZAR");
    expect(result.failed[0]?.amount.amount).toBe("250");
    expect(result.failed[0]?.reason).toBe("non-zero-suspense");
  });

  it("passes non-suspense accounts even if they have non-zero balances", () => {
    const tb = makeTB([
      { leafAccountId: "ACC-1100-001", currency: "ZAR", amountMinor: 999_000 },
      { leafAccountId: "ACC-2100-001", currency: "ZAR", amountMinor: 50_000 },
    ]);
    const result = assertZeroBalance({ trialBalance: tb, chartOfAccounts: COA_FIXTURES });

    expect(result.ok).toBe(true);
    expect(result.failed.length).toBe(0);
  });

  it("passes suspense account with explicit zero balance row in TB", () => {
    const tb = makeTB([{ leafAccountId: "ACC-1100-004", currency: "ZAR", amountMinor: 0 }]);
    const result = assertZeroBalance({ trialBalance: tb, chartOfAccounts: COA_FIXTURES });

    // amountMinor === 0 → passed
    expect(result.ok).toBe(true);
  });

  it("fails both suspense accounts if both have non-zero balances", () => {
    const tb = makeTB([
      { leafAccountId: "ACC-1100-004", currency: "ZAR", amountMinor: 10_000 },
      { leafAccountId: "ACC-1100-005", currency: "USD", amountMinor: 500 },
    ]);
    const result = assertZeroBalance({ trialBalance: tb, chartOfAccounts: COA_FIXTURES });

    expect(result.ok).toBe(false);
    expect(result.failed.length).toBe(2);
    const accountIds = result.failed.map((f) => f.accountId);
    expect(accountIds).toContain("ACC-1100-004");
    expect(accountIds).toContain("ACC-1100-005");
  });
});

// ---------------------------------------------------------------------------
// triageException
// ---------------------------------------------------------------------------

describe("triageException", () => {
  it("classifies trace null-source-id as unexplained", () => {
    const result = triageException({
      exceptions: [
        {
          accountId: "ACC-2100-001",
          amountMinorAbsolute: 1000n,
          step: "trace",
          hint: "null-source-id",
        },
      ],
      asOf: "2026-05-15",
    });

    expect(result.unexplained.length).toBe(1);
    expect(result.timingDifference.length).toBe(0);
    expect(result.substrateGap.length).toBe(0);
  });

  it("classifies trace phantom-source-event as unexplained", () => {
    const result = triageException({
      exceptions: [
        {
          accountId: "ACC-1100-001",
          amountMinorAbsolute: 500n,
          step: "trace",
          hint: "phantom-source-event",
        },
      ],
      asOf: "2026-05-15",
    });

    expect(result.unexplained.length).toBe(1);
    expect(result.unexplained[0]?.exceptionKind).toBe("unexplained");
  });

  it("classifies trace unrecognised-source-type as substrate-gap", () => {
    const result = triageException({
      exceptions: [
        {
          accountId: "ACC-1100-002",
          amountMinorAbsolute: 200n,
          step: "trace",
          hint: "unrecognised-source-type",
        },
      ],
      asOf: "2026-05-15",
    });

    expect(result.substrateGap.length).toBe(1);
    expect(result.unexplained.length).toBe(0);
    expect(result.timingDifference.length).toBe(0);
  });

  it("classifies classification failures as unexplained", () => {
    const result = triageException({
      exceptions: [
        {
          accountId: "ACC-2100-005",
          amountMinorAbsolute: 100n,
          step: "classification",
          hint: "classification-superseded",
        },
      ],
      asOf: "2026-05-15",
    });

    expect(result.unexplained.length).toBe(1);
    expect(result.unexplained[0]?.exceptionKind).toBe("unexplained");
  });

  it("classifies aged item within clearance horizon as timing-difference", () => {
    const result = triageException({
      exceptions: [
        {
          accountId: "ACC-1100-004",
          amountMinorAbsolute: 5000n,
          step: "aged",
          ageCalendarDays: 1,
          clearanceHorizonDays: 2,
        },
      ],
      asOf: "2026-05-15",
    });

    expect(result.timingDifference.length).toBe(1);
    expect(result.unexplained.length).toBe(0);
  });

  it("classifies aged item beyond clearance horizon as unexplained", () => {
    const result = triageException({
      exceptions: [
        {
          accountId: "ACC-1100-004",
          amountMinorAbsolute: 7500n,
          step: "aged",
          ageCalendarDays: 5,
          clearanceHorizonDays: 2,
        },
      ],
      asOf: "2026-05-15",
    });

    expect(result.unexplained.length).toBe(1);
    expect(result.timingDifference.length).toBe(0);
  });

  it("classifies zero-balance suspense with ageCalendarDays <= horizon as timing-difference", () => {
    const result = triageException({
      exceptions: [
        {
          accountId: "ACC-1100-005",
          currency: "USD",
          amountMinorAbsolute: 300n,
          step: "zero-balance",
          ageCalendarDays: 1,
          clearanceHorizonDays: 2,
        },
      ],
      asOf: "2026-05-15",
    });

    expect(result.timingDifference.length).toBe(1);
    expect(result.unexplained.length).toBe(0);
  });

  it("sets escalate=true when unexplained exception exceeds materiality threshold", () => {
    // Default threshold = 5_000_000_00n (ZAR 50,000)
    const result = triageException({
      exceptions: [
        {
          accountId: "ACC-2100-001",
          amountMinorAbsolute: 6_000_000_00n, // ZAR 60,000 — above threshold
          step: "trace",
          hint: "null-source-id",
        },
      ],
      asOf: "2026-05-15",
    });

    expect(result.escalate).toBe(true);
    expect(result.unexplained.length).toBe(1);
  });

  it("sets escalate=false when unexplained exception is below materiality threshold", () => {
    const result = triageException({
      exceptions: [
        {
          accountId: "ACC-2100-001",
          amountMinorAbsolute: 1_000_00n, // ZAR 1,000 — below threshold
          step: "trace",
          hint: "null-source-id",
        },
      ],
      asOf: "2026-05-15",
    });

    expect(result.escalate).toBe(false);
  });

  it("respects a custom materiality threshold", () => {
    const result = triageException({
      exceptions: [
        {
          accountId: "ACC-2100-001",
          amountMinorAbsolute: 2_000_00n, // ZAR 2,000
          step: "trace",
          hint: "null-source-id",
        },
      ],
      asOf: "2026-05-15",
      materialityThresholdMinor: 1_000_00n, // ZAR 1,000
    });

    expect(result.escalate).toBe(true);
  });

  it("handles empty exceptions list — ok, no escalation", () => {
    const result = triageException({ exceptions: [], asOf: "2026-05-15" });

    expect(result.timingDifference.length).toBe(0);
    expect(result.substrateGap.length).toBe(0);
    expect(result.unexplained.length).toBe(0);
    expect(result.escalate).toBe(false);
  });

  it("escalate=false when only substrate-gap exceptions exceed materiality", () => {
    // substrate-gap exceptions do not drive escalate (only unexplained do)
    const result = triageException({
      exceptions: [
        {
          accountId: "ACC-1100-002",
          amountMinorAbsolute: 1_000_000_000n, // Very large
          step: "trace",
          hint: "unrecognised-source-type",
        },
      ],
      asOf: "2026-05-15",
    });

    expect(result.substrateGap.length).toBe(1);
    expect(result.unexplained.length).toBe(0);
    expect(result.escalate).toBe(false);
  });
});
