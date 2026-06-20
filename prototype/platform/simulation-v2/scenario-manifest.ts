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

/**
 * Counterparty behaviour profile id — selects confirmation/settlement
 * reliability. Maps to the env-sim counterparty profiles
 * (platform/simulation/env-sim/counterparty-profiles.ts):
 *   "reliable"        → ALWAYS_SETTLE   (always settles on-time, never rejects)
 *   "slow"            → SLOW_SETTLER    (settles T+3, never fails)
 *   "occasional-fail" → OCCASIONAL_FAIL (5% settlement-failure probability)
 *   "unreliable"      → UNRELIABLE      (10% failure + delay + 2% rejection)
 * Determinism: the per-trade fail/retry draw is taken from the scenario's
 * SeededRng, never Math.random (recon:fx-v2-sim-boundary enforces).
 */
export type CounterpartyBehaviourProfileId = "reliable" | "slow" | "occasional-fail" | "unreliable";

/**
 * The external credit rating the scenario's rating-agency feed publishes for a
 * counterparty at provisioning (M6). The SUT maps this to a Basel class
 * fail-closed. A mid-scenario upgrade/downgrade is declared per day via
 * `ScenarioDay.ratingActions`.
 */
export interface ScenarioCreditRating {
  /** The rating agency (S&P / Moody's / Fitch). */
  readonly agency: "S&P" | "Moodys" | "Fitch";
  /** The long-term issuer rating notch (S&P/Fitch scale, e.g. "AA-", "BBB+"). */
  readonly rating:
    | "AAA"
    | "AA+"
    | "AA"
    | "AA-"
    | "A+"
    | "A"
    | "A-"
    | "BBB+"
    | "BBB"
    | "BBB-"
    | "BB+"
    | "BB"
    | "BB-"
    | "B+"
    | "B"
    | "B-"
    | "CCC+"
    | "CCC"
    | "CCC-"
    | "CC"
    | "C"
    | "D";
  /** The supervisory counterparty type the rating applies to (CRE20 map input). */
  readonly counterpartyType:
    | "sovereign-domestic-currency"
    | "sovereign-foreign-currency"
    | "mdb-zero-weight"
    | "bank"
    | "pse"
    | "corporate";
}

/**
 * The CSA (Credit Support Annex) terms the scenario stands up for a margined
 * counterparty (M8). All amounts are MAJOR units of the CSA currency.
 */
export interface ScenarioCsaTerms {
  /** CSA threshold (TH) — uncollateralised exposure tolerated before a call. */
  readonly thresholdMajor: number;
  /** Minimum transfer amount (MTA) — calls below this are not made. */
  readonly mtaMajor: number;
  /** Eligible collateral kinds the counterparty may post. */
  readonly eligibleCollateral: readonly ("cash" | "government-bond")[];
  /** Haircut applied to posted collateral (fraction, e.g. 0.02 = 2%). */
  readonly haircut: number;
  /**
   * How the counterparty responds to a margin call (M8 behaviour profile):
   *   "posts-in-full"  → always posts the full called amount;
   *   "disputes-once"  → disputes the FIRST call, then posts subsequent calls;
   *   "fails"          → fails to post (a defaulting counterparty).
   * Defaults to "posts-in-full".
   */
  readonly marginBehaviour?: "posts-in-full" | "disputes-once" | "fails";
}

/** The ISDA/CSA agreement the scenario stands up for a counterparty (M2). */
export interface ScenarioAgreement {
  /** Master-agreement form. */
  readonly agreementType: "ISDA-2002" | "ISDA-1992";
  /** Whether a CSA (collateral support annex) is in scope. */
  readonly csaInScope: boolean;
  /** CSA threshold currency, when csaInScope. Defaults to the reporting ccy. */
  readonly csaCurrency?: string;
  /** CSA collateral terms (thresholds, MTA, eligible collateral, haircut) — M8. */
  readonly csaTerms?: ScenarioCsaTerms;
}

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
  /** Behaviour profile id selecting confirmation/settlement reliability. */
  readonly behaviourProfile: CounterpartyBehaviourProfileId;
  /**
   * The ISDA/CSA agreement the scenario stands up from the manifest (M2). When
   * omitted the counterparty trades spot-only with no master agreement — the
   * runner still provisions the netting set, but no CounterpartyAgreementAccepted
   * is emitted. Forwards (a derivative) require a master agreement in scope.
   */
  readonly agreement?: ScenarioAgreement;
  /**
   * The external credit rating the rating-agency feed publishes for this
   * counterparty at provisioning (M6). When omitted the SUT fails closed to the
   * prudent conservative Basel class (CRE20 unrated/100% interim).
   */
  readonly creditRating?: ScenarioCreditRating;
}

/** A mid-scenario rating upgrade/downgrade the agency feed publishes on a day (M6). */
export interface ScenarioRatingAction {
  /** Counterparty whose rating changes (must be a provisioned counterparty). */
  readonly counterpartyId: string;
  /** The new rating + agency + type the feed publishes this day. */
  readonly rating: ScenarioCreditRating;
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
  /** Mid-scenario rating revisions the agency feed publishes this day (M6). */
  readonly ratingActions?: readonly ScenarioRatingAction[];
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
