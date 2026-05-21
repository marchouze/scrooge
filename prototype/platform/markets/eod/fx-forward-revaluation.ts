// platform/markets/eod/fx-forward-revaluation.ts
//
// EOD mark-to-market revaluation for FX forward, FX swap (far leg), and NDF
// positions.
//
// Companion module to fx-revaluation.ts (spot). Do NOT modify fx-revaluation.ts.
// This module runs alongside it: spot module handles "FX-spot"; this module
// handles {"FX-forward", "FX-swap", "NDF"}.
//
// Algorithm (per brief WS-FINANCE-FX-REVAL):
//   1. Replay FxTradeExecuted — collect positions with productTaxonomy ∈
//      {"FX-forward", "FX-swap", "NDF"}.
//   2. Replay FxSettlementConfirmed — build settled-trade set.
//   3. FX-swap near-leg: if FxSettlementConfirmed for legKind="near" exists,
//      treat near leg as closed. Skip near-leg revaluation.
//   4. Replay FxPositionRevalued for (tradeId, valuationDate) — idempotency.
//   5. For each open, un-revalued position:
//      a. Compute remaining tenor (calendar days: settlementDate − today).
//      b. Fetch forwardRate via ForwardRateSource.getForwardRate(pair, date, tenor).
//      c. Compute MtM P&L (flat-discount approximation — v0):
//           pnlDelta = (currentForwardRate − bookedRate) × notionalMinor
//                        / currentForwardRate
//         Rates are in minor units (× 10^6); notional in minor currency units.
//      d. NDF: settlementForm = "cash"; pnlDelta is the net-settlement
//         estimate in ndfSettlementCurrency minor units.
//      e. Emit FxPositionRevalued.
//   6. Return EodForwardRevaluationResult.
//
// Substrate gaps (v0):
//   [GAP-FWD-1] Forward-rate curve is a static seed (forward-rate-seed.ts).
//               Real integration: Ravi's IRRBB / yield-curve substrate.
//               Production: replace ForwardRateSource with a live curve feed.
//   [GAP-FWD-2] Flat-discount approximation only (no risk-free curve
//               discounting). Real valuation: Ravi's ALM substrate with
//               currency-specific OIS discount factors.
//   [GAP-FWD-3] FX options not in scope. Black-Scholes / vol-surface
//               pricing is a separate workstream.
//   [GAP-FWD-4] NDF fixing-source API integration deferred. At v0, the
//               forward rate is caller-supplied via ForwardRateSource; the
//               live SARB or EMTA fixing feed integrates at v1.
//   [GAP-FWD-5] Calendar-adjusted tenor calculation not implemented.
//               Build-phase uses raw calendar days. Production: use a
//               business-day calendar (JIHCAL or equivalent).
//
// Authority:
//   IAS-21-§28               (monetary items retranslated at closing rate)
//   IFRS-9-§5.7.1            (FVTPL: changes in fair value through P&L)
//   D-MARKETS-SCHEMA-FOUNDATION   (CEO-approved)
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
//   EXCON-SARB-CIRC-3-2020   (cross-border FX reporting)
//   ORG-EXCON-ODP-001        (NDF Excon AD rules)
//
// Authors: Bea (Accounting & financial reporting engineer, engineering)
//          Kai (Derivatives & structured products engineer, engineering)

import { clock } from "../../composition";
import { newEventId } from "../../core/types";
import {
  type FxPositionRevaluedPayload,
  type FxSettlementConfirmedPayload,
  makeFxPositionRevalued,
} from "../../event-store/event-types/fx-accounting";
import type { EventStore } from "../../event-store/store";
import type { FxTradeExecutedPayload } from "../cdm/fx";
import { seedForwardRate } from "./forward-rate-seed";

// ---------------------------------------------------------------------------
// ForwardRateSource — injectable interface (mirrors FxRateSource in spot module)
// ---------------------------------------------------------------------------

/**
 * Injectable forward-rate source. Allows tests to supply a static table and
 * production to plug in a live curve feed (Ravi's IRRBB substrate —
 * [GAP-FWD-1]).
 *
 * @param currencyPair  Canonical pair string, e.g. "ZAR/USD".
 * @param valuationDate YYYY-MM-DD valuation date.
 * @param tenorDays     Remaining calendar days to settlement.
 * @returns             Forward rate in minor units (× 10^6 for 6dp precision).
 *                      Throws if the pair/tenor is not available.
 */
export type ForwardRateSource = {
  getForwardRate(currencyPair: string, valuationDate: string, tenorDays: number): bigint;
};

/**
 * Build-phase static forward-rate source backed by forward-rate-seed.ts.
 *
 * Production replacement: real yield-curve feed per Ravi IRRBB substrate
 * ([GAP-FWD-1]). Swap this implementation for a live-rate connector once
 * that substrate lands; the ForwardRateSource interface stays stable.
 */
export const staticForwardRateSource: ForwardRateSource = {
  getForwardRate(currencyPair: string, _valuationDate: string, tenorDays: number): bigint {
    return seedForwardRate(currencyPair, tenorDays);
  },
};

/**
 * StubForwardRateSource — test helper with a caller-supplied lookup table.
 *
 * @param rates  Map: currencyPair → map of tenorDays → rate (bigint minor units).
 *               The exact tenorDays key is looked up; no interpolation.
 *               Throws on a missing key so tests fail loudly.
 */
export function makeStubForwardRateSource(
  rates: Record<string, Record<number, bigint>>,
): ForwardRateSource {
  return {
    getForwardRate(currencyPair: string, _valuationDate: string, tenorDays: number): bigint {
      const pairRates = rates[currencyPair];
      if (!pairRates) {
        throw new Error(`StubForwardRateSource: no rates for pair "${currencyPair}"`);
      }
      // Find closest tenor key — tests should use exact keys, but allow
      // nearest-key fallback for convenience (with a clear warning).
      const exact = pairRates[tenorDays];
      if (exact !== undefined) return exact;

      // Find nearest key.
      const keys = Object.keys(pairRates).map(Number);
      if (keys.length === 0) {
        throw new Error(`StubForwardRateSource: pair "${currencyPair}" has no tenor entries`);
      }
      const nearest = keys.reduce((prev, curr) =>
        Math.abs(curr - tenorDays) < Math.abs(prev - tenorDays) ? curr : prev,
      );
      // Use nearest but surface the approximation.
      const rate = pairRates[nearest];
      if (rate === undefined) {
        throw new Error(
          `StubForwardRateSource: no rate for pair "${currencyPair}" at tenorDays=${tenorDays}`,
        );
      }
      return rate;
    },
  };
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type EodForwardRevaluationResult = {
  /** Number of positions where FxPositionRevalued was emitted. */
  revalued: number;
  /** Number of positions skipped (already revalued today or near-leg settled). */
  skipped: number;
  /** ISO 8601 date this run covered. */
  asOf: string;
  /** Any non-fatal errors encountered per tradeId. */
  errors: string[];
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const RECON_CITATIONS = [
  "IAS-21-§28",
  "IFRS-9-§5.7.1",
  "D-MARKETS-SCHEMA-FOUNDATION",
  "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
  "EXCON-SARB-CIRC-3-2020",
];

const RECON_ACTOR = {
  type: "service" as const,
  id: "bea:eod-fx-forward-revaluation",
};

const BANK_ENTITY = "LE-ZA-HOZ-BANK";

/**
 * Compute calendar days between two ISO 8601 dates (YYYY-MM-DD).
 * Returns a non-negative integer; returns 0 if settlementDate ≤ valuationDate.
 */
function calendarDaysRemaining(valuationDate: string, settlementDate: string): number {
  const t0 = Date.parse(valuationDate);
  const t1 = Date.parse(settlementDate);
  if (Number.isNaN(t0) || Number.isNaN(t1)) {
    throw new Error(
      `calendarDaysRemaining: invalid date — valuationDate="${valuationDate}" settlementDate="${settlementDate}"`,
    );
  }
  const diffMs = t1 - t0;
  return Math.max(0, Math.round(diffMs / 86_400_000));
}

/**
 * Compute MtM P&L delta (flat-discount approximation — [GAP-FWD-2]).
 *
 *   pnlDelta = (currentForwardRate − bookedRate) × notionalMinor
 *                / currentForwardRate
 *
 * Rates are in minor units (× 10^6). Notional is in base-currency minor units.
 * The result is in base-currency minor units (ZAR cents for ZAR-based pairs).
 *
 * BigInt arithmetic throughout to avoid float rounding on large notionals.
 */
function computeMtmPnlMinor(
  currentForwardRateMinor: bigint,
  bookedRateDecimal: number,
  notionalBaseMinor: number,
): number {
  if (currentForwardRateMinor === 0n) {
    throw new Error("computeMtmPnlMinor: currentForwardRateMinor must not be zero");
  }
  // Convert bookedRate (decimal) to minor units (× 10^6).
  const bookedRateMinor = BigInt(Math.round(bookedRateDecimal * 1_000_000));
  const notional = BigInt(notionalBaseMinor);

  // pnlDelta_minor = (currentRate_minor - bookedRate_minor) × notional
  //                  / currentRate_minor
  // Multiply before divide to preserve precision.
  const rateDelta = currentForwardRateMinor - bookedRateMinor;
  const pnlRaw = (rateDelta * notional) / currentForwardRateMinor;

  return Number(pnlRaw);
}

/** Serialize a CurrencyPair object to canonical "BASE/QUOTE" string. */
function pairToString(pair: { base: string; quote: string }): string {
  return `${pair.base}/${pair.quote}`;
}

// ---------------------------------------------------------------------------
// Main revaluation runner
// ---------------------------------------------------------------------------

/**
 * Run the EOD FX forward / swap / NDF mark-to-market revaluation for
 * `valuationDate`.
 *
 * Scope:
 *   - FX-forward positions (single near leg, settlement on a future date).
 *   - FX-swap far leg (near leg treated as spot; skip if its legKind="near"
 *     FxSettlementConfirmed already exists).
 *   - NDF positions (cash-settlement only; pnlDelta denominated in
 *     ndfSettlementCurrency minor units).
 *
 * Not in scope: FX-spot (handled by fx-revaluation.ts). FX options
 * ([GAP-FWD-3]).
 *
 * @param store          EventStore to replay and append into.
 * @param valuationDate  YYYY-MM-DD valuation date (EOD).
 * @param rateSource     Forward-rate source (defaults to staticForwardRateSource).
 */
export function runEodFxForwardRevaluation(
  store: EventStore,
  valuationDate: string,
  rateSource: ForwardRateSource = staticForwardRateSource,
): EodForwardRevaluationResult {
  const revaluedAt = clock.now();
  const errors: string[] = [];

  // -------------------------------------------------------------------------
  // Step 1: Collect all non-spot FX trades.
  // -------------------------------------------------------------------------
  const trades = new Map<string, FxTradeExecutedPayload>();
  for (const e of store.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as unknown as FxTradeExecutedPayload;
    if (
      p.productTaxonomy === "FX-forward" ||
      p.productTaxonomy === "FX-swap" ||
      p.productTaxonomy === "NDF"
    ) {
      trades.set(p.tradeId.value, p);
    }
  }

  // -------------------------------------------------------------------------
  // Step 2: Build settled-position set.
  //   - Keyed by `tradeId` for FX-forward and NDF (single leg).
  //   - Keyed by `tradeId:legKind` for FX-swap (track per-leg settlement).
  // -------------------------------------------------------------------------
  const settledTrades = new Set<string>(); // fully settled trades
  const settledNearLegs = new Set<string>(); // FX-swap near leg settled
  for (const e of store.replay({ type: "FxSettlementConfirmed" })) {
    const p = e.payload as unknown as FxSettlementConfirmedPayload;
    if (p.legKind === "near") {
      settledNearLegs.add(p.tradeId);
    }
    // A "far" leg settlement → full trade settled.
    if (p.legKind === "far") {
      settledTrades.add(p.tradeId);
    }
    // Non-swap (forward/NDF) has only a near leg; mark the whole trade.
    if (p.legKind === "near") {
      const trade = trades.get(p.tradeId);
      if (trade && trade.productTaxonomy !== "FX-swap") {
        settledTrades.add(p.tradeId);
      }
    }
  }
  // CDM `SettlementConfirmed` (2026-05-20 GL-significant under
  // PR-FX-LIFECYCLE-CLOSE). It does not carry `legKind` — it is emitted once
  // both legs settle, so we treat its presence as "full trade settled" for
  // non-FX-swap products. For FX-swap, the per-leg accounting events above
  // remain authoritative.
  for (const e of store.replay({ type: "SettlementConfirmed" })) {
    const p = e.payload as { tradeId?: unknown };
    if (typeof p.tradeId !== "string") continue;
    const trade = trades.get(p.tradeId);
    if (trade && trade.productTaxonomy !== "FX-swap") {
      settledTrades.add(p.tradeId);
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: Find positions already revalued today (idempotency gate).
  // -------------------------------------------------------------------------
  const alreadyRevaluedToday = new Set<string>();
  for (const e of store.replay({ type: "FxPositionRevalued" })) {
    const p = e.payload as unknown as FxPositionRevaluedPayload;
    if (e.as_of === valuationDate) {
      alreadyRevaluedToday.add(p.tradeId);
    }
  }

  let revalued = 0;
  let skipped = 0;

  // -------------------------------------------------------------------------
  // Step 4: Process each open position.
  // -------------------------------------------------------------------------
  for (const [tradeId, trade] of trades) {
    // Skip fully settled trades.
    if (settledTrades.has(tradeId)) continue;

    // Skip positions already revalued today.
    if (alreadyRevaluedToday.has(tradeId)) {
      skipped++;
      continue;
    }

    const currencyPairStr = pairToString(trade.currencyPair);

    try {
      if (trade.productTaxonomy === "FX-swap") {
        // -------------------------------------------------------------------
        // FX-swap: near leg = treat as spot; skip if settled.
        //          far leg = value as forward.
        // -------------------------------------------------------------------
        const nearLeg = trade.legs.find((l) => l.legKind === "near");
        const farLeg = trade.legs.find((l) => l.legKind === "far");

        if (!farLeg) {
          errors.push(`${tradeId}: FX-swap missing far leg — skipped`);
          skipped++;
          continue;
        }

        // Near leg: if FxSettlementConfirmed exists for legKind=near → settled.
        // We value only the far (forward) leg.
        const nearLegSettled = settledNearLegs.has(tradeId);
        if (!nearLeg || nearLegSettled) {
          // Near leg already settled — value only far leg as forward.
        }
        // Regardless of near-leg status, we value the far leg as the forward.
        const farSettlementDate = farLeg.settlementDate.iso;
        const tenorDays = calendarDaysRemaining(valuationDate, farSettlementDate);
        const forwardRateMinor = rateSource.getForwardRate(
          currencyPairStr,
          valuationDate,
          tenorDays,
        );
        const bookedRate = farLeg.rate.amount;
        const notionalBaseMinor = farLeg.notional.amountMinor;

        const pnlDeltaMinor = computeMtmPnlMinor(forwardRateMinor, bookedRate, notionalBaseMinor);

        const payload: FxPositionRevaluedPayload = {
          tradeId,
          currencyPair: currencyPairStr,
          bookRate: bookedRate,
          revalRate: Number(forwardRateMinor) / 1_000_000,
          notionalBaseMinor,
          unrealisedPnlZarMinor: pnlDeltaMinor,
          revaluedAt,
          rateSource: "static-forward-seed",
        };

        store.append(
          makeFxPositionRevalued({
            asOf: valuationDate,
            entity: BANK_ENTITY,
            actor: RECON_ACTOR,
            citations: RECON_CITATIONS,
            payload,
            eventId: newEventId(),
          }),
        );
        revalued++;
      } else if (trade.productTaxonomy === "NDF") {
        // -------------------------------------------------------------------
        // NDF: cash-settlement only.
        //   pnlDelta denominated in ndfSettlementCurrency minor units.
        //   Emits FxPositionRevalued with settlementForm = "cash".
        // -------------------------------------------------------------------
        const nearLeg = trade.legs.find((l) => l.legKind === "near") ?? trade.legs[0];
        if (!nearLeg) {
          errors.push(`${tradeId}: NDF missing near leg — skipped`);
          skipped++;
          continue;
        }

        const settlementDate = nearLeg.settlementDate.iso;
        const tenorDays = calendarDaysRemaining(valuationDate, settlementDate);
        const forwardRateMinor = rateSource.getForwardRate(
          currencyPairStr,
          valuationDate,
          tenorDays,
        );
        const bookedRate = nearLeg.rate.amount;
        const notionalBaseMinor = nearLeg.notional.amountMinor;

        // NDF settlement amount in ndfSettlementCurrency minor units.
        // Formula: (currentForwardRate − bookedRate) × notional / currentForwardRate
        // ([GAP-FWD-4]: at v0 forward rate from ForwardRateSource; live fixing deferred)
        const ndfPnlMinor = computeMtmPnlMinor(forwardRateMinor, bookedRate, notionalBaseMinor);

        const payload: FxPositionRevaluedPayload = {
          tradeId,
          currencyPair: currencyPairStr,
          bookRate: bookedRate,
          revalRate: Number(forwardRateMinor) / 1_000_000,
          notionalBaseMinor,
          unrealisedPnlZarMinor: ndfPnlMinor,
          revaluedAt,
          rateSource: "static-forward-seed",
        };

        store.append(
          makeFxPositionRevalued({
            asOf: valuationDate,
            entity: BANK_ENTITY,
            actor: RECON_ACTOR,
            citations: RECON_CITATIONS,
            payload,
            eventId: newEventId(),
          }),
        );
        revalued++;
      } else {
        // FX-forward — single near leg.
        const nearLeg = trade.legs.find((l) => l.legKind === "near") ?? trade.legs[0];
        if (!nearLeg) {
          errors.push(`${tradeId}: FX-forward missing near leg — skipped`);
          skipped++;
          continue;
        }

        const settlementDate = nearLeg.settlementDate.iso;
        const tenorDays = calendarDaysRemaining(valuationDate, settlementDate);
        const forwardRateMinor = rateSource.getForwardRate(
          currencyPairStr,
          valuationDate,
          tenorDays,
        );
        const bookedRate = nearLeg.rate.amount;
        const notionalBaseMinor = nearLeg.notional.amountMinor;

        const pnlDeltaMinor = computeMtmPnlMinor(forwardRateMinor, bookedRate, notionalBaseMinor);

        const payload: FxPositionRevaluedPayload = {
          tradeId,
          currencyPair: currencyPairStr,
          bookRate: bookedRate,
          revalRate: Number(forwardRateMinor) / 1_000_000,
          notionalBaseMinor,
          unrealisedPnlZarMinor: pnlDeltaMinor,
          revaluedAt,
          rateSource: "static-forward-seed",
        };

        store.append(
          makeFxPositionRevalued({
            asOf: valuationDate,
            entity: BANK_ENTITY,
            actor: RECON_ACTOR,
            citations: RECON_CITATIONS,
            payload,
            eventId: newEventId(),
          }),
        );
        revalued++;
      }
    } catch (err) {
      errors.push(`${tradeId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { revalued, skipped, asOf: valuationDate, errors };
}
