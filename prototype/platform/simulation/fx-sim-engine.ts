// platform/simulation/fx-sim-engine.ts
//
// FX market-making simulation engine. Generates random FX trades at a
// configurable interval and appends them to the event store as
// FxTradeExecuted events. Used for build-phase rehearsal only.
//
// Authority: D-FX-SALES-TRADING-FRONTEND; D-MARKETS-SCHEMA-FOUNDATION;
//   D-FX-BOOK-BOUNDARY.
// Author: Devon (Chief Operating Officer, engineering)

import { randomUUID } from "node:crypto";

import { nowUtc } from "../core/types";
import { SIM_COUNTERPARTIES } from "./fx-sim-counterparties";
import { generateSimTrade } from "./fx-sim-generator";
import { FxRateEngine } from "./fx-sim-rates";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SimConfig {
  /** Minimum interval between trades in ms. Default 2000. */
  minIntervalMs: number;
  /** Maximum interval between trades in ms. Default 8000. */
  maxIntervalMs: number;
  /** Trading book identifier. Default "BK-FX-MM-SIM-001". */
  bookId: string;
}

const DEFAULT_CONFIG: SimConfig = {
  minIntervalMs: 2_000,
  maxIntervalMs: 8_000,
  bookId: "BK-FX-MM-SIM-001",
};

export interface SimStatus {
  running: boolean;
  tradesGenerated: number;
  errorsCount: number;
  startedAt: string | null;
  stoppedAt: string | null;
  lastTradeAt: string | null;
  lastTradeId: string | null;
  lastPair: string | null;
  lastSide: "buy" | "sell" | null;
  lastRate: number | null;
  lastCounterparty: string | null;
  config: SimConfig;
}

// ---------------------------------------------------------------------------
// FxSimEngine
// ---------------------------------------------------------------------------

/** Minimal event store interface required by the sim engine. */
export interface IEventStore {
  append(event: {
    event_id: string;
    type: string;
    as_of: string;
    entity: string;
    actor: { type: "service" | "human" | "system"; id: string };
    citations: string[];
    payload: Record<string, unknown>;
  }): void;
}

export class FxSimEngine {
  private readonly store: IEventStore;
  private readonly rateEngine: FxRateEngine;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private status: SimStatus;

  constructor(store: IEventStore) {
    this.store = store;
    this.rateEngine = new FxRateEngine();
    this.status = {
      running: false,
      tradesGenerated: 0,
      errorsCount: 0,
      startedAt: null,
      stoppedAt: null,
      lastTradeAt: null,
      lastTradeId: null,
      lastPair: null,
      lastSide: null,
      lastRate: null,
      lastCounterparty: null,
      config: { ...DEFAULT_CONFIG },
    };
  }

  /** Start the simulation. If already running, returns current status unchanged. */
  start(config?: Partial<SimConfig>): SimStatus {
    if (this.status.running) {
      return { ...this.status };
    }

    this.status = {
      ...this.status,
      running: true,
      startedAt: nowUtc(),
      stoppedAt: null,
      config: {
        minIntervalMs: config?.minIntervalMs ?? DEFAULT_CONFIG.minIntervalMs,
        maxIntervalMs: config?.maxIntervalMs ?? DEFAULT_CONFIG.maxIntervalMs,
        bookId: config?.bookId ?? DEFAULT_CONFIG.bookId,
      },
    };

    this.scheduleNext();
    return { ...this.status };
  }

  /** Stop the simulation. If already stopped, returns current status unchanged. */
  stop(): SimStatus {
    if (!this.status.running) {
      return { ...this.status };
    }
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.status = {
      ...this.status,
      running: false,
      stoppedAt: nowUtc(),
    };
    return { ...this.status };
  }

  /** Get a snapshot of the current status. */
  getStatus(): SimStatus {
    return { ...this.status };
  }

  private scheduleNext(): void {
    const { minIntervalMs, maxIntervalMs } = this.status.config;
    const delay = minIntervalMs + Math.random() * (maxIntervalMs - minIntervalMs);
    this.timer = setTimeout(() => {
      this.fireTrade().catch((err: unknown) => {
        console.error("[FxSimEngine] unexpected error in fireTrade:", err);
      });
    }, delay);
  }

  private async fireTrade(): Promise<void> {
    try {
      const payload = generateSimTrade(this.rateEngine, SIM_COUNTERPARTIES, this.status.config.bookId);
      const eventId = `sim-trade-${randomUUID()}`;
      const asOf = nowUtc();

      this.store.append({
        event_id: eventId,
        type: "FxTradeExecuted",
        as_of: asOf,
        entity: "BANK-ZA-001",
        actor: { type: "service", id: "agent:devon:fx-sim-engine" },
        citations: ["D-FX-SALES-TRADING-FRONTEND", "D-MARKETS-SCHEMA-FOUNDATION"],
        payload: payload as unknown as Record<string, unknown>,
      });

      const tradeIdValue = payload.tradeId.value;
      const pair = `${payload.currencyPair.base}/${payload.currencyPair.quote}`;
      const leg = payload.legs[0];
      const mid = leg ? leg.rate.amount : null;

      this.status = {
        ...this.status,
        tradesGenerated: this.status.tradesGenerated + 1,
        lastTradeAt: asOf,
        lastTradeId: tradeIdValue,
        lastPair: pair,
        lastSide: payload.side,
        lastRate: mid,
        lastCounterparty: payload.counterparty.name,
      };
    } catch (err) {
      console.error("[FxSimEngine] fireTrade error:", err);
      this.status = {
        ...this.status,
        errorsCount: this.status.errorsCount + 1,
      };
    }

    // Reschedule if still running.
    if (this.status.running) {
      this.scheduleNext();
    }
  }
}
