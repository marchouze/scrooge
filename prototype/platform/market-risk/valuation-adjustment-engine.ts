// platform/market-risk/valuation-adjustment-engine.ts
//
// Valuation-adjustment / prudent-valuation reserve framework (MVP).
//
// Generalises the single-purpose CVA engine (market-risk/cva-engine.ts) into a
// reserve framework that computes, per adjustment category, a ZAR-minor reserve
// figure routed through the no-silent-zero `FinancialInput` contract, and rolls
// them up into the prudent-valuation AVA umbrella (CRR Art 105 / SA-Basel
// prudent-valuation equivalent). The reserve total is consumable by daily P&L.
//
// ADJUSTMENT CATEGORIES (MVP):
//   - close-out-bid-offer — the cost of unwinding each live position at the
//     bid/offer rather than mid. Most material for the FX-spot book. Computed
//     per instrument as (half-spread fraction by pair) × |ZAR position notional|.
//     The half-spread fraction is a LOUD requireWeight lookup by canonical pair
//     — an unknown pair fails, never a silent 0% spread that zeroes the reserve.
//   - day-1-deferral — the sum of |deferred day-1 P&L| over recorded Level-3
//     deferrals (Day1PnLDeferralRecorded events). A Level-3 (unobservable) mark
//     whose initial measurement gain/loss has not been observably confirmed is
//     held as a reserve, not recognised in P&L (IFRS 13 B5.1.2A).
//   - cva — folded straight from the existing CVA engine (computeCva). Its maths
//     are NOT rewritten here; this engine only adapts its CvaReport into the
//     adjustment shape and propagates its loud no-silent-zero status.
//   - market-price-uncertainty — the CRR Art 105(10) market-price-uncertainty
//     AVA, fed from IPV variances (IpvExceptionRaised.divergenceZar). Where no
//     IPV variance data exists the category is ABSENT (not 0).
//
// NO SILENT ZEROS (objective 4 of D-TRUSTED-FIGURES-PROGRAM-V1): each category
// is a `FinancialInput<number>` — present with lineage, or absent with a reason
// + where it was expected from. A category that cannot be computed is excluded
// from the AVA umbrella total (recorded as absent), never folded in as a 0.
//
// THE AVA UMBRELLA (prudent-valuation): the umbrella ALWAYS exists and sums the
// populated categories. Even when only close-out (+ CVA, + day-1) populate, the
// total is their additive sum and the absent categories (model-risk,
// concentration, and market-price-uncertainty when no IPV data) are recorded.
//
// Authority:
//   - Camille (CFO) recommendation R2 (valuation-adjustment / reserve framework)
//   - IFRS 13 (fair-value measurement; day-1 P&L; fair-value hierarchy)
//   - accounting-policies-ifrs-v1 §3.3; valuation-policy-v1 §7
//   - CRR Art 105 / SA-Basel prudent-valuation equivalent (AVA framework)
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (no silent zero)
//   - D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 5 (CVA engine reused)
//
// Author: Rohan (Risk engineer, engineering), under
//   brief:rohan:valuation-adjustment-prudent-valuation-reserve-f:2026-05-31
//   (WS-PRODUCT-CONTROL).

import { newEventId, nowUtc } from "../core/types";
import {
  type AvaCategoryLine,
  type Ifrs13Level,
  type ValuationAdjustmentType,
  makePrudentValuationAvaAggregated,
  makeValuationAdjustmentComputed,
} from "../event-store/event-types/valuation-adjustment";
import type { EventStore } from "../event-store/store";
import { toCanonicalPair } from "../market-data/canonical-pair";
import type { MarketDataStore } from "../market-data/store";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import {
  type FinancialInput,
  absent,
  isPresent,
  present,
  requireWeight,
} from "../types/financial-input";
import { computeCva } from "./cva-engine";

// ---------------------------------------------------------------------------
// Constants — documented build-phase reserve parameters.
// ---------------------------------------------------------------------------

/**
 * Close-out half-spread fraction by canonical currency pair. The reserve for a
 * position is (half-spread) × |ZAR notional| — the cost of crossing half the
 * bid/offer to unwind at mid. A documented build-phase substitute for live
 * desk bid/offer quotes (a licence-day extension feeds these from the live
 * order book). A LOUD requireWeight lookup — an unknown pair FAILS rather than
 * silently weighting the close-out reserve at 0% and under-stating it.
 *
 * These are conservative liquid-G10/ZAR half-spreads (a few bps of notional).
 */
const CLOSE_OUT_HALF_SPREAD_BY_PAIR: Readonly<Record<string, number>> = {
  "USD/ZAR": 0.0005, // 5 bps
  "EUR/ZAR": 0.0006, // 6 bps
  "GBP/ZAR": 0.0007, // 7 bps
  "EUR/USD": 0.0002, // 2 bps (liquid major)
  "GBP/USD": 0.0003, // 3 bps
};

/** Engine identity / lineage constants. */
const ENGINE_ID = "valuation-adjustment-engine-v1";
const ENGINE_ACTOR_ID = "agent:valuation-adjustment-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One adjustment category result — a FinancialInput plus its scope + IFRS level. */
export interface AdjustmentResult {
  readonly adjustmentType: ValuationAdjustmentType;
  /** The reserve magnitude in ZAR minor (positive deduction), or absent. */
  readonly amount: FinancialInput<number>;
  readonly instrumentScope: string;
  readonly ifrs13Level: Ifrs13Level;
}

export interface ValuationAdjustmentReport {
  readonly valuationDate: string;
  readonly currency: string;
  /** Per-category adjustment results (present + absent), in canonical order. */
  readonly adjustments: readonly AdjustmentResult[];
  /**
   * The prudent-valuation AVA umbrella total in ZAR minor — the SUM of the
   * present categories only. Absent categories are excluded (never a silent 0).
   * Always present: an all-absent universe yields a present total of 0 with a
   * lineage noting nothing populated (the umbrella exists even when empty).
   */
  readonly totalAva: FinancialInput<number>;
  /** AVA umbrella category lines (event-ready). */
  readonly avaCategories: readonly AvaCategoryLine[];
}

// ---------------------------------------------------------------------------
// Close-out / bid-offer reserve
// ---------------------------------------------------------------------------

interface LivePosition {
  readonly tradeId: string;
  readonly pairKey: string;
  readonly zarNotionalMinor: number;
}

/**
 * Derive the live (open, unsettled, uncancelled) FX-spot positions with their
 * ZAR notional. Mirrors the daily-pnl live-position fold: a position is live
 * when it has an FxTradeExecuted and neither TradeMatured/SettlementConfirmed
 * nor FxTradeCancelled. Spot only (the close-out reserve's primary book).
 */
export function deriveLiveFxSpotPositions(args: {
  readonly eventStore: EventStore;
  readonly asOf: string;
}): LivePosition[] {
  const { eventStore, asOf } = args;
  const bound = { asOf };

  const closedIds = new Set<string>();
  for (const e of eventStore.replay({ type: "TradeMatured", ...bound })) {
    const p = e.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string") closedIds.add(p.tradeId);
  }
  for (const e of eventStore.replay({ type: "SettlementConfirmed", ...bound })) {
    const p = e.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string") closedIds.add(p.tradeId);
  }
  const cancelledIds = new Set<string>();
  try {
    for (const e of eventStore.replay({ type: "FxTradeCancelled", ...bound })) {
      const p = e.payload as { tradeId?: string | { value?: string } };
      const tid = p.tradeId;
      const idStr =
        typeof tid === "object" && tid !== null && "value" in tid
          ? (tid.value ?? "")
          : String(tid ?? "");
      if (idStr) cancelledIds.add(idStr);
    }
  } catch {
    // FxTradeCancelled not registered — silently continue (graceful, mirrors daily-pnl).
  }

  const positions: LivePosition[] = [];
  for (const e of eventStore.replay({ type: "FxTradeExecuted", ...bound })) {
    const fx = e.payload as unknown as FxTradeExecutedPayload;
    if (fx.productTaxonomy !== "FX-spot") continue; // close-out MVP scope: spot book
    const tradeId = fx.tradeId.value;
    if (closedIds.has(tradeId) || cancelledIds.has(tradeId)) continue;
    // ZAR notional: the leg whose currency is ZAR (notional or counterNotional).
    let zarNotionalMinor = 0;
    for (const leg of fx.legs) {
      if (leg.notional.currency === "ZAR") {
        zarNotionalMinor = Math.max(zarNotionalMinor, Math.abs(leg.notional.amountMinor));
      }
      if (leg.counterNotional.currency === "ZAR") {
        zarNotionalMinor = Math.max(zarNotionalMinor, Math.abs(leg.counterNotional.amountMinor));
      }
    }
    const { pairKey } = toCanonicalPair(fx.currencyPair.base, fx.currencyPair.quote);
    positions.push({ tradeId, pairKey, zarNotionalMinor });
  }
  return positions;
}

/**
 * Compute the close-out / bid-offer reserve over the live FX-spot book. Per
 * position: (half-spread by pair) × |ZAR notional|. A LOUD requireWeight lookup
 * on the pair — an unknown pair throws, so the position is routed into the
 * absent path (the whole reserve degrades, never a silent 0% spread). No live
 * positions ⟹ absent (reserve is 0 by absence of exposure, surfaced loudly).
 */
export function computeCloseOutReserve(args: {
  readonly eventStore: EventStore;
  readonly asOf: string;
}): AdjustmentResult {
  const positions = deriveLiveFxSpotPositions(args);
  const scope = "live FX-spot book (open, uncancelled, unsettled positions)";

  if (positions.length === 0) {
    return {
      adjustmentType: "close-out-bid-offer",
      amount: absent(
        "no live FX-spot positions — close-out reserve is 0 by absence of exposure",
        "live FX-spot book (FxTradeExecuted minus TradeMatured / SettlementConfirmed / FxTradeCancelled)",
      ),
      instrumentScope: scope,
      ifrs13Level: "level-2",
    };
  }

  let reserveMinor = 0;
  const unpriceable: string[] = [];
  for (const pos of positions) {
    let halfSpread: number;
    try {
      halfSpread = requireWeight(
        CLOSE_OUT_HALF_SPREAD_BY_PAIR,
        pos.pairKey,
        "close-out half-spread",
      );
    } catch {
      // Unknown pair — no documented spread. Routed into the absent path rather
      // than a silent 0% spread that would under-state the reserve.
      unpriceable.push(`${pos.tradeId} (${pos.pairKey})`);
      continue;
    }
    reserveMinor += Math.round(halfSpread * pos.zarNotionalMinor);
  }

  if (unpriceable.length > 0) {
    return {
      adjustmentType: "close-out-bid-offer",
      amount: absent(
        `close-out reserve degraded — no documented half-spread for ${unpriceable.join(", ")}; a 0% spread would silently under-state the reserve`,
        "CLOSE_OUT_HALF_SPREAD_BY_PAIR (documented build-phase half-spreads) or a live desk bid/offer quote",
      ),
      instrumentScope: scope,
      ifrs13Level: "level-2",
    };
  }

  return {
    adjustmentType: "close-out-bid-offer",
    amount: present(
      reserveMinor,
      `Σ (half-spread by pair) × |ZAR notional| over ${positions.length} live FX-spot position(s); ${ENGINE_ID}`,
    ),
    instrumentScope: scope,
    ifrs13Level: "level-2",
  };
}

// ---------------------------------------------------------------------------
// Day-1 P&L deferral reserve
// ---------------------------------------------------------------------------

/**
 * Sum |deferred day-1 P&L| over recorded Level-3 deferrals
 * (Day1PnLDeferralRecorded). Latest deferral per (instrumentId) wins. No
 * deferrals ⟹ absent (no Level-3 day-1 deferrals recorded — not a silent 0).
 */
export function computeDay1DeferralReserve(args: {
  readonly eventStore: EventStore;
  readonly asOf: string;
}): AdjustmentResult {
  const { eventStore, asOf } = args;
  const scope = "Level-3 (unobservable) marks with a deferred initial measurement gain/loss";

  const latestByInstrument = new Map<string, number>(); // instrumentId → day1PnlZarMinor
  for (const e of eventStore.replay({ type: "Day1PnLDeferralRecorded", asOf })) {
    const p = e.payload as { instrumentId?: unknown; day1PnlZarMinor?: unknown };
    if (typeof p.instrumentId === "string" && typeof p.day1PnlZarMinor === "number") {
      // replay() is ascending sequence order — last write wins per instrument.
      latestByInstrument.set(p.instrumentId, p.day1PnlZarMinor);
    }
  }

  if (latestByInstrument.size === 0) {
    return {
      adjustmentType: "day-1-deferral",
      amount: absent(
        "no Level-3 day-1 P&L deferrals recorded — day-1 deferral reserve is 0 by absence of Level-3 marks",
        "Day1PnLDeferralRecorded events (IFRS 13 B5.1.2A Level-3 initial-measurement deferrals)",
      ),
      instrumentScope: scope,
      ifrs13Level: "level-3",
    };
  }

  let reserveMinor = 0;
  for (const day1 of latestByInstrument.values()) {
    reserveMinor += Math.abs(day1);
  }
  return {
    adjustmentType: "day-1-deferral",
    amount: present(
      reserveMinor,
      `Σ |deferred day-1 P&L| over ${latestByInstrument.size} Level-3 deferral(s); IFRS 13 B5.1.2A`,
    ),
    instrumentScope: scope,
    ifrs13Level: "level-3",
  };
}

// ---------------------------------------------------------------------------
// CVA — folded from the existing CVA engine (maths NOT rewritten)
// ---------------------------------------------------------------------------

/**
 * Adapt the CVA engine's CvaReport into an adjustment result. The CVA maths are
 * owned by cva-engine.ts — this only maps the report and propagates its loud
 * no-silent-zero status: `computed` ⟹ present; any other status ⟹ absent with
 * the engine's own reason.
 */
export function computeCvaAdjustment(args: {
  readonly eventStore: EventStore;
  readonly marketData: MarketDataStore;
  readonly asOf: string;
}): AdjustmentResult {
  const { eventStore, marketData, asOf } = args;
  const report = computeCva({ eventStore, marketData, asOf });
  const scope = "uncollateralised OTC derivative book (IRS + FX forward/swap)";

  if (isPresent(report.cva)) {
    // CVA is a ZAR major-unit magnitude in the report — convert to minor.
    const reserveMinor = Math.round(report.cva.value * 100);
    return {
      adjustmentType: "cva",
      amount: present(
        reserveMinor,
        `CVA folded from cva-engine (status=computed): ${report.cva.lineage}`,
      ),
      instrumentScope: scope,
      ifrs13Level: "level-2",
    };
  }
  return {
    adjustmentType: "cva",
    amount: absent(report.cva.reason, report.cva.expectedFrom),
    instrumentScope: scope,
    ifrs13Level: "level-2",
  };
}

// ---------------------------------------------------------------------------
// Market-price-uncertainty AVA — fed from IPV variances
// ---------------------------------------------------------------------------

/**
 * Market-price-uncertainty AVA (CRR Art 105(10)) from IPV variances: the sum of
 * |divergenceZar| over IpvExceptionRaised events (latest per positionId). Where
 * no IPV variance data exists the category is ABSENT (not 0) — the linkage that
 * recon:valuation-adjustment-additive asserts.
 */
export function computeMarketPriceUncertaintyAva(args: {
  readonly eventStore: EventStore;
  readonly asOf: string;
}): AdjustmentResult {
  const { eventStore, asOf } = args;
  const scope = "marked positions with an IPV (independent price verification) variance";

  const latestByPosition = new Map<string, number>(); // positionId → divergenceZar
  for (const e of eventStore.replay({ type: "IpvExceptionRaised", asOf })) {
    const p = e.payload as { positionId?: unknown; divergenceZar?: unknown };
    if (typeof p.positionId === "string" && typeof p.divergenceZar === "number") {
      latestByPosition.set(p.positionId, p.divergenceZar);
    }
  }

  if (latestByPosition.size === 0) {
    return {
      adjustmentType: "market-price-uncertainty",
      amount: absent(
        "no IPV variance data — market-price-uncertainty AVA is absent (not 0); it activates once IPV exceptions are raised",
        "IpvExceptionRaised events (divergenceZar — independent price-verification variances)",
      ),
      instrumentScope: scope,
      ifrs13Level: "level-2",
    };
  }

  let avaZar = 0;
  for (const divZar of latestByPosition.values()) {
    avaZar += Math.abs(divZar);
  }
  return {
    adjustmentType: "market-price-uncertainty",
    amount: present(
      Math.round(avaZar * 100),
      `Σ |IPV divergence| over ${latestByPosition.size} position(s); CRR Art 105(10) market-price-uncertainty AVA`,
    ),
    instrumentScope: scope,
    ifrs13Level: "level-2",
  };
}

// ---------------------------------------------------------------------------
// Declared-but-not-yet-eventised AVA categories
// ---------------------------------------------------------------------------

/** Model-risk + concentration AVAs — declared, no eventised input yet ⟹ absent. */
function declaredAbsentAva(
  adjustmentType: ValuationAdjustmentType,
  label: string,
  expectedFrom: string,
): AdjustmentResult {
  return {
    adjustmentType,
    amount: absent(
      `${label} AVA has no eventised input yet — recorded as absent (not 0) until its substrate lands`,
      expectedFrom,
    ),
    instrumentScope: "(not yet scoped — substrate gap)",
    ifrs13Level: "mixed",
  };
}

// ---------------------------------------------------------------------------
// AVA umbrella aggregation
// ---------------------------------------------------------------------------

/**
 * Compute the full valuation-adjustment report: every category as a
 * FinancialInput, plus the prudent-valuation AVA umbrella summing the present
 * categories only. Pure read — no appends. The umbrella ALWAYS exists: an
 * all-absent universe yields a present total of 0 with a lineage noting nothing
 * populated.
 */
export function computeValuationAdjustments(args: {
  readonly eventStore: EventStore;
  readonly marketData: MarketDataStore;
  readonly asOf: string;
}): ValuationAdjustmentReport {
  const { eventStore, marketData, asOf } = args;

  const adjustments: AdjustmentResult[] = [
    computeCloseOutReserve({ eventStore, asOf }),
    computeDay1DeferralReserve({ eventStore, asOf }),
    computeCvaAdjustment({ eventStore, marketData, asOf }),
    computeMarketPriceUncertaintyAva({ eventStore, asOf }),
    declaredAbsentAva(
      "model-risk",
      "model-risk",
      "a model-uncertainty AVA input event (not yet eventised — substrate gap)",
    ),
    declaredAbsentAva(
      "concentration",
      "concentration",
      "a concentrated-position AVA input event (not yet eventised — substrate gap)",
    ),
  ];

  // AVA umbrella: sum the present categories only; record the absent ones.
  const avaCategories: AvaCategoryLine[] = adjustments.map((a) => {
    if (isPresent(a.amount)) {
      return {
        adjustmentType: a.adjustmentType,
        present: true,
        amountZarMinor: a.amount.value,
      };
    }
    return {
      adjustmentType: a.adjustmentType,
      present: false,
      amountZarMinor: 0,
      absentReason: a.amount.reason,
    };
  });

  const populated = avaCategories.filter((c) => c.present);
  const totalAvaMinor = populated.reduce((s, c) => s + c.amountZarMinor, 0);
  const totalAva: FinancialInput<number> =
    populated.length > 0
      ? present(
          totalAvaMinor,
          `prudent-valuation AVA umbrella: Σ over ${populated.length} populated AVA categor(y/ies) [${populated
            .map((c) => c.adjustmentType)
            .join(", ")}]; CRR Art 105 / valuation-policy-v1 §7`,
        )
      : // No category populated — the umbrella still exists and sums to 0; this
        // is a present 0 (an explicit "nothing populated yet"), accompanied by
        // the absent category reasons on avaCategories, NOT a silent figure.
        present(
          0,
          "prudent-valuation AVA umbrella: no AVA category populated yet — total 0 by absence; absent categories recorded on the umbrella",
        );

  return {
    valuationDate: asOf,
    currency: "ZAR",
    adjustments,
    totalAva,
    avaCategories,
  };
}

// ---------------------------------------------------------------------------
// Engine identity (for callers wiring CalculationPerformed / events)
// ---------------------------------------------------------------------------

export const VALUATION_ADJUSTMENT_ENGINE = {
  id: ENGINE_ID,
  actorId: ENGINE_ACTOR_ID,
} as const;

// ---------------------------------------------------------------------------
// Run wrapper (append) — mirrors runDailyPnLReport / runPnLAttribution
// ---------------------------------------------------------------------------

const BANK_ENTITY = "LE-ZA-HOZ-BANK";
const ENGINE_ACTOR = {
  type: "service" as const,
  id: ENGINE_ACTOR_ID,
};
const CITATIONS = [
  "D-TRUSTED-FIGURES-PROGRAM-V1",
  "IFRS-13",
  "valuation-policy-v1-§7",
  "CRR-Art-105",
];

/**
 * Run the valuation-adjustment / prudent-valuation reserve engine for
 * `clockNow`'s date: compute the per-category adjustments + the AVA umbrella
 * (pure read) and APPEND the resulting events:
 *
 *   - one `ValuationAdjustmentComputed` per adjustment category (close-out,
 *     day-1-deferral, CVA, market-price-uncertainty, model-risk, concentration);
 *   - one `PrudentValuationAvaAggregated` umbrella event summing the populated
 *     categories (no-silent-zero — absent categories recorded, never folded as 0).
 *
 * `Day1PnLDeferralRecorded` is the INPUT to the day-1 reserve (recorded upstream
 * when a Level-3 mark is taken), not an output of this run — the engine reads
 * those events, it does not synthesise them, so this wrapper does not emit them.
 *
 * The CVA category needs a `MarketDataStore`. The handler passes the same store
 * it already opened (from `BANK_MARKET_DATA_DB`); when unavailable the caller may
 * pass a throwaway in-memory store — the CVA category then degrades to absent
 * loudly (no silent 0), which is the correct no-mark posture.
 *
 * Returns the number of events appended so the caller can fold it into its run
 * summary.
 *
 * Authority: Camille (CFO) recommendation R2; IFRS 13; valuation-policy-v1 §7;
 *   CRR Art 105 / SA-Basel prudent-valuation equivalent; D-TRUSTED-FIGURES-PROGRAM-V1.
 * Author: Rohan (Risk engineer, engineering).
 */
export function runValuationAdjustments(
  store: EventStore,
  clockNow: () => string,
  marketData: MarketDataStore,
): number {
  const asOf = clockNow();
  const valuationDate = asOf.slice(0, 10);
  const report = computeValuationAdjustments({ eventStore: store, marketData, asOf });
  const computedAt = nowUtc();

  let eventsEmitted = 0;

  // One ValuationAdjustmentComputed per category — present carries the value;
  // absent carries amount 0 with `complete:false` + the absentReason so a
  // consumer cannot read the 0 as a real figure (no-silent-zero contract).
  for (const adj of report.adjustments) {
    const amount = adj.amount;
    const complete = isPresent(amount);
    store.append(
      makeValuationAdjustmentComputed({
        asOf: valuationDate,
        entity: BANK_ENTITY,
        actor: ENGINE_ACTOR,
        citations: CITATIONS,
        payload: {
          adjustmentId: `vadj:${adj.adjustmentType}:${valuationDate}:${newEventId().slice(0, 8)}`,
          valuationDate,
          adjustmentType: adj.adjustmentType,
          amountZarMinor: complete ? amount.value : 0,
          complete,
          ...(complete ? {} : { absentReason: amount.reason }),
          instrumentScope: adj.instrumentScope,
          ifrs13Level: adj.ifrs13Level,
          lineage: complete
            ? amount.lineage
            : `absent: ${amount.reason}; expected from ${amount.expectedFrom}`,
          computedAt,
          computedBy: ENGINE_ACTOR.id,
        },
      }),
    );
    eventsEmitted += 1;
  }

  // The prudent-valuation AVA umbrella — sums the populated categories only.
  const populated = report.avaCategories.filter((c) => c.present).length;
  const absentCount = report.avaCategories.length - populated;
  const totalAvaZarMinor = isPresent(report.totalAva) ? report.totalAva.value : 0;
  store.append(
    makePrudentValuationAvaAggregated({
      asOf: valuationDate,
      entity: BANK_ENTITY,
      actor: ENGINE_ACTOR,
      citations: CITATIONS,
      payload: {
        aggregationId: `pva:${valuationDate}:${newEventId().slice(0, 8)}`,
        valuationDate,
        totalAvaZarMinor,
        categories: [...report.avaCategories],
        populatedCategories: populated,
        absentCategories: absentCount,
        aggregatedAt: computedAt,
        aggregatedBy: ENGINE_ACTOR.id,
      },
    }),
  );
  eventsEmitted += 1;

  return eventsEmitted;
}
