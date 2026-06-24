// platform/simulation-v2-live/hub-module.ts
//
// SimulatorModule wrapper for the live FX V2 generative driver. Adapts
// V2LiveFxDriver to the ThirdPartySimHub contract (platform/simulation/hub/types)
// so the V2 simulator is start/stop/fire-controllable from the same hub the V1
// simulators use — reusing the hub's lifecycle, config validation, and Principle-1
// event-derived status (no new hub).
//
// mode "loop+fire": `start` runs the continuous scheduler; `fire("tick")` injects
// one deterministic tick (generate + book + settle one cohort) for a manual probe.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20).

import type { EventStore } from "../event-store/store";
import type { MarketDataStore } from "../market-data/store";
import type { SimConfigField, SimStatus, SimulatorModule } from "../simulation/hub/types";
import { V2LiveFxDriver, type V2LiveFxDriverConfig } from "./live-driver";

/** Hub module id — the live V2 generative FX counterparty simulator. */
export const V2_FX_GENERATIVE_MODULE_ID = "fx-v2-generative";

/**
 * Sim-side actor ids the driver's external-party emissions carry. The hub derives
 * eventsEmitted / lastEventAt from these (Principle 1) — the bank's own
 * booking/settlement actors are SUT-internal and deliberately excluded.
 */
const SIM_ACTOR_IDS: readonly string[] = [
  "agent:env:counterparty-provisioning-sim",
  "agent:env:fx-trade-confirmation-sim",
  "agent:env:fx-settlement-sim",
];

const CONFIG_SCHEMA: readonly SimConfigField[] = [
  {
    key: "tickIntervalMs",
    label: "Tick interval (ms)",
    type: "number",
    default: 3000,
    min: 250,
    max: 600_000,
    help: "Wall-clock period between ticks (scheduler only).",
  },
  {
    key: "tradesPerTick",
    label: "Trades per tick",
    type: "number",
    default: 1,
    min: 1,
    max: 20,
  },
  {
    key: "settlementMode",
    label: "Settlement mode",
    type: "select",
    default: "accelerated",
    options: ["accelerated", "realtime"],
    help: "accelerated = settle same tick; realtime = settle on T+2 sim day.",
  },
  {
    key: "seed",
    label: "RNG seed",
    type: "number",
    default: 4606,
    help: "Deterministic replay seed (same seed → same run).",
  },
];

function configFrom(raw: Record<string, unknown> | undefined): V2LiveFxDriverConfig {
  const r = raw ?? {};
  const cfg: {
    tickIntervalMs?: number;
    tradesPerTick?: number;
    settlementMode?: "accelerated" | "realtime";
    seed?: number;
  } = {};
  if (typeof r.tickIntervalMs === "number") cfg.tickIntervalMs = r.tickIntervalMs;
  if (typeof r.tradesPerTick === "number") cfg.tradesPerTick = r.tradesPerTick;
  if (r.settlementMode === "accelerated" || r.settlementMode === "realtime") {
    cfg.settlementMode = r.settlementMode;
  }
  if (typeof r.seed === "number" && Number.isInteger(r.seed)) cfg.seed = r.seed;
  return cfg;
}

/**
 * Build the hub module wrapping the live FX V2 generative driver. The driver is
 * (re)constructed on each `start(config)` so dashboard reconfiguration takes
 * effect; the shared event/market stores are injected once.
 */
export function makeV2FxGenerativeModule(args: {
  readonly eventStore: EventStore;
  readonly marketDataStore: MarketDataStore;
}): SimulatorModule {
  let driver: V2LiveFxDriver | null = null;

  const ensureDriver = (config?: Record<string, unknown>): V2LiveFxDriver => {
    driver = new V2LiveFxDriver({
      eventStore: args.eventStore,
      marketDataStore: args.marketDataStore,
      config: configFrom(config),
    });
    return driver;
  };

  const idleStatus = (): SimStatus => ({
    id: V2_FX_GENERATIVE_MODULE_ID,
    running: false,
    eventsEmitted: 0,
    lastEventAt: null,
    lastEventType: null,
    lastError: null,
    startedAt: null,
  });

  return {
    id: V2_FX_GENERATIVE_MODULE_ID,
    label: "FX V2 generative counterparty (live)",
    domain: "counterparty",
    description:
      "Live, born-V2 third-party FX-spot simulator: generates trades on a tick and " +
      "streams the full lifecycle (confirm → book → settle → cash) into the shared " +
      "store, tagged simulated. Replay-safe (SimulatedClock + SeededRng).",
    mode: "loop+fire",
    configSchema: CONFIG_SCHEMA,
    fireActions: [
      {
        id: "tick",
        label: "Fire one tick (generate + book + settle one cohort)",
      },
    ],
    eventActorIds: SIM_ACTOR_IDS,
    start(config?: Record<string, unknown>): void {
      // Reconstruct with the supplied config (fresh deterministic run), then loop.
      ensureDriver(config).start();
    },
    stop(): void {
      driver?.stop();
    },
    isRunning(): boolean {
      return driver?.isRunning() ?? false;
    },
    async fire(actionId: string): Promise<{ ok: boolean; detail?: unknown }> {
      if (actionId !== "tick") {
        return { ok: false, detail: `unknown action '${actionId}'` };
      }
      const d = driver ?? ensureDriver();
      d.tickOnce();
      return { ok: true, detail: d.getStatus() };
    },
    getStatus(): SimStatus {
      if (!driver) return idleStatus();
      const s = driver.getStatus();
      return {
        id: V2_FX_GENERATIVE_MODULE_ID,
        running: s.running,
        // Fallback count (the hub overrides this from eventActorIds, Principle 1).
        eventsEmitted: s.tradesBooked,
        lastEventAt: null,
        lastEventType: null,
        lastError: s.lastError,
        startedAt: s.startedAt,
        extra: {
          simClock: s.simClock,
          ticks: s.ticks,
          tradesGenerated: s.tradesGenerated,
          tradesBooked: s.tradesBooked,
          settlementsConfirmed: s.settlementsConfirmed,
          cashInstancesMaterialised: s.cashInstancesMaterialised,
          boundariesFired: s.boundariesFired,
          lastTrade: s.lastTrade,
          lastPnLTotalReporting: s.lastPnLTotalReporting,
          lastVarReporting: s.lastVarReporting,
        },
      };
    },
  };
}
