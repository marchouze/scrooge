// tests/unposted-trades-check.test.ts
//
// MC2 unposted-trades check — exit-criterion tests for
// platform/accounting/unposted-trades-check.ts.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
// Procedure: PROC-FIN-MC-01 §5 MC2
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, it } from "bun:test";

import { checkUnpostedTrades } from "../platform/accounting/unposted-trades-check";
import type { UnpostedTradeEvent } from "../platform/accounting/unposted-trades-check";
import type { SubLedgerPostingEmittedPayload } from "../platform/event-store/event-types/fx-accounting";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PERIOD_END = "2026-05-31";

function makeTrade(
  id: string,
  tradeId: string,
  valueDate: string,
  eventType = "FxTradeExecuted",
): UnpostedTradeEvent {
  return { eventId: id, eventType, valueDate, tradeId };
}

function makePosting(sourceEventId: string): SubLedgerPostingEmittedPayload {
  return {
    sourceEventId,
    postingType: "trade-booking",
    legs: [
      { accountId: "ACC-1200-001", debitCredit: "debit", amountMinor: 100_000, currency: "ZAR" },
      { accountId: "ACC-2100-001", debitCredit: "credit", amountMinor: 100_000, currency: "ZAR" },
    ],
    postedAt: "2026-05-15T10:00:00.000Z",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkUnpostedTrades", () => {
  it("returns ok:true and empty unposted when all trades are posted", () => {
    const trades = [
      makeTrade("evt-001", "TRD-001", "2026-05-10"),
      makeTrade("evt-002", "TRD-002", "2026-05-20"),
    ];
    const postings = [makePosting("evt-001"), makePosting("evt-002")];

    const result = checkUnpostedTrades({
      tradeEvents: trades,
      postingEvents: postings,
      periodEnd: PERIOD_END,
    });

    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
    expect(result.unposted).toHaveLength(0);
  });

  it("returns ok:false and lists unposted trades when a trade has no posting", () => {
    const trades = [
      makeTrade("evt-001", "TRD-001", "2026-05-10"),
      makeTrade("evt-002", "TRD-002", "2026-05-20"), // no posting for this one
    ];
    const postings = [makePosting("evt-001")];

    const result = checkUnpostedTrades({
      tradeEvents: trades,
      postingEvents: postings,
      periodEnd: PERIOD_END,
    });

    expect(result.ok).toBe(false);
    expect(result.count).toBe(1);
    expect(result.unposted[0]?.eventId).toBe("evt-002");
    expect(result.unposted[0]?.tradeId).toBe("TRD-002");
  });

  it("excludes trades with valueDate after periodEnd", () => {
    const trades = [
      makeTrade("evt-001", "TRD-001", "2026-05-31"), // on the last day — included
      makeTrade("evt-002", "TRD-002", "2026-06-01"), // next month — excluded
    ];
    const postings: SubLedgerPostingEmittedPayload[] = []; // no postings

    const result = checkUnpostedTrades({
      tradeEvents: trades,
      postingEvents: postings,
      periodEnd: PERIOD_END,
    });

    // Only evt-001 falls within the period — evt-002 is excluded.
    expect(result.ok).toBe(false);
    expect(result.count).toBe(1);
    expect(result.unposted[0]?.eventId).toBe("evt-001");
  });

  it("returns ok:true with no trades in the period", () => {
    const trades = [
      makeTrade("evt-001", "TRD-001", "2026-06-05"), // future
    ];
    const postings: SubLedgerPostingEmittedPayload[] = [];

    const result = checkUnpostedTrades({
      tradeEvents: trades,
      postingEvents: postings,
      periodEnd: PERIOD_END,
    });

    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
  });

  it("returns ok:true with empty trade and posting arrays", () => {
    const result = checkUnpostedTrades({
      tradeEvents: [],
      postingEvents: [],
      periodEnd: PERIOD_END,
    });

    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
    expect(result.unposted).toHaveLength(0);
  });

  it("handles multiple trades posted correctly and multiple unposted", () => {
    const trades = [
      makeTrade("evt-001", "TRD-001", "2026-05-01"),
      makeTrade("evt-002", "TRD-002", "2026-05-02"),
      makeTrade("evt-003", "TRD-003", "2026-05-03"),
      makeTrade("evt-004", "TRD-004", "2026-05-04"),
    ];
    const postings = [makePosting("evt-001"), makePosting("evt-004")];

    const result = checkUnpostedTrades({
      tradeEvents: trades,
      postingEvents: postings,
      periodEnd: PERIOD_END,
    });

    expect(result.ok).toBe(false);
    expect(result.count).toBe(2);
    const unpostedIds = result.unposted.map((u) => u.eventId).sort();
    expect(unpostedIds).toEqual(["evt-002", "evt-003"]);
  });

  it("respects different event types (not only FxTradeExecuted)", () => {
    const trades = [makeTrade("evt-bond-001", "BOND-001", "2026-05-10", "BondTradeBooked")];
    const postings: SubLedgerPostingEmittedPayload[] = []; // no posting

    const result = checkUnpostedTrades({
      tradeEvents: trades,
      postingEvents: postings,
      periodEnd: PERIOD_END,
    });

    expect(result.ok).toBe(false);
    expect(result.unposted[0]?.eventType).toBe("BondTradeBooked");
  });

  it("correctly matches by eventId not tradeId", () => {
    // Two trades sharing the same tradeId but different eventIds
    const trades = [
      makeTrade("evt-a", "TRD-SAME", "2026-05-10"),
      makeTrade("evt-b", "TRD-SAME", "2026-05-11"),
    ];
    // Only evt-a has a posting
    const postings = [makePosting("evt-a")];

    const result = checkUnpostedTrades({
      tradeEvents: trades,
      postingEvents: postings,
      periodEnd: PERIOD_END,
    });

    expect(result.ok).toBe(false);
    expect(result.count).toBe(1);
    expect(result.unposted[0]?.eventId).toBe("evt-b");
  });

  it("count matches unposted array length", () => {
    const trades = [
      makeTrade("evt-001", "TRD-001", "2026-05-01"),
      makeTrade("evt-002", "TRD-002", "2026-05-02"),
      makeTrade("evt-003", "TRD-003", "2026-05-03"),
    ];
    const postings: SubLedgerPostingEmittedPayload[] = [];

    const result = checkUnpostedTrades({
      tradeEvents: trades,
      postingEvents: postings,
      periodEnd: PERIOD_END,
    });

    expect(result.count).toBe(result.unposted.length);
    expect(result.count).toBe(3);
  });
});
