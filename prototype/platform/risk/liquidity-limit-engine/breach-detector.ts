// platform/risk/liquidity-limit-engine/breach-detector.ts
//
// WS-LIQUIDITY-LIMIT-ENGINE — passive breach detector.
//
// Reads upstream liquidity observations (via `projection.ts`) and compares
// them against the configured tier thresholds. Returns the implied
// `LiquidityLimitBreachedPayload` payloads — emission is the caller's
// responsibility (Ravi's daily limit-sweep handler).
//
// `detectBreaches` does NOT emit events and does NOT mutate the event
// store. It is a pure function over `observations` + `configs`.
//
// Severity precedence per LRM Policy v1 §9.1:
//   critical (tier-1) > high (tier-2) > medium (tier-3) > low
//
// When multiple tiers are crossed for the same (line, subjectRef), only
// the worst tier's breach payload is emitted (engine writes one record per
// observation, not one per tier).
//
// Standing authority:
//   - D-RAS; LRM Policy v1; brief:ravi:liquidity-limit-engine-mirroring-
//     credit-limit-en:2026-05-21.
//
// Author: Ravi (Treasury and ALM engineer, engineering).

import type {
  LiquidityBreachSeverity,
  LiquidityLimitBreachedPayload,
  LiquidityLimitTier,
} from "../../event-store/event-types/liquidity-limit";
import { utcNow } from "../../types/time";
import { DEFAULT_LIMIT_CONFIGS } from "./config";
import {
  type ConcentrationFeed,
  getConcentrationObservations,
  getPortfolioObservations,
} from "./projection";
import type { LiquidityLimitConfig, LiquidityLimitObservation } from "./types";

// ---------------------------------------------------------------------------
// Tier precedence — used to pick the worst breach per observation.
// ---------------------------------------------------------------------------

const TIER_PRECEDENCE: Record<LiquidityLimitTier, number> = {
  "tier-1": 3,
  "tier-2": 2,
  "tier-3": 1,
};

// ---------------------------------------------------------------------------
// Breach-ID counter — per-process; the engine caller can override before
// emission if it needs a different scheme. Mirrors the credit-limit pattern.
// ---------------------------------------------------------------------------

let breachCounter = 0;
function nextBreachId(asOf: string): string {
  const year = asOf.slice(0, 4);
  breachCounter += 1;
  const seq = String(breachCounter).padStart(3, "0");
  return `LL-BREACH-${year}-${seq}`;
}

/**
 * Reset the breach-id counter. Exported so tests can assert against
 * deterministic IDs.
 */
export function resetBreachIdCounter(): void {
  breachCounter = 0;
}

// ---------------------------------------------------------------------------
// Core comparison — does `observation.current` breach `cfg.threshold`?
// ---------------------------------------------------------------------------

export function observationBreachesConfig(
  observation: LiquidityLimitObservation,
  cfg: LiquidityLimitConfig,
): boolean {
  if (cfg.direction === "floor") return observation.current < cfg.threshold;
  return observation.current > cfg.threshold;
}

// ---------------------------------------------------------------------------
// Public API surface
// ---------------------------------------------------------------------------

export interface DetectBreachesOpts {
  /** When set, replaces upstream-event reads — used by tests. */
  observations?: readonly LiquidityLimitObservation[];
  /** Concentration observations override (for tests + ALM-substrate stub). */
  concentrationFeed?: ConcentrationFeed;
  /** Limit-configuration override; defaults to `DEFAULT_LIMIT_CONFIGS`. */
  configs?: readonly LiquidityLimitConfig[];
  /** Wall-clock anchor for the detectedAt timestamp and ID year. */
  asOf?: string;
}

export interface BreachDetectionResult {
  newBreaches: LiquidityLimitBreachedPayload[];
}

export function detectBreaches(opts: DetectBreachesOpts = {}): BreachDetectionResult {
  const asOf = opts.asOf ?? utcNow();
  const configs = opts.configs ?? DEFAULT_LIMIT_CONFIGS;

  const observations: LiquidityLimitObservation[] = opts.observations
    ? [...opts.observations]
    : [
        ...getPortfolioObservations(asOf),
        ...getConcentrationObservations(asOf, opts.concentrationFeed),
      ];

  const breaches: LiquidityLimitBreachedPayload[] = [];

  for (const observation of observations) {
    const matching = configs.filter((c) => c.line === observation.line);
    if (matching.length === 0) continue;

    // Find the worst (highest-precedence) tier the observation breaches.
    let worst: { cfg: LiquidityLimitConfig; precedence: number } | null = null;
    for (const cfg of matching) {
      if (!observationBreachesConfig(observation, cfg)) continue;
      const precedence = TIER_PRECEDENCE[cfg.tier];
      if (!worst || precedence > worst.precedence) {
        worst = { cfg, precedence };
      }
    }
    if (!worst) continue;

    const payload: LiquidityLimitBreachedPayload = {
      breachId: nextBreachId(asOf),
      tier: worst.cfg.tier,
      line: observation.line,
      current: observation.current,
      threshold: worst.cfg.threshold,
      currentUnit: worst.cfg.currentUnit,
      severity: worst.cfg.severity,
      detectedAt: asOf,
    };
    if (observation.subjectRef) payload.subjectRef = observation.subjectRef;
    if (observation.sourceEventId) payload.sourceEventId = observation.sourceEventId;
    breaches.push(payload);
  }

  return { newBreaches: breaches };
}

// ---------------------------------------------------------------------------
// Status summary — for gateway hooks and the dashboard. Returns the worst
// status across the configured lines for any tier-1 line; the gateway
// rejects when any tier-1 line is in red.
// ---------------------------------------------------------------------------

export interface TierStatusSummary {
  tier1Red: boolean;
  tier1RedLines: {
    line: string;
    current: number;
    threshold: number;
    severity: LiquidityBreachSeverity;
  }[];
  observationsCount: number;
}

export function tierStatus(opts: DetectBreachesOpts = {}): TierStatusSummary {
  const configs = opts.configs ?? DEFAULT_LIMIT_CONFIGS;
  const asOf = opts.asOf ?? utcNow();
  const observations: LiquidityLimitObservation[] = opts.observations
    ? [...opts.observations]
    : [
        ...getPortfolioObservations(asOf),
        ...getConcentrationObservations(asOf, opts.concentrationFeed),
      ];

  const redLines: TierStatusSummary["tier1RedLines"] = [];
  for (const observation of observations) {
    const tier1Configs = configs.filter((c) => c.line === observation.line && c.tier === "tier-1");
    for (const cfg of tier1Configs) {
      if (observationBreachesConfig(observation, cfg)) {
        redLines.push({
          line: observation.line,
          current: observation.current,
          threshold: cfg.threshold,
          severity: cfg.severity,
        });
      }
    }
  }

  return {
    tier1Red: redLines.length > 0,
    tier1RedLines: redLines,
    observationsCount: observations.length,
  };
}
