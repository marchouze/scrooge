// platform/simulation/env-sim/market-data-sim.ts
//
// MarketDataSimulator — appends FX quote ticks to the MarketDataStore at a
// configurable interval using FxRateEngine for rate generation.
//
// Market data ticks are reference/time-series data, NOT business domain events.
// They must not enter the event store. This simulator writes exclusively to the
// separate MarketDataStore (platform/market-data/store.ts).
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION.
// Author: Env (External Environment Simulator) / Devon (Chief Operating Officer, engineering)

import { randomUUID } from "node:crypto";

import { nowUtc } from "../../core/types";
import type { MarketDataStore } from "../../market-data/store";
import { type FxQuotePayload, MarketDataSources } from "../../market-data/types";
import type { FxRateEngine } from "../fx-sim-rates";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The 5 standard pairs tracked by the MarketDataSimulator. */
const STANDARD_PAIRS = ["ZAR/USD", "ZAR/EUR", "ZAR/GBP", "EUR/USD", "GBP/ZAR"] as const;

// ---------------------------------------------------------------------------
// MarketDataSimulator
// ---------------------------------------------------------------------------

export class MarketDataSimulator {
  private readonly mdStore: MarketDataStore;
  private readonly rateEngine: FxRateEngine;
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    mdStore: MarketDataStore,
    rateEngine: FxRateEngine,
    options: { intervalMs: number; rng: () => number },
  ) {
    this.mdStore = mdStore;
    this.rateEngine = rateEngine;
    this.intervalMs = options.intervalMs;
    // rng accepted for interface symmetry with other sub-simulators; rate engine manages its own randomness.
    void options.rng;
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
        const payload: FxQuotePayload = {
          pair,
          mid: rate.mid,
          bid: rate.bid,
          ask: rate.ask,
          source: MarketDataSources.FX_SIM,
        };
        this.mdStore.append({
          id: randomUUID(),
          source: MarketDataSources.FX_SIM,
          instrument: pair,
          dataType: "fx-quote",
          asOf,
          payload: payload as unknown as Record<string, unknown>,
        });
      } catch (err) {
        console.error(`[MarketDataSimulator] error emitting tick for ${pair}:`, err);
      }
    }
  }
}
