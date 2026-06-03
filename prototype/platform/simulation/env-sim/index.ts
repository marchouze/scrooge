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
import { MarketDataStore, lookupQuoteWithInverse } from "../../market-data/store";
import type { FxTradeExecutedPayload } from "../../markets/cdm/fx";
import {
  getFxNetPositions,
  getLimitUtilisations,
  rebuildLimitUtilisation,
} from "../../projections/markets/limit-utilisation";
import type { SimCounterparty } from "../fx-sim-counterparties";
import { generateSimTrade } from "../fx-sim-generator";
import { FxRateEngine, resolveSeedMidRates } from "../fx-sim-rates";
import { runPostTradeLifecycle } from "../post-trade-lifecycle";
import { CorrespondentAdviceSim } from "./correspondent-advice-sim";
import type { CounterpartyBehaviorProfile } from "./counterparty-profiles";
import { mulberry32 } from "./counterparty-profiles";
import { STANDARD_PAIRS } from "./market-data-sim";
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
  /**
   * Minimum notional in USD major units (e.g. 500_000 = $500k).
   * Passed to generateSimTrade; uses legacy per-counterparty range when absent.
   */
  notionalUsdMin?: number;
  /**
   * Maximum notional in USD major units (e.g. 5_000_000 = $5M).
   * Passed to generateSimTrade; uses legacy per-counterparty range when absent.
   */
  notionalUsdMax?: number;
  /**
   * Provenance of generated trades. "simulated" (default) tags trades with
   * provenance.kind:"simulated"; "production" tags them as real trades.
   */
  provenance?: "simulated" | "production";
  /**
   * Execution hook. When provided, fireTrade() routes the generated trade
   * through this callback (the bank's normal booking path) INSTEAD of appending
   * FxTradeExecuted + running the bespoke post-trade lifecycle. The 3rd-party
   * simulator hub wires this to bookFxTrade so simulated counterparty trade
   * initiations book exactly like a manual/real trade. When unset, the legacy
   * append + lifecycle path runs (standalone / tests).
   *
   * The fourth argument is the provenance mode configured on the engine, so the
   * callback can pass it through to bookFxTrade as provenanceMode.
   */
  /**
   * Counterparty source. When provided, each `fireTrade()` call invokes this
   * to get the current live counterparty list — enabling KYC-derived counterparties
   * without restarting the engine. Falls back to `SIM_COUNTERPARTIES` when absent.
   * The server wires this to `getActiveFxCounterparties(eventStore)`.
   */
  getCounterparties?: () => SimCounterparty[];
  executeFxTrade?: (
    payload: FxTradeExecutedPayload,
    asOf: string,
    counterpartyBic: string,
    provenanceMode: "simulated" | "production",
    settlementMode: "realtime" | "accelerated",
  ) => void;
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
  /** Risk monitor state — updated on each tick. */
  riskMonitor: {
    /** Current B3 utilisation as a fraction (e.g. 1.23 = 123%). Null until first tick. */
    b3UtilisationPct: number | null;
    b3RagStatus: "green" | "amber" | "red" | null;
    b3ExposureZar: number | null;
    b3LimitZar: number | null;
    /** Trading mode the engine is currently operating in. */
    mode: "normal" | "reducing" | "force-reduce";
    /** The forced side applied on the last risk-directed trade, or null if random. */
    lastForcedSide: "buy" | "sell" | null;
    /** The pair filter applied on the last risk-directed trade, or null. */
    lastTargetPairs: string[] | null;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the set of FX pairs currently available in the market data store.
 * Queries both production and simulated ticks so the sim works regardless of
 * which feed is active. Falls back to STANDARD_PAIRS when the store is empty.
 */
function getAvailableFxPairs(store: MarketDataStore): string[] {
  const ticks = store.query({ dataType: "fx-quote", provenance: "all", limit: 500 });
  const seen = new Set<string>();
  for (const tick of ticks) seen.add(tick.instrument);
  return seen.size > 0 ? [...seen] : [...STANDARD_PAIRS];
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
    provenance: "simulated" | "production";
    notionalUsdMin?: number;
    notionalUsdMax?: number;
    seed?: number;
    counterpartyProfiles?: CounterpartyBehaviorProfile[];
    getCounterparties?: () => SimCounterparty[];
    executeFxTrade?: (
      payload: FxTradeExecutedPayload,
      asOf: string,
      counterpartyBic: string,
      provenanceMode: "simulated" | "production",
      settlementMode: "realtime" | "accelerated",
    ) => void;
  };
  private readonly rateEngine: FxRateEngine;
  private readonly rng: () => number;
  private readonly profileMap: Map<string, CounterpartyBehaviorProfile>;

  private readonly marketDataSim: MarketDataSimulator;
  private readonly nostroSim: NostroStatementSimulator;
  private readonly correspondentSim: CorrespondentAdviceSim;
  private readonly regulatoryAckSim: RegulatoryAckSim;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private tradeLoopRunning = false;
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
      provenance: options?.provenance ?? "simulated",
      ...(options?.notionalUsdMin !== undefined ? { notionalUsdMin: options.notionalUsdMin } : {}),
      ...(options?.notionalUsdMax !== undefined ? { notionalUsdMax: options.notionalUsdMax } : {}),
      ...(options?.seed !== undefined ? { seed: options.seed } : {}),
      ...(options?.counterpartyProfiles !== undefined
        ? { counterpartyProfiles: options.counterpartyProfiles }
        : {}),
      ...(options?.getCounterparties !== undefined
        ? { getCounterparties: options.getCounterparties }
        : {}),
      ...(options?.executeFxTrade !== undefined ? { executeFxTrade: options.executeFxTrade } : {}),
    };

    // Seeded PRNG or Math.random.
    this.rng = options?.seed !== undefined ? mulberry32(options.seed) : Math.random;

    // Market data store — use caller-supplied instance or default to in-memory.
    this.marketDataStore = options?.marketDataStore ?? new MarketDataStore(":memory:");

    // FX rate engine — seed each pair's starting mid from the most recent
    // production market-data tick in the store, falling back to the documented
    // approximations when none exists.
    this.rateEngine = new FxRateEngine(resolveSeedMidRates(this.marketDataStore));

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
      riskMonitor: {
        b3UtilisationPct: null,
        b3RagStatus: null,
        b3ExposureZar: null,
        b3LimitZar: null,
        mode: "normal",
        lastForcedSide: null,
        lastTargetPairs: null,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Sub-simulator accessors — exposed so the ThirdPartySimHub can register each
  // external sub-simulator as an individually-controllable module. Additive;
  // these do not change engine behaviour.
  // ---------------------------------------------------------------------------

  get marketDataSimulator(): MarketDataSimulator {
    return this.marketDataSim;
  }

  get nostroStatementSimulator(): NostroStatementSimulator {
    return this.nostroSim;
  }

  get correspondentAdviceSimulator(): CorrespondentAdviceSim {
    return this.correspondentSim;
  }

  get regulatoryAckSimulator(): RegulatoryAckSim {
    return this.regulatoryAckSim;
  }

  // ---------------------------------------------------------------------------
  // Risk monitor — computes trade direction to stay within B3 limit
  // ---------------------------------------------------------------------------

  /**
   * Inspect the current limit-utilisation projection and return a forced side
   * + pair filter that reduces the dominant open position.
   *
   * Logic:
   *  1. Rebuild the projection from the live event store.
   *  2. Find the non-ZAR currency with the largest ZAR-equivalent absolute
   *     net position (i.e. the dominant contributor to B3).
   *  3. Determine whether that currency is net long or net short.
   *  4. Map to the trade direction that reduces the position.
   *  5. Bias probability: green → none; amber → 70%; red → 95%.
   */
  computeFxRiskDirection(): {
    forcedSide?: "buy" | "sell";
    eligiblePairsFilter?: string[];
    mode: "normal" | "reducing" | "force-reduce";
    b3Row: ReturnType<typeof getLimitUtilisations>[number] | undefined;
  } {
    const events = [...this.store.replay()];
    rebuildLimitUtilisation(events);
    const utilisations = getLimitUtilisations(this.marketDataStore);
    const b3Row = utilisations.find((r) => r.cluster === "B3");
    const netPositions = getFxNetPositions();

    if (!b3Row || b3Row.ragStatus === "green") {
      return { mode: "normal", b3Row };
    }

    // Determine probability of forcing a risk-reducing trade.
    const forceProb = b3Row.ragStatus === "red" ? 0.95 : 0.7;
    if (this.rng() > forceProb) {
      return { mode: "normal", b3Row };
    }

    // Find the non-ZAR currency with the largest ZAR-equivalent absolute position.
    let dominantCcy: string | null = null;
    let dominantZarEquiv = 0;
    for (const [ccy, pos] of netPositions) {
      if (ccy === "ZAR") continue;
      const absPos = Math.abs(pos);
      if (absPos === 0) continue;
      const quote = lookupQuoteWithInverse(this.marketDataStore, `${ccy}/ZAR`);
      const zarEquiv = quote ? absPos * quote.rate : absPos;
      if (zarEquiv > dominantZarEquiv) {
        dominantZarEquiv = zarEquiv;
        dominantCcy = ccy;
      }
    }

    // If no foreign CCY dominates, check ZAR itself.
    const zarPos = netPositions.get("ZAR") ?? 0;
    if (!dominantCcy && Math.abs(zarPos) > 0) {
      // Reduce ZAR long by buying foreign; reduce ZAR short by selling foreign.
      const side = zarPos > 0 ? "buy" : "sell";
      const mode = b3Row.ragStatus === "red" ? "force-reduce" : "reducing";
      return {
        forcedSide: side,
        eligiblePairsFilter: ["USD/ZAR", "EUR/ZAR", "GBP/ZAR"],
        mode,
        b3Row,
      };
    }

    if (!dominantCcy) return { mode: "normal", b3Row };

    const netPos = netPositions.get(dominantCcy) ?? 0;
    // Pairs in our set where dominantCcy appears as the base currency.
    const basePairs = ["USD/ZAR", "EUR/ZAR", "GBP/ZAR", "EUR/USD", "EUR/GBP", "GBP/USD"].filter(
      (p) => p.startsWith(`${dominantCcy}/`),
    );

    // If net long dominant CCY → sell it (side=sell for pairs where it's base).
    // If net short dominant CCY → buy it (side=buy for pairs where it's base).
    const forcedSide: "buy" | "sell" = netPos > 0 ? "sell" : "buy";
    const mode = b3Row.ragStatus === "red" ? "force-reduce" : "reducing";

    return {
      forcedSide,
      ...(basePairs.length > 0 ? { eligiblePairsFilter: basePairs } : {}),
      mode,
      b3Row,
    };
  }

  /**
   * Start the engine and all sub-simulators. Idempotent.
   * Optional `config` overrides accepted for backward compatibility with FxSimEngine callers.
   */
  /**
   * Start ONLY the FX trade-generation loop (no sub-simulators). Used by the
   * 3rd-party simulator hub's counterparty-fx-request module. Idempotent.
   */
  startTradeLoop(config?: {
    minIntervalMs?: number;
    maxIntervalMs?: number;
    bookId?: string;
    settlementMode?: "realtime" | "accelerated";
    provenance?: "simulated" | "production";
    notionalUsdMin?: number;
    notionalUsdMax?: number;
  }): EnvSimStatus {
    if (this.tradeLoopRunning) return this.getStatus();

    // Apply config overrides.
    if (config?.minIntervalMs !== undefined) this.opts.minIntervalMs = config.minIntervalMs;
    if (config?.maxIntervalMs !== undefined) this.opts.maxIntervalMs = config.maxIntervalMs;
    if (config?.bookId !== undefined) this.opts.bookId = config.bookId;
    if (config?.settlementMode !== undefined) this.opts.settlementMode = config.settlementMode;
    if (config?.provenance !== undefined) this.opts.provenance = config.provenance;
    if (config?.notionalUsdMin !== undefined) this.opts.notionalUsdMin = config.notionalUsdMin;
    if (config?.notionalUsdMax !== undefined) this.opts.notionalUsdMax = config.notionalUsdMax;

    this.tradeLoopRunning = true;
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
    return this.getStatus();
  }

  /** Stop ONLY the FX trade-generation loop. Idempotent. */
  stopTradeLoop(): EnvSimStatus {
    if (!this.tradeLoopRunning) return this.getStatus();
    this.tradeLoopRunning = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.status = { ...this.status, running: false, stoppedAt: nowUtc() };
    return this.getStatus();
  }

  isTradeLoopRunning(): boolean {
    return this.tradeLoopRunning;
  }

  /**
   * Start the trade loop AND all sub-simulators. Idempotent. Retained for
   * back-compat with the legacy /api/fx-sim/* control panel.
   */
  start(config?: {
    minIntervalMs?: number;
    maxIntervalMs?: number;
    bookId?: string;
    settlementMode?: "realtime" | "accelerated";
  }): EnvSimStatus {
    this.startTradeLoop(config);
    this.marketDataSim.start();
    this.nostroSim.start();
    // correspondentSim handles MT202s for realtime mode only; in accelerated mode
    // simulateInboundMessages() already emits the MT202 inside runPostTradeLifecycle.
    if (this.opts.settlementMode === "realtime") {
      this.correspondentSim.start();
    }
    this.regulatoryAckSim.start();

    return this.getStatus();
  }

  /** Stop the trade loop and all sub-simulators. Idempotent. */
  stop(): EnvSimStatus {
    this.stopTradeLoop();

    this.marketDataSim.stop();
    this.nostroSim.stop();
    this.correspondentSim.stop();
    this.regulatoryAckSim.stop();

    this.status = {
      ...this.status,
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
    // Always compute a fresh risk monitor reading so callers (e.g. /api/fx-sim/status)
    // see current B3 even when the sim is stopped between ticks.
    const { mode, b3Row } = this.computeFxRiskDirection();
    return {
      ...this.status,
      riskMonitor: {
        b3UtilisationPct: b3Row ? b3Row.utilisationPct : null,
        b3RagStatus: b3Row ? b3Row.ragStatus : null,
        b3ExposureZar: b3Row ? b3Row.currentExposure : null,
        b3LimitZar: b3Row ? b3Row.limitValue : null,
        mode,
        lastForcedSide: this.status.riskMonitor.lastForcedSide,
        lastTargetPairs: this.status.riskMonitor.lastTargetPairs,
      },
      subSimulators: {
        marketData: this.marketDataSim.isRunning(),
        nostroStatement: this.nostroSim.isRunning(),
        correspondentAdvice: this.correspondentSim.isRunning(),
        regulatoryAck: this.regulatoryAckSim.isRunning(),
      },
    };
  }

  /**
   * Fire a single trade synchronously (for testing or manual trigger).
   * In production the scheduler calls this via `scheduledFire` which first
   * runs the risk monitor to determine the optimal trade direction.
   */
  fireTrade(opts?: { forcedSide?: "buy" | "sell"; eligiblePairsFilter?: string[] }): void {
    const counterparties = this.opts.getCounterparties?.() ?? [];
    if (counterparties.length === 0) {
      console.warn("[EnvSimEngine] fireTrade: no eligible counterparties — skipping trade");
      return;
    }
    // Get available pairs from market data store; fall back to STANDARD_PAIRS.
    const availablePairs = getAvailableFxPairs(this.marketDataStore);

    const payload = generateSimTrade(this.rateEngine, counterparties, this.opts.bookId, {
      rng: this.rng,
      marketDataStore: this.marketDataStore,
      availablePairs,
      ...(this.opts.notionalUsdMin !== undefined
        ? { notionalUsdMin: this.opts.notionalUsdMin }
        : {}),
      ...(this.opts.notionalUsdMax !== undefined
        ? { notionalUsdMax: this.opts.notionalUsdMax }
        : {}),
      ...(opts?.forcedSide ? { forcedSide: opts.forcedSide } : {}),
      ...(opts?.eligiblePairsFilter ? { eligiblePairsFilter: opts.eligiblePairsFilter } : {}),
    });
    const asOf = nowUtc();
    const cp = counterparties.find((c) => c.partyId === payload.counterparty.partyId);
    const counterpartyBic = cp?.bic ?? "SBZAZAJJXXX";
    const provenanceMode = this.opts.provenance;
    const settlementMode = this.opts.settlementMode;

    if (this.opts.executeFxTrade) {
      // Route execution through the bank's normal booking path (hub wiring).
      this.opts.executeFxTrade(payload, asOf, counterpartyBic, provenanceMode, settlementMode);
    } else {
      // Legacy path: append FxTradeExecuted + run the bespoke post-trade lifecycle.
      this.store.append({
        event_id: `sim-trade-${randomUUID()}`,
        type: "FxTradeExecuted",
        as_of: asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:env:fx-sim-engine" },
        citations: ["D-FX-SALES-TRADING-FRONTEND", "D-MARKETS-SCHEMA-FOUNDATION"],
        payload: payload as unknown as Record<string, unknown>,
      });

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
    }

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
        console.error("[EnvSimEngine] unexpected error in scheduledFire:", err);
      });
    }, delay);
  }

  private async scheduledFire(): Promise<void> {
    try {
      // Run risk monitor before every trade — computes forced side + pair filter.
      const { forcedSide, eligiblePairsFilter, mode, b3Row } = this.computeFxRiskDirection();

      // Update the risk monitor section of status.
      this.status = {
        ...this.status,
        riskMonitor: {
          b3UtilisationPct: b3Row ? b3Row.utilisationPct : null,
          b3RagStatus: b3Row ? b3Row.ragStatus : null,
          b3ExposureZar: b3Row ? b3Row.currentExposure : null,
          b3LimitZar: b3Row ? b3Row.limitValue : null,
          mode,
          lastForcedSide: forcedSide ?? null,
          lastTargetPairs: eligiblePairsFilter ? [...eligiblePairsFilter] : null,
        },
      };

      this.fireTrade({
        ...(forcedSide ? { forcedSide } : {}),
        ...(eligiblePairsFilter ? { eligiblePairsFilter } : {}),
      });
    } catch (err) {
      console.error("[EnvSimEngine] fireTrade error:", err);
      this.status = {
        ...this.status,
        errorsCount: this.status.errorsCount + 1,
      };
    }

    if (this.tradeLoopRunning) {
      this.scheduleNext();
    }
  }
}
