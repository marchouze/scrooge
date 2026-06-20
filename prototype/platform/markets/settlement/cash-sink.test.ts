// platform/markets/settlement/cash-sink.test.ts
//
// Slice 0 — the shared store-agnostic settlement sink. Asserts the two adapters
// (EventStore + anchor SQLite) are byte-equivalent over the SAME shared grammar
// payloads: a settled FX trade materialised through each sink yields identical
// cash-instance payloads, idempotent on re-run.
//
// Authority: D-FX-V2-SIMULATOR-FIRST; D-CASH-ASSET-CLASS-V1. Principle 1.
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Database } from "bun:sqlite";
import { afterAll, describe, expect, test } from "bun:test";

import { buildSettledCashPayloads } from "../../../v2-core/fil-instances/cash-materialisation";
import { EventStore } from "../../event-store/store";
import { AnchorDbCashSink, EventStoreCashSink } from "./cash-sink";

const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST", "D-CASH-ASSET-CLASS-V1"];

function builtLegs() {
  return buildSettledCashPayloads({
    tradeId: "T-SINK-001",
    tenant: ENTITY,
    reporting: "ZAR",
    counterpartyId: "CP-SINK-001",
    nettingSetId: "NS-CP-SINK-001-ZAR",
    settledAsOf: "2026-03-01T17:00:00.000Z",
    fxInstance: "fil:inst:LE-ZA-HOZ-BANK:T-SINK-001",
    legs: [
      { currency: "USD", signedMajor: 1_000_000, side: "received" },
      { currency: "ZAR", signedMajor: -18_500_000, side: "paid" },
    ],
    originatingEvent: { eventType: "FxSimSettlementConfirmed", eventId: "ev-sink-1" },
  });
}

describe("Slice 0 — shared store-agnostic cash sink", () => {
  const tmp = mkdtempSync(join(tmpdir(), "cash-sink-"));
  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("EventStore + anchor sinks produce byte-identical cash payloads", () => {
    const legs = builtLegs();

    // EventStore sink.
    const store = new EventStore(":memory:");
    const esSink = new EventStoreCashSink(store);
    for (const leg of legs) {
      expect(esSink.hasCreated(leg.instance)).toBe(false);
      esSink.appendCreated({
        asOf: leg.payload.asOf,
        entity: ENTITY,
        citations: CITATIONS,
        payload: leg.payload,
      });
    }
    const esPayloads = [...store.replay({ type: "FilInstrumentCreated" })]
      .map((e) => JSON.stringify(e.payload))
      .sort();

    // Anchor sink.
    const dbPath = join(tmp, "anchor.db");
    const anchorSink = new AnchorDbCashSink(dbPath);
    for (const leg of legs) {
      expect(anchorSink.hasCreated(leg.instance)).toBe(false);
      anchorSink.appendCreated({
        asOf: leg.payload.asOf,
        entity: ENTITY,
        citations: CITATIONS,
        payload: leg.payload,
      });
    }
    anchorSink.close();

    const db = new Database(dbPath, { readonly: true });
    const anchorPayloads = db
      .query<{ payload: string }, []>(
        "SELECT payload FROM v2_events WHERE type='FilInstrumentCreated'",
      )
      .all()
      .map((r) => JSON.stringify(JSON.parse(r.payload)))
      .sort();
    db.close();

    expect(anchorPayloads).toEqual(esPayloads);
    expect(esPayloads.length).toBe(2);
    store.close();
  });

  test("both sinks are idempotent on re-append", () => {
    const legs = builtLegs();

    const store = new EventStore(":memory:");
    const esSink = new EventStoreCashSink(store);
    for (let i = 0; i < 2; i++) {
      for (const leg of legs) {
        if (esSink.hasCreated(leg.instance)) continue;
        esSink.appendCreated({
          asOf: leg.payload.asOf,
          entity: ENTITY,
          citations: CITATIONS,
          payload: leg.payload,
        });
      }
    }
    expect([...store.replay({ type: "FilInstrumentCreated" })].length).toBe(2);
    store.close();

    const dbPath = join(tmp, "anchor-idem.db");
    const anchorSink = new AnchorDbCashSink(dbPath);
    for (let i = 0; i < 2; i++) {
      for (const leg of legs) {
        if (anchorSink.hasCreated(leg.instance)) continue;
        anchorSink.appendCreated({
          asOf: leg.payload.asOf,
          entity: ENTITY,
          citations: CITATIONS,
          payload: leg.payload,
        });
      }
    }
    const db = new Database(dbPath, { readonly: true });
    const n = db
      .query<{ c: number }, []>(
        "SELECT COUNT(*) AS c FROM v2_events WHERE type='FilInstrumentCreated'",
      )
      .get();
    db.close();
    expect(n?.c).toBe(2);
    anchorSink.close();
    expect(existsSync(dbPath)).toBe(true);
  });
});
