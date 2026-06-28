// dashboard/v2-markets-fx-trades-view.test.ts
//
// Tests for the FX trade-history view. Populates a store via the live FX V2
// simulator (which books FilInstrumentCreated FX trades + settles some), then
// asserts the history shape: all trades, newest-first, with lifecycle status and
// the buy/sell quad; provenance-filtered.

import { describe, expect, test } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import { MarketDataStore } from "../platform/market-data/store";
import { V2LiveFxDriver } from "../platform/simulation-v2-live/live-driver";
import { emitClientOnboardingLifecycle } from "../platform/simulation-v2/sim-modules/counterparty-provisioning";
import { buildV2FxTradeHistoryView } from "./v2-markets-fx-trades-view";

// The live driver now trades ONLY with in-sim onboarded FX-eligible clients
// (D-FX-SIM-LIVE-REALTIME-ONBOARDED) — no seed fallback. Onboard one simulated
// client so the driver has a counterparty; an empty store would fail-closed.
function populated(settlementMode: "accelerated" | "realtime", ticks = 5) {
  const eventStore = new EventStore();
  const marketDataStore = new MarketDataStore(":memory:");
  emitClientOnboardingLifecycle({
    store: eventStore,
    scenarioId: "fx-v2-live",
    asOf: "2026-02-02T07:00:00.000Z",
    counterparty: {
      counterpartyId: "CP-SIM-ACME-100",
      name: "Acme Sim Bank",
      bic: "ACMEZAJJXXX",
      eligiblePairs: ["USD/ZAR", "EUR/ZAR"],
      behaviourProfile: "reliable",
      agreement: { agreementType: "ISDA-2002", csaInScope: true, csaCurrency: "ZAR" },
    },
  });
  const driver = new V2LiveFxDriver({
    eventStore,
    marketDataStore,
    config: { tradesPerTick: 1, seed: 0x7a7a, settlementMode },
  });
  for (let i = 0; i < ticks; i++) driver.tickOnce();
  return eventStore;
}

describe("buildV2FxTradeHistoryView", () => {
  test("production-only lens is honestly empty (sim is simulated provenance)", () => {
    const eventStore = populated("accelerated");
    const v = buildV2FxTradeHistoryView({ eventStore, filter: { mode: "production-only" } });
    expect(v.dataState).toBe("empty");
    expect(v.count).toBe(0);
    expect(v.rows.length).toBe(0);
  });

  test("+Sim: all FX trades present, newest-first, with buy/sell quad", () => {
    const eventStore = populated("accelerated");
    const v = buildV2FxTradeHistoryView({ eventStore, filter: { mode: "combined" } });
    expect(v.dataState).toBe("live");
    expect(v.count).toBe(5);
    expect(v.rows.length).toBe(5);
    // Newest first (tradeDate descending).
    for (let i = 1; i < v.rows.length; i++) {
      expect(v.rows[i - 1].tradeDate >= v.rows[i].tradeDate).toBe(true);
    }
    // Every row carries the symmetric quad in two distinct currencies + a side.
    for (const r of v.rows) {
      expect(r.buy).not.toBeNull();
      expect(r.sell).not.toBeNull();
      expect(r.buy?.currency).not.toBe(r.sell?.currency);
      expect(["buy", "sell"]).toContain(r.side);
      expect(r.pair).toContain("/");
    }
  });

  test("accelerated: all trades settle same-tick → status settled", () => {
    const eventStore = populated("accelerated");
    const v = buildV2FxTradeHistoryView({ eventStore, filter: { mode: "combined" } });
    expect(v.settledCount).toBe(5);
    expect(v.openCount).toBe(0);
    expect(v.rows.every((r) => r.status === "settled")).toBe(true);
  });

  test("realtime: recent trades remain open (T+2 not yet reached)", () => {
    const eventStore = populated("realtime");
    const v = buildV2FxTradeHistoryView({ eventStore, filter: { mode: "combined" } });
    // Some settled, some still open — realtime defers settlement to T+2.
    expect(v.openCount).toBeGreaterThan(0);
    expect(v.openCount + v.settledCount + v.otherCount).toBe(v.count);
  });
});
