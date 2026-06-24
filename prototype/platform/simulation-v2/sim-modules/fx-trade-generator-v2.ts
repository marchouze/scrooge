// platform/simulation-v2/sim-modules/fx-trade-generator-v2.ts
//
// V2-native generative FX-spot trade driver. The live simulator's analogue of the
// V1 `generateSimTrade()` (platform/simulation/fx-sim-generator.ts): on each tick
// it manufactures ONE plausible FX-spot trade action a counterparty requests of
// the bank — random counterparty / pair / side / notional, priced off the live
// random-walk rate engine.
//
// PORT, NOT IMPORT (D-V1-REMOVAL-PHASE-1): this is born V2 and imports nothing
// from the V1 `platform/simulation/` spine. It emits the existing born-V2
// `ScenarioTradeAction` shape the V2 modules already consume (trade-confirmation,
// book-affirmed-fx-trade) — so the generated trade flows through the SAME booking
// path as a manifest-declared one.
//
// REPLAY-SAFETY (recon:fx-v2-sim-boundary Rule C): no Math.random / Date.now /
// no-arg `new Date()`. Every stochastic choice draws from the injected SeededRng;
// the trade is dated from the injected clock instant (`asOf`). `new Date(ms)` with
// an argument is a pure formatter (allowed) — it never reads the wall clock.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20).

import { T_PLUS_TWO_MS } from "../../scenario-clock";
import type { SeededRng } from "../prng";
import type { ScenarioCounterparty, ScenarioTradeAction } from "../scenario-manifest";
import { FxRateWalkV2 } from "./fx-rate-walk-v2";

export interface GenerateScenarioTradeArgs {
  /** Seeded RNG — the single source of stochastic choices (replay-safe). */
  readonly rng: SeededRng;
  /** Clock instant the trade is requested at (ISO-8601, from the SimulatedClock). */
  readonly asOf: string;
  /** Monotonic sequence number — guarantees a unique tradeId within a run. */
  readonly seq: number;
  /** Eligible (provisioned) counterparties the trade may be requested by. */
  readonly counterparties: readonly ScenarioCounterparty[];
  /** Live random-walk rate engine — prices the trade off the current spread. */
  readonly rateWalk: FxRateWalkV2;
  /** Min base notional (MAJOR units). Default 1,000,000. */
  readonly notionalMajorMin?: number;
  /** Max base notional (MAJOR units). Default 10,000,000. */
  readonly notionalMajorMax?: number;
  /** Notional granularity (MAJOR units). Default 100,000. */
  readonly lotMajor?: number;
  /** Force the bank-side direction (risk-aware generation parity). */
  readonly forcedSide?: "buy" | "sell";
}

/** Compact an ISO instant into an id-safe token (digits + T/Z separators only). */
function compactInstant(asOf: string): string {
  return asOf.replace(/[^0-9TZ]/g, "");
}

/** T+2 settlement date (YYYY-MM-DD) from an ISO instant. Calendar-day spot convention. */
function tPlusTwoDate(asOf: string): string {
  const ms = Date.parse(asOf);
  if (Number.isNaN(ms)) {
    throw new Error(`generateScenarioTrade: asOf "${asOf}" is not a valid ISO-8601 instant`);
  }
  // `new Date(ms)` is a pure formatter over an explicit epoch — not a wall-clock read.
  return new Date(ms + T_PLUS_TWO_MS).toISOString().slice(0, 10);
}

/** Round a rate to 5 decimal places (standard FX quotation precision). */
function round5(n: number): number {
  return Math.round(n * 100_000) / 100_000;
}

/**
 * Generate ONE FX-spot trade action, or `null` when no eligible counterparty /
 * pair exists (fail-closed: the driver simply skips the tick). Pure + deterministic
 * for a given (rng sequence, asOf, seq, counterparties, rateWalk state).
 */
export function generateScenarioTrade(args: GenerateScenarioTradeArgs): ScenarioTradeAction | null {
  const {
    rng,
    asOf,
    seq,
    counterparties,
    rateWalk,
    notionalMajorMin = 1_000_000,
    notionalMajorMax = 10_000_000,
    lotMajor = 100_000,
    forcedSide,
  } = args;

  const eligible = counterparties.filter((c) => c.eligiblePairs.length > 0);
  if (eligible.length === 0) return null;

  const counterparty = rng.pick(eligible);
  const pair = rng.pick(counterparty.eligiblePairs);
  const side: "buy" | "sell" = forcedSide ?? (rng.bernoulli(0.5) ? "buy" : "sell");

  // Price off the live spread: a bank `buy` lifts the offer (ask), a `sell` hits
  // the bid — the realistic execution side of the quoted spread.
  const quote = rateWalk.tick(pair, rng);
  const rate = round5(side === "buy" ? quote.ask : quote.bid);

  // Notional in whole lots within [min, max].
  const minLots = Math.max(1, Math.floor(notionalMajorMin / lotMajor));
  const maxLots = Math.max(minLots, Math.floor(notionalMajorMax / lotMajor));
  const lots = rng.intBetween(minLots, maxLots);
  const baseNotionalMajor = lots * lotMajor;

  return {
    tradeId: `FXSPOT-${compactInstant(asOf)}-${seq}`,
    counterpartyId: counterparty.counterpartyId,
    productTaxonomy: "FX-spot",
    pair,
    side,
    baseNotionalMajor,
    rate,
    settlementDate: tPlusTwoDate(asOf),
  };
}
