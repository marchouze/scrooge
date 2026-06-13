// v2-core/fil-models/market-risk-var/methodology.ts
//
// MARKET-RISK VaR methodology — the v2-native historical-simulation arithmetic
// the VaR `AttributionMetric` runs (V2 A3). This is a faithful PORT of the v1
// `platform/market-risk/var-engine.ts` historical-simulation core
// (`simulatePnLDistribution` / `historicalVaR` / `historicalES`) — NOT an
// import (recon:v2-no-v1-import — ENFORCING). The two must agree byte-for-byte
// on the same inputs; `recon:attribution-var-diversification` asserts the group-
// node VaR reconciles to the v1 engine over the SAME standing-NOP exposure +
// return matrix (the A3 parity proof).
//
// THE CRUX (A3 "Prove"): VaR is NON-ADDITIVE. The book P&L for a single
// historical scenario t is `Σ_factor exposure_factor × return_factor,t` — the
// JOINT scenario P&L across all factors. The VaR is a QUANTILE of that joint
// distribution. Because the factor returns are CORRELATED (and a scenario nets
// a loss in one factor against a gain in another), the quantile of the joint
// distribution is < the sum of the per-factor quantiles: diversification. There
// is NO way to recover `VaR(group)` from `VaR(deskA) + VaR(deskB)` — you must
// re-simulate over the joint exposure vector. That is exactly why the metric
// carries `joint-recompute` semantics (no `add`).
//
// METHODOLOGY (matches v1, documented standards):
//   - 99% 1-day historical-simulation VaR (Basel-2.5 / FRTB internal-model VaR).
//   - 97.5% 1-day Expected Shortfall (FRTB d457 / MAR33) — mean tail loss.
//   - Risk factors are the bank's standing net FX position per ISO-4217 currency
//     (the B3 / NOP basis), each currency C mapped to its C/ZAR return window.
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD (A3 build slice);
//   D-VAR-EXPOSURE-INCLUDES-STANDING-NOP (CEO-approved 2026-06-12, methodology
//   owner Helena (Chief Risk Officer, governance)); BCBS d457 (FRTB) MAR33;
//   Basel-2.5 MAR; Principle 1.
// Author: Atlas (Core banking platform architect, engineering) ·
//         Rohan (Risk systems engineer, engineering — VaR methodology) ·
//         Helena (Chief Risk Officer, governance — methodology accountability).

// ---------------------------------------------------------------------------
// Constants (the v1 engine's chosen confidence levels — pinned for the hash).
// ---------------------------------------------------------------------------

/** 99% 1-day VaR (Basel-2.5 / FRTB internal-model VaR). */
export const VAR_CONFIDENCE = 0.99;
/** 97.5% 1-day Expected Shortfall (FRTB d457 / MAR33). */
export const ES_CONFIDENCE = 0.975;

// ---------------------------------------------------------------------------
// A risk-factor exposure — the signed ZAR exposure of the (joint) member set to
// one risk factor, plus that factor's historical return window (most-recent-
// first daily log-returns).
// ---------------------------------------------------------------------------

export interface VarRiskFactorExposure {
  /** Risk-factor key (an FX pair, e.g. "USD/ZAR"). */
  readonly factor: string;
  /** Net signed exposure in ZAR (long +, short −). */
  readonly exposureZar: number;
  /** Most-recent-first daily log-returns for this factor. */
  readonly returns: readonly number[];
}

// ---------------------------------------------------------------------------
// Historical-simulation core — PORTED VERBATIM from v1 var-engine (the parity
// contract). Scenario t P&L = Σ_factor exposure_factor × return_factor,t,
// aligned by index; the distribution length is the SHORTEST factor history.
// ---------------------------------------------------------------------------

/**
 * Build the simulated 1-day P&L distribution for a JOINT exposure vector. The
 * joint structure is the whole point: each scenario nets the per-factor moves
 * together, so correlation + offset are captured — the source of diversification.
 */
export function simulatePnLDistribution(exposures: readonly VarRiskFactorExposure[]): number[] {
  if (exposures.length === 0) return [];
  let scenarioCount = Number.POSITIVE_INFINITY;
  for (const e of exposures) {
    scenarioCount = Math.min(scenarioCount, e.returns.length);
  }
  if (!Number.isFinite(scenarioCount) || scenarioCount <= 0) return [];

  const pnl: number[] = [];
  for (let t = 0; t < scenarioCount; t++) {
    let scenarioPnl = 0;
    for (const e of exposures) {
      const r = e.returns[t];
      if (r === undefined) continue;
      scenarioPnl += e.exposureZar * r;
    }
    pnl.push(scenarioPnl);
  }
  return pnl;
}

/**
 * Historical-simulation VaR: the loss at the given confidence quantile. Losses
 * are the negated P&L (a loss is positive). PORTED VERBATIM from v1
 * `historicalVaR` (same index arithmetic → byte parity).
 */
export function historicalVaR(pnlDistribution: readonly number[], confidence: number): number {
  if (pnlDistribution.length === 0) return 0;
  const losses = pnlDistribution.map((p) => -p).sort((a, b) => a - b); // ascending
  const idx = Math.min(losses.length - 1, Math.ceil(confidence * losses.length) - 1);
  const v = losses[Math.max(0, idx)] ?? 0;
  return Math.max(0, v);
}

/**
 * Historical-simulation Expected Shortfall: the mean of the losses in the tail
 * beyond the VaR quantile. PORTED VERBATIM from v1 `historicalES`.
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
// The joint VaR over a set of risk-factor exposures (the metric's kernel).
// ---------------------------------------------------------------------------

export interface JointVarResult {
  /** 99% 1-day VaR (ZAR positive loss magnitude). */
  readonly varZar: number;
  /** 97.5% 1-day Expected Shortfall (ZAR positive loss magnitude). */
  readonly esZar: number;
  /** Scenarios actually simulated (shortest factor history). */
  readonly scenarioCount: number;
  /** The risk factors that contributed (non-zero exposure). */
  readonly factors: readonly string[];
}

/**
 * Compute the JOINT VaR + ES over a risk-factor exposure vector. Re-simulates
 * the joint P&L distribution and takes the quantile — NEVER a sum of per-factor
 * VaRs. Returns a zero result for an empty / historyless vector.
 */
export function jointVar(exposures: readonly VarRiskFactorExposure[]): JointVarResult {
  const live = exposures.filter((e) => e.exposureZar !== 0);
  const distribution = simulatePnLDistribution(live);
  return {
    varZar: historicalVaR(distribution, VAR_CONFIDENCE),
    esZar: historicalES(distribution, ES_CONFIDENCE),
    scenarioCount: distribution.length,
    factors: live.map((e) => e.factor),
  };
}

// ---------------------------------------------------------------------------
// methodologyHash — deterministic integrity anchor (mirrors the FX model). Pins
// the methodology version + the load-bearing constants so any silent change to
// the arithmetic changes the hash.
// ---------------------------------------------------------------------------

// Local FNV-1a (not exported — the FX methodology already exports a `fnv1a`;
// keeping this private avoids a barrel name collision in v2-core/index.ts).
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function computeVarMethodologyHash(
  modelId: string,
  version: { major: number; minor: number },
): string {
  const pin = [
    `model=${modelId}`,
    `version=${version.major}.${version.minor}`,
    `var-confidence=${VAR_CONFIDENCE}`,
    `es-confidence=${ES_CONFIDENCE}`,
    "method=historical-simulation",
    "holding=1-day",
    "scenario-pnl=sum(exposure*return)",
    "var=quantile(joint-loss)",
    "es=mean-tail(joint-loss)",
    "non-additive=joint-recompute",
  ].join("|");
  return `mrvar:v${version.major}.${version.minor}:${fnv1a(pin)}`;
}
