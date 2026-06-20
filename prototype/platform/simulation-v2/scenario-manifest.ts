// platform/simulation-v2/scenario-manifest.ts
//
// Declarative multi-day FX scenario manifest (Phase 0).
//
// A scenario is DECLARED as data — counterparties, agreements, the market path,
// the trade calendar, and the expected external responses — then replayed
// deterministically by scenario-runner.ts. The runner drives the EOD trigger bus
// across the manifest's day range; on each simulated day it applies that day's
// market path and trade actions (external-party emissions) and the EOD bus fires
// the SUT cadence hooks.
//
// Determinism: the manifest carries a single integer `seed`. Every stochastic
// choice during replay draws from a SeededRng constructed from it. There is no
// Math.random / Date.now anywhere on the path (recon:fx-v2-sim-boundary enforces).
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20).
// Author: Atlas (Core banking platform architect, engineering).

/** A counterparty the scenario provisions (M2 wires the full Niko lifecycle). */
export interface ScenarioCounterparty {
  /** Stable counterparty id (e.g. "CP-SIM-RELIABLE-001"). */
  readonly counterpartyId: string;
  /** Display name. */
  readonly name: string;
  /** SWIFT BIC. */
  readonly bic: string;
  /** FX pairs this counterparty trades (e.g. ["USD/ZAR", "EUR/ZAR"]). */
  readonly eligiblePairs: readonly string[];
  /**
   * Behaviour profile id selecting confirmation/settlement reliability.
   * "reliable" | "slow" | "fail" map to the env-sim counterparty profiles.
   */
  readonly behaviourProfile: "reliable" | "slow" | "fail";
}

/** A single observable on the market path for one pair on one day. */
export interface ScenarioMarketObservation {
  /** Pair string, e.g. "USD/ZAR". */
  readonly pair: string;
  /** Spot mid rate (reporting per 1 base). */
  readonly spotMid: number;
  /**
   * Outright forward points for the standard tenor (additive to spot,
   * reporting-per-base). Optional — spot-only days omit it.
   */
  readonly forwardPoints?: number;
  /**
   * Continuously-compounded OIS discount rate (annualised, decimal) for the
   * reporting currency, used to present-value forward MtM. Optional; when
   * omitted the runner uses the manifest default.
   */
  readonly oisRate?: number;
}

/** One simulated trading day in the scenario. */
export interface ScenarioDay {
  /** Calendar date (YYYY-MM-DD). Must be strictly increasing across days. */
  readonly date: string;
  /** Market observations applied at the START of this day (pre-trade). */
  readonly market: readonly ScenarioMarketObservation[];
  /** Trade actions the counterparty initiates on this day (booked intra-day). */
  readonly trades?: readonly ScenarioTradeAction[];
}

/** A trade the simulated counterparty requests on a given day. */
export interface ScenarioTradeAction {
  /** Stable trade id. */
  readonly tradeId: string;
  /** Counterparty initiating the trade (must be a provisioned counterparty). */
  readonly counterpartyId: string;
  /** Product taxonomy. M1 scope: spot + forward. */
  readonly productTaxonomy: "FX-spot" | "FX-forward";
  /** Currency pair, e.g. "USD/ZAR". */
  readonly pair: string;
  /** Side from the BANK's perspective. */
  readonly side: "buy" | "sell";
  /** Base-currency notional in MAJOR units (e.g. 5_000_000 = USD 5m). */
  readonly baseNotionalMajor: number;
  /** Agreed all-in rate (reporting per 1 base). */
  readonly rate: number;
  /** Settlement date (YYYY-MM-DD). Spot = T+2; forward = future. */
  readonly settlementDate: string;
}

/** The full declarative scenario. */
export interface ScenarioManifest {
  /** Stable scenario id — used as the `simulated` provenance scenario tag. */
  readonly scenarioId: string;
  /** Human-readable description. */
  readonly description: string;
  /** Seed for the scenario's deterministic PRNG. */
  readonly seed: number;
  /** Baseline instant the SimulatedClock starts at (ISO-8601). */
  readonly baselineInstant: string;
  /** EOD boundary hour (UTC). Defaults to 17 if omitted. */
  readonly eodHourUtc?: number;
  /** Default reporting-ccy OIS rate when a day omits `oisRate`. */
  readonly defaultOisRate?: number;
  /** Counterparties provisioned before day 1. */
  readonly counterparties: readonly ScenarioCounterparty[];
  /** The ordered trading days. */
  readonly days: readonly ScenarioDay[];
}

/**
 * Validate a manifest's structural invariants (dates strictly increasing,
 * trades reference provisioned counterparties + a known pair, seed integer).
 * Throws on the first violation — scenarios fail loudly, never silently skew.
 */
export function validateManifest(m: ScenarioManifest): void {
  if (!Number.isInteger(m.seed)) {
    throw new Error(`Manifest ${m.scenarioId}: seed must be an integer (got ${m.seed})`);
  }
  if (m.days.length === 0) {
    throw new Error(`Manifest ${m.scenarioId}: must declare at least one day`);
  }
  if (Number.isNaN(Date.parse(m.baselineInstant))) {
    throw new Error(`Manifest ${m.scenarioId}: baselineInstant is not valid ISO-8601`);
  }
  const cpIds = new Set(m.counterparties.map((c) => c.counterpartyId));
  let prev = "";
  for (const day of m.days) {
    if (Number.isNaN(Date.parse(day.date))) {
      throw new Error(`Manifest ${m.scenarioId}: day date "${day.date}" is not valid`);
    }
    if (day.date <= prev) {
      throw new Error(
        `Manifest ${m.scenarioId}: day dates must be strictly increasing ("${day.date}" after "${prev}")`,
      );
    }
    prev = day.date;
    for (const t of day.trades ?? []) {
      if (!cpIds.has(t.counterpartyId)) {
        throw new Error(
          `Manifest ${m.scenarioId}: trade ${t.tradeId} references unprovisioned counterparty ${t.counterpartyId}`,
        );
      }
      if (t.baseNotionalMajor <= 0) {
        throw new Error(
          `Manifest ${m.scenarioId}: trade ${t.tradeId} baseNotionalMajor must be > 0`,
        );
      }
    }
  }
}
