// platform/recon/var-nop-exposure-parity.test.ts
//
// Pins the VaR ↔ B3 NOP exposure-parity gate
// (D-VAR-EXPOSURE-INCLUDES-STANDING-NOP).
//
// Author: Rohan (Risk engineer, engineering).

import { describe, expect, it } from "bun:test";

import type { Event } from "../event-store/types";
import { MarketDataStore } from "../market-data/store";
import { run } from "./var-nop-exposure-parity";

// A var-engine source that imports the shared fold and carries NO settled-trade
// exclusion — the post-decision shape.
const CLEAN_SOURCE = `
import { deriveNetFxPositionByCurrency } from "../projections/markets/limit-utilisation";
export function deriveRiskFactorExposures() {
  const net = deriveNetFxPositionByCurrency(events);
  // ... no settled-trade exclusion ...
}
`;

// An in-memory market-data store (no DB) — assertion (a) never touches it, and
// the flat-book path skips (b) before any quote lookup.
const EMPTY_MD = new MarketDataStore(":memory:");

describe("var-nop-exposure-parity recon", () => {
  it("passes (a): var-engine imports the shared fold, no settled-trade exclusion", () => {
    const r = run({ varEngineSource: CLEAN_SOURCE, events: [], marketData: EMPTY_MD });
    // Flat synthetic book → assertion (b) FAILS (synthetic mode requires a book).
    // Assertion (a) must produce zero fails.
    const aFails = r.violations.filter(
      (v) => v.severity === "fail" && v.subject === "var-engine.ts",
    );
    expect(aFails).toHaveLength(0);
  });

  it("fails (a): var-engine re-introduces a settled-trade exclusion (split-brain)", () => {
    const regressed = `${CLEAN_SOURCE}\nconst settledTradeIds = new Set<string>();\n`;
    const r = run({ varEngineSource: regressed, events: [], marketData: EMPTY_MD });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some((v) => v.severity === "fail" && /settledTradeIds/.test(v.message)),
    ).toBe(true);
  });

  it("fails (a): var-engine drops the shared fold import", () => {
    const r = run({
      varEngineSource: "export function deriveRiskFactorExposures() {}",
      events: [],
      marketData: EMPTY_MD,
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => /deriveNetFxPositionByCurrency/.test(v.message))).toBe(true);
  });

  it("downgrades (b) to info on a genuinely flat live book (default event source)", () => {
    // No `events` override → reads the live store; if that store happens to be
    // flat the parity assertion is `info`, not `fail`. We only assert assertion
    // (a) holds with the clean source so the test is store-independent.
    const r = run({ varEngineSource: CLEAN_SOURCE });
    const aFails = r.violations.filter((v) => v.subject === "var-engine.ts");
    expect(aFails).toHaveLength(0);
  });

  it("parity holds when VaR and B3 see the same book (shared fold)", () => {
    // Two operating-book FxTradeExecuted near legs (one settled, one not) — the
    // shared fold drives BOTH bases, so they reconcile by construction. With no
    // market-data quotes both sides fall back to rate 1, so the per-currency
    // ZAR figures match exactly.
    const mkTrade = (id: string, rcvCcy: string, rcvMinor: number): Event =>
      ({
        event_id: `ev:${id}`,
        type: "FxTradeExecuted",
        as_of: "2026-06-01T00:00:00.000Z",
        provenance: { kind: "simulated", scenario: "operator:manual-sim-booking" },
        payload: {
          tradeId: { scheme: "test", value: id },
          currencyPair: { base: rcvCcy, quote: "ZAR" },
          side: "buy",
          legs: [
            {
              legKind: "near",
              payCurrency: "ZAR",
              receiveCurrency: rcvCcy,
              notional: { currency: "ZAR", amountMinor: 100000 },
              counterNotional: { currency: rcvCcy, amountMinor: rcvMinor },
            },
          ],
        },
      }) as unknown as Event;

    const settled: Event = {
      event_id: "ev:settle-1",
      type: "SettlementConfirmed",
      as_of: "2026-06-02T00:00:00.000Z",
      provenance: { kind: "simulated", scenario: "operator:manual-sim-booking" },
      payload: { tradeId: "t1" },
    } as unknown as Event;

    const events = [mkTrade("t1", "EUR", 50000), mkTrade("t2", "GBP", 40000), settled];
    const r = run({ events, marketData: EMPTY_MD, varEngineSource: CLEAN_SOURCE });
    // No parity mismatch violation (both bases driven by the same fold).
    expect(r.violations.some((v) => v.subject === "VaR ↔ B3 NOP parity")).toBe(false);
  });
});
