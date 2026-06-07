// platform/simulation/bond-sim-engine.ts
//
// BondSimEngine — bond market-making simulator. The bond analogue of
// EnvSimEngine (platform/simulation/env-sim/index.ts), trimmed to the trade
// loop, the bond market-data feed, and a position guard.
//
// Trade loop: on a randomised interval it asks the position guard for a
// risk-reducing direction, generates a counterparty RFQ via
// generateSimBondTrade, and books it through the `executeBondTrade` hook (wired
// by the server to the bank's `bookBondTrade` path → BondTradeExecuted → GL →
// BondSettlementInstructed → Standard Bank custodian).
//
// Position guard: the bond analogue of the FX B3 risk monitor. It folds the
// unified-position projection, finds the benchmark bond with the largest net
// nominal, and — when that net breaches the configured cap — biases the trade
// side toward reducing the inventory (sell a long / buy a short) with
// amber/red-graded probability.
//
// Authority: D-NPA-SAGB-BOND-INTERNAL-TEST; D-MARKETS-SCHEMA-FOUNDATION;
//   D-FINANCIAL-INSTRUMENT-ENTITY (unified position).
// Author: Devon (Chief Operating Officer, engineering)

import { nowUtc } from "../core/types";
import type { EventStore } from "../event-store/store";
import { MarketDataStore } from "../market-data/store";
import type { BondTradeBookBody } from "../markets/cdm/bond-book";
import { SA_BOND_ISINS } from "../markets/reference/sa-bond-reference";
import {
  unifiedPositionInitial,
  unifiedPositionProjection,
} from "../projections/markets/unified-position";
import { BondMarketDataSimulator } from "./bond-market-data-sim";
import type { BondSimCounterparty } from "./bond-sim-counterparties";
import { generateSimBondTrade } from "./bond-sim-generator";
import { BondPriceEngine, resolveSeedBondPrices } from "./bond-sim-prices";
import { mulberry32 } from "./env-sim/counterparty-profiles";

// ---------------------------------------------------------------------------
// Options + status
// ---------------------------------------------------------------------------

export interface BondSimOptions {
  /** Minimum interval between trades in ms. Default 3000. */
  minIntervalMs?: number;
  /** Maximum interval between trades in ms. Default 10000. */
  maxIntervalMs?: number;
  /** Bond market-data tick interval in ms. Default 60_000. */
  marketDataIntervalMs?: number;
  /** Seed for the PRNG — enables deterministic replay. */
  seed?: number;
  /** External MarketDataStore. Defaults to an in-memory store (tests/standalone). */
  marketDataStore?: MarketDataStore;
  /** Provenance of generated trades. Default "simulated". */
  provenance?: "simulated" | "production";
  /** Minimum nominal in ZAR major units (face value). Default 5_000_000. */
  minNominalZar?: number;
  /** Maximum nominal in ZAR major units (face value). Default 50_000_000. */
  maxNominalZar?: number;
  /** Per-bond net-nominal cap in ZAR minor units. Default R200m face. */
  positionCapZarMinor?: number;
  /** Live counterparty source (server wires getActiveBondCounterparties). */
  getCounterparties?: () => BondSimCounterparty[];
  /**
   * Execution hook. When provided, fireTrade() routes the generated body through
   * this callback (the bank's bookBondTrade path). When unset (tests/standalone)
   * the trade is generated and counted but not booked.
   */
  executeBondTrade?: (
    body: BondTradeBookBody,
    asOf: string,
    provenanceMode: "simulated" | "production",
  ) => void;
}

export type RagStatus = "green" | "amber" | "red";
export type GuardMode = "normal" | "reducing" | "force-reduce";

export interface BondSimStatus {
  running: boolean;
  tradesGenerated: number;
  errorsCount: number;
  startedAt: string | null;
  stoppedAt: string | null;
  lastTradeAt: string | null;
  lastTradeId: string | null;
  lastIsin: string | null;
  lastSide: "buy" | "sell" | null;
  lastCleanPrice: number | null;
  lastCounterparty: string | null;
  config: {
    minIntervalMs: number;
    maxIntervalMs: number;
    provenance: "simulated" | "production";
  };
  marketDataRunning: boolean;
  positionMonitor: {
    /** Largest single-bond net nominal magnitude (ZAR minor), or null. */
    dominantNetZarMinor: number | null;
    dominantIsin: string | null;
    capZarMinor: number;
    ragStatus: RagStatus | null;
    mode: GuardMode;
    lastForcedSide: "buy" | "sell" | null;
    lastTargetIsin: string | null;
  };
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS = {
  minIntervalMs: 3_000,
  maxIntervalMs: 10_000,
  marketDataIntervalMs: 60_000,
  /** R200m face value, in ZAR minor units (cents). */
  positionCapZarMinor: 200_000_000 * 100,
} as const;

/** Net beyond this multiple of the cap is "red" (vs "amber" at the cap). */
const RED_MULTIPLE = 1.5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ISINs with a bond-price tick in the store; falls back to all benchmarks. */
function getAvailableBondIsins(store: MarketDataStore): string[] {
  const ticks = store.query({ dataType: "bond-price", provenance: "all", limit: 500 });
  const seen = new Set<string>();
  for (const t of ticks) seen.add(t.instrument);
  return seen.size > 0 ? [...seen] : [...SA_BOND_ISINS];
}

// ---------------------------------------------------------------------------
// BondSimEngine
// ---------------------------------------------------------------------------

export class BondSimEngine {
  private readonly store: EventStore;
  readonly marketDataStore: MarketDataStore;
  private opts: {
    minIntervalMs: number;
    maxIntervalMs: number;
    marketDataIntervalMs: number;
    provenance: "simulated" | "production";
    positionCapZarMinor: number;
    minNominalZar?: number;
    maxNominalZar?: number;
    getCounterparties?: () => BondSimCounterparty[];
    executeBondTrade?: BondSimOptions["executeBondTrade"];
  };
  private readonly priceEngine: BondPriceEngine;
  private readonly bondMarketDataSim: BondMarketDataSimulator;
  private readonly rng: () => number;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private tradeLoopRunning = false;
  private status: BondSimStatus;

  constructor(store: EventStore, options?: BondSimOptions) {
    this.store = store;
    this.opts = {
      minIntervalMs: options?.minIntervalMs ?? DEFAULTS.minIntervalMs,
      maxIntervalMs: options?.maxIntervalMs ?? DEFAULTS.maxIntervalMs,
      marketDataIntervalMs: options?.marketDataIntervalMs ?? DEFAULTS.marketDataIntervalMs,
      provenance: options?.provenance ?? "simulated",
      positionCapZarMinor: options?.positionCapZarMinor ?? DEFAULTS.positionCapZarMinor,
      ...(options?.minNominalZar !== undefined ? { minNominalZar: options.minNominalZar } : {}),
      ...(options?.maxNominalZar !== undefined ? { maxNominalZar: options.maxNominalZar } : {}),
      ...(options?.getCounterparties !== undefined
        ? { getCounterparties: options.getCounterparties }
        : {}),
      ...(options?.executeBondTrade !== undefined
        ? { executeBondTrade: options.executeBondTrade }
        : {}),
    };

    this.rng = options?.seed !== undefined ? mulberry32(options.seed) : Math.random;
    this.marketDataStore = options?.marketDataStore ?? new MarketDataStore(":memory:");
    this.priceEngine = new BondPriceEngine(resolveSeedBondPrices(this.marketDataStore));
    this.bondMarketDataSim = new BondMarketDataSimulator(this.marketDataStore, this.priceEngine, {
      intervalMs: this.opts.marketDataIntervalMs,
      rng: this.rng,
    });

    this.status = {
      running: false,
      tradesGenerated: 0,
      errorsCount: 0,
      startedAt: null,
      stoppedAt: null,
      lastTradeAt: null,
      lastTradeId: null,
      lastIsin: null,
      lastSide: null,
      lastCleanPrice: null,
      lastCounterparty: null,
      config: {
        minIntervalMs: this.opts.minIntervalMs,
        maxIntervalMs: this.opts.maxIntervalMs,
        provenance: this.opts.provenance,
      },
      marketDataRunning: false,
      positionMonitor: {
        dominantNetZarMinor: null,
        dominantIsin: null,
        capZarMinor: this.opts.positionCapZarMinor,
        ragStatus: null,
        mode: "normal",
        lastForcedSide: null,
        lastTargetIsin: null,
      },
    };
  }

  /** Sub-simulator accessor for the hub adapter. */
  get bondMarketDataSimulator(): BondMarketDataSimulator {
    return this.bondMarketDataSim;
  }

  // -------------------------------------------------------------------------
  // Position guard
  // -------------------------------------------------------------------------

  /** Net nominal (ZAR minor, signed by side) per benchmark bond ISIN. */
  private netNominalByIsin(): Map<string, number> {
    let state = unifiedPositionInitial;
    for (const e of this.store.replay({})) {
      if (unifiedPositionProjection.accepts(e)) {
        state = unifiedPositionProjection.reduce(state, e);
      }
    }
    const net = new Map<string, number>();
    for (const row of state.rows.values()) {
      if (row.assetClass !== "bond") continue;
      const isin = row.key.instrumentId.replace("fi:bond:", "");
      net.set(isin, (net.get(isin) ?? 0) + row.quantity);
    }
    return net;
  }

  /**
   * Inspect bond inventory and return a forced side + ISIN filter that reduces
   * the dominant net position when it breaches the cap.
   *
   * green (within cap) → normal; amber (over cap) → force 70%; red (>1.5× cap)
   * → force 95%. Long → sell, short → buy, on the dominant bond.
   */
  computeBondPositionDirection(): {
    forcedSide?: "buy" | "sell";
    eligibleIsinsFilter?: string[];
    mode: GuardMode;
    ragStatus: RagStatus;
    dominantIsin: string | null;
    dominantNet: number;
  } {
    const net = this.netNominalByIsin();
    let dominantIsin: string | null = null;
    let dominantNet = 0;
    for (const [isin, q] of net) {
      if (Math.abs(q) > Math.abs(dominantNet)) {
        dominantNet = q;
        dominantIsin = isin;
      }
    }

    const cap = this.opts.positionCapZarMinor;
    const absNet = Math.abs(dominantNet);
    const ragStatus: RagStatus =
      absNet >= cap * RED_MULTIPLE ? "red" : absNet >= cap ? "amber" : "green";

    if (ragStatus === "green" || !dominantIsin) {
      return { mode: "normal", ragStatus, dominantIsin, dominantNet };
    }

    const forceProb = ragStatus === "red" ? 0.95 : 0.7;
    if (this.rng() > forceProb) {
      return { mode: "normal", ragStatus, dominantIsin, dominantNet };
    }

    // Long (net > 0) → sell to reduce; short (net < 0) → buy to reduce.
    const forcedSide: "buy" | "sell" = dominantNet > 0 ? "sell" : "buy";
    const mode: GuardMode = ragStatus === "red" ? "force-reduce" : "reducing";
    return {
      forcedSide,
      eligibleIsinsFilter: [dominantIsin],
      mode,
      ragStatus,
      dominantIsin,
      dominantNet,
    };
  }

  // -------------------------------------------------------------------------
  // Trade loop
  // -------------------------------------------------------------------------

  startTradeLoop(config?: {
    minIntervalMs?: number;
    maxIntervalMs?: number;
    provenance?: "simulated" | "production";
    minNominalZar?: number;
    maxNominalZar?: number;
  }): BondSimStatus {
    if (this.tradeLoopRunning) return this.getStatus();
    if (config?.minIntervalMs !== undefined) this.opts.minIntervalMs = config.minIntervalMs;
    if (config?.maxIntervalMs !== undefined) this.opts.maxIntervalMs = config.maxIntervalMs;
    if (config?.provenance !== undefined) this.opts.provenance = config.provenance;
    if (config?.minNominalZar !== undefined) this.opts.minNominalZar = config.minNominalZar;
    if (config?.maxNominalZar !== undefined) this.opts.maxNominalZar = config.maxNominalZar;

    this.tradeLoopRunning = true;
    this.status = {
      ...this.status,
      running: true,
      startedAt: nowUtc(),
      stoppedAt: null,
      config: {
        minIntervalMs: this.opts.minIntervalMs,
        maxIntervalMs: this.opts.maxIntervalMs,
        provenance: this.opts.provenance,
      },
    };
    this.scheduleNext();
    return this.getStatus();
  }

  stopTradeLoop(): BondSimStatus {
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

  getStatus(): BondSimStatus {
    const guard = this.computeBondPositionDirection();
    return {
      ...this.status,
      marketDataRunning: this.bondMarketDataSim.isRunning(),
      positionMonitor: {
        ...this.status.positionMonitor,
        dominantNetZarMinor: guard.dominantNet,
        dominantIsin: guard.dominantIsin,
        capZarMinor: this.opts.positionCapZarMinor,
        ragStatus: guard.ragStatus,
        mode: guard.mode,
      },
    };
  }

  /**
   * Fire a single trade. Lazy-imports generateSimBondTrade to keep the module
   * graph acyclic. Honours a forced side / ISIN filter from the guard.
   */
  fireTrade(opts?: { forcedSide?: "buy" | "sell"; eligibleIsinsFilter?: string[] }): void {
    const counterparties = this.opts.getCounterparties?.() ?? [];
    if (counterparties.length === 0) {
      console.warn("[BondSimEngine] fireTrade: no eligible counterparties — skipping trade");
      return;
    }
    const availableIsins = getAvailableBondIsins(this.marketDataStore);
    const body = generateSimBondTrade(this.priceEngine, counterparties, {
      rng: this.rng,
      marketDataStore: this.marketDataStore,
      availableIsins,
      provenanceMode: this.opts.provenance,
      ...(this.opts.minNominalZar !== undefined ? { minNominalZar: this.opts.minNominalZar } : {}),
      ...(this.opts.maxNominalZar !== undefined ? { maxNominalZar: this.opts.maxNominalZar } : {}),
      ...(opts?.forcedSide ? { forcedSide: opts.forcedSide } : {}),
      ...(opts?.eligibleIsinsFilter ? { eligibleIsinsFilter: opts.eligibleIsinsFilter } : {}),
    });

    const asOf = nowUtc();
    if (this.opts.executeBondTrade) {
      this.opts.executeBondTrade(body, asOf, this.opts.provenance);
    } else {
      console.warn("[BondSimEngine] fireTrade: no executeBondTrade hook — trade not booked");
    }

    const cp = counterparties.find((c) => (c.lei ?? c.partyId) === body.counterpartyLei);
    this.status = {
      ...this.status,
      tradesGenerated: this.status.tradesGenerated + 1,
      lastTradeAt: asOf,
      lastTradeId: body.tradeId,
      lastIsin: body.isin,
      lastSide: body.side,
      lastCleanPrice: body.cleanPricePct,
      lastCounterparty: cp?.name ?? body.counterpartyLei,
    };
  }

  private scheduleNext(): void {
    const { minIntervalMs, maxIntervalMs } = this.opts;
    const delay = minIntervalMs + this.rng() * (maxIntervalMs - minIntervalMs);
    this.timer = setTimeout(() => {
      this.scheduledFire().catch((err: unknown) => {
        console.error("[BondSimEngine] unexpected error in scheduledFire:", err);
      });
    }, delay);
  }

  private async scheduledFire(): Promise<void> {
    try {
      const { forcedSide, eligibleIsinsFilter, mode, ragStatus, dominantIsin, dominantNet } =
        this.computeBondPositionDirection();

      this.status = {
        ...this.status,
        positionMonitor: {
          dominantNetZarMinor: dominantNet,
          dominantIsin,
          capZarMinor: this.opts.positionCapZarMinor,
          ragStatus,
          mode,
          lastForcedSide: forcedSide ?? null,
          lastTargetIsin: eligibleIsinsFilter?.[0] ?? null,
        },
      };

      this.fireTrade({
        ...(forcedSide ? { forcedSide } : {}),
        ...(eligibleIsinsFilter ? { eligibleIsinsFilter } : {}),
      });
    } catch (err) {
      console.error("[BondSimEngine] fireTrade error:", err);
      this.status = { ...this.status, errorsCount: this.status.errorsCount + 1 };
    }

    if (this.tradeLoopRunning) this.scheduleNext();
  }
}
