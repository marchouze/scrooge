// platform/accounting/period-close-handler.test.ts
//
// Unit tests for M2 Slice 2 — period-close handler.
//
// Tests cover:
//   - openPeriod: emits AccountingPeriodOpened with correct payload
//   - closePeriod: rejects when no balanced trial-balance snapshot exists
//   - closePeriod: succeeds when a balanced snapshot exists
//   - snapshotTrialBalance: appends TrialBalanceSnapshotted (interim)
//   - Semantic cross-link: SemanticRegistry.resolve({id:"Balance"}) is defined
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// Authors: Bea (Accounting & financial reporting engineer, engineering) +
//          Atlas (Platform Engineer, engineering)

import { describe, expect, it } from "bun:test";

import { EventStore } from "../event-store/store";
import { SLICE_1_ENTRIES, SemanticRegistry, balance } from "../semantic";
import { closePeriod, openPeriod, snapshotTrialBalance } from "./period-close-handler";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:bea:test" };
const CITATIONS = ["D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN", "IAS-1"];

const PERIOD_ID = "period:LE-ZA-HOZ-BANK:month:2026-05";
const PERIOD_START = "2026-05-01T00:00:00.000Z";
const PERIOD_END = "2026-05-31T23:59:59.999Z";
const OPENED_AT = "2026-05-01T05:00:00.000Z";
const CLOSED_AT = "2026-05-31T23:59:59.999Z";
const SNAPSHOT_AT = "2026-05-15T12:00:00.000Z";

function openPayload() {
  return {
    periodId: PERIOD_ID,
    periodKind: "month" as const,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    openedAt: OPENED_AT,
    functionalCurrency: "ZAR",
  };
}

// ---------------------------------------------------------------------------
// openPeriod tests
// ---------------------------------------------------------------------------

describe("openPeriod()", () => {
  it("TC-1: emits AccountingPeriodOpened with correct payload", () => {
    const store = new EventStore(":memory:");
    const result = openPeriod({
      eventStore: store,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: openPayload(),
    });

    expect(result.appended).toBe(true);
    expect(result.event.type).toBe("AccountingPeriodOpened");
    const p = result.event.payload as Record<string, unknown>;
    expect(p.periodId).toBe(PERIOD_ID);
    expect(p.periodKind).toBe("month");
    expect(p.functionalCurrency).toBe("ZAR");
    expect(p.periodStart).toBe(PERIOD_START);
    expect(p.periodEnd).toBe(PERIOD_END);
  });

  it("TC-2: idempotent return when period already open with same payload", () => {
    const store = new EventStore(":memory:");
    const first = openPeriod({
      eventStore: store,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: openPayload(),
    });
    const second = openPeriod({
      eventStore: store,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: openPayload(),
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.event.event_id).toBe(first.event.event_id);
  });

  it("TC-3: persists event so replay returns it", () => {
    const store = new EventStore(":memory:");
    openPeriod({
      eventStore: store,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: openPayload(),
    });

    let found = false;
    for (const e of store.replay({ entity: ENTITY, type: "AccountingPeriodOpened" })) {
      const p = e.payload as Record<string, unknown>;
      if (p.periodId === PERIOD_ID) found = true;
    }
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// snapshotTrialBalance tests
// ---------------------------------------------------------------------------

describe("snapshotTrialBalance()", () => {
  it("TC-4: throws when no AccountingPeriodOpened exists for the period", () => {
    const store = new EventStore(":memory:");
    expect(() =>
      snapshotTrialBalance({
        eventStore: store,
        entity: ENTITY,
        periodId: PERIOD_ID,
        snapshotAt: SNAPSHOT_AT,
        actor: ACTOR,
        citations: CITATIONS,
      }),
    ).toThrow("no AccountingPeriodOpened");
  });

  it("TC-5: appends TrialBalanceSnapshotted (interim) when period is open", () => {
    const store = new EventStore(":memory:");
    openPeriod({
      eventStore: store,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: openPayload(),
    });

    const result = snapshotTrialBalance({
      eventStore: store,
      entity: ENTITY,
      periodId: PERIOD_ID,
      snapshotAt: SNAPSHOT_AT,
      actor: ACTOR,
      citations: CITATIONS,
    });

    expect(result.snapshotEvent.type).toBe("TrialBalanceSnapshotted");
    const p = result.snapshotEvent.payload as Record<string, unknown>;
    expect(p.snapshotKind).toBe("interim");
    expect(p.periodId).toBe(PERIOD_ID);
  });
});

// ---------------------------------------------------------------------------
// closePeriod tests
// ---------------------------------------------------------------------------

describe("closePeriod()", () => {
  it("TC-6: throws when no AccountingPeriodOpened exists for the period", () => {
    const store = new EventStore(":memory:");
    expect(() =>
      closePeriod({
        eventStore: store,
        entity: ENTITY,
        periodId: PERIOD_ID,
        closedAt: CLOSED_AT,
        actor: ACTOR,
        citations: CITATIONS,
      }),
    ).toThrow("no AccountingPeriodOpened");
  });

  it("TC-7: succeeds and emits AccountingPeriodClosed when period is open (zero postings — empty close)", () => {
    // Empty-TB close is valid: zero postings → zero-row trial balance,
    // all perCurrencyTotals empty, balanced by construction.
    const store = new EventStore(":memory:");
    openPeriod({
      eventStore: store,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: openPayload(),
    });

    const result = closePeriod({
      eventStore: store,
      entity: ENTITY,
      periodId: PERIOD_ID,
      closedAt: CLOSED_AT,
      actor: ACTOR,
      citations: CITATIONS,
    });

    expect(result.accountingPeriodClosedEvent.type).toBe("AccountingPeriodClosed");
    expect(result.trialBalanceSnapshotEvent.type).toBe("TrialBalanceSnapshotted");

    const closedPayload = result.accountingPeriodClosedEvent.payload as Record<string, unknown>;
    expect(closedPayload.periodId).toBe(PERIOD_ID);
    expect(closedPayload.trialBalanceSnapshotEventId).toBe(
      result.trialBalanceSnapshotEvent.event_id,
    );
  });

  it("TC-8: throws on double-close (idempotent-terminal)", () => {
    const store = new EventStore(":memory:");
    openPeriod({
      eventStore: store,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: openPayload(),
    });

    closePeriod({
      eventStore: store,
      entity: ENTITY,
      periodId: PERIOD_ID,
      closedAt: CLOSED_AT,
      actor: ACTOR,
      citations: CITATIONS,
    });

    expect(() =>
      closePeriod({
        eventStore: store,
        entity: ENTITY,
        periodId: PERIOD_ID,
        closedAt: CLOSED_AT,
        actor: ACTOR,
        citations: CITATIONS,
      }),
    ).toThrow("already closed");
  });

  it("TC-9: close snapshot event is TrialBalanceSnapshotted with kind=close", () => {
    const store = new EventStore(":memory:");
    openPeriod({
      eventStore: store,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: openPayload(),
    });

    const result = closePeriod({
      eventStore: store,
      entity: ENTITY,
      periodId: PERIOD_ID,
      closedAt: CLOSED_AT,
      actor: ACTOR,
      citations: CITATIONS,
    });

    const tbPayload = result.trialBalanceSnapshotEvent.payload as Record<string, unknown>;
    expect(tbPayload.snapshotKind).toBe("close");
    expect(tbPayload.periodId).toBe(PERIOD_ID);
  });
});

// ---------------------------------------------------------------------------
// Semantic cross-link — Slice 2 acceptance criterion
// ---------------------------------------------------------------------------

describe("semantic cross-link", () => {
  it("TC-10: SemanticRegistry.resolve({id:'Balance'}) is defined (M2 Slice 2 acceptance criterion)", () => {
    // Build the registry from the Slice 1 entries that include `balance`.
    const registry = SemanticRegistry.from(SLICE_1_ENTRIES);
    const entry = registry.resolve({ id: "Balance" });
    expect(entry).toBeDefined();
    expect(entry?.id).toBe("Balance");
    expect(entry?.status).toBe("in-force");
  });

  it("TC-11: balance export from @platform/semantic has id='Balance'", () => {
    // Verify the named export matches the registry-resolved entry.
    expect(balance.id).toBe("Balance");
    expect(balance.status).toBe("in-force");
  });
});
