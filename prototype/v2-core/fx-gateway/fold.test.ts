// v2-core/fx-gateway/fold.test.ts
//
// V2 FX gateway-rejection fold (WS-FX-OTC-CLOSURE FU3).
//
// Proves: newest-first ordering + cap; schema fail-closed (a malformed payload
// is skipped, never surfaced as a valid rejection); name-free output; empty on
// no events.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import {
  type V2FxGatewayEventLike,
  MAX_V2_REJECTIONS,
  foldV2FxRejections,
} from "./fold";

function ev(
  id: string,
  rejectedAt: string,
  overrides: Record<string, unknown> = {},
): V2FxGatewayEventLike {
  return {
    event_id: id,
    type: "V2FxOrderRejectedAtGateway",
    as_of: rejectedAt,
    payload: {
      kind: "V2FxOrderRejectedAtGateway",
      orderId: `ord-${id}`,
      currencyPair: "USD/ZAR",
      counterpartyId: "urn:party:legal-entity:standard-bank-za",
      rejectingCheck: "market-risk",
      rejectionReason: "B3 utilisation would breach the FX NOP limit",
      citationToRule: "RAS-B3",
      rejectedAt,
      ...overrides,
    },
  };
}

describe("foldV2FxRejections", () => {
  test("empty input → empty feed", () => {
    expect(foldV2FxRejections([])).toEqual([]);
  });

  test("ignores non-gateway-rejection types", () => {
    const other: V2FxGatewayEventLike = {
      event_id: "x",
      type: "SomethingElse",
      as_of: "2026-06-19T10:00:00.000Z",
      payload: { kind: "SomethingElse" },
    };
    expect(foldV2FxRejections([other])).toEqual([]);
  });

  test("orders newest-first by rejection instant", () => {
    const rows = foldV2FxRejections([
      ev("a", "2026-06-19T10:00:00.000Z"),
      ev("c", "2026-06-19T12:00:00.000Z"),
      ev("b", "2026-06-19T11:00:00.000Z"),
    ]);
    expect(rows.map((r) => r.eventId)).toEqual(["c", "b", "a"]);
  });

  test("caps at MAX_V2_REJECTIONS", () => {
    const events: V2FxGatewayEventLike[] = [];
    for (let i = 0; i < MAX_V2_REJECTIONS + 10; i++) {
      const hh = String(i % 24).padStart(2, "0");
      events.push(ev(`e${i}`, `2026-06-19T${hh}:00:00.000Z`));
    }
    expect(foldV2FxRejections(events).length).toBe(MAX_V2_REJECTIONS);
  });

  test("fail-closed: a malformed payload is skipped, never a half-valid row", () => {
    // Missing required `rejectingCheck` → schema rejects → row skipped.
    const bad = ev("bad", "2026-06-19T13:00:00.000Z", { rejectingCheck: undefined });
    // An invalid enum value → also skipped.
    const badEnum = ev("badenum", "2026-06-19T13:30:00.000Z", { rejectingCheck: "not-a-check" });
    const good = ev("good", "2026-06-19T12:00:00.000Z");
    const rows = foldV2FxRejections([bad, badEnum, good]);
    expect(rows.map((r) => r.eventId)).toEqual(["good"]);
  });

  test("output carries no persona name — only typed gate + party id", () => {
    const rows = foldV2FxRejections([ev("a", "2026-06-19T10:00:00.000Z")]);
    const json = JSON.stringify(rows);
    // The fold surfaces the typed gate kind, the order/party ids, the reason and
    // the citation — none of which is a persona personal name.
    expect(rows[0]?.rejectingCheck).toBe("market-risk");
    expect(json).not.toMatch(/Saskia|Helena|Rohan|Mira|Kai/);
  });
});
