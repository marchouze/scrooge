// platform/simulation/hub/adapters/bond-sim.ts
//
// Thin adapters wrapping the live BondSimEngine + its bond market-data feed as
// ThirdPartySimHub modules — the bond analogue of adapters/env-sim.ts. No
// simulator logic is re-implemented here; each adapter delegates to the engine
// instance the dashboard already owns.
//
// Authority: D-NPA-SAGB-BOND-INTERNAL-TEST; D-MARKETS-SCHEMA-FOUNDATION.
// Author: Devon (Chief Operating Officer, engineering)

import { nowUtc } from "../../../core/types";
import type { BondSimEngine } from "../../bond-sim-engine";
import type { SimStatus, SimulatorModule } from "../types";

/**
 * Counterparty bond request-to-trade — automatic in-process loop.
 *
 * Configurable via sim-hub: provenance (simulated/production), nominal range
 * (ZAR face), and trade frequency. Trades route through the bank's normal
 * bookBondTrade path (wired via executeBondTrade in server.ts) →
 * BondTradeExecuted → GL → BondSettlementInstructed → Standard Bank custodian.
 * The position guard biases the side toward reducing inventory when a benchmark
 * bond's net nominal breaches the cap.
 */
export function makeCounterpartyBondRequestModule(engine: BondSimEngine): SimulatorModule {
  let startedAt: string | null = null;
  let lastError: string | null = null;

  return {
    id: "counterparty-bond-request",
    label: "Counterparty bond request-to-trade",
    domain: "counterparty",
    description:
      "External counterparties requesting SA government-bond trades. Picks a bond-eligible counterparty from the party register, a benchmark bond (R186/R2030/R2040) from the live bond-price feed, a random side, nominal from the configured ZAR face range, and a clean price from the latest bond-price tick. Routes through bookBondTrade. A position guard biases the side toward reducing inventory when a bond's net nominal breaches the cap. Configure provenance, frequency, and nominal below.",
    mode: "loop+fire",
    configSchema: [
      {
        key: "provenance",
        label: "Provenance",
        type: "select",
        default: "simulated",
        options: ["simulated", "production"],
        help: "simulated = tagged build-phase; production = books as a real trade",
      },
      {
        key: "minNominalZar",
        label: "Min nominal (ZAR face)",
        type: "number",
        default: 5_000_000,
        min: 100_000,
        max: 1_000_000_000,
        help: "Minimum trade face value in ZAR",
      },
      {
        key: "maxNominalZar",
        label: "Max nominal (ZAR face)",
        type: "number",
        default: 50_000_000,
        min: 100_000,
        max: 1_000_000_000,
        help: "Maximum trade face value in ZAR",
      },
      {
        key: "minIntervalMs",
        label: "Min interval (ms)",
        type: "number",
        default: 3_000,
        min: 500,
        max: 300_000,
      },
      {
        key: "maxIntervalMs",
        label: "Max interval (ms)",
        type: "number",
        default: 10_000,
        min: 500,
        max: 300_000,
      },
    ],
    fireActions: [{ id: "fire-trade", label: "Fire one trade" }],
    eventActorIds: [],
    start(config) {
      const provenance =
        config?.provenance === "production" ? "production" : ("simulated" as const);
      const minNominalZar =
        typeof config?.minNominalZar === "number" ? config.minNominalZar : 5_000_000;
      const maxNominalZar =
        typeof config?.maxNominalZar === "number" ? config.maxNominalZar : 50_000_000;
      const minIntervalMs =
        typeof config?.minIntervalMs === "number" ? config.minIntervalMs : 3_000;
      const maxIntervalMs =
        typeof config?.maxIntervalMs === "number" ? config.maxIntervalMs : 10_000;

      if (!engine.isTradeLoopRunning()) startedAt = nowUtc();
      lastError = null;
      engine.startTradeLoop({
        provenance,
        minNominalZar,
        maxNominalZar,
        minIntervalMs,
        maxIntervalMs,
      });
    },
    stop() {
      engine.stopTradeLoop();
    },
    isRunning() {
      return engine.isTradeLoopRunning();
    },
    async fire(actionId) {
      if (actionId !== "fire-trade") return { ok: false, detail: `unknown action '${actionId}'` };
      try {
        engine.fireTrade();
        return { ok: true, detail: "trade fired" };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        return { ok: false, detail: lastError };
      }
    },
    getStatus(): SimStatus {
      const s = engine.getStatus();
      return {
        id: "counterparty-bond-request",
        running: engine.isTradeLoopRunning(),
        eventsEmitted: s.tradesGenerated,
        lastEventAt: s.lastTradeAt,
        lastEventType: s.lastTradeAt ? "BondTradeExecuted" : null,
        lastError,
        startedAt,
        extra: {
          lastIsin: s.lastIsin,
          lastSide: s.lastSide,
          lastCleanPrice: s.lastCleanPrice,
          lastCounterparty: s.lastCounterparty,
          positionMonitor: s.positionMonitor,
          provenance: s.config.provenance,
        },
      };
    },
  };
}

/**
 * Synthetic bond price feed — emits simulated clean-price ticks for the three
 * benchmark bonds to the market-data store (reference data, not the event
 * store). Isolated from valuation: every valuation read filters to
 * provenance="production", so these synthetic ticks can never reach a real mark.
 */
export function makeBondMarketDataFeedModule(engine: BondSimEngine): SimulatorModule {
  let startedAt: string | null = null;
  const sub = engine.bondMarketDataSimulator;
  return {
    id: "bond-market-data-feed",
    label: "Synthetic bond feed (simulated ticks)",
    domain: "market-data",
    description:
      'SIMULATED bond price feed — emits clean-price + implied-yield ticks tagged provenance="simulated" for the benchmark SA government bonds (R186/R2030/R2040) to the market-data store. Seeds and periodically re-anchors from the production JSE Debt reference fixture. Drives the bond trade-sim loop and renders in the market-data Bonds section with a sim badge.',
    mode: "loop",
    configSchema: [],
    eventActorIds: [], // writes to MarketDataStore, not the event store
    start() {
      if (!sub.isRunning()) startedAt = nowUtc();
      sub.start();
    },
    stop() {
      sub.stop();
      startedAt = null;
    },
    isRunning() {
      return sub.isRunning();
    },
    getStatus(): SimStatus {
      return {
        id: "bond-market-data-feed",
        running: sub.isRunning(),
        eventsEmitted: 0, // writes to MarketDataStore, not the event store
        lastEventAt: null,
        lastEventType: null,
        lastError: null,
        startedAt,
      };
    },
  };
}
