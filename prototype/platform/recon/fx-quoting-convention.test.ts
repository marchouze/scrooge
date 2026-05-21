// platform/recon/fx-quoting-convention.test.ts
//
// Unit tests for the fx-quoting-convention advisory recon. Drives the
// pipeline with injected events so the test does not depend on the live
// event store.
//
// Authority:
//   - D-FX-QUOTING-CONVENTION (CEO-approved 2026-05-21)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   - PR #654 (pair-direction precedent)
//
// Author: Kai (trading systems engineer)

import { describe, expect, it } from "bun:test";

import { run } from "./fx-quoting-convention";

function canonicalPayload(): Record<string, unknown> {
  return {
    tradeId: { scheme: "internal-trade-id", value: "recon-test-001" },
    productTaxonomy: "FX-spot",
    currencyPair: { base: "USD", quote: "ZAR" },
    side: "buy",
    legs: [
      {
        legKind: "near",
        payCurrency: "ZAR",
        receiveCurrency: "USD",
        notional: { currency: "ZAR", amountMinor: 18_500_000 },
        counterNotional: { currency: "USD", amountMinor: 1_000_000 },
        rate: { currency: "ZAR", amount: 18.5 },
        settlementDate: { iso: "2026-05-23", calendar: "JIHCAL" },
      },
    ],
    tradeDate: { iso: "2026-05-21", calendar: "JIHCAL" },
    counterparty: { partyId: "cp-test", name: "Test CP", role: "counterparty" },
    venue: "OTC",
    trader: "kai-test",
    bookId: "FX-MM-ZAR-01",
    bookType: "trading",
    settlementForm: "physical",
    settlementPath: "correspondent",
    clientFlowRef: "client-trade:recon-test-001",
  };
}

describe("fx-quoting-convention recon", () => {
  it("empty event source → asserted=0, ok=true", () => {
    const r = run({ fxTradeEvents: [] });
    expect(r.asserted).toBe(0);
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("canonical event → zero violations, ok=true", () => {
    const r = run({
      fxTradeEvents: [
        { event_id: "ev-ok", as_of: "2026-05-21T00:00:00.000Z", payload: canonicalPayload() },
      ],
    });
    expect(r.asserted).toBe(1);
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("inverted-rate event → warn, advisory keeps ok=true", () => {
    const base = canonicalPayload();
    const legs = base.legs as Array<Record<string, unknown>>;
    const firstLeg = legs[0];
    if (!firstLeg) throw new Error("canonical payload must have a leg");
    // Flip rate.currency from quote (ZAR) to base (USD) — the canonical
    // inverted-rate signature.
    const bad = {
      ...base,
      legs: [{ ...firstLeg, rate: { currency: "USD", amount: 1 / 18.5 } }, ...legs.slice(1)],
    };
    const r = run({
      fxTradeEvents: [{ event_id: "ev-bad", as_of: "2026-05-21T00:00:00.000Z", payload: bad }],
    });
    expect(r.asserted).toBe(1);
    expect(r.violations.length).toBeGreaterThan(0);
    expect(r.violations.every((v) => v.severity === "warn")).toBe(true);
    // P2 advisory — warn does not flip ok=false.
    expect(r.ok).toBe(true);
    const messages = r.violations.map((v) => v.message).join(" | ");
    expect(messages).toContain("D-FX-QUOTING-CONVENTION");
  });
});
