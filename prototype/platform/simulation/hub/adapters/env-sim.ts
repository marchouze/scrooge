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

/** Map a validated hub config object onto EnvSimEngine.start()'s shape. */
function toEngineConfig(config?: Record<string, unknown>): {
  minIntervalMs?: number;
  maxIntervalMs?: number;
  bookId?: string;
  settlementMode?: "realtime" | "accelerated";
} {
  const c: {
    minIntervalMs?: number;
    maxIntervalMs?: number;
    bookId?: string;
    settlementMode?: "realtime" | "accelerated";
  } = {};
  if (typeof config?.minIntervalMs === "number") c.minIntervalMs = config.minIntervalMs;
  if (typeof config?.maxIntervalMs === "number") c.maxIntervalMs = config.maxIntervalMs;
  if (typeof config?.bookId === "string") c.bookId = config.bookId;
  if (config?.settlementMode === "realtime" || config?.settlementMode === "accelerated") {
    c.settlementMode = config.settlementMode;
  }
  return c;
}

/**
 * Counterparty FX request-to-trade — the EXTERNAL stimulus. When running, it
 * represents counterparties continuously requesting FX trades; the bank's
 * internal market-maker (EnvSimEngine) executes the fills. The internal MM
 * view (risk monitor, rates) remains at /fx-sim. A full RFQ→quote→fill
 * handshake with a dedicated CounterpartyTradeRequested event is a follow-up.
 */
export function makeCounterpartyFxRequestModule(engine: EnvSimEngine): SimulatorModule {
  return {
    id: "counterparty-fx-request",
    label: "Counterparty FX request-to-trade",
    domain: "counterparty",
    description:
      "External counterparties requesting FX spot trades. Each initiation is booked through the bank's NORMAL trade-booking path (same as a manual/real trade, tagged simulated), then the internal market-maker risk monitor steers direction to stay within the B3 limit.",
    mode: "loop+fire",
    configSchema: [
      {
        key: "minIntervalMs",
        label: "Min interval (ms)",
        type: "number",
        default: 2000,
        min: 100,
        max: 600000,
      },
      {
        key: "maxIntervalMs",
        label: "Max interval (ms)",
        type: "number",
        default: 8000,
        min: 100,
        max: 600000,
      },
      { key: "bookId", label: "Book ID", type: "text", default: "BK-FX-MM-SIM-001" },
      {
        key: "settlementMode",
        label: "Settlement",
        type: "select",
        default: "accelerated",
        options: ["accelerated", "realtime"],
        help: "accelerated: full lifecycle at T+0. realtime: settles at T+2.",
      },
    ],
    fireActions: [{ id: "request-one", label: "Send one request" }],
    // Trades book through the normal path (actor "operator"); the engine's own
    // tradesGenerated counter is authoritative, so no event-derived override.
    eventActorIds: [],
    start(config) {
      engine.startTradeLoop(toEngineConfig(config));
    },
    stop() {
      engine.stopTradeLoop();
    },
    isRunning() {
      return engine.isTradeLoopRunning();
    },
    async fire(actionId) {
      if (actionId !== "request-one") return { ok: false, detail: `unknown action '${actionId}'` };
      engine.fireTrade();
      return { ok: true };
    },
    getStatus(): SimStatus {
      const s = engine.getStatus();
      return {
        id: "counterparty-fx-request",
        running: s.running,
        eventsEmitted: s.tradesGenerated,
        lastEventAt: s.lastTradeAt,
        lastEventType: s.lastTradeId ? "FxTradeExecuted" : null,
        lastError: s.errorsCount > 0 ? `${s.errorsCount} error(s)` : null,
        startedAt: s.startedAt,
        extra: {
          lastTradeId: s.lastTradeId,
          lastPair: s.lastPair,
          lastSide: s.lastSide,
          lastRate: s.lastRate,
          lastCounterparty: s.lastCounterparty,
          settlementMode: s.config.settlementMode,
          riskMonitor: s.riskMonitor,
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
      "SIMULATED FX price feed — emits bid/mid/ask ticks tagged provenance=\"simulated\" for the standard pairs to the market-data store (reference data, not the event store). Isolated from the real MTM/valuation source: every valuation read filters to provenance=\"production\", so these synthetic ticks can never reach a real mark. Drives the FX trade-sim loop and risk monitor at high frequency without burning Twelve Data free-tier credits.",
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
