// tests/operational-loss-projection.test.ts
//
// Tests for the OperationalLossEvent capture type + the operational-loss
// projection (open/closed by business line + BCBS event-type category).
//
// Author: Tomas (Operations & payments engineer, engineering) — governance
//   owner Devon (Chief Operating Officer, governance; op-risk seat).

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { makeOperationalLossEvent } from "../platform/event-store/event-types/operational-risk";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";
import { buildOperationalLossProjection } from "../platform/reporting/operational-loss-projection";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "service", id: "agent:tomas:op-risk-loss-capture" };
const CITATIONS = ["D-FX-HELD-DIMS-SEAT-SWEEP", "BCBS-D196-§644"];

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "op-loss-test-"));
});

afterAll(() => {
  if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
});

function freshStore(): EventStore {
  return new EventStore(join(tmpDir, `event-${Math.random().toString(36).slice(2)}.db`));
}

function loss(
  store: EventStore,
  payload: Parameters<typeof makeOperationalLossEvent>[0]["payload"],
  asOf = "2026-06-12T08:00:00.000Z",
): void {
  store.append(
    makeOperationalLossEvent({ asOf, entity: ENTITY, actor: ACTOR, citations: CITATIONS, payload }),
  );
}

describe("OperationalLossEvent — type + schema", () => {
  it("constructs a well-formed OperationalLossEvent and round-trips through the store", () => {
    const store = freshStore();
    loss(store, {
      lossEventId: "loss:fx:settlement-fail-001",
      eventDate: "2026-06-10",
      discoveryDate: "2026-06-11",
      grossLossMinor: 250_000_00,
      currency: "ZAR",
      businessLine: "trading-and-sales",
      eventTypeCategory: "execution-delivery-and-process-management",
      recoveryMinor: 50_000_00,
      status: "open",
      description: "FX settlement instruction sent to wrong nostro; remediation in progress",
      productId: "prd:bank:fx:otc-vanilla",
    });
    const events = [...store.replay({ type: "OperationalLossEvent" })];
    expect(events).toHaveLength(1);
    const p = events[0]!.payload as Record<string, unknown>;
    expect(p.lossEventId).toBe("loss:fx:settlement-fail-001");
    expect(p.grossLossMinor).toBe(250_000_00);
    expect(p.businessLine).toBe("trading-and-sales");
    expect(p.eventTypeCategory).toBe("execution-delivery-and-process-management");
    store.close();
  });

  it("rejects an unknown business line (taxonomy enforced)", () => {
    expect(() =>
      makeOperationalLossEvent({
        asOf: "2026-06-12T08:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          lossEventId: "loss:bad",
          eventDate: "2026-06-10",
          discoveryDate: "2026-06-10",
          grossLossMinor: 1,
          currency: "ZAR",
          // Invalid business line — runtime schema must reject. Cast through
          // unknown so the deliberately-wrong value reaches makeOperationalLossEvent.
          businessLine: "not-a-real-line" as unknown as "trading-and-sales",
          eventTypeCategory: "internal-fraud",
          status: "open",
          description: "x",
        },
      }),
    ).toThrow();
  });

  it("defaults recoveryMinor to 0 when omitted", () => {
    const store = freshStore();
    loss(store, {
      lossEventId: "loss:no-recovery",
      eventDate: "2026-06-10",
      discoveryDate: "2026-06-10",
      grossLossMinor: 100_00,
      currency: "ZAR",
      businessLine: "payment-and-settlement",
      eventTypeCategory: "external-fraud",
      status: "open",
      description: "card-not-present fraud loss",
    });
    const proj = buildOperationalLossProjection(store);
    expect(proj.records[0]!.recoveryMinor).toBe(0);
    expect(proj.records[0]!.netLossMinor).toBe(100_00);
    store.close();
  });
});

describe("operational-loss-projection — open/closed by business line", () => {
  it("partitions records into open and closed and computes net = gross − recovery", () => {
    const store = freshStore();
    loss(store, {
      lossEventId: "loss:a",
      eventDate: "2026-06-01",
      discoveryDate: "2026-06-02",
      grossLossMinor: 1_000_00,
      currency: "ZAR",
      businessLine: "trading-and-sales",
      eventTypeCategory: "execution-delivery-and-process-management",
      recoveryMinor: 200_00,
      status: "open",
      description: "open loss",
    });
    loss(store, {
      lossEventId: "loss:b",
      eventDate: "2026-06-03",
      discoveryDate: "2026-06-03",
      grossLossMinor: 500_00,
      currency: "ZAR",
      businessLine: "trading-and-sales",
      eventTypeCategory: "internal-fraud",
      recoveryMinor: 500_00,
      status: "recovered",
      description: "fully recovered loss",
    });
    const proj = buildOperationalLossProjection(store);

    expect(proj.totals.count).toBe(2);
    expect(proj.totals.openCount).toBe(1);
    expect(proj.totals.closedCount).toBe(1);
    expect(proj.openRecords.map((r) => r.lossEventId)).toEqual(["loss:a"]);
    expect(proj.closedRecords.map((r) => r.lossEventId)).toEqual(["loss:b"]);
    expect(proj.totals.grossLossMinor).toBe(1_500_00);
    expect(proj.totals.recoveryMinor).toBe(700_00);
    expect(proj.totals.netLossMinor).toBe(800_00); // (1000-200) + (500-500)

    const tradingLine = proj.byBusinessLine.find((l) => l.businessLine === "trading-and-sales");
    expect(tradingLine?.count).toBe(2);
    expect(tradingLine?.openCount).toBe(1);
    expect(tradingLine?.closedCount).toBe(1);
    store.close();
  });

  it("latest-wins per lossEventId: a status change supersedes the prior capture", () => {
    const store = freshStore();
    loss(
      store,
      {
        lossEventId: "loss:evolving",
        eventDate: "2026-06-01",
        discoveryDate: "2026-06-01",
        grossLossMinor: 1_000_00,
        currency: "ZAR",
        businessLine: "agency-services",
        eventTypeCategory: "clients-products-and-business-practices",
        recoveryMinor: 0,
        status: "open",
        description: "loss opened",
      },
      "2026-06-01T08:00:00.000Z",
    );
    // Later capture: recovered + recovery booked.
    loss(
      store,
      {
        lossEventId: "loss:evolving",
        eventDate: "2026-06-01",
        discoveryDate: "2026-06-01",
        grossLossMinor: 1_000_00,
        currency: "ZAR",
        businessLine: "agency-services",
        eventTypeCategory: "clients-products-and-business-practices",
        recoveryMinor: 1_000_00,
        status: "closed",
        description: "loss closed after recovery",
      },
      "2026-06-05T08:00:00.000Z",
    );
    const proj = buildOperationalLossProjection(store);
    expect(proj.records).toHaveLength(1);
    expect(proj.records[0]!.status).toBe("closed");
    expect(proj.records[0]!.open).toBe(false);
    expect(proj.totals.openCount).toBe(0);
    expect(proj.totals.closedCount).toBe(1);
    expect(proj.records[0]!.netLossMinor).toBe(0);
    store.close();
  });

  it("aggregates by BCBS event-type category", () => {
    const store = freshStore();
    loss(store, {
      lossEventId: "loss:f1",
      eventDate: "2026-06-01",
      discoveryDate: "2026-06-01",
      grossLossMinor: 300_00,
      currency: "ZAR",
      businessLine: "trading-and-sales",
      eventTypeCategory: "internal-fraud",
      status: "open",
      description: "rogue trade",
    });
    loss(store, {
      lossEventId: "loss:f2",
      eventDate: "2026-06-02",
      discoveryDate: "2026-06-02",
      grossLossMinor: 700_00,
      currency: "ZAR",
      businessLine: "trading-and-sales",
      eventTypeCategory: "internal-fraud",
      status: "open",
      description: "another internal fraud",
    });
    const proj = buildOperationalLossProjection(store);
    const fraud = proj.byEventTypeCategory.find((c) => c.eventTypeCategory === "internal-fraud");
    expect(fraud?.count).toBe(2);
    expect(fraud?.grossLossMinor).toBe(1_000_00);
    store.close();
  });

  it("returns an empty projection for a store with no loss events", () => {
    const store = freshStore();
    const proj = buildOperationalLossProjection(store);
    expect(proj.records).toHaveLength(0);
    expect(proj.totals.count).toBe(0);
    expect(proj.byBusinessLine).toHaveLength(0);
    store.close();
  });
});
