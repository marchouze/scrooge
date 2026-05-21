// platform/recon/gl-ledger-coverage.test.ts
//
// Fixture tests for recon:gl-ledger-coverage. Synthetic FX-spot trade
// runs through the full lifecycle and the recon is asserted to:
//   - pass when every event has its expected postings (or zero, where
//     IFRS 9 §5.5.1 dictates),
//   - fail when an FX event is missing its posting,
//   - fail when a `neither-delivered` failure carries a posting,
//   - fail when trial balance is non-zero at a close,
//   - fail when an accountId is not in the chart-of-accounts,
//   - pass on empty event-store / no closes (empty-state correctness).
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, it } from "bun:test";

import { run } from "./gl-ledger-coverage";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

interface MinimalEvent {
  event_id: string;
  type: string;
  as_of: string;
  payload: Record<string, unknown>;
}

const COA_IDS = new Set([
  "ACC-1000-001",
  "ACC-1100-001",
  "ACC-1100-002",
  "ACC-2100-001",
  "ACC-2100-002",
  "ACC-2300-001",
  "ACC-2300-002",
  "ACC-2300-003",
  "ACC-2300-004",
  "ACC-4000-001",
]);

function mkTrade(eventId = "evt-trade-001"): MinimalEvent {
  return {
    event_id: eventId,
    type: "FxTradeExecuted",
    as_of: "2026-05-21T09:00:00.000Z",
    payload: { tradeId: "T-001", currencyPair: { base: "ZAR", quote: "USD" } },
  };
}

function mkBalancedPosting(
  sourceEventId: string,
  opts?: { accountIds?: [string, string]; eventId?: string },
): MinimalEvent {
  const [drId, crId] = opts?.accountIds ?? ["ACC-1100-001", "ACC-2100-001"];
  return {
    event_id: opts?.eventId ?? `evt-post-${sourceEventId}`,
    type: "SubLedgerPostingEmitted",
    as_of: "2026-05-21T09:00:01.000Z",
    payload: {
      sourceEventId,
      postingType: "trade-booking",
      postedAt: "2026-05-21T09:00:01.000Z",
      legs: [
        { accountId: drId, debitCredit: "debit", amountMinor: 100_000, currency: "ZAR" },
        { accountId: crId, debitCredit: "credit", amountMinor: 100_000, currency: "ZAR" },
      ],
    },
  };
}

function mkUnbalancedPosting(sourceEventId: string): MinimalEvent {
  return {
    event_id: `evt-post-unbal-${sourceEventId}`,
    type: "SubLedgerPostingEmitted",
    as_of: "2026-05-21T09:00:01.000Z",
    payload: {
      sourceEventId,
      postingType: "trade-booking",
      postedAt: "2026-05-21T09:00:01.000Z",
      legs: [
        // 100 dr, 70 cr — unbalanced; would normally fail schema refine,
        // but we bypass schema here to simulate a regression.
        {
          accountId: "ACC-1100-001",
          debitCredit: "debit",
          amountMinor: 100_000,
          currency: "ZAR",
        },
        { accountId: "ACC-2100-001", debitCredit: "credit", amountMinor: 70_000, currency: "ZAR" },
      ],
    },
  };
}

function mkClose(eventId = "evt-close-001", cutoff = "2026-05-31T23:59:59.000Z"): MinimalEvent {
  return {
    event_id: eventId,
    type: "PeriodClosed",
    as_of: "2026-06-01T08:00:00.000Z",
    payload: {
      periodId: "period:bank-za-001:month:2026-05",
      cutoffTs: cutoff,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("recon:gl-ledger-coverage — happy paths", () => {
  it("passes on an empty event store (vacuous)", () => {
    const r = run({ events: [], chartOfAccountsAccountIds: COA_IDS });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
  });

  it("passes when every FX event has a matching posting (booking-only fixture)", () => {
    const trade = mkTrade();
    const posting = mkBalancedPosting(trade.event_id);
    const r = run({ events: [trade, posting], chartOfAccountsAccountIds: COA_IDS });
    expect(r.ok).toBe(true);
  });

  it("passes when neither-delivered failure produces zero postings (IFRS 9 §5.5.1)", () => {
    const trade = mkTrade();
    const tradePosting = mkBalancedPosting(trade.event_id);
    const fail: MinimalEvent = {
      event_id: "evt-fail-001",
      type: "FxSettlementFailed",
      as_of: "2026-05-21T15:00:00.000Z",
      payload: {
        tradeRef: "T-001",
        failureKind: "neither-delivered",
        legStatus: { payLegDelivered: false, receiveLegDelivered: false },
      },
    };
    const r = run({ events: [trade, tradePosting, fail], chartOfAccountsAccountIds: COA_IDS });
    expect(r.ok).toBe(true);
  });

  it("passes when one-leg-delivered failure has its PR-FX-005 default-recognition posting", () => {
    const trade = mkTrade();
    const tradePosting = mkBalancedPosting(trade.event_id);
    const fail: MinimalEvent = {
      event_id: "evt-fail-002",
      type: "FxSettlementFailed",
      as_of: "2026-05-21T15:00:00.000Z",
      payload: {
        tradeRef: "T-001",
        failureKind: "one-leg-delivered",
        legStatus: { payLegDelivered: true, receiveLegDelivered: false },
      },
    };
    const eclPosting: MinimalEvent = {
      event_id: "evt-post-ecl-001",
      type: "SubLedgerPostingEmitted",
      as_of: "2026-05-21T15:00:01.000Z",
      payload: {
        sourceEventId: fail.event_id,
        postingType: "settlement",
        postedAt: "2026-05-21T15:00:01.000Z",
        legs: [
          {
            accountId: "ACC-2300-004",
            debitCredit: "debit",
            amountMinor: 50_000,
            currency: "ZAR",
          },
          {
            accountId: "ACC-2300-003",
            debitCredit: "credit",
            amountMinor: 50_000,
            currency: "ZAR",
          },
        ],
      },
    };
    const r = run({
      events: [trade, tradePosting, fail, eclPosting],
      chartOfAccountsAccountIds: COA_IDS,
    });
    expect(r.ok).toBe(true);
  });
});

describe("recon:gl-ledger-coverage — failure modes", () => {
  it("fails when an FxTradeExecuted has no posting", () => {
    const trade = mkTrade();
    const r = run({ events: [trade], chartOfAccountsAccountIds: COA_IDS });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("GL coverage gap"))).toBe(true);
  });

  it("fails when neither-delivered HAS a posting (IFRS 9 §5.5.1 violation)", () => {
    const trade = mkTrade();
    const tradePosting = mkBalancedPosting(trade.event_id);
    const fail: MinimalEvent = {
      event_id: "evt-fail-003",
      type: "FxSettlementFailed",
      as_of: "2026-05-21T15:00:00.000Z",
      payload: {
        tradeRef: "T-001",
        failureKind: "neither-delivered",
        legStatus: { payLegDelivered: false, receiveLegDelivered: false },
      },
    };
    // Buggy regression: a posting against the mutual-fail event.
    const badPosting = mkBalancedPosting(fail.event_id, {
      eventId: "evt-bad-posting",
      accountIds: ["ACC-2300-004", "ACC-2300-003"],
    });
    const r = run({
      events: [trade, tradePosting, fail, badPosting],
      chartOfAccountsAccountIds: COA_IDS,
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("IFRS 9 §5.5.1 violation"))).toBe(true);
  });

  it("fails when one-leg-delivered has no posting", () => {
    const trade = mkTrade();
    const tradePosting = mkBalancedPosting(trade.event_id);
    const fail: MinimalEvent = {
      event_id: "evt-fail-004",
      type: "FxSettlementFailed",
      as_of: "2026-05-21T15:00:00.000Z",
      payload: {
        tradeRef: "T-001",
        failureKind: "one-leg-delivered",
        legStatus: { payLegDelivered: true, receiveLegDelivered: false },
      },
    };
    const r = run({ events: [trade, tradePosting, fail], chartOfAccountsAccountIds: COA_IDS });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some((v) => v.message.includes("one-leg-delivered") && v.severity === "fail"),
    ).toBe(true);
  });

  it("fails on phantom source event (sourceEventId not in store)", () => {
    const orphan: MinimalEvent = {
      event_id: "evt-post-orphan",
      type: "SubLedgerPostingEmitted",
      as_of: "2026-05-21T09:00:01.000Z",
      payload: {
        sourceEventId: "evt-does-not-exist",
        postingType: "trade-booking",
        postedAt: "2026-05-21T09:00:01.000Z",
        legs: [
          {
            accountId: "ACC-1100-001",
            debitCredit: "debit",
            amountMinor: 100_000,
            currency: "ZAR",
          },
          {
            accountId: "ACC-2100-001",
            debitCredit: "credit",
            amountMinor: 100_000,
            currency: "ZAR",
          },
        ],
      },
    };
    const r = run({ events: [orphan], chartOfAccountsAccountIds: COA_IDS });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("Phantom-source-event"))).toBe(true);
  });

  it("fails on phantom accountId not in chart-of-accounts", () => {
    const trade = mkTrade();
    const posting = mkBalancedPosting(trade.event_id, {
      accountIds: ["ACC-9999-999", "ACC-2100-001"],
    });
    const r = run({ events: [trade, posting], chartOfAccountsAccountIds: COA_IDS });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("Phantom account"))).toBe(true);
  });

  it("fails when trial balance does not close at zero at PeriodClosed", () => {
    const trade = mkTrade();
    const unbal = mkUnbalancedPosting(trade.event_id);
    const close = mkClose();
    const r = run({ events: [trade, unbal, close], chartOfAccountsAccountIds: COA_IDS });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("Trial-balance integrity break"))).toBe(
      true,
    );
  });

  it("passes when trial balance closes at zero at PeriodClosed", () => {
    const trade = mkTrade();
    const posting = mkBalancedPosting(trade.event_id);
    const close = mkClose();
    const r = run({ events: [trade, posting, close], chartOfAccountsAccountIds: COA_IDS });
    expect(r.ok).toBe(true);
  });
});

describe("recon:gl-ledger-coverage — chart-of-accounts integration", () => {
  it("loads chart-of-accounts.json from disk by default", () => {
    // No override — recon should load the real CoA. Empty event set → vacuous pass.
    const r = run({ events: [] });
    expect(r.ok).toBe(true);
  });
});
