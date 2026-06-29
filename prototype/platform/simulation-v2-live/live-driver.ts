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
import { onboardedFxCounterparties } from "./onboarded-counterparty-source";

const REPORTING = "ZAR";
const SCENARIO_ID = "fx-v2-live";
const SOURCE_LINEAGE = "simulation-v2-live:fx-generative";
const DEFAULT_BASELINE = "2026-02-02T07:00:00.000Z";

/**
 * Clock-advance mode (D-FX-SIM-LIVE-REALTIME-ONBOARDED):
 *   - "fixed-day-step" (DEFAULT): advance the SimulatedClock by a fixed `stepMs`
 *     (= `dayStepMs`) per tick. Byte-replayable from (seed, baselineInstant,
 *     stepMs, tick-count) — the wall clock decides only WHEN a tick fires.
 *   - "real-elapsed": advance the SimulatedClock by the REAL wall-clock delta
 *     since the previous tick (sim-now = assumed-past baseline + accumulated real
 *     elapsed). Reads wall-time ONLY inside the live-driver scheduler boundary
 *     (the approved boundary); the payload package stays fully deterministic.
 */
export type ClockAdvanceMode = "fixed-day-step" | "real-elapsed";

/**
 * Wall-clock epoch-ms source, injected so `real-elapsed` mode stays testable
 * (the test supplies a deterministic fake; production defaults to `Date.now`).
 * The ONLY wall-clock read in this package's `real-elapsed` path.
 */
export type WallClockNowMs = () => number;

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
  /** ISO instant the SimulatedClock starts at (the assumed-past baseline). Default DEFAULT_BASELINE. */
  readonly baselineInstant?: string;
  /**
   * Simulated time advanced per tick in "fixed-day-step" mode. Default
   * ONE_DAY_MS (one sim day / tick). Selectable — the day-step is a config value,
   * not a hardcoded constant (the constant is only the default).
   */
  readonly stepMs?: number;
  /**
   * Clock-advance mode. "fixed-day-step" (default) keeps byte-replay; "real-elapsed"
   * advances the sim clock by the real wall-clock delta between ticks (current
   * date/time trading from an assumed-past baseline). See {@link ClockAdvanceMode}.
   */
  readonly clockAdvanceMode?: ClockAdvanceMode;
  /**
   * Wall-clock now-source (epoch ms) used ONLY by "real-elapsed" mode. Injectable
   * so tests stay deterministic; defaults to `Date.now`. Ignored in
   * "fixed-day-step" mode (no wall-clock read at all).
   */
  readonly nowMs?: WallClockNowMs;
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
  /**
   * EXPLICIT counterparty opt-in. When supplied the driver trades with exactly
   * this set (used by the replay-determinism tests with DEFAULT_SIM_COUNTERPARTIES).
   * When OMITTED the driver resolves its counterparties from the IN-SIM ONBOARDED
   * client set (onboarded-counterparty-source.ts) — fail-closed: no onboarded
   * client → no counterparty → no trade. There is NO silent seed fallback.
   */
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

/**
 * True when `pair` (`BASE/QUOTE`) is quoted in the reporting currency on EITHER
 * leg — i.e. one leg is the reporting currency, so its settled FCY leg has a
 * resolvable IAS 21 §21 ZAR cost basis (the reporting counter leg). A cross with
 * neither leg = reporting (e.g. EUR/USD when reporting is ZAR) is NOT
 * settlement-capable under the current FX-vanilla product. Malformed pairs → false.
 */
function isReportingQuotedPair(pair: string, reporting: string): boolean {
  const [base, quote] = pair.split("/");
  if (base === undefined || quote === undefined || base === "" || quote === "") return false;
  return base === reporting || quote === reporting;
}

/**
 * Resume baseline for a WARM store. The driver replays from a FIXED baseline +
 * seed, so a second run against a store that ALREADY holds this scenario's events
 * would regenerate identical deterministic tradeIds → event_ids and throw
 * `UNIQUE constraint failed` (the dashboard simulator is CONTROLLABLE — started,
 * stopped, and fired across sessions, each time reconstructing the driver). To
 * make every run re-runnable, resume the sim clock one day AFTER the latest
 * persisted scenario instant, so each run continues FORWARD in sim-time and every
 * generated tradeId (which embeds the instant) is fresh. A COLD store with no
 * scenario events returns null → DEFAULT_BASELINE. Deterministic: derived from
 * persisted `as_of` strings via Date.parse — NO wall-clock read. The marker type
 * is `FilInstrumentCreated` (one per booked trade), filtered to this scenario's
 * `simulated` provenance so non-sim instruments are ignored.
 */
function resolveResumeBaseline(store: EventStore): number | null {
  let maxMs: number | null = null;
  for (const ev of store.replay({ type: "FilInstrumentCreated" })) {
    const prov = ev.provenance as { scenario?: string } | null | undefined;
    if (!prov || prov.scenario !== SCENARIO_ID) continue;
    const ms = Date.parse(ev.as_of);
    if (Number.isNaN(ms)) continue;
    if (maxMs === null || ms > maxMs) maxMs = ms;
  }
  return maxMs === null ? null : maxMs + ONE_DAY_MS;
}

export class V2LiveFxDriver {
  private readonly eventStore: EventStore;
  private readonly marketDataStore: MarketDataStore;
  private readonly clock: SimulatedClock;
  private readonly rng: SeededRng;
  private readonly rateWalk: FxRateWalkV2;
  private readonly bus: EodTriggerBus;
  /**
   * Explicitly-injected counterparties (opt-in), or null to resolve from the
   * onboarded client set lazily at first provision. NEVER falls back to a seed.
   */
  private readonly injectedCounterparties: readonly ScenarioCounterparty[] | null;
  /** Resolved counterparty set (injected, or folded from onboarded clients). */
  private counterparties: readonly ScenarioCounterparty[] = [];
  private readonly stepMs: number;
  private readonly tickIntervalMs: number;
  private readonly tradesPerTick: number;
  private readonly settlementMode: "accelerated" | "realtime";
  private readonly clockAdvanceMode: ClockAdvanceMode;
  private readonly nowMs: WallClockNowMs;
  /** Wall-clock ms at the previous tick ("real-elapsed" mode only); null before the first tick. */
  private lastWallMs: number | null = null;
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
    // Explicit baseline (tests/scenarios) wins — preserves byte-replay. Otherwise
    // resume one day past the latest persisted scenario instant on a warm store, so
    // repeated dashboard runs never collide on deterministic ids; cold store →
    // DEFAULT_BASELINE.
    this.clock = new SimulatedClock(
      cfg.baselineInstant ?? resolveResumeBaseline(args.eventStore) ?? DEFAULT_BASELINE,
    );
    this.rng = new SeededRng(cfg.seed ?? 0x11fe);
    this.rateWalk = new FxRateWalkV2();
    this.bus = new EodTriggerBus(this.clock, { eodHourUtc: cfg.eodHourUtc ?? 17 });
    // No silent seed fallback: an explicit `counterparties` opt-in is the ONLY
    // way to inject a set; otherwise the driver folds the onboarded client set
    // lazily at first provision (fail-closed empty → zero trades).
    this.injectedCounterparties = cfg.counterparties ?? null;
    this.stepMs = cfg.stepMs ?? ONE_DAY_MS;
    this.tickIntervalMs = cfg.tickIntervalMs ?? 3_000;
    this.tradesPerTick = Math.max(1, cfg.tradesPerTick ?? 1);
    this.settlementMode = cfg.settlementMode ?? "accelerated";
    this.clockAdvanceMode = cfg.clockAdvanceMode ?? "fixed-day-step";
    this.nowMs = cfg.nowMs ?? Date.now; // wall-clock: "real-elapsed" mode only; injectable for tests.
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

  /**
   * Resolve the trading counterparty set: the explicit injected opt-in, else the
   * IN-SIM ONBOARDED client set folded from the store (fail-closed empty → []).
   * Resolved lazily at first provision so the onboarding seed can land AFTER
   * driver construction. NEVER falls back to DEFAULT_SIM_COUNTERPARTIES.
   *
   * SETTLEMENT-CAPABILITY SCOPING: the bank's built FX-vanilla product settles a
   * two-leg spot where ONE leg is the reporting currency (FCY ⇄ ZAR) — the ZAR
   * leg IS the IAS 21 §21 cost basis of the FCY leg (settle-fx-leg.ts /
   * cash-materialisation.ts). A non-reporting CROSS (e.g. EUR/USD) has no ZAR leg,
   * so its settled FCY cash legs have no resolvable ZAR carrying amount and the
   * materialiser FAILS CLOSED. Cross-pair FCY settlement (caller-supplied
   * `zarCostBasisOverrideBySide` priced off a settlement-date X/ZAR rate) is a
   * not-yet-built capability — see the tracked gap. Until it lands, the live
   * driver trades ONLY reporting-quoted pairs, so every booked trade is settleable.
   * This is a subset of each counterparty's onboarded eligibility (recon:fx-sim-
   * counterparty-onboarded still holds — driver pairs ⊆ onboarded pairs).
   */
  private resolveCounterparties(): readonly ScenarioCounterparty[] {
    const resolved =
      this.injectedCounterparties !== null
        ? this.injectedCounterparties
        : onboardedFxCounterparties(this.eventStore);
    return resolved
      .map((cp) => ({
        ...cp,
        eligiblePairs: cp.eligiblePairs.filter((p) => isReportingQuotedPair(p, REPORTING)),
      }))
      .filter((cp) => cp.eligiblePairs.length > 0);
  }

  /** Provision the resolved counterparties once (idempotent on the store). */
  private provisionOnce(): void {
    if (this.provisioned) return;
    this.counterparties = this.resolveCounterparties();
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

    // Advance the simulated clock; the bus fires the EOD boundary(ies) crossed
    // (cohort P&L + VaR), leaving the clock at the next tick's instant. The
    // advance amount depends on the mode (the assumed-past baseline is unchanged):
    //   - fixed-day-step: a fixed `stepMs` (byte-replayable).
    //   - real-elapsed:   the real wall-clock delta since the previous tick
    //     (sim-now = pastBaseline + accumulated real elapsed). The ONLY wall-clock
    //     read in this package, confined to this scheduler-side advance.
    this.bus.advanceBy(this.clockStepForTick());
    this.ticks += 1;
  }

  /**
   * The simulated-time advance for this tick. In "fixed-day-step" mode it is a
   * fixed `stepMs`. In "real-elapsed" mode it is the wall-clock delta since the
   * previous tick (the first tick advances 0 — there is no prior reference,
   * baseline stays the assumed-past instant). Negative deltas (clock skew) are
   * clamped to 0 so the sim clock never rewinds.
   */
  private clockStepForTick(): number {
    if (this.clockAdvanceMode === "fixed-day-step") return this.stepMs;
    const now = this.nowMs();
    const prev = this.lastWallMs;
    this.lastWallMs = now;
    if (prev === null) return 0;
    const delta = now - prev;
    return delta > 0 ? delta : 0;
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
