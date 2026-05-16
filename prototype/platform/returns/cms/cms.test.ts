// platform/returns/cms/cms.test.ts
//
// M3 Slice 8 — Unit tests for the CMS (Conduct Management System) layer.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10).
//
// Asserts:
//   1. All numeric metric cells are non-NaN.
//   2. `status === "rehearsal"` for empty event store.
//   3. Non-regulated entity is silently skipped.
//   4. TCF outcome breakdown sums to `totalComplaints`.
//   5. Subscriber wires `AccountingPeriodClosed` → generator correctly.
//   6. `ConductMetrics.averageResolutionDays` is 0 (not NaN) when no
//      resolved complaints exist.
//
// Authors: Atlas (Platform Engineer, engineering) +
//   Devon (Chief Operating Officer, governance — TCF oversight).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { newEventId } from "../../core/types";
import { EventStore } from "../../event-store/store";
import { setDefaultProvenanceModeOverride } from "../../projections/filter";
import type { ConductMetrics, TCFOutcome } from "./types";
import { CMS_REGULATED_ENTITIES } from "./types";
import { generateCmsDisclosure } from "./generator";
import { cmsPeriodCloseSubscriber } from "./period-close-subscriber";

const ENTITY_BANK = "LE-ZA-HOZ-BANK";
const ENTITY_SECURITIES = "LE-ZA-HOZ-SECURITIES";
const ACTOR = { type: "service" as const, id: "agent:Devon" };

const PERIOD_START = "2026-05-01T00:00:00.000Z";
const PERIOD_END = "2026-06-01T00:00:00.000Z";

const CLOSED_PAYLOAD = {
  periodId: "period:hoz-bank:month:2026-05",
  closedAt: PERIOD_END,
  trialBalanceSnapshotEventId: newEventId(),
  uptoSequence: 0,
};

const CITATIONS = ["D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN"];

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ---------------------------------------------------------------------------
// Helper: build a store with some AlertOpened events
// ---------------------------------------------------------------------------

function buildStoreWithAlerts(count: number): EventStore {
  const store = new EventStore(":memory:");
  for (let i = 0; i < count; i++) {
    store.append({
      event_id: newEventId(),
      type: "AlertOpened",
      as_of: `2026-05-${String(i + 10).padStart(2, "0")}T10:00:00.000Z`,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        alertId: `alert-${i}`,
        raisedAt: `2026-05-${String(i + 10).padStart(2, "0")}T10:00:00.000Z`,
      },
    });
  }
  return store;
}

function buildStoreWithConflicts(count: number): EventStore {
  const store = new EventStore(":memory:");
  for (let i = 0; i < count; i++) {
    store.append({
      event_id: newEventId(),
      type: "ConflictDeclared",
      as_of: `2026-05-${String(i + 10).padStart(2, "0")}T10:00:00.000Z`,
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        conflictId: `conflict-${i}`,
        declarant: "director-stub",
        declaredAt: `2026-05-${String(i + 10).padStart(2, "0")}T10:00:00.000Z`,
      },
    });
  }
  return store;
}

// ---------------------------------------------------------------------------
// Helpers to assert numeric safety
// ---------------------------------------------------------------------------

function assertMetricsNonNaN(metrics: ConductMetrics): void {
  expect(Number.isNaN(metrics.totalComplaints)).toBe(false);
  expect(Number.isNaN(metrics.resolvedWithin5Days)).toBe(false);
  expect(Number.isNaN(metrics.averageResolutionDays)).toBe(false);
  expect(Number.isNaN(metrics.escalatedCount)).toBe(false);
  expect(Number.isNaN(metrics.bestExecutionBreachCount)).toBe(false);
  expect(Number.isNaN(metrics.conflictFlagsRaised)).toBe(false);

  const outcomes: TCFOutcome[] = [1, 2, 3, 4, 5, 6];
  for (const o of outcomes) {
    expect(Number.isNaN(metrics.tcfOutcomeBreakdown[o])).toBe(false);
  }
}

// ---------------------------------------------------------------------------
// 1. All numeric cells non-NaN (empty store)
// ---------------------------------------------------------------------------

describe("CMS generator — numeric cell safety", () => {
  it("produces non-NaN numeric cells from empty event store", () => {
    const store = new EventStore(":memory:");
    const { disclosure } = generateCmsDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: store,
      periodStart: PERIOD_START,
    });
    assertMetricsNonNaN(disclosure.metrics);
  });

  it("produces non-NaN numeric cells when AlertOpened events exist", () => {
    const store = buildStoreWithAlerts(3);
    const { disclosure } = generateCmsDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: store,
      periodStart: PERIOD_START,
    });
    assertMetricsNonNaN(disclosure.metrics);
  });
});

// ---------------------------------------------------------------------------
// 2. status === "rehearsal" for empty event store
// ---------------------------------------------------------------------------

describe("CMS generator — rehearsal status", () => {
  it("returns status='rehearsal' for empty event store", () => {
    const store = new EventStore(":memory:");
    const { disclosure } = generateCmsDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: store,
      periodStart: PERIOD_START,
    });
    expect(disclosure.status).toBe("rehearsal");
  });

  it("returns status='rehearsal' even when AlertOpened events exist (no live feeds yet)", () => {
    const store = buildStoreWithAlerts(2);
    const { disclosure } = generateCmsDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: store,
      periodStart: PERIOD_START,
    });
    // Status stays "rehearsal" until M3 Slice 9+ live feeds land.
    expect(disclosure.status).toBe("rehearsal");
  });
});

// ---------------------------------------------------------------------------
// 3. Non-regulated entity is silently skipped
// ---------------------------------------------------------------------------

describe("CMS subscriber — entity guard", () => {
  it("skips LE-ZA-HOZ-SECURITIES (not CMS-regulated)", () => {
    const store = new EventStore(":memory:");
    const result = cmsPeriodCloseSubscriber({
      closedPayload: CLOSED_PAYLOAD,
      entity: ENTITY_SECURITIES,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_START,
    });
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain("not in CMS_REGULATED_ENTITIES");
  });

  it("does not skip LE-ZA-HOZ-BANK", () => {
    const store = new EventStore(":memory:");
    const result = cmsPeriodCloseSubscriber({
      closedPayload: CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_START,
    });
    expect(result.skipped).toBe(false);
  });

  it("CMS_REGULATED_ENTITIES contains LE-ZA-HOZ-BANK", () => {
    expect(CMS_REGULATED_ENTITIES).toContain(ENTITY_BANK);
  });
});

// ---------------------------------------------------------------------------
// 4. TCF outcome breakdown sums to totalComplaints
// ---------------------------------------------------------------------------

describe("CMS generator — TCF outcome breakdown invariant", () => {
  it("breakdown sums to totalComplaints for empty store", () => {
    const store = new EventStore(":memory:");
    const { disclosure } = generateCmsDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: store,
      periodStart: PERIOD_START,
    });
    const sum = (Object.values(disclosure.metrics.tcfOutcomeBreakdown) as number[]).reduce(
      (a, b) => a + b,
      0,
    );
    expect(sum).toBe(disclosure.metrics.totalComplaints);
  });

  it("breakdown sums to totalComplaints when AlertOpened events exist", () => {
    const store = buildStoreWithAlerts(4);
    const { disclosure } = generateCmsDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: store,
      periodStart: PERIOD_START,
    });
    const sum = (Object.values(disclosure.metrics.tcfOutcomeBreakdown) as number[]).reduce(
      (a, b) => a + b,
      0,
    );
    expect(sum).toBe(disclosure.metrics.totalComplaints);
  });

  it("totalComplaints equals number of AlertOpened events in period", () => {
    const store = buildStoreWithAlerts(5);
    const { disclosure } = generateCmsDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: store,
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.totalComplaints).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 5. averageResolutionDays is 0 (not NaN) when no resolved complaints
// ---------------------------------------------------------------------------

describe("CMS generator — averageResolutionDays safety", () => {
  it("averageResolutionDays is 0 (not NaN) when no resolved complaints", () => {
    const store = buildStoreWithAlerts(3);
    const { disclosure } = generateCmsDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: store,
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.averageResolutionDays).toBe(0);
    expect(Number.isNaN(disclosure.metrics.averageResolutionDays)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. ConflictDeclared events are counted
// ---------------------------------------------------------------------------

describe("CMS generator — ConflictDeclared folding", () => {
  it("counts ConflictDeclared events in the period", () => {
    const store = buildStoreWithConflicts(3);
    const { disclosure } = generateCmsDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: store,
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.conflictFlagsRaised).toBe(3);
  });

  it("does not count ConflictDeclared events outside the period", () => {
    const store = new EventStore(":memory:");
    // Append a conflict event BEFORE the period start
    store.append({
      event_id: newEventId(),
      type: "ConflictDeclared",
      as_of: "2026-04-15T10:00:00.000Z",
      entity: ENTITY_BANK,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        conflictId: "old-conflict",
        declarant: "director-stub",
        declaredAt: "2026-04-15T10:00:00.000Z",
      },
    });
    const { disclosure } = generateCmsDisclosure({
      entityId: ENTITY_BANK,
      reportingDate: PERIOD_END,
      eventStore: store,
      periodStart: PERIOD_START,
    });
    expect(disclosure.metrics.conflictFlagsRaised).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Subscriber wires period-close → generator
// ---------------------------------------------------------------------------

describe("CMS subscriber — period-close integration", () => {
  it("produces disclosure from subscriber on period close (bank entity)", () => {
    const store = buildStoreWithAlerts(2);
    const result = cmsPeriodCloseSubscriber({
      closedPayload: CLOSED_PAYLOAD,
      entity: ENTITY_BANK,
      eventStore: store,
      actor: ACTOR,
      periodStart: PERIOD_START,
      periodLabel: "2026-05",
    });
    expect(result.skipped).toBe(false);
    expect(result.disclosure).toBeDefined();
    expect(result.disclosure.entityId).toBe(ENTITY_BANK);
    expect(result.disclosure.reportingDate).toBe(PERIOD_END);
    expect(result.disclosure.metrics.period).toBe("2026-05");
    expect(result.disclosure.status).toBe("rehearsal");
  });
});
