// platform/recon/fx-book-nop-parity.test.ts
//
// Tests for recon:fx-book-nop-parity (V2 A2).
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import type { Event } from "../event-store/types";
import { run } from "./fx-book-nop-parity";

/** A minimal FxTradeExecuted event with a near leg (the NOP fold input shape). */
function fxTrade(args: {
  id: string;
  receiveCurrency: string;
  payCurrency: string;
  receiveMinor: number;
  payMinor: number;
}): Event {
  return {
    type: "FxTradeExecuted",
    event_id: args.id,
    as_of: "2026-06-10T00:00:00.000Z",
    payload: {
      tradeId: { value: args.id },
      book: "fx-trading",
      legs: [
        {
          legKind: "near",
          receiveCurrency: args.receiveCurrency,
          payCurrency: args.payCurrency,
          counterNotional: { amountMinor: args.receiveMinor },
          notional: { amountMinor: args.payMinor },
        },
      ],
    },
  } as unknown as Event;
}

describe("recon:fx-book-nop-parity", () => {
  test("flat bench (no FX trades) with explicit events → fail (no NOP to reconcile)", () => {
    const r = run({ events: [] });
    // With explicit events override, a flat bench is a fail (a populated book is
    // expected when events are injected by a test).
    expect(r.ok).toBe(false);
  });

  test("v2 fx-trading book reconciles to the NOP fold (delta 0)", () => {
    // Buy USD 1,000.00 (pay ZAR): NOP USD = +1000. The v2 book member built from
    // the shared fold must match exactly.
    const events: Event[] = [
      fxTrade({
        id: "t1",
        receiveCurrency: "USD",
        payCurrency: "ZAR",
        receiveMinor: 100_000, // 1,000.00 USD
        payMinor: 1_850_000, // 18,500.00 ZAR
      }),
      fxTrade({
        id: "t2",
        receiveCurrency: "EUR",
        payCurrency: "ZAR",
        receiveMinor: 50_000, // 500.00 EUR
        payMinor: 1_000_000,
      }),
    ];
    const r = run({ events });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBeGreaterThanOrEqual(2);
    // Parity delta 0 — the v2 book net equals the NOP fold net per currency.
    expect(r.asOf).toContain("parity delta Σ|book − NOP| = 0 minor units");
    expect(r.violations.every((v) => v.severity !== "fail")).toBe(true);
  });
});
