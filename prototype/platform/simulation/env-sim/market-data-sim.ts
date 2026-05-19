// platform/simulation/env-sim/market-data-sim.ts
//
// MarketDataSimulator — emits MarketDataTickReceived events at a configurable
// interval using FxRateEngine for rate generation.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
// Author: Env (External Environment Simulator) / Devon (Chief Operating Officer, engineering)

import { nowUtc } from "../../core/types";
import type { EventStore } from "../../event-store/store";
import { makeMarketDataTickReceived } from "../../event-store/event-types/markets";
import type { FxRateEngine } from "../fx-sim-rates";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTOR = { type: "service" as const, id: "agent:env:market-data-sim" };
const ENTITY = "BANK-ZA-001";
const CITATIONS = ["D-MARKETS-SCHEMA-FOUNDATION"];

/** The 5 standard pairs tracked by the MarketDataSimulator. */
const STANDARD_PAIRS = ["ZAR/USD", "ZAR/EUR", "ZAR/GBP", "EUR/USD", "GBP/ZAR"] as const;

// ---------------------------------------------------------------------------
// MarketDataSimulator
// ---------------------------------------------------------------------------

export class MarketDataSimulator {
  private readonly store: EventStore;
  private readonly rateEngine: FxRateEngine;
  private readonly intervalMs: number;
  private readonly rng: () => number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    store: EventStore,
    rateEngine: FxRateEngine,
    options: { intervalMs: number; rng: () => number },
  ) {
    this.store = store;
    this.rateEngine = rateEngine;
    this.intervalMs = options.intervalMs;
    this.rng = options.rng;
  }

  /** Start emitting market data ticks. Idempotent. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => {
      this.emitTick();
    }, this.intervalMs);
  }

  /** Stop emitting ticks. Idempotent. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private emitTick(): void {
    const asOf = nowUtc();
    for (const pair of STANDARD_PAIRS) {
      try {
        const rate = this.rateEngine.tick(pair);
        this.store.append(
          makeMarketDataTickReceived({
            asOf,
            entity: ENTITY,
            actor: ACTOR,
            citations: CITATIONS,
            payload: {
              pair,
              mid: rate.mid,
              bid: rate.bid,
              ask: rate.ask,
              source: "env-sim",
              asOf,
            },
          }),
        );
      } catch (err) {
        console.error(`[MarketDataSimulator] error emitting tick for ${pair}:`, err);
      }
    }
  }
}
