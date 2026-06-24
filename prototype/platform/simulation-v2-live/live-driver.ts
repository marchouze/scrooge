// platform/simulation-v2-live/live-driver.ts
//
// V2LiveFxDriver — the live, real-time FX V2 third-party simulator. The V2
// analogue of the V1 EnvSimEngine loop: it GENERATES FX spot trades on a tick and
// streams the full born-V2 lifecycle (market feed → confirmation → booking →
// settlement with fail/retry → cash materialisation → EOD reval/P&L/VaR) into the
// LIVE shared event store, tagged `simulated` so it is provenance-segregated from
// the bank's production reads (V1 `provenanceMode` parity).
//
// SCHEDULER vs PAYLOAD (the replay-safety reconciliation). The ONLY wall-clock
// dependency is the `setInterval` in `start()` — a pure SCHEDULER that decides
// WHEN a tick fires. It calls `tickOnce()`, which reads NOTHING from the wall
// clock: it advances an injected `SimulatedClock` by a fixed `stepMs` and draws
// every stochastic choice from a `SeededRng`. So a recorded live run replays
// exactly from `(seed, baselineInstant, stepMs, tick-count)`. `tickOnce()` is the
// deterministic unit the test exercises directly (no timer). There is NO
// `Date.now()` / `new Date()` anywhere in this package.
//
// BOUNDARY (recon:fx-v2-sim-boundary Rule A): this driver emits NO SUT-internal
// event type itself. The external-party emissions (market feed, confirmations,
// settlement statuses, provisioning lifecycle) go through the `simulation-v2/`
// modules; the bank's own booking / settlement / provisioning go through the SUT
// entry points (bookAffirmedFxTrade / settleFxLeg / provisionCounterparty), to
// which the driver hands an explicit `simulated` provenance tag.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   D-CASH-ASSET-CLASS-V1; D-FX-INSTRUMENT-BUYSELL-QUAD.

import { formatInstanceUrn } from "../../v2-core/fil-core/urn";
import { type ProvenanceTag, simulatedTag } from "../event-store/provenance";
import type { EventStore } from "../event-store/store";
import type { MarketDataStore } from "../market-data/store";
import { provisionCounterparty } from "../markets/counterparty/provision-counterparty";
import { bookAffirmedFxTrade } from "../markets/products/book-affirmed-fx-trade";
import { settleFxLeg } from "../markets/settlement/settle-fx-leg";
import { ONE_DAY_MS, SimulatedClock } from "../scenario-clock";
import { type EodHook, EodTriggerBus } from "../simulation-v2/eod-bus";
import { SeededRng } from "../simulation-v2/prng";
import type {
  CounterpartyBehaviourProfileId,
  ScenarioCounterparty,
  ScenarioDay,
  ScenarioManifest,
  ScenarioMarketObservation,
  ScenarioTradeAction,
} from "../simulation-v2/scenario-manifest";
import { emitCounterpartyProvisioning } from "../simulation-v2/sim-modules/counterparty-provisioning";
import { FxRateWalkV2 } from "../simulation-v2/sim-modules/fx-rate-walk-v2";
import { generateScenarioTrade } from "../simulation-v2/sim-modules/fx-trade-generator-v2";
import {
  emitSimulatedMarketFeed,
  ingestMarketFeed,
} from "../simulation-v2/sim-modules/market-data-feed-v2";
import { emitPostSettlementAdvice } from "../simulation-v2/sim-modules/post-settlement-advice-v2";
import { emitSettlementLifecycle } from "../simulation-v2/sim-modules/settlement-lifecycle";
import { emitCounterpartyConfirmation } from "../simulation-v2/sim-modules/trade-confirmation";
import { buildFxCadenceHooks } from "./cadence-hooks";

const REPORTING = "ZAR";
const SCENARIO_ID = "fx-v2-live";
const SOURCE_LINEAGE = "simulation-v2-live:fx-generative";
const DEFAULT_BASELINE = "2026-02-02T07:00:00.000Z";

/** Default simulated counterparties (CP-SIM-* — simulated identities, not agents). */
export const DEFAULT_SIM_COUNTERPARTIES: readonly ScenarioCounterparty[] = Object.freeze([
  {
    counterpartyId: "CP-SIM-RELIABLE-001",
    name: "Sim Reliable Bank",
    bic: "SIMRZAJJXXX",
    eligiblePairs: ["USD/ZAR", "EUR/ZAR"],
    behaviourProfile: "reliable",
    agreement: { agreementType: "ISDA-2002", csaInScope: true, csaCurrency: "ZAR" },
  },
  {
    counterpartyId: "CP-SIM-OCCFAIL-002",
    name: "Sim Occasional-Fail Bank",
    bic: "SIMOZAJJXXX",
    eligiblePairs: ["USD/ZAR", "GBP/ZAR"],
    behaviourProfile: "occasional-fail",
    agreement: { agreementType: "ISDA-2002", csaInScope: false },
  },
]);

export interface V2LiveFxDriverConfig {
  /** Seed for the run's deterministic RNG. Default 0x11fe. */
  readonly seed?: number;
  /** ISO instant the SimulatedClock starts at. Default DEFAULT_BASELINE. */
  readonly baselineInstant?: string;
  /** Simulated time advanced per tick. Default ONE_DAY_MS (one sim day / tick). */
  readonly stepMs?: number;
  /** Wall-clock interval between ticks (the scheduler period). Default 3000ms. */
  readonly tickIntervalMs?: number;
  /** Trades generated per tick. Default 1. */
  readonly tradesPerTick?: number;
  /**
   * "accelerated" settles each trade in the same tick it is booked (time-compressed
   * rehearsal); "realtime" defers settlement until the sim clock reaches the trade's
   * settlement date. Default "accelerated".
   */
  readonly settlementMode?: "accelerated" | "realtime";
  /** EOD boundary hour (UTC). Default 17. */
  readonly eodHourUtc?: number;
  /** Counterparties the simulator trades with. Default DEFAULT_SIM_COUNTERPARTIES. */
  readonly counterparties?: readonly ScenarioCounterparty[];
}

export interface V2LiveFxStatus {
  readonly running: boolean;
  readonly scenarioId: string;
  readonly simClock: string;
  readonly ticks: number;
  readonly tradesGenerated: number;
  readonly tradesBooked: number;
  readonly settlementsConfirmed: number;
  readonly cashInstancesMaterialised: number;
  readonly boundariesFired: number;
  readonly lastTrade: ScenarioTradeAction | null;
  readonly lastPnLTotalReporting: number | null;
  readonly lastVarReporting: number | null;
  readonly lastError: string | null;
  readonly startedAt: string | null;
}

interface OpenTrade {
  readonly trade: ScenarioTradeAction;
  readonly profile: CounterpartyBehaviourProfileId;
  settled: boolean;
}

/** Rejection probability per behaviour profile (the counterparty declining a confirmation). */
function rejectionProbability(profile: CounterpartyBehaviourProfileId): number {
  return profile === "unreliable" ? 0.02 : 0;
}

export class V2LiveFxDriver {
  private readonly eventStore: EventStore;
  private readonly marketDataStore: MarketDataStore;
  private readonly clock: SimulatedClock;
  private readonly rng: SeededRng;
  private readonly rateWalk: FxRateWalkV2;
  private readonly bus: EodTriggerBus;
  private readonly counterparties: readonly ScenarioCounterparty[];
  private readonly stepMs: number;
  private readonly tickIntervalMs: number;
  private readonly tradesPerTick: number;
  private readonly settlementMode: "accelerated" | "realtime";
  private readonly provenance: ProvenanceTag;
  private readonly bookedRateByInstance = new Map<string, number>();
  private readonly hooks: readonly EodHook[];
  private readonly openTrades: OpenTrade[] = [];

  private timer: ReturnType<typeof setInterval> | null = null;
  private provisioned = false;
  private seq = 0;
  private ticks = 0;
  private tradesGenerated = 0;
  private tradesBooked = 0;
  private settlementsConfirmed = 0;
  private cashInstancesMaterialised = 0;
  private lastTrade: ScenarioTradeAction | null = null;
  private lastPnLTotal: number | null = null;
  private lastVar: number | null = null;
  private lastError: string | null = null;
  private startedAt: string | null = null;

  constructor(args: {
    readonly eventStore: EventStore;
    readonly marketDataStore: MarketDataStore;
    readonly config?: V2LiveFxDriverConfig;
  }) {
    const cfg = args.config ?? {};
    this.eventStore = args.eventStore;
    this.marketDataStore = args.marketDataStore;
    this.clock = new SimulatedClock(cfg.baselineInstant ?? DEFAULT_BASELINE);
    this.rng = new SeededRng(cfg.seed ?? 0x11fe);
    this.rateWalk = new FxRateWalkV2();
    this.bus = new EodTriggerBus(this.clock, { eodHourUtc: cfg.eodHourUtc ?? 17 });
    this.counterparties = cfg.counterparties ?? DEFAULT_SIM_COUNTERPARTIES;
    this.stepMs = cfg.stepMs ?? ONE_DAY_MS;
    this.tickIntervalMs = cfg.tickIntervalMs ?? 3_000;
    this.tradesPerTick = Math.max(1, cfg.tradesPerTick ?? 1);
    this.settlementMode = cfg.settlementMode ?? "accelerated";
    this.provenance = simulatedTag({ scenario: SCENARIO_ID, sourceLineage: SOURCE_LINEAGE });

    // EOD cadence hooks (cohort P&L + VaR over the simulated cohort). Pure reads —
    // SA-CCR EAD emission is OFF (a production-tagged risk aggregate over a
    // simulated cohort would mix provenance in the shared store).
    this.hooks = buildFxCadenceHooks({
      reporting: REPORTING,
      bookedRateByInstance: this.bookedRateByInstance,
      onPnL: (_date, r) => {
        this.lastPnLTotal = r.totalUnrealisedReporting ?? null;
      },
      onVar: (_date, r) => {
        this.lastVar = r.status === "computed" ? (r.varReporting ?? null) : null;
      },
    })({ eventStore: this.eventStore, marketDataStore: this.marketDataStore });
    for (const hook of this.hooks) this.bus.register(hook);
  }

  /** Provision the simulated counterparties once (idempotent on the store). */
  private provisionOnce(): void {
    if (this.provisioned) return;
    const asOf = this.clock.now();
    for (const cp of this.counterparties) {
      emitCounterpartyProvisioning({
        store: this.eventStore,
        scenarioId: SCENARIO_ID,
        asOf,
        counterparty: cp,
        reporting: REPORTING,
      });
      provisionCounterparty({
        store: this.eventStore,
        scenarioId: SCENARIO_ID,
        asOf,
        reporting: REPORTING,
        counterparty: cp,
      });
    }
    this.provisioned = true;
  }

  /** Build the current tick's market observation set (one walked spot per eligible pair). */
  private buildMarketObservations(): ScenarioMarketObservation[] {
    const pairs = new Set<string>();
    for (const cp of this.counterparties) for (const p of cp.eligiblePairs) pairs.add(p);
    const obs: ScenarioMarketObservation[] = [];
    for (const pair of pairs) {
      const r = this.rateWalk.tick(pair, this.rng);
      obs.push({ pair, spotMid: r.mid, forwardPoints: 0.05, oisRate: 0.07 });
    }
    return obs;
  }

  /** A manifest-shaped envelope for the market-feed module (reads scenarioId + reporting). */
  private manifestFor(day: ScenarioDay): ScenarioManifest {
    return {
      scenarioId: SCENARIO_ID,
      description: "Live FX V2 generative simulator",
      seed: 0,
      baselineInstant: this.clock.now(),
      eodHourUtc: 17,
      defaultOisRate: 0.07,
      counterparties: this.counterparties,
      days: [day],
    };
  }

  /** Settle a single open trade (external lifecycle + SUT cash materialisation). */
  private settleTrade(open: OpenTrade, asOf: string): void {
    emitSettlementLifecycle({
      store: this.eventStore,
      scenarioId: SCENARIO_ID,
      asOf,
      reporting: REPORTING,
      trade: open.trade,
      behaviourProfile: open.profile,
      rng: this.rng,
    });
    const result = settleFxLeg({
      store: this.eventStore,
      scenarioId: SCENARIO_ID,
      reporting: REPORTING,
      tradeId: open.trade.tradeId,
      provenance: this.provenance,
    });
    if (result.settled) {
      open.settled = true;
      this.settlementsConfirmed += 1;
      this.cashInstancesMaterialised += result.cashInstancesMaterialised;
      // External post-settlement advices (correspondent pacs.002 + camt.053 nostro
      // statement) — the outside world confirming the funds movement.
      emitPostSettlementAdvice({
        store: this.eventStore,
        scenarioId: SCENARIO_ID,
        asOf,
        trade: open.trade,
      });
    }
  }

  /**
   * Run ONE deterministic tick: advance the simulated day, publish + ingest the
   * market feed, generate/confirm/book trades, drive due settlements, then advance
   * the EOD bus (firing the day's cadence hooks). Pure of the wall clock — the
   * scheduler in start() is the only thing that decides WHEN this runs.
   */
  tickOnce(): void {
    this.provisionOnce();
    const asOf = this.clock.now();
    const date = asOf.slice(0, 10);
    const market = this.buildMarketObservations();
    const day: ScenarioDay = { date, market };
    const manifest = this.manifestFor(day);

    emitSimulatedMarketFeed({ day, marketDataStore: this.marketDataStore, manifest, asOf });
    ingestMarketFeed({ day, marketDataStore: this.marketDataStore, manifest, asOf });

    for (let i = 0; i < this.tradesPerTick; i++) {
      this.seq += 1;
      const trade = generateScenarioTrade({
        rng: this.rng,
        asOf,
        seq: this.seq,
        counterparties: this.counterparties,
        rateWalk: this.rateWalk,
      });
      if (!trade) continue;
      this.tradesGenerated += 1;
      this.lastTrade = trade;

      const profile =
        this.counterparties.find((c) => c.counterpartyId === trade.counterpartyId)
          ?.behaviourProfile ?? "reliable";
      const affirm = !this.rng.bernoulli(rejectionProbability(profile));
      emitCounterpartyConfirmation({
        store: this.eventStore,
        scenarioId: SCENARIO_ID,
        asOf,
        trade,
        affirm,
      });
      if (!affirm) continue;

      const booked = bookAffirmedFxTrade({
        store: this.eventStore,
        scenarioId: SCENARIO_ID,
        asOf,
        reporting: REPORTING,
        trade,
        provenance: this.provenance,
      });
      if (booked) {
        this.tradesBooked += 1;
        this.bookedRateByInstance.set(
          formatInstanceUrn({ tenant: "LE-ZA-HOZ-BANK", instanceId: trade.tradeId }),
          trade.rate,
        );
        const open: OpenTrade = { trade, profile, settled: false };
        this.openTrades.push(open);
        if (this.settlementMode === "accelerated") this.settleTrade(open, asOf);
      }
    }

    // Realtime mode: settle trades whose settlement date the sim clock has reached.
    if (this.settlementMode === "realtime") {
      for (const open of this.openTrades) {
        if (!open.settled && date >= open.trade.settlementDate) this.settleTrade(open, asOf);
      }
    }

    // Advance the simulated clock one step; the bus fires the EOD boundary(ies)
    // crossed (cohort P&L + VaR), leaving the clock at the next tick's instant.
    this.bus.advanceBy(this.stepMs);
    this.ticks += 1;
  }

  /** Start the real-time scheduler. Idempotent — a second start() is a no-op. */
  start(): void {
    if (this.timer !== null) return;
    this.startedAt = this.clock.now();
    // wall-clock: scheduler ONLY — decides WHEN a tick fires; the tick reads the
    // SimulatedClock + SeededRng, never the wall clock (replay-safety preserved).
    this.timer = setInterval(() => {
      try {
        this.tickOnce();
        this.lastError = null;
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : String(err);
      }
    }, this.tickIntervalMs);
  }

  /** Stop the scheduler. The simulated clock + accumulated state are retained. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  getStatus(): V2LiveFxStatus {
    return {
      running: this.isRunning(),
      scenarioId: SCENARIO_ID,
      simClock: this.clock.now(),
      ticks: this.ticks,
      tradesGenerated: this.tradesGenerated,
      tradesBooked: this.tradesBooked,
      settlementsConfirmed: this.settlementsConfirmed,
      cashInstancesMaterialised: this.cashInstancesMaterialised,
      boundariesFired: this.bus.boundariesFired(),
      lastTrade: this.lastTrade,
      lastPnLTotalReporting: this.lastPnLTotal,
      lastVarReporting: this.lastVar,
      lastError: this.lastError,
      startedAt: this.startedAt,
    };
  }
}
