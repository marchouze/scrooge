// platform/market-risk/eod-cohort-var-v2.ts
//
// M4 — EOD-driven VaR / SVaR / ES over the SIMULATED FX cohort. SUT side.
//
// This is a SUT cadence job (Market Risk): at each EOD boundary the Phase-0 bus
// fires it; it derives the bank's net FX exposure per currency from its OWN booked
// FIL instruments (`FilInstrumentCreated`, assetClass "fx" and settled "cash")
// and the per-factor return histories from the adopted PRODUCTION market marks,
// then runs the historical-simulation kernel (the SAME pure functions
// `simulatePnLDistribution` / `historicalVaR` / `historicalES` the V1 engine and
// var-engine-v2 use). Correctness is judged AGAINST THE SIMULATOR: known inputs
// (cohort exposure + simulated return path) → expected VaR/SVaR/ES, NOT a V1
// parity gate (D-FX-V2-SIMULATOR-FIRST).
//
// WHY NOT var-engine-v2.ts DIRECTLY: that emitter derives exposures via
// `deriveRiskFactorExposures` → `deriveNetFxPositionByCurrency`, which folds the
// V1 `FxTradeExecuted` stream. The simulator books FIL instruments (born-V2), not
// V1 FX trades, so the V1 NOP fold would see a flat book. Re-coupling the V2
// simulator path to the V1 fold would violate the V1-retirement directive
// (D-V1-REMOVAL-STANDING-DIRECTIVE) and the simulator-first oracle. This SUT job
// folds the FIL cohort instead — a V1-free exposure basis — and reuses ONLY the
// kernel arithmetic (which is risk-factor-agnostic and already V1-free).
//
// EXPOSURE BASIS — STANDING NET OPEN POSITION, settlement-retained (the same
// methodology as var-engine.ts under D-VAR-EXPOSURE-INCLUDES-STANDING-NOP): a
// settled FX trade's foreign cash leg STAYS a risk factor (the bank still holds
// the foreign currency). Folding both the open FX instruments AND the settled
// `cash` instruments gives the standing NOP per currency.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   D-VAR-EXPOSURE-INCLUDES-STANDING-NOP (CEO-approved 2026-06-12, methodology
//   owner Helena, Chief Risk Officer); BCBS d457 / MAR33; Basel-2.5 MAR.
// Author: Atlas (Core banking platform architect, engineering).

import type { EventStore } from "../event-store/store";
import { type MarketDataStore, lookupQuoteWithInverse } from "../market-data/store";
import { type ProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import {
  type RiskFactorExposure,
  confidenceFor,
  historicalES,
  historicalVaR,
  simulatePnLDistribution,
} from "./var-engine";

export type CohortVarStatus = "computed" | "no-positions" | "insufficient-history";

export interface CohortVarResult {
  readonly reportDate: string;
  readonly reporting: string;
  readonly status: CohortVarStatus;
  /** The standing-NOP risk-factor exposures the figures were derived from. */
  readonly exposures: readonly RiskFactorExposure[];
  readonly minObservations: number;
  readonly scenarioCount: number;
  /** VaR — 99% 1-day, reporting-ccy positive loss magnitude (0 unless computed). */
  readonly varReporting: number;
  /** SVaR — 99% 1-day stressed, reporting-ccy (0 unless computed). */
  readonly svarReporting: number;
  /** ES — 97.5% 1-day, reporting-ccy (0 unless computed). */
  readonly esReporting: number;
}

/**
 * Minimum return observations per risk factor below which VaR cannot be computed
 * from a defensible window. Mirrors var-engine.ts MIN_RETURN_OBSERVATIONS (the
 * build-phase floor) — sourced here so the cohort job and the V1 engine share the
 * sufficiency floor. The simulated scenario seeds at least this many returns so
 * VaR computes (NOT "insufficient-history").
 */
export const COHORT_MIN_RETURN_OBSERVATIONS = 20;

interface CohortPosition {
  /** Foreign currency (the risk-factor leg). */
  readonly currency: string;
  /** Signed net position in the foreign currency's MAJOR units (long +, short −). */
  readonly netMajor: number;
}

/**
 * The fail-closed production-read provenance filter for the cohort-VaR fold.
 *
 * `production-only` — NOT the env default (`defaultProvenanceFilter()`, today
 * `operating-book`). The production VaR figure is a regulatory / risk-appetite
 * number, so it reads strictly production provenance: a simulated FIL instrument
 * is excluded EVEN IF it is physically present in the production canonical store.
 * This closes the store-separation gap (the R300m-into-Prod class,
 * `D-V2-UI-VISIBILITY-REMEDIATION`): correctness no longer depends on the
 * production and simulated stores being distinct files — the filter excludes
 * simulated provenance regardless of store contents.
 *
 * Authority: D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12);
 *   D-DATA-PROVENANCE-SUBSTRATE. Mirrors the BA 320 / BA 350 fold discipline.
 */
export function productionCohortVarFilter(): ProvenanceFilter {
  return { mode: "production-only" };
}

/**
 * Compute the cohort's VaR / SVaR / ES for `reportDate` from the booked FIL
 * cohort + the production return histories. Pure read; deterministic given the
 * stores. NO SILENT ZEROS: a figure is `computed` only when the book is non-flat
 * AND every risk factor has a sufficient return window; otherwise a loud
 * `no-positions` / `insufficient-history` status with zeroed figures.
 *
 * FAIL-CLOSED PROVENANCE: the FIL cohort fold is provenance-filtered. The
 * default (`provenanceFilter` omitted) is the strict production-only read
 * (`productionCohortVarFilter()`), so a simulated FIL instrument leaked into the
 * production store is excluded from the production VaR figure — the read does NOT
 * rely on store separation. A caller wanting the simulated/combined book (the
 * +Sim path, recon) passes a simulated-inclusive filter explicitly.
 */
export function computeCohortVar(args: {
  readonly eventStore: EventStore;
  readonly marketDataStore: MarketDataStore;
  readonly reporting: string;
  readonly reportDate: string;
  readonly asOf: string;
  /** Return window length to read per factor (defaults to 250 business days). */
  readonly window?: number;
  /**
   * Provenance filter applied to the FIL-cohort event fold. Defaults to the
   * strict production-only read (`productionCohortVarFilter()`) so the
   * production path fails closed regardless of store contents. The +Sim / recon
   * read passes a simulated-inclusive filter (e.g. `defaultProvenanceFilter()`
   * or `{ mode: "combined" }`) explicitly.
   */
  readonly provenanceFilter?: ProvenanceFilter;
}): CohortVarResult {
  const { eventStore, marketDataStore, reporting, reportDate, asOf } = args;
  const window = args.window ?? 250;
  const provenanceFilter = args.provenanceFilter ?? productionCohortVarFilter();

  const netByCcy = foldCohortNetPosition(eventStore, reporting, provenanceFilter);

  const exposures: RiskFactorExposure[] = [];
  const returnsByFactor = new Map<string, number[]>();

  for (const pos of netByCcy) {
    if (pos.netMajor === 0) continue;
    // Translate the foreign net position to the reporting currency at the latest
    // production spot mark (the standing NOP in reporting terms).
    const quote = lookupQuoteWithInverse(marketDataStore, `${pos.currency}/${reporting}`, {
      provenance: "production",
    });
    const zarRate = quote && quote.rate > 0 ? quote.rate : 1;
    const exposureReporting = pos.netMajor * zarRate;
    const factor = `${pos.currency}/${reporting}`;
    const returns = fxReturnSeriesFromMarks(marketDataStore, factor, asOf, window);
    returnsByFactor.set(factor, returns);
    exposures.push({
      factor,
      exposureZar: exposureReporting,
      returnObservations: returns.length,
    });
  }

  if (exposures.length === 0) {
    return {
      reportDate,
      reporting,
      status: "no-positions",
      exposures,
      minObservations: 0,
      scenarioCount: 0,
      varReporting: 0,
      svarReporting: 0,
      esReporting: 0,
    };
  }

  const minObservations = exposures.reduce(
    (min, e) => Math.min(min, e.returnObservations),
    Number.POSITIVE_INFINITY,
  );
  const resolvedMin = Number.isFinite(minObservations) ? minObservations : 0;

  if (resolvedMin < COHORT_MIN_RETURN_OBSERVATIONS) {
    return {
      reportDate,
      reporting,
      status: "insufficient-history",
      exposures,
      minObservations: resolvedMin,
      scenarioCount: 0,
      varReporting: 0,
      svarReporting: 0,
      esReporting: 0,
    };
  }

  const pnl = simulatePnLDistribution(exposures, returnsByFactor);
  const varReporting = historicalVaR(pnl, confidenceFor("var"));
  const esReporting = historicalES(pnl, confidenceFor("es"));
  // SVaR ≥ VaR (a stress calibration cannot be less severe). Build-phase: the
  // stress window is the full available window.
  const svarReporting = Math.max(varReporting, historicalVaR(pnl, confidenceFor("svar")));

  return {
    reportDate,
    reporting,
    status: "computed",
    exposures,
    minObservations: resolvedMin,
    scenarioCount: pnl.length,
    varReporting,
    svarReporting,
    esReporting,
  };
}

// ---------------------------------------------------------------------------
// Cohort fold — standing net FX position per currency from the FIL cohort.
// ---------------------------------------------------------------------------

/**
 * Fold the bank's standing net FX position per foreign currency from the FIL
 * cohort: open FX instruments contribute their signed base notional; settled
 * `cash` instruments contribute their signed amount (settlement-retained NOP).
 * The reporting currency leg is excluded (it is not an FX risk factor). A
 * terminated FX instrument is dropped (its cash legs carry the retained NOP).
 *
 * Every replayed FIL lifecycle event is provenance-filtered through
 * `provenanceFilter` (the same `eventMatchesProvenanceFilter` predicate the
 * BA 320 / BA 350 folds use). Under the production-only default a simulated
 * instrument is excluded even if physically present in the production store —
 * the fold no longer relies on store separation for provenance correctness.
 * The termination set is filtered identically so a simulated termination cannot
 * silently drop a production instrument under the production read.
 */
function foldCohortNetPosition(
  store: EventStore,
  reporting: string,
  provenanceFilter: ProvenanceFilter,
): CohortPosition[] {
  const terminated = new Set<string>();
  for (const e of store.replay({ type: "FilInstrumentTerminated" })) {
    if (!eventMatchesProvenanceFilter(e, provenanceFilter)) continue;
    const inst = (e.payload as { instance?: string }).instance;
    if (inst) terminated.add(inst);
  }

  const net = new Map<string, number>();
  for (const e of store.replay({ type: "FilInstrumentCreated" })) {
    if (!eventMatchesProvenanceFilter(e, provenanceFilter)) continue;
    const p = e.payload as Record<string, unknown>;
    const economic = p.economicTerms as Record<string, unknown> | undefined;
    if (!economic) continue;
    const assetClass = economic.assetClass;
    if (assetClass !== "fx" && assetClass !== "cash") continue;
    const instance = p.instance as string | undefined;
    if (!instance) continue;
    // An open FX instrument whose settlement terminated it is excluded — its
    // retained NOP lives in the settled cash legs (avoids double counting).
    if (assetClass === "fx" && terminated.has(instance)) continue;

    const currency = (economic.currency as string | undefined) ?? "";
    if (!currency || currency === reporting) continue;
    const direction = economic.direction as "long" | "short" | undefined;
    const notional = economic.notional as { amount?: string } | undefined;
    if (!direction || !notional?.amount) continue;
    const magnitude = Number(notional.amount);
    if (!Number.isFinite(magnitude)) continue;
    const signed = direction === "long" ? magnitude : -magnitude;
    net.set(currency, (net.get(currency) ?? 0) + signed);
  }

  return [...net.entries()].map(([currency, netMajor]) => ({ currency, netMajor }));
}

/**
 * Build the daily return series for an FX pair from the production market marks
 * (mirrors var-engine.ts fxReturnSeries but reads the cohort's production marks).
 * Most-recent-first log-returns of the mid rate, bounded to `window`.
 */
function fxReturnSeriesFromMarks(
  marketData: MarketDataStore,
  pair: string,
  asOf: string,
  window: number,
): number[] {
  const ticks = marketData
    .query({
      provenance: "production",
      instrument: pair,
      dataType: "fx-quote",
      to: asOf,
      limit: window + 1,
    })
    .map((t) => extractMid(t.payload))
    .filter((r): r is number => typeof r === "number" && r > 0);

  const returns: number[] = [];
  for (let i = 0; i + 1 < ticks.length; i++) {
    const newer = ticks[i];
    const older = ticks[i + 1];
    if (newer === undefined || older === undefined || older === 0) continue;
    returns.push(Math.log(newer / older));
  }
  return returns;
}

function extractMid(payload: unknown): number | undefined {
  const p = payload as { mid?: number; midRate?: number };
  if (typeof p.mid === "number") return p.mid;
  if (typeof p.midRate === "number") return p.midRate;
  return undefined;
}
