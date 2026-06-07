// platform/simulation/bond-market-data-sim.ts
//
// BondMarketDataSimulator — appends simulated bond-price ticks to the
// MarketDataStore at a configurable interval using BondPriceEngine for the
// clean-price walk. The bond analogue of MarketDataSimulator
// (platform/simulation/env-sim/market-data-sim.ts).
//
// Ticks are tagged source="bond-sim", provenance="simulated" — reference /
// time-series data, NOT business-domain events. They never enter the event
// store and are isolated from valuation: every valuation read filters to
// provenance="production", so these synthetic ticks can never reach a real
// mark. `bond-price` already maps to the "bonds" asset-class column in the
// market-data dashboard, so the ticks render in the Bonds section with a `sim`
// badge automatically.
//
// Authority: D-NPA-SAGB-BOND-INTERNAL-TEST; D-MARKETS-SCHEMA-FOUNDATION.
// Author: Devon (Chief Operating Officer, engineering)

import { randomUUID } from "node:crypto";

import { nowUtc } from "../core/types";
import type { MarketDataStore } from "../market-data/store";
import { type BondPricePayload, MarketDataSources } from "../market-data/types";
import { SA_BOND_ISINS, SA_BOND_REFERENCE } from "../markets/reference/sa-bond-reference";
import type { BondPriceEngine } from "./bond-sim-prices";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Re-anchor the random walk from production jse-debt ticks every N ticks. At the
 * default 60-second interval this is every 10 minutes, so the simulated prices
 * cannot drift more than ~10 minutes of walk away from the reference fixture.
 */
const RESEED_EVERY_N_TICKS = 10;

/** The benchmark bonds tracked by the simulator (R186, R2030, R2040). */
export const SIM_BONDS: readonly string[] = SA_BOND_ISINS;

/** Simulated-walk marker carried in the tick payload's fixingVariant slot. */
const SIM_FIXING_VARIANT = "simulated-walk" as const;

// ---------------------------------------------------------------------------
// BondMarketDataSimulator
// ---------------------------------------------------------------------------

export class BondMarketDataSimulator {
  private readonly mdStore: MarketDataStore;
  private readonly priceEngine: BondPriceEngine;
  private readonly intervalMs: number;
  private readonly rng: () => number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private tickCount = 0;

  constructor(
    mdStore: MarketDataStore,
    priceEngine: BondPriceEngine,
    options: { intervalMs: number; rng: () => number },
  ) {
    this.mdStore = mdStore;
    this.priceEngine = priceEngine;
    this.intervalMs = options.intervalMs;
    this.rng = options.rng;
  }

  /** Start emitting bond-price ticks. Idempotent. */
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

  /** Emit one tick per bond. Exposed for tests / manual single-step.  */
  emitTick(): void {
    this.tickCount++;
    if (this.tickCount % RESEED_EVERY_N_TICKS === 0) {
      this.priceEngine.reseed(this.mdStore);
    }
    const asOf = nowUtc();
    for (const isin of SIM_BONDS) {
      try {
        const quote = this.priceEngine.tick(isin, this.rng);
        const bondCode = SA_BOND_REFERENCE[isin]?.bondCode ?? isin;
        const payload: BondPricePayload = {
          cleanPrice: quote.mid.toFixed(4),
          yieldToMaturity: quote.yieldToMaturity.toFixed(6),
          bondCode,
          fixingVariant: SIM_FIXING_VARIANT,
        };
        this.mdStore.append({
          id: randomUUID(),
          source: MarketDataSources.BOND_SIM,
          instrument: isin,
          dataType: "bond-price",
          provenance: "simulated",
          asOf,
          payload: payload as unknown as Record<string, unknown>,
        });
      } catch (err) {
        console.error(`[BondMarketDataSimulator] error emitting tick for ${isin}:`, err);
      }
    }
  }
}
