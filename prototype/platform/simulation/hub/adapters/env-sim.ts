// platform/simulation/hub/adapters/env-sim.ts
//
// Thin adapters wrapping the live EnvSimEngine + its sub-simulators as
// ThirdPartySimHub modules. No simulator logic is re-implemented here — each
// adapter delegates to the existing instance the dashboard already owns, so the
// hub and the legacy /fx-sim panel drive the *same* underlying objects (the
// idempotent start/stop guards make shared control safe).
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION. Scrooge session-delegation (Marc).

import { nowUtc } from "../../../core/types";
import type { EnvSimEngine } from "../../env-sim/index";
import type { SimStatus, SimulatorModule } from "../types";

/**
 * Counterparty FX request-to-trade — automatic in-process loop.
 *
 * Configurable via sim-hub: provenance (simulated/production), notional range
 * (USD equiv), and trade frequency. Trades route through the bank's normal
 * bookFxTrade path (wired via executeFxTrade in server.ts).
 *
 * Pairs are drawn from whatever is currently live in the market data store;
 * counterparties from the combined sim+real list (ALL_FX_COUNTERPARTIES).
 * Rate = market data bid/ask ±1%.
 */
export function makeCounterpartyFxRequestModule(engine: EnvSimEngine): SimulatorModule {
  let startedAt: string | null = null;
  let lastError: string | null = null;

  return {
    id: "counterparty-fx-request",
    label: "Counterparty FX request-to-trade",
    domain: "counterparty",
    description:
      "External counterparties requesting FX spot trades. Picks counterparty from the full list (sim + real), pair from live market data, random side, notional from the configured USD range, rate from market data bid/ask ±1%. Routes through bookFxTrade. Configure provenance, frequency, and notional below.",
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
        key: "minNotionalUsd",
        label: "Min notional (USD)",
        type: "number",
        default: 500_000,
        min: 1_000,
        max: 500_000_000,
        help: "Minimum trade notional in USD equivalent",
      },
      {
        key: "maxNotionalUsd",
        label: "Max notional (USD)",
        type: "number",
        default: 5_000_000,
        min: 1_000,
        max: 500_000_000,
        help: "Maximum trade notional in USD equivalent",
      },
      {
        key: "settlementMode",
        label: "Settlement mode",
        type: "select",
        default: "accelerated",
        options: ["accelerated", "realtime"],
        help: "accelerated = full lifecycle fires at T+0; realtime = only instructions at T+0, payments at T+2",
      },
      {
        key: "minIntervalMs",
        label: "Min interval (ms)",
        type: "number",
        default: 2_000,
        min: 500,
        max: 300_000,
      },
      {
        key: "maxIntervalMs",
        label: "Max interval (ms)",
        type: "number",
        default: 8_000,
        min: 500,
        max: 300_000,
      },
    ],
    fireActions: [{ id: "fire-trade", label: "Fire one trade" }],
    eventActorIds: [],
    start(config) {
      const provenance =
        config?.provenance === "production" ? "production" : ("simulated" as const);
      const minNotionalUsd =
        typeof config?.minNotionalUsd === "number" ? config.minNotionalUsd : 500_000;
      const maxNotionalUsd =
        typeof config?.maxNotionalUsd === "number" ? config.maxNotionalUsd : 5_000_000;
      const settlementMode =
        config?.settlementMode === "realtime" ? "realtime" : ("accelerated" as const);
      const minIntervalMs =
        typeof config?.minIntervalMs === "number" ? config.minIntervalMs : 2_000;
      const maxIntervalMs =
        typeof config?.maxIntervalMs === "number" ? config.maxIntervalMs : 8_000;

      if (!engine.isTradeLoopRunning()) startedAt = nowUtc();
      lastError = null;
      engine.startTradeLoop({
        provenance,
        settlementMode,
        notionalUsdMin: minNotionalUsd,
        notionalUsdMax: maxNotionalUsd,
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
        id: "counterparty-fx-request",
        running: engine.isTradeLoopRunning(),
        eventsEmitted: s.tradesGenerated,
        lastEventAt: s.lastTradeAt,
        lastEventType: s.lastTradeAt ? "FxTradeExecuted" : null,
        lastError,
        startedAt,
        extra: {
          lastPair: s.lastPair,
          lastSide: s.lastSide,
          lastRate: s.lastRate,
          lastCounterparty: s.lastCounterparty,
          riskMonitor: s.riskMonitor,
          provenance: s.config.settlementMode,
        },
      };
    },
  };
}

/** Shared shape for the loop-only sub-sim adapters (no config in the core slice). */
function makeLoopSubSim(args: {
  id: string;
  label: string;
  domain: SimulatorModule["domain"];
  description: string;
  eventActorIds: readonly string[];
  sub: { start(): void; stop(): void; isRunning(): boolean };
}): SimulatorModule {
  let startedAt: string | null = null;
  return {
    id: args.id,
    label: args.label,
    domain: args.domain,
    description: args.description,
    mode: "loop",
    configSchema: [],
    eventActorIds: args.eventActorIds,
    start() {
      if (!args.sub.isRunning()) startedAt = nowUtc();
      args.sub.start();
    },
    stop() {
      args.sub.stop();
      startedAt = null;
    },
    isRunning() {
      return args.sub.isRunning();
    },
    getStatus(): SimStatus {
      return {
        id: args.id,
        running: args.sub.isRunning(),
        eventsEmitted: 0, // hub overrides from event-derived counts
        lastEventAt: null,
        lastEventType: null,
        lastError: null,
        startedAt,
      };
    },
  };
}

export function makeMarketDataFeedModule(engine: EnvSimEngine): SimulatorModule {
  return makeLoopSubSim({
    id: "market-data-feed",
    label: "Synthetic FX feed (simulated ticks)",
    domain: "market-data",
    description:
      'SIMULATED FX price feed — emits bid/mid/ask ticks tagged provenance="simulated" for the standard pairs to the market-data store (reference data, not the event store). Isolated from the real MTM/valuation source: every valuation read filters to provenance="production", so these synthetic ticks can never reach a real mark. Drives the FX trade-sim loop and risk monitor at high frequency without burning Twelve Data free-tier credits.',
    eventActorIds: [], // writes to MarketDataStore, not the event store
    sub: engine.marketDataSimulator,
  });
}

export function makeNostroStatementModule(engine: EnvSimEngine): SimulatorModule {
  return makeLoopSubSim({
    id: "nostro-statement",
    label: "Nostro statement (MT940 / camt.053)",
    domain: "custodian",
    description:
      "Daily correspondent nostro statements (MT940 + camt.053) arriving as InboundMessageReceived events.",
    eventActorIds: ["agent:env:nostro-statement-sim"],
    sub: engine.nostroStatementSimulator,
  });
}

export function makeCorrespondentAdviceModule(engine: EnvSimEngine): SimulatorModule {
  return makeLoopSubSim({
    id: "correspondent-advice",
    label: "Correspondent advice (MT202)",
    domain: "payments",
    description:
      "Correspondent MT202 credit advices on settlement receive legs, arriving as InboundMessageReceived events.",
    eventActorIds: ["agent:env:correspondent-advice-sim"],
    sub: engine.correspondentAdviceSimulator,
  });
}

export function makeRegulatoryAckModule(engine: EnvSimEngine): SimulatorModule {
  return makeLoopSubSim({
    id: "regulatory-ack",
    label: "Regulatory ACK (SARB)",
    domain: "regulatory",
    description:
      "SARB acknowledgements for dispatched BA-* regulatory returns, arriving as InboundMessageReceived events.",
    eventActorIds: ["agent:env:regulatory-ack-sim"],
    sub: engine.regulatoryAckSimulator,
  });
}
