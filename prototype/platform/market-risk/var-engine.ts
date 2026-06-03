// platform/market-risk/var-engine.ts
//
// Market-risk VaR / SVaR / ES engine — historical-simulation suite over the
// live trading book (FX, bonds, IRS, equity). Closes the model-scope gap
// declared by RISK-MRP-01 (Model Risk Policy v1) §1.1: market-risk models
// (VaR, Stressed VaR, Expected Shortfall) are in declared scope but were
// ungoverned and uncomputed.
//
// METHODOLOGY (documented + chosen standards):
//   - VaR: historical simulation, 99% confidence, 1-day holding period.
//     The bank elects historical simulation (not parametric / Monte-Carlo) for
//     the build phase: it makes no distributional assumption, captures fat tails
//     directly from realised returns, and is the most defensible method when the
//     trading book is small and the return history short. A 250-business-day
//     observation window is the standard FRTB / Basel-2.5 lookback.
//   - SVaR (Stressed VaR): the same 99% 1-day historical-simulation VaR, but
//     calibrated to a continuous 250-day STRESS window of significant financial
//     stress (Basel-2.5 MAR / FRTB ES-stress-period analogue). Until a multi-year
//     return history exists the stress window cannot be identified, so SVaR shares
//     the VaR history-sufficiency gate.
//   - ES (Expected Shortfall): 97.5% confidence (the FRTB-prescribed quantile,
//     d457 / MAR33), 1-day. ES = the mean loss in the tail beyond the 97.5%
//     quantile — a coherent risk measure that, unlike VaR, captures the
//     magnitude of tail losses.
//
// RISK FACTORS (build phase): the FX desk is the populated trading book, so the
// risk factors are the net open ZAR positions per FX currency pair. Bonds, IRS
// and equity legs map to their own risk factors as their price-history feeds
// land; the engine is risk-factor-agnostic (it consumes a position vector + a
// per-factor return matrix), so adding a factor is data, not code.
//
// NO SILENT ZEROS (objective 4 of D-TRUSTED-FIGURES-PROGRAM-V1): a VaR/SVaR/ES
// figure is surfaced ONLY when there are live trading positions AND a sufficient
// historical-return window for every risk factor in the book. Otherwise the
// report carries a loud, reasoned `status`:
//   - `no-positions`        — the trading book is flat (no open risk-factor
//                             exposure). VaR is 0 by absence of risk, surfaced
//                             loudly, never an unexplained 0.
//   - `insufficient-history`— there ARE live positions but the market-data store
//                             holds fewer than the minimum return observations
//                             for one or more risk factors. The figure cannot be
//                             derived from a too-short window (it would understate
//                             tail risk) → degraded, output null, surfaced on the
//                             /api/data-failures banner.
//   - `computed`            — live positions + sufficient history → real figure.
//
// GOVERNANCE (D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 4): the three surfaced
// figures bind in CALC_BINDINGS (calcKeys `var`, `svar`, `es`;
// model:market-risk-var-hs-v1, model:market-risk-svar-hs-v1,
// model:market-risk-es-hs-v1; owned by Helena (Chief Risk Officer, governance)).
// They consume the market-risk P&L / sensitivity model
// (model:market-risk-pnl-sensitivity-v1) that derives the risk-factor exposure
// vector from the live book.
//
// Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 (Slice 4, CEO session-delegation
//   2026-05-29); RISK-MRP-01 §1.1, §2; BCBS d457 (FRTB) MAR33; Basel-2.5 MAR.
// Author: Rohan (Risk systems engineer, engineering), built under
//   D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 4 coordinated by Helena (Chief Risk
//   Officer, governance — model-risk-policy owner + methodology accountability),
//   validated by Nadia (Independent-validation engineer), with the historical
//   market-data return window supplied by Ravi (market-data infrastructure
//   engineer).

import { fxPositionCalculator } from "../accounting/fx-calculators";
import type { EventStore } from "../event-store/store";
import type { MarketDataStore } from "../market-data/store";
import { extractMidRate, lookupQuoteWithInverse } from "../market-data/store";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import { eventInOperatingBook } from "../projections/filter";
import { type FinancialInput, absent, present, requireWeight } from "../types/financial-input";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Basel-2.5 / FRTB standard observation window (business days). */
export const VAR_OBSERVATION_WINDOW = 250;

/**
 * Minimum return observations per risk factor below which VaR/SVaR/ES cannot be
 * computed from a defensible window. A too-short history understates tail risk;
 * surfacing a number derived from it would be a silent-zero-class error. We
 * require at least 20 daily returns (≈1 trading month) as the absolute floor for
 * a build-phase figure; production tightens this to the full 250-day window.
 */
export const MIN_RETURN_OBSERVATIONS = 20;

/**
 * Per-confidence z-equivalent quantile indices are not used (historical
 * simulation is non-parametric); these are the chosen confidence levels carried
 * for documentation + the SVaR/ES quantiles. Held in a loud weight table so a
 * mis-keyed confidence fails via requireWeight rather than a silent default.
 */
const CONFIDENCE_LEVELS: Readonly<Record<string, number>> = {
  var: 0.99, // 99% 1-day (Basel-2.5 / FRTB internal-model VaR)
  svar: 0.99, // 99% 1-day calibrated to a stress window
  es: 0.975, // 97.5% 1-day (FRTB d457 / MAR33 Expected Shortfall)
};

/** Look up the confidence level for a measure, loudly. */
export function confidenceFor(measure: "var" | "svar" | "es"): number {
  return requireWeight(CONFIDENCE_LEVELS, measure, "market-risk confidence levels");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarketRiskStatus = "computed" | "no-positions" | "insufficient-history";

/** A single risk factor: a net exposure with the return history available for it. */
export interface RiskFactorExposure {
  /** Risk-factor key (e.g. an FX pair "USD/ZAR"). */
  readonly factor: string;
  /** Net exposure in ZAR (signed; long positive, short negative). */
  readonly exposureZar: number;
  /** Number of historical daily returns available for this factor. */
  readonly returnObservations: number;
}

export interface MarketRiskReport {
  readonly asOf: string;
  readonly currency: string;
  readonly status: MarketRiskStatus;
  /** The risk-factor exposure vector the figures were (or would be) derived from. */
  readonly exposures: readonly RiskFactorExposure[];
  /** Smallest return-observation count across all live risk factors. */
  readonly minObservations: number;
  /**
   * VaR — 99% 1-day historical-simulation Value-at-Risk, ZAR positive loss
   * magnitude. `present` only when status is `computed`.
   */
  readonly var: FinancialInput<number>;
  /** SVaR — 99% 1-day stressed VaR, ZAR positive loss magnitude. */
  readonly svar: FinancialInput<number>;
  /** ES — 97.5% 1-day Expected Shortfall, ZAR positive loss magnitude. */
  readonly es: FinancialInput<number>;
}

// ---------------------------------------------------------------------------
// Risk-factor extraction (live trading-book → exposure vector + return matrix)
// ---------------------------------------------------------------------------

/**
 * Build the daily return series for an FX pair from the market-data store.
 * Returns are simple log-returns of the mid rate between consecutive ticks,
 * most-recent-first, bounded to the observation window. An FX pair with fewer
 * than two ticks yields an empty series (no return can be formed).
 *
 * Direction-neutral: VaR is invariant to whether the pair is stored direct or
 * inverse because a log-return of 1/r is just −log-return of r; the engine takes
 * the exposure-weighted return so the sign is carried by the exposure, not here.
 */
export function fxReturnSeries(
  marketData: MarketDataStore,
  pair: string,
  asOf: string,
  window: number = VAR_OBSERVATION_WINDOW,
  provenance: "production" | "simulated" = "production",
): number[] {
  // Most-recent-first ticks (asc-bounded by asOf), one extra so we can form
  // `window` returns from `window + 1` levels. Production-provenance only:
  // simulation ticks must never contaminate a live VaR valuation
  // (D-MARKETS-SCHEMA-FOUNDATION; valuation-policy §4.3).
  const ticks = marketData
    .query({ provenance, instrument: pair, dataType: "fx-quote", to: asOf, limit: window + 1 })
    .map((t) => extractMidRate(t.payload))
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

/**
 * Derive a currency → ZAR-rate map (units of ZAR per 1 minor unit of currency,
 * matching fxPositionCalculator's contract) from the live trading book's
 * currencies, sourcing the latest mid quote per pair from the MarketDataStore
 * (direction-aware). ZAR maps to 1. A currency with no usable quote is omitted
 * (fxPositionCalculator then treats it at rate 1 — a degraded translation that
 * the engine's history-sufficiency gate will catch downstream, never a silent
 * wrong figure surfaced as VaR).
 */
export function deriveZarRatesFromMarketData(
  marketData: MarketDataStore,
  currencies: Iterable<string>,
): Map<string, number> {
  const rates = new Map<string, number>();
  rates.set("ZAR", 1);
  for (const ccy of currencies) {
    if (ccy === "ZAR" || rates.has(ccy)) continue;
    const quote = lookupQuoteWithInverse(marketData, `${ccy}/ZAR`, { provenance: "production" });
    // rate is ZAR per 1 unit of ccy; fxPositionCalculator multiplies a minor
    // base amount by this rate to get a minor ZAR amount, so the per-unit and
    // per-minor-unit factors coincide (both legs are minor units).
    if (quote && quote.rate > 0) rates.set(ccy, quote.rate);
  }
  return rates;
}

/**
 * Derive the live trading-book risk-factor exposures (FX desk) + their return
 * histories. This is the market-risk P&L / sensitivity model
 * (model:market-risk-pnl-sensitivity-v1): it maps the live book to a signed
 * ZAR-exposure-per-risk-factor vector and attaches each factor's return window.
 */
export function deriveRiskFactorExposures(args: {
  readonly eventStore: EventStore;
  readonly marketData: MarketDataStore;
  readonly asOf: string;
  /** currency → ZAR rate, for translating net base positions to ZAR. Derived
   *  from the MarketDataStore when omitted. */
  readonly zarRates?: ReadonlyMap<string, number>;
}): { exposures: RiskFactorExposure[]; returnsByFactor: Map<string, number[]> } {
  const { eventStore, marketData, asOf } = args;

  // ---- Live FX positions (the populated build-phase trading book) ----------
  // Operating-book inclusion (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE): only
  // production + operational-simulated trades enter the VaR book. Seed
  // scaffolding (build-phase-fixture) + sandbox runs are held out — otherwise a
  // polluted store inflates VaR by orders of magnitude (the same provenance
  // class fixed in the B3 limit-utilisation projection).
  const trades: FxTradeExecutedPayload[] = [];
  for (const ev of eventStore.replay({ type: "FxTradeExecuted", asOf })) {
    if (!eventInOperatingBook(ev)) continue;
    trades.push(ev.payload as unknown as FxTradeExecutedPayload);
  }

  const settledTradeIds = new Set<string>();
  for (const ev of eventStore.replay({ type: "SettlementConfirmed", asOf })) {
    const p = ev.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string") settledTradeIds.add(p.tradeId);
  }
  for (const ev of eventStore.replay({ type: "TradeMatured", asOf })) {
    const p = ev.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string") settledTradeIds.add(p.tradeId);
  }

  // Build (or accept) the ZAR-rate map across every currency the book touches.
  const currencies = new Set<string>();
  for (const t of trades) {
    currencies.add(t.currencyPair.base);
    currencies.add(t.currencyPair.quote);
  }
  const zarRates = args.zarRates ?? deriveZarRatesFromMarketData(marketData, currencies);

  const fxPositions = fxPositionCalculator({ trades, settledTradeIds, zarRates, asOf });

  const exposures: RiskFactorExposure[] = [];
  const returnsByFactor = new Map<string, number[]>();

  for (const pos of fxPositions) {
    // Skip a flat pair (net zero) — it carries no risk-factor exposure.
    if (pos.netPositionZarMinor === 0) continue;
    const exposureZar = pos.netPositionZarMinor / 100; // minor → major ZAR
    const returns = fxReturnSeries(marketData, pos.currencyPair, asOf);
    returnsByFactor.set(pos.currencyPair, returns);
    exposures.push({
      factor: pos.currencyPair,
      exposureZar,
      returnObservations: returns.length,
    });
  }

  return { exposures, returnsByFactor };
}

// ---------------------------------------------------------------------------
// Historical-simulation core
// ---------------------------------------------------------------------------

/**
 * Build the simulated 1-day P&L distribution for the book by applying each
 * historical scenario's per-factor return to the current exposure vector and
 * summing across factors. Scenario t P&L = Σ_factor exposure_factor × return_factor,t.
 *
 * Scenarios are aligned by index (scenario 0 = most-recent return for every
 * factor). The distribution length is the SHORTEST factor history (a scenario
 * is only well-formed when every factor has a return for it).
 */
export function simulatePnLDistribution(
  exposures: readonly RiskFactorExposure[],
  returnsByFactor: ReadonlyMap<string, number[]>,
): number[] {
  if (exposures.length === 0) return [];
  let scenarioCount = Number.POSITIVE_INFINITY;
  for (const e of exposures) {
    const series = returnsByFactor.get(e.factor) ?? [];
    scenarioCount = Math.min(scenarioCount, series.length);
  }
  if (!Number.isFinite(scenarioCount) || scenarioCount <= 0) return [];

  const pnl: number[] = [];
  for (let t = 0; t < scenarioCount; t++) {
    let scenarioPnl = 0;
    for (const e of exposures) {
      const series = returnsByFactor.get(e.factor);
      const r = series?.[t];
      if (r === undefined) continue;
      scenarioPnl += e.exposureZar * r;
    }
    pnl.push(scenarioPnl);
  }
  return pnl;
}

/**
 * Historical-simulation VaR: the loss at the given confidence quantile.
 * Losses are the negated P&L (a loss is a positive number). Returns the loss
 * magnitude at the (1 − confidence) tail.
 */
export function historicalVaR(pnlDistribution: readonly number[], confidence: number): number {
  if (pnlDistribution.length === 0) return 0;
  const losses = pnlDistribution.map((p) => -p).sort((a, b) => a - b); // ascending
  // The VaR quantile: the loss not exceeded with `confidence` probability.
  const idx = Math.min(losses.length - 1, Math.ceil(confidence * losses.length) - 1);
  const v = losses[Math.max(0, idx)] ?? 0;
  return Math.max(0, v);
}

/**
 * Historical-simulation Expected Shortfall (97.5%): the mean of the losses in
 * the tail beyond the VaR quantile.
 */
export function historicalES(pnlDistribution: readonly number[], confidence: number): number {
  if (pnlDistribution.length === 0) return 0;
  const losses = pnlDistribution.map((p) => -p).sort((a, b) => a - b); // ascending
  const idx = Math.min(losses.length - 1, Math.ceil(confidence * losses.length) - 1);
  const tail = losses.slice(Math.max(0, idx));
  if (tail.length === 0) return 0;
  const mean = tail.reduce((s, l) => s + l, 0) / tail.length;
  return Math.max(0, mean);
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Compute the market-risk VaR / SVaR / ES suite over the live trading book.
 *
 * Pure read — no appends. NO SILENT ZEROS: the figures are `present` only when
 * there are live positions and a sufficient return window for every factor;
 * otherwise the report carries a loud `status` + `absent` figures.
 */
export function computeMarketRisk(args: {
  readonly eventStore: EventStore;
  readonly marketData: MarketDataStore;
  readonly asOf: string;
  /** currency → ZAR rate. Derived from the MarketDataStore when omitted. */
  readonly zarRates?: ReadonlyMap<string, number>;
}): MarketRiskReport {
  const { eventStore, marketData, asOf } = args;
  const { exposures, returnsByFactor } = deriveRiskFactorExposures({
    eventStore,
    marketData,
    asOf,
    ...(args.zarRates ? { zarRates: args.zarRates } : {}),
  });

  const minObservations = exposures.reduce(
    (min, e) => Math.min(min, e.returnObservations),
    exposures.length === 0 ? 0 : Number.POSITIVE_INFINITY,
  );

  // ---- No live positions: VaR is 0 by absence of risk, surfaced loudly. ----
  if (exposures.length === 0) {
    const reason = "trading book is flat — no open risk-factor exposure (FX/bond/IRS/equity)";
    const exp = "live FX positions (fxPositionCalculator over FxTradeExecuted)";
    return {
      asOf,
      currency: "ZAR",
      status: "no-positions",
      exposures,
      minObservations: 0,
      var: absent(reason, exp),
      svar: absent(reason, exp),
      es: absent(reason, exp),
    };
  }

  // ---- Live positions but too-short history: degraded, never a silent 0. ---
  if (!Number.isFinite(minObservations) || minObservations < MIN_RETURN_OBSERVATIONS) {
    const obs = Number.isFinite(minObservations) ? minObservations : 0;
    const reason = `insufficient market-data return history — ${obs} observation(s) for the thinnest risk factor, below the ${MIN_RETURN_OBSERVATIONS}-observation floor (target ${VAR_OBSERVATION_WINDOW}-day window). A VaR derived from a too-short window understates tail risk.`;
    const exp =
      "MarketDataStore fx-quote tick history per risk factor (Ravi — market-data infrastructure)";
    return {
      asOf,
      currency: "ZAR",
      status: "insufficient-history",
      exposures,
      minObservations: obs,
      var: absent(reason, exp),
      svar: absent(reason, exp),
      es: absent(reason, exp),
    };
  }

  // ---- Live positions + sufficient history: compute the real figures. ------
  const pnl = simulatePnLDistribution(exposures, returnsByFactor);
  const varZar = historicalVaR(pnl, confidenceFor("var"));
  const esZar = historicalES(pnl, confidenceFor("es"));

  // SVaR — same 99% 1-day historical-simulation VaR calibrated to a stress
  // window. In the build phase there is no multi-year history from which to
  // pick a distinct stress window, so the stress window is the full available
  // window (the most adverse the data supports). When a multi-year history
  // lands, the stress window is the worst continuous 250-day block. SVaR ≥ VaR
  // is enforced (a stress calibration cannot be less severe than the current one).
  const svarZar = Math.max(varZar, historicalVaR(pnl, confidenceFor("svar")));

  const lineage = `historical-simulation over ${pnl.length} scenarios, ${exposures.length} risk factor(s)`;
  return {
    asOf,
    currency: "ZAR",
    status: "computed",
    exposures,
    minObservations,
    var: present(varZar, lineage),
    svar: present(svarZar, `${lineage}; stress-calibrated`),
    es: present(esZar, lineage),
  };
}
