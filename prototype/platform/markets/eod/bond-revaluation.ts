// platform/markets/eod/bond-revaluation.ts
//
// EOD mark-to-market revaluation for trading-book JSE bond positions.
//
// Pattern mirrors irs-revaluation.ts exactly:
//   1. Replay BondTradeExecuted → collect all bond trades.
//   2. Replay BondMatured + BondSold → exclude closed positions.
//   3. Replay BondPositionRevalued by (tradeId, revalDate) → idempotency gate.
//   4. For each live trading-book position:
//      a. Query MarketDataStore for the latest jse-debt bond-price tick for the
//         bond's ISIN (production provenance; falls back to simulated if no
//         production tick is available).
//      b. If no tick available, record a skip reason and continue.
//      c. Compute accrued interest using accruedInterestZarMinor (ACT/365,
//         semi-annual SA convention per JSE-RULES-BONDS).
//      d. Compute dirty price = cleanPrice × nominalMinor / 100 + accruedInterest.
//      e. Compute unrealised P&L = current dirty value − cost at booking
//         (original dirtyPricePercent × nominalMinor / 100 from BondTradeExecuted).
//      f. Emit BondPositionRevalued.
//   5. Return EodBondRevaluationResult.
//
// Substrate gaps (v0):
//   [GAP-BOND-1] Bond-price feed is the build-phase fixture (jse-debt / "production"
//                provenance fixture ticks). Production JSE Debt Market live feed is
//                sequenced post-licence.
//   [GAP-BOND-2] Unrealised P&L is vs booking dirty price; no carrying-amount
//                accumulation across revaluations (EIR amortisation not folded here).
//   [GAP-BOND-3] Banking-book bonds excluded — they are measured at amortised cost
//                (IFRS 9 §4.1.2), not FVTPL; BondPositionRevalued is trading-book only.
//
// Authority:
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved 2026-05-07)
//   IFRS-9-§5.7.1 (FVTPL: fair-value changes through P&L — trading book only)
//   JSE-RULES-BONDS (clean-price quotation, ACT/365 semi-annual)
//   D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22) Slice 10
//
// Author: Rohan (Market risk engineer, engineering)

import { newEventId } from "../../core/types";
import {
  type BondSoldPayload,
  type BondTradeExecutedPayload,
  makeBondPositionRevalued,
} from "../../event-store/event-types/bond-accounting";
import type { EventStore } from "../../event-store/store";
import type { MarketDataStore } from "../../market-data/store";
import { MarketDataSources } from "../../market-data/types";
import { accruedInterestZarMinor } from "../../markets/reference/sa-bond-reference";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type EodBondRevaluationResult = {
  /** Number of trading-book bond positions where BondPositionRevalued was emitted. */
  revalued: number;
  /** Number of positions skipped (already revalued today, matured/sold, no price tick). */
  skipped: number;
  /** ISO 8601 date this run covered. */
  asOf: string;
  /** Sum of unrealised P&L across all revalued positions (ZAR minor units). */
  totalUnrealisedPnlZarMinor: number;
  /** Descriptive skip reasons — fed into MtmRunCompleted.skippedReasons[]. */
  skipReasons: string[];
  /** Any non-fatal errors encountered per tradeId. */
  errors: string[];
};

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const REVAL_CITATIONS = [
  "IFRS-9-§5.7.1",
  "D-MARKETS-SCHEMA-FOUNDATION",
  "D-FINANCIAL-INSTRUMENT-ENTITY",
  "JSE-RULES-BONDS",
];

const REVAL_ACTOR = {
  type: "service" as const,
  id: "rohan:eod-bond-revaluation",
};

const BANK_ENTITY = "LE-ZA-HOZ-BANK";

// ---------------------------------------------------------------------------
// Main revaluation runner
// ---------------------------------------------------------------------------

/**
 * Run EOD bond mark-to-market revaluation for `revalDate`.
 *
 * Only trading-book positions are revalued (FVTPL per IFRS 9 §4.1.4).
 * Banking-book bonds remain at amortised cost and are excluded.
 *
 * @param store      EventStore to replay and append into.
 * @param mdStore    MarketDataStore to resolve bond-price ticks from.
 * @param revalDate  YYYY-MM-DD revaluation date (EOD).
 */
export function runEodBondRevaluation(
  store: EventStore,
  mdStore: MarketDataStore,
  revalDate: string,
): EodBondRevaluationResult {
  const skipReasons: string[] = [];
  const errors: string[] = [];

  // -------------------------------------------------------------------------
  // Step 1: Collect all bond trades.
  // -------------------------------------------------------------------------
  const trades = new Map<string, BondTradeExecutedPayload>();
  for (const e of store.replay({ type: "BondTradeExecuted" })) {
    const p = e.payload as unknown as BondTradeExecutedPayload;
    trades.set(p.tradeId, p);
  }

  if (trades.size === 0) {
    return {
      revalued: 0,
      skipped: 0,
      asOf: revalDate,
      totalUnrealisedPnlZarMinor: 0,
      skipReasons: [],
      errors: [],
    };
  }

  // -------------------------------------------------------------------------
  // Step 2: Track matured and sold positions.
  // -------------------------------------------------------------------------
  const closedTradeIds = new Set<string>();

  for (const e of store.replay({ type: "BondMatured" })) {
    const p = e.payload as unknown as { tradeId: string };
    if (p.tradeId) closedTradeIds.add(p.tradeId);
  }

  for (const e of store.replay({ type: "BondSold" })) {
    const p = e.payload as unknown as BondSoldPayload;
    if (p.tradeId) closedTradeIds.add(p.tradeId);
  }

  // -------------------------------------------------------------------------
  // Step 3: Find positions already revalued today (idempotency gate).
  // -------------------------------------------------------------------------
  const alreadyRevaluedToday = new Set<string>();
  for (const e of store.replay({ type: "BondPositionRevalued" })) {
    const p = e.payload as unknown as { tradeId: string; revalDate: string };
    if (p.revalDate === revalDate) {
      alreadyRevaluedToday.add(p.tradeId);
    }
  }

  let revalued = 0;
  let skipped = 0;
  let totalUnrealisedPnlZarMinor = 0;

  // -------------------------------------------------------------------------
  // Step 4: Process each live trading-book position.
  // -------------------------------------------------------------------------
  for (const [tradeId, trade] of trades) {
    // Skip closed positions (matured or sold).
    if (closedTradeIds.has(tradeId)) {
      skipped++;
      continue;
    }

    // Only trading-book positions are FVTPL-revalued.
    if (trade.portfolio !== "trading-book") {
      skipped++;
      continue;
    }

    // Skip matured bonds (maturity date ≤ revaluation date).
    if (trade.maturityDate <= revalDate) {
      skipped++;
      continue;
    }

    // Skip already revalued today (idempotent).
    if (alreadyRevaluedToday.has(tradeId)) {
      skipped++;
      continue;
    }

    try {
      const isin = trade.bondIsin;

      // -----------------------------------------------------------------------
      // Resolve clean price from MarketDataStore.
      // Try production first, then simulated as a fallback.
      // -----------------------------------------------------------------------
      let tick = mdStore.getLatest(
        MarketDataSources.JSE_DEBT,
        isin,
        undefined,
        "production", // provenance: production-only for valuation (jse-debt is exchange-grade)
      );

      // Fallback to simulated (bond-sim) if no production tick available.
      // [GAP-BOND-1]: production JSE Debt Market live feed is sequenced post-licence;
      // the build-phase fixture is tagged production, but bond-sim provides a continuous
      // intraday walk for live positions when no fixture tick is available.
      if (!tick) {
        tick = mdStore.getLatest(
          MarketDataSources.BOND_SIM,
          isin,
          undefined,
          "simulated", // provenance: simulated — fallback when no production tick
        );
      }

      if (!tick) {
        const reason = `bond MTM: no price tick for ISIN ${isin} (tradeId ${tradeId}) — no jse-debt or bond-sim tick in store`;
        if (!skipReasons.includes(reason)) skipReasons.push(reason);
        skipped++;
        continue;
      }

      const cleanPriceStr = tick.payload.cleanPrice;
      if (typeof cleanPriceStr !== "string" && typeof cleanPriceStr !== "number") {
        const reason = `bond MTM: price tick for ${isin} has no usable cleanPrice field`;
        if (!skipReasons.includes(reason)) skipReasons.push(reason);
        skipped++;
        continue;
      }

      const currentCleanPricePercent = Number(cleanPriceStr);
      if (!Number.isFinite(currentCleanPricePercent) || currentCleanPricePercent <= 0) {
        const reason = `bond MTM: price tick for ${isin} has invalid cleanPrice "${cleanPriceStr}"`;
        if (!skipReasons.includes(reason)) skipReasons.push(reason);
        skipped++;
        continue;
      }

      // -----------------------------------------------------------------------
      // Compute accrued interest (ACT/365, SA semi-annual convention).
      // -----------------------------------------------------------------------
      const accruedInterestMinor = accruedInterestZarMinor(isin, trade.nominalMinor, revalDate);

      // -----------------------------------------------------------------------
      // Compute current dirty value in minor units:
      //   dirtyValue = nominalMinor × currentCleanPricePercent / 100 + accruedInterest
      // -----------------------------------------------------------------------
      const currentDirtyValueMinor = Math.round(
        (trade.nominalMinor * currentCleanPricePercent) / 100 + accruedInterestMinor,
      );

      // -----------------------------------------------------------------------
      // Compute booking dirty value (cost basis at trade execution):
      //   bookingDirtyValue = nominalMinor × dirtyPricePercent / 100
      // -----------------------------------------------------------------------
      const bookingDirtyValueMinor = Math.round(
        (trade.nominalMinor * trade.dirtyPricePercent) / 100,
      );

      // -----------------------------------------------------------------------
      // Unrealised P&L: positive = gain, negative = loss.
      // For a "buy" position: gain when current value > booking cost.
      // For a "sell" position: gain when current value < booking cost (short).
      // -----------------------------------------------------------------------
      const sideSign = trade.side === "buy" ? 1 : -1;
      const unrealisedPnlZarMinor = sideSign * (currentDirtyValueMinor - bookingDirtyValueMinor);

      // -----------------------------------------------------------------------
      // Emit BondPositionRevalued.
      // -----------------------------------------------------------------------
      store.append(
        makeBondPositionRevalued({
          asOf: revalDate,
          entity: BANK_ENTITY,
          actor: REVAL_ACTOR,
          citations: REVAL_CITATIONS,
          payload: {
            tradeId,
            bondIsin: isin,
            revalDate,
            bookCleanPricePercent: trade.cleanPricePercent,
            currentCleanPricePercent,
            unrealisedPnlZarMinor,
            currency: trade.currency,
          },
          eventId: newEventId(),
        }),
      );

      revalued++;
      totalUnrealisedPnlZarMinor += unrealisedPnlZarMinor;
    } catch (err) {
      errors.push(`${tradeId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    revalued,
    skipped,
    asOf: revalDate,
    totalUnrealisedPnlZarMinor,
    skipReasons,
    errors,
  };
}
