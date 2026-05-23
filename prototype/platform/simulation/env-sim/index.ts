// platform/simulation/env-sim/index.ts
//
// EnvSimEngine — External Environment Simulator.
//
// Orchestrates:
//  - FX trade generation (absorbed from FxSimEngine)
//  - Stochastic post-trade lifecycle (counterparty behavior profiles)
//  - MarketDataSimulator (price ticks)
//  - NostroStatementSimulator (daily MT940/camt.053)
//  - CorrespondentAdviceSim (MT202 on receive legs)
//  - RegulatoryAckSim (SARB acks on regulatory reports)
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION; D-FX-SALES-TRADING-FRONTEND.
// Author: Env (External Environment Simulator) / Devon (Chief Operating Officer, engineering)

import { randomUUID } from "node:crypto";

import { nowUtc } from "../../core/types";
import type { EventStore } from "../../event-store/store";
import { MarketDataStore } from "../../market-data/store";
import { SIM_COUNTERPARTIES } from "../fx-sim-counterparties";
import { generateSimTrade } from "../fx-sim-generator";
import { FxRateEngine } from "../fx-sim-rates";
import { runPostTradeLifecycle } from "../post-trade-lifecycle";
import { CorrespondentAdviceSim } from "./correspondent-advice-sim";
import type { CounterpartyBehaviorProfile } from "./counterparty-profiles";
import { mulberry32 } from "./counterparty-profiles";
import { MarketDataSimulator } from "./market-data-sim";
import { NostroStatementSimulator } from "./nostro-statement-sim";
import { RegulatoryAckSim } from "./regulatory-ack-sim";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface EnvSimOptions {
  /** Minimum interval between trades in ms. Default 2000. */
  minIntervalMs?: number;
  /** Maximum interval between trades in ms. Default 8000. */
  maxIntervalMs?: number;
  /** Trading book identifier. Default "BK-FX-MM-SIM-001". */
  bookId?: string;
  /** Seed for the PRNG — enables deterministic replay. */
  seed?: number;
  /** Per-counterparty behavior profiles. Defaults to ALWAYS_SETTLE for all. */
  counterpartyProfiles?: CounterpartyBehaviorProfile[];
  /** Market data tick interval in ms. Default 60_000. */
  marketDataIntervalMs?: number;
  /** Nostro statement interval in ms. Default 86_400_000 (24h). */
  nostroStatementIntervalMs?: number;
  /**
   * External MarketDataStore instance. If not provided, an in-memory store is
   * created internally (suitable for tests and standalone runs).
   */
  marketDataStore?: MarketDataStore;
  /**
   * Settlement mode:
   *   "accelerated" (default) — full lifecycle fires synchronously at T+0.
   *   "realtime" — only FxSettlementInstructed events fire at T+0; the
   *     server's settlement timer emits PrincipalPayments + SettlementConfirmed
   *     when the trade's settlementDate (T+2) arrives.
   */
  settlementMode?: "realtime" | "accelerated";
}

export interface EnvSimStatus {
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
  /** Active configuration (preserved for backward compatibility with FxSimEngine callers). */
  config: {
    minIntervalMs: number;
    maxIntervalMs: number;
    bookId: string;
    settlementMode: "realtime" | "accelerated";
  };
  subSimulators: {
    marketData: boolean;
    nostroStatement: boolean;
    correspondentAdvice: boolean;
    regulatoryAck: boolean;
  };
}

// ---------------------------------------------------------------------------
// Default options
// ---------------------------------------------------------------------------

const DEFAULTS = {
  minIntervalMs: 2_000,
  maxIntervalMs: 8_000,
  bookId: "BK-FX-MM-SIM-001",
  marketDataIntervalMs: 60_000,
  nostroStatementIntervalMs: 86_400_000,
} as const;

// ---------------------------------------------------------------------------
// EnvSimEngine
// ---------------------------------------------------------------------------

export class EnvSimEngine {
  private readonly store: EventStore;
  readonly marketDataStore: MarketDataStore;
  private opts: {
    minIntervalMs: number;
    maxIntervalMs: number;
    bookId: string;
    marketDataIntervalMs: number;
    nostroStatementIntervalMs: number;
    settlementMode: "realtime" | "accelerated";
    seed?: number;
    counterpartyProfiles?: CounterpartyBehaviorProfile[];
  };
  private readonly rateEngine: FxRateEngine;
  private readonly rng: () => number;
  private readonly profileMap: Map<string, CounterpartyBehaviorProfile>;

  private readonly marketDataSim: MarketDataSimulator;
  private readonly nostroSim: NostroStatementSimulator;
  private readonly correspondentSim: CorrespondentAdviceSim;
  private readonly regulatoryAckSim: RegulatoryAckSim;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private status: EnvSimStatus;

  constructor(store: EventStore, options?: EnvSimOptions) {
    this.store = store;
    this.opts = {
      minIntervalMs: options?.minIntervalMs ?? DEFAULTS.minIntervalMs,
      maxIntervalMs: options?.maxIntervalMs ?? DEFAULTS.maxIntervalMs,
      bookId: options?.bookId ?? DEFAULTS.bookId,
      marketDataIntervalMs: options?.marketDataIntervalMs ?? DEFAULTS.marketDataIntervalMs,
      nostroStatementIntervalMs:
        options?.nostroStatementIntervalMs ?? DEFAULTS.nostroStatementIntervalMs,
      settlementMode: options?.settlementMode ?? "accelerated",
      ...(options?.seed !== undefined ? { seed: options.seed } : {}),
      ...(options?.counterpartyProfiles !== undefined
        ? { counterpartyProfiles: options.counterpartyProfiles }
        : {}),
    };

    // Seeded PRNG or Math.random.
    this.rng = options?.seed !== undefined ? mulberry32(options.seed) : Math.random;
    this.rateEngine = new FxRateEngine();

    // Market data store — use caller-supplied instance or default to in-memory.
    this.marketDataStore = options?.marketDataStore ?? new MarketDataStore(":memory:");

    // Build profile lookup map.
    this.profileMap = new Map();
    for (const p of options?.counterpartyProfiles ?? []) {
      this.profileMap.set(p.counterpartyId, p);
    }

    // Sub-simulators.
    this.marketDataSim = new MarketDataSimulator(this.marketDataStore, this.rateEngine, {
      intervalMs: this.opts.marketDataIntervalMs,
      rng: this.rng,
    });
    this.nostroSim = new NostroStatementSimulator(store, this.rng, {
      intervalMs: this.opts.nostroStatementIntervalMs,
    });
    this.correspondentSim = new CorrespondentAdviceSim(store);
    this.regulatoryAckSim = new RegulatoryAckSim(store);

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
      config: {
        minIntervalMs: this.opts.minIntervalMs,
        maxIntervalMs: this.opts.maxIntervalMs,
        bookId: this.opts.bookId,
        settlementMode: this.opts.settlementMode,
      },
      subSimulators: {
        marketData: false,
        nostroStatement: false,
        correspondentAdvice: false,
        regulatoryAck: false,
      },
    };
  }

  /**
   * Start the engine and all sub-simulators. Idempotent.
   * Optional `config` overrides accepted for backward compatibility with FxSimEngine callers.
   */
  start(config?: {
    minIntervalMs?: number;
    maxIntervalMs?: number;
    bookId?: string;
    settlementMode?: "realtime" | "accelerated";
  }): EnvSimStatus {
    if (this.status.running) return { ...this.status };

    // Apply config overrides for backward compat.
    if (config?.minIntervalMs !== undefined) this.opts.minIntervalMs = config.minIntervalMs;
    if (config?.maxIntervalMs !== undefined) this.opts.maxIntervalMs = config.maxIntervalMs;
    if (config?.bookId !== undefined) this.opts.bookId = config.bookId;
    if (config?.settlementMode !== undefined) this.opts.settlementMode = config.settlementMode;

    this.status = {
      ...this.status,
      running: true,
      startedAt: nowUtc(),
      stoppedAt: null,
      config: {
        minIntervalMs: this.opts.minIntervalMs,
        maxIntervalMs: this.opts.maxIntervalMs,
        bookId: this.opts.bookId,
        settlementMode: this.opts.settlementMode,
      },
    };

    this.scheduleNext();
    this.marketDataSim.start();
    this.nostroSim.start();
    this.correspondentSim.start();
    this.regulatoryAckSim.start();

    return this.getStatus();
  }

  /** Stop the engine and all sub-simulators. Idempotent. */
  stop(): EnvSimStatus {
    if (!this.status.running) return { ...this.status };

    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.marketDataSim.stop();
    this.nostroSim.stop();
    this.correspondentSim.stop();
    this.regulatoryAckSim.stop();

    this.status = {
      ...this.status,
      running: false,
      stoppedAt: nowUtc(),
      subSimulators: {
        marketData: false,
        nostroStatement: false,
        correspondentAdvice: false,
        regulatoryAck: false,
      },
    };

    return { ...this.status };
  }

  /** Get a snapshot of current status. */
  getStatus(): EnvSimStatus {
    return {
      ...this.status,
      subSimulators: {
        marketData: this.marketDataSim.isRunning(),
        nostroStatement: this.nostroSim.isRunning(),
        correspondentAdvice: this.correspondentSim.isRunning(),
        regulatoryAck: this.regulatoryAckSim.isRunning(),
      },
    };
  }

  /**
   * Fire a single trade synchronously (for testing). Returns immediately
   * after appending all events.
   */
  fireTrade(): void {
    const payload = generateSimTrade(this.rateEngine, SIM_COUNTERPARTIES, this.opts.bookId);
    const eventId = `sim-trade-${randomUUID()}`;
    const asOf = nowUtc();

    this.store.append({
      event_id: eventId,
      type: "FxTradeExecuted",
      as_of: asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:env:fx-sim-engine" },
      citations: ["D-FX-SALES-TRADING-FRONTEND", "D-MARKETS-SCHEMA-FOUNDATION"],
      payload: payload as unknown as Record<string, unknown>,
    });

    const cp = SIM_COUNTERPARTIES.find((c) => c.partyId === payload.counterparty.partyId);
    const counterpartyBic = cp?.bic ?? "SBZAZAJJXXX";

    runPostTradeLifecycle(
      this.store,
      payload,
      asOf,
      "BANKZAJJXXX",
      counterpartyBic,
      (partyId) => this.profileMap.get(partyId) ?? this.profileMap.get("*"),
      this.rng,
      this.opts.settlementMode,
    );

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
  }

  private scheduleNext(): void {
    const { minIntervalMs, maxIntervalMs } = this.opts;
    const delay = minIntervalMs + this.rng() * (maxIntervalMs - minIntervalMs);
    this.timer = setTimeout(() => {
      this.scheduledFire().catch((err: unknown) => {
        console.error("[EnvSimEngine] unexpected error in fireTrade:", err);
      });
    }, delay);
  }

  private async scheduledFire(): Promise<void> {
    try {
      this.fireTrade();
    } catch (err) {
      console.error("[EnvSimEngine] fireTrade error:", err);
      this.status = {
        ...this.status,
        errorsCount: this.status.errorsCount + 1,
      };
    }

    if (this.status.running) {
      this.scheduleNext();
    }
  }
}
