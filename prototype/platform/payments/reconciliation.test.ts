// platform/payments/reconciliation.test.ts
//
// Tests for the three-way reconciliation harness (PROC-PAY-RBH-01):
//   - TC-1: Sunny-day: all three legs present, amounts match → clean
//   - TC-2: Amount break: payment.netCash !== settlement.netCash
//   - TC-3: Timing break: payment leg missing within 4h of settlementDate
//   - TC-4: Nostro break: payment settled, ledger missing after 4h
//   - TC-5: Nostro break: payment leg missing after 4h past settlementDate
//   - TC-6: DailyReconciliationReport emitted with correct counts
//   - TC-7: Dry-run: no events emitted even on breaks
//   - TC-8: Multiple trade IDs — mixed results
//
// Authority: PROC-PAY-RBH-01, NPS-ACT-78-1998, BANKS-ACT-94-1990
// Authors: Tomas (Operations & payments engineer, engineering),
//          Bea (Accounting & financial reporting engineer, engineering),
//          Atlas (Core Banking Platform Architect, engineering — substrate)

import { describe, expect, it } from "bun:test";

import {
  makeJournalEntryPosted,
  makePaymentSettled,
  makeSettlementInstructionReceived,
} from "../event-store/event-types/payments";
import { EventStore } from "../event-store/store";
import { runThreeWayReconciliation } from "./reconciliation";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const AS_OF = "2026-05-16";
const ENTITY = "BANK-ZA-001";
const ACTOR = { type: "service" as const, id: "agent:tomas:test" };
const CITATIONS = ["PROC-PAY-RBH-01", "NPS-ACT-78-1998"];

/** A point in time well within 4h of settlementDate (1h later). */
function within4h(settlementDate: string): string {
  const d = new Date(`${settlementDate}T00:00:00.000Z`);
  d.setUTCHours(d.getUTCHours() + 1);
  return d.toISOString();
}

function makeStore(): EventStore {
  return new EventStore(":memory:");
}

function appendSettlementInstruction(
  store: EventStore,
  tradeId: string,
  netCash: number,
  settlementDate = AS_OF,
): void {
  store.append(
    makeSettlementInstructionReceived({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId,
        legKind: "receive",
        settlementDate,
        currency: "ZAR",
        netCash,
        correspondent: { name: "Standard Bank", bic: "SBZAZAJJ" },
        citations: CITATIONS,
      },
    }),
  );
}

function appendPaymentSettled(
  store: EventStore,
  tradeId: string,
  netCash: number,
  settledAt: string,
): void {
  store.append(
    makePaymentSettled({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId,
        legKind: "receive",
        paymentRef: `PAY-${tradeId}`,
        currency: "ZAR",
        netCash,
        settledAt,
        citations: CITATIONS,
      },
    }),
  );
}

function appendJournalEntry(store: EventStore, tradeId: string, amountMinor: number): void {
  store.append(
    makeJournalEntryPosted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId,
        accountDebit: "ACC-1001-001",
        accountCredit: "ACC-2001-001",
        currency: "ZAR",
        amountMinor,
        postedAt: new Date().toISOString(),
        citations: CITATIONS,
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// TC-1: Sunny-day — all three legs present, amounts match
// ---------------------------------------------------------------------------

describe("TC-1: sunny-day — all three legs present and amounts match", () => {
  it("returns matchedCount=1 and breakCount=0", () => {
    const store = makeStore();
    appendSettlementInstruction(store, "TRADE-001", 100000);
    appendPaymentSettled(store, "TRADE-001", 100000, within4h(AS_OF));
    appendJournalEntry(store, "TRADE-001", 100000);

    const result = runThreeWayReconciliation(AS_OF, true, store);

    expect(result.matchedCount).toBe(1);
    expect(result.breakCount).toBe(0);
    expect(result.breaks).toHaveLength(0);
  });

  it("emits no ReconciliationBreak events", () => {
    const store = makeStore();
    appendSettlementInstruction(store, "TRADE-001", 100000);
    appendPaymentSettled(store, "TRADE-001", 100000, within4h(AS_OF));
    appendJournalEntry(store, "TRADE-001", 100000);

    runThreeWayReconciliation(AS_OF, false, store);

    let breakCount = 0;
    for (const e of store.replay({ type: "ReconciliationBreak" })) {
      void e;
      breakCount++;
    }
    expect(breakCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TC-2: Amount break — payment.netCash !== settlement.netCash
// ---------------------------------------------------------------------------

describe("TC-2: amount break — payment amount differs from settlement instruction", () => {
  it("returns matchedCount=0, breakCount=1, break.kind=amount", () => {
    const store = makeStore();
    appendSettlementInstruction(store, "TRADE-002", 100000);
    appendPaymentSettled(store, "TRADE-002", 99000, within4h(AS_OF)); // mismatch
    appendJournalEntry(store, "TRADE-002", 99000);

    const result = runThreeWayReconciliation(AS_OF, true, store);

    expect(result.matchedCount).toBe(0);
    expect(result.breakCount).toBe(1);
    expect(result.breaks).toHaveLength(1);
    expect(result.breaks[0]?.kind).toBe("amount");
    expect(result.breaks[0]?.tradeId).toBe("TRADE-002");
    expect(result.breaks[0]?.tradeAmount).toBe(100000);
    expect(result.breaks[0]?.paymentAmount).toBe(99000);
  });

  it("emits ReconciliationBreak event with kind=amount", () => {
    const store = makeStore();
    appendSettlementInstruction(store, "TRADE-002", 100000);
    appendPaymentSettled(store, "TRADE-002", 99000, within4h(AS_OF));
    appendJournalEntry(store, "TRADE-002", 99000);

    runThreeWayReconciliation(AS_OF, false, store);

    let found = false;
    for (const e of store.replay({ type: "ReconciliationBreak" })) {
      const p = e.payload as { kind: string; tradeId: string };
      if (p.tradeId === "TRADE-002" && p.kind === "amount") found = true;
    }
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-3: Timing break — payment leg missing, within 4h of settlementDate
// ---------------------------------------------------------------------------

describe("TC-3: timing break — payment leg missing, settlement date today or future", () => {
  it("returns break.kind=timing when settlement date is today", () => {
    // Use today as the settlementDate — payment is still expected today, so timing.
    const today = new Date().toISOString().slice(0, 10);
    const store2 = makeStore();
    store2.append(
      makeSettlementInstructionReceived({
        asOf: today,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "TRADE-003",
          legKind: "receive",
          settlementDate: today,
          currency: "ZAR",
          netCash: 50000,
          correspondent: { name: "Standard Bank", bic: "SBZAZAJJ" },
          citations: CITATIONS,
        },
      }),
    );
    // No PaymentSettled appended — payment leg missing.

    const result = runThreeWayReconciliation(today, true, store2);

    expect(result.breakCount).toBe(1);
    expect(result.breaks[0]?.kind).toBe("timing");
    expect(result.breaks[0]?.tradeId).toBe("TRADE-003");
  });
});

// ---------------------------------------------------------------------------
// TC-4: Nostro break — payment settled, ledger missing after 4h
// ---------------------------------------------------------------------------

describe("TC-4: nostro break — payment settled but ledger leg missing after 4h", () => {
  it("returns break.kind=nostro when settledAt is >4h ago", () => {
    const store = makeStore();
    // settledAt is well in the past (6h ago).
    const pastSettledAt = new Date();
    pastSettledAt.setUTCHours(pastSettledAt.getUTCHours() - 6);

    appendSettlementInstruction(store, "TRADE-004", 75000);
    appendPaymentSettled(store, "TRADE-004", 75000, pastSettledAt.toISOString());
    // No JournalEntryPosted — ledger leg missing.

    const result = runThreeWayReconciliation(AS_OF, true, store);

    expect(result.breakCount).toBe(1);
    expect(result.breaks[0]?.kind).toBe("nostro");
    expect(result.breaks[0]?.tradeId).toBe("TRADE-004");
  });

  it("emits ReconciliationBreak event with kind=nostro", () => {
    const store = makeStore();
    const pastSettledAt = new Date();
    pastSettledAt.setUTCHours(pastSettledAt.getUTCHours() - 6);

    appendSettlementInstruction(store, "TRADE-004", 75000);
    appendPaymentSettled(store, "TRADE-004", 75000, pastSettledAt.toISOString());

    runThreeWayReconciliation(AS_OF, false, store);

    let found = false;
    for (const e of store.replay({ type: "ReconciliationBreak" })) {
      const p = e.payload as { kind: string; tradeId: string };
      if (p.tradeId === "TRADE-004" && p.kind === "nostro") found = true;
    }
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TC-5: Nostro break — payment missing after 4h past settlementDate
// ---------------------------------------------------------------------------

describe("TC-5: nostro break — payment leg missing after 4h past settlementDate", () => {
  it("returns break.kind=nostro when settlementDate is >4h in the past", () => {
    const store = makeStore();
    // settlementDate is well in the past — one day before AS_OF.
    // Use a fixed date relative to AS_OF (not wall-clock) so the test
    // is stable regardless of when it runs. The settlement instruction's
    // asOf must also be <= AS_OF for the reconciliation reader to pick it up.
    const dayBeforeAsOf = "2026-05-15"; // one day before AS_OF = "2026-05-16"

    store.append(
      makeSettlementInstructionReceived({
        asOf: dayBeforeAsOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "TRADE-005",
          legKind: "receive",
          settlementDate: dayBeforeAsOf,
          currency: "ZAR",
          netCash: 200000,
          correspondent: { name: "Standard Bank", bic: "SBZAZAJJ" },
          citations: CITATIONS,
        },
      }),
    );
    // No PaymentSettled appended.

    const result = runThreeWayReconciliation(AS_OF, true, store);

    expect(result.breakCount).toBe(1);
    expect(result.breaks[0]?.kind).toBe("nostro");
    expect(result.breaks[0]?.tradeId).toBe("TRADE-005");
  });
});

// ---------------------------------------------------------------------------
// TC-6: DailyReconciliationReport emitted with correct counts
// ---------------------------------------------------------------------------

describe("TC-6: DailyReconciliationReport emitted with correct counts", () => {
  it("emits exactly one DailyReconciliationReport with matchedCount and breakCount", () => {
    const store = makeStore();
    // One matched trade.
    appendSettlementInstruction(store, "TRADE-010", 100000);
    appendPaymentSettled(store, "TRADE-010", 100000, within4h(AS_OF));
    appendJournalEntry(store, "TRADE-010", 100000);
    // One amount break.
    appendSettlementInstruction(store, "TRADE-011", 100000);
    appendPaymentSettled(store, "TRADE-011", 90000, within4h(AS_OF));
    appendJournalEntry(store, "TRADE-011", 90000);

    runThreeWayReconciliation(AS_OF, false, store);

    let reportCount = 0;
    let reportPayload: { matchedCount?: number; breakCount?: number } = {};
    for (const e of store.replay({ type: "DailyReconciliationReport" })) {
      reportCount++;
      reportPayload = e.payload as { matchedCount?: number; breakCount?: number };
    }
    expect(reportCount).toBe(1);
    expect(reportPayload.matchedCount).toBe(1);
    expect(reportPayload.breakCount).toBe(1);
  });

  it("dry-run: no DailyReconciliationReport emitted", () => {
    const store = makeStore();
    appendSettlementInstruction(store, "TRADE-020", 100000);
    appendPaymentSettled(store, "TRADE-020", 100000, within4h(AS_OF));
    appendJournalEntry(store, "TRADE-020", 100000);

    runThreeWayReconciliation(AS_OF, true, store);

    let count = 0;
    for (const e of store.replay({ type: "DailyReconciliationReport" })) {
      void e;
      count++;
    }
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TC-7: Dry-run — no events emitted even on breaks
// ---------------------------------------------------------------------------

describe("TC-7: dry-run mode", () => {
  it("returns break results but emits no events", () => {
    const store = makeStore();
    appendSettlementInstruction(store, "TRADE-DRY", 100000);
    appendPaymentSettled(store, "TRADE-DRY", 80000, within4h(AS_OF)); // amount mismatch
    appendJournalEntry(store, "TRADE-DRY", 80000);

    const result = runThreeWayReconciliation(AS_OF, true, store);

    expect(result.breakCount).toBe(1);
    expect(result.breaks[0]?.kind).toBe("amount");

    // No break events should have been appended.
    let breakEventCount = 0;
    for (const e of store.replay({ type: "ReconciliationBreak" })) {
      void e;
      breakEventCount++;
    }
    expect(breakEventCount).toBe(0);

    let reportCount = 0;
    for (const e of store.replay({ type: "DailyReconciliationReport" })) {
      void e;
      reportCount++;
    }
    expect(reportCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// TC-8: Multiple trade IDs — mixed results
// ---------------------------------------------------------------------------

describe("TC-8: multiple trade IDs with mixed results", () => {
  it("correctly counts matched vs breaks across multiple trades", () => {
    const store = makeStore();
    // Trade 1: clean match
    appendSettlementInstruction(store, "TRADE-M1", 100000);
    appendPaymentSettled(store, "TRADE-M1", 100000, within4h(AS_OF));
    appendJournalEntry(store, "TRADE-M1", 100000);

    // Trade 2: clean match
    appendSettlementInstruction(store, "TRADE-M2", 200000);
    appendPaymentSettled(store, "TRADE-M2", 200000, within4h(AS_OF));
    appendJournalEntry(store, "TRADE-M2", 200000);

    // Trade 3: amount break
    appendSettlementInstruction(store, "TRADE-M3", 150000);
    appendPaymentSettled(store, "TRADE-M3", 140000, within4h(AS_OF));
    appendJournalEntry(store, "TRADE-M3", 140000);

    // Trade 4: nostro (ledger missing, payment >4h ago)
    const pastSettledAt = new Date();
    pastSettledAt.setUTCHours(pastSettledAt.getUTCHours() - 6);
    appendSettlementInstruction(store, "TRADE-M4", 50000);
    appendPaymentSettled(store, "TRADE-M4", 50000, pastSettledAt.toISOString());
    // No JournalEntryPosted.

    const result = runThreeWayReconciliation(AS_OF, true, store);

    expect(result.matchedCount).toBe(2);
    expect(result.breakCount).toBe(2);

    const kinds = result.breaks.map((b) => b.kind).sort();
    expect(kinds).toEqual(["amount", "nostro"]);
  });
});

// ---------------------------------------------------------------------------
// TC-9: Empty event store — no trade legs → no output
// ---------------------------------------------------------------------------

describe("TC-9: empty event store", () => {
  it("returns matchedCount=0 and breakCount=0 when no events exist", () => {
    const store = makeStore();
    const result = runThreeWayReconciliation(AS_OF, true, store);
    expect(result.matchedCount).toBe(0);
    expect(result.breakCount).toBe(0);
    expect(result.breaks).toHaveLength(0);
  });
});
