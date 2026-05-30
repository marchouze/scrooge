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
 * Counterparty FX request-to-trade — the EXTERNAL stimulus.
 *
 * INPUT PATH (D-FX-SIM-FRONTEND-INPUT-DRIVER, CEO-approved 2026-05-30):
 * a 3rd-party simulator models an actor OUTSIDE the bank, so the faithful
 * realisation is for the counterparty to transact through the bank's external
 * web front-end — `/trade-book.html` — exactly as a real external party would,
 * NOT via an internal `bookFxTrade` call. Trades now enter via the reusable
 * front-end browser-driver:
 *
 *   1. `scripts/sim/fx-frontend-trade-specs.ts` emits N deterministic specs
 *      (every spec tagged provenance=simulated), each mapping 1:1 onto the
 *      trade-book form fields.
 *   2. An agent drives Claude-in-Chrome over `/trade-book.html`, filling and
 *      submitting the form per spec — see
 *      `platform/simulation/fx-frontend-driver/README.md`.
 *
 * The previous in-process auto-booking (`engine.startTradeLoop` / `fireTrade`
 * → `executeFxTrade` → `bookFxTrade`) is RETIRED for this module: keeping it
 * alongside the front-end path would be two live booking paths for the same
 * scope (duplicate-trade risk; CLAUDE.md "One dispatch path per scope"). The
 * in-process coupling was also the per-booking wedge vector fixed in PR #912.
 *
 * The bank's INTERNAL market-maker (EnvSimEngine risk monitor, rates) remains
 * at /fx-sim; `engine` is retained here only to surface that read-only risk
 * context — this module no longer drives its trade loop.
 *
 * SUBSTRATE GAP (named, not hidden): a fully autonomous UNATTENDED run needs an
 * agent runtime — a Bun server process cannot invoke the Claude-in-Chrome MCP
 * tool. Until that runtime lands these runs are agent-executed /
 * Scrooge-coordinated. Roadmap item, not a blocker.
 */
export function makeCounterpartyFxRequestModule(engine: EnvSimEngine): SimulatorModule {
  return {
    id: "counterparty-fx-request",
    label: "Counterparty FX request-to-trade (front-end input)",
    domain: "counterparty",
    description:
      "External counterparties requesting FX spot trades. Trades now ENTER VIA THE FRONT-END: an agent runs scripts/sim/fx-frontend-trade-specs.ts to generate deterministic simulated specs, then drives Claude-in-Chrome over /trade-book.html to book each one (see platform/simulation/fx-frontend-driver/README.md). The in-process auto-booking is retired — the front-end is the canonical input path. Autonomous unattended browser runs require an agent runtime (substrate gap).",
    // No internal loop/fire — booking is driven externally through the browser.
    mode: "fire",
    configSchema: [],
    fireActions: [{ id: "how-to", label: "How to book (front-end driver)" }],
    // Front-end-booked FX trades carry actor "operator" (same as a manual/real
    // trade), so they are NOT attributable to a sim actor id here; the hub's
    // event-derived count would otherwise also catch genuine manual trades.
    eventActorIds: [],
    // Booking is external; the in-process loop is retired. start/stop are no-ops
    // kept only to satisfy the lifecycle contract.
    start() {
      /* retired — booking enters via the front-end driver */
    },
    stop() {
      /* retired — booking enters via the front-end driver */
    },
    isRunning() {
      return false;
    },
    async fire(actionId) {
      if (actionId !== "how-to") return { ok: false, detail: `unknown action '${actionId}'` };
      return {
        ok: true,
        detail:
          "Booking enters via the front-end. Run: `bun run scripts/sim/fx-frontend-trade-specs.ts --count <n> --seed <s>` then have an agent drive /trade-book.html via Claude-in-Chrome per platform/simulation/fx-frontend-driver/README.md.",
      };
    },
    getStatus(): SimStatus {
      // Read-only internal MM risk context (rates / B3 steering) for the panel;
      // this module no longer drives the engine's trade loop, so it reports as
      // not running and emits nothing in-process.
      const s = engine.getStatus();
      return {
        id: "counterparty-fx-request",
        running: false,
        eventsEmitted: 0,
        lastEventAt: null,
        lastEventType: null,
        lastError: null,
        startedAt: null,
        extra: {
          inputPath: "front-end (/trade-book.html via Claude-in-Chrome)",
          paramGenerator: "scripts/sim/fx-frontend-trade-specs.ts",
          driverProcedure: "platform/simulation/fx-frontend-driver/README.md",
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
