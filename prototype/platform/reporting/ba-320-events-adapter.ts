// platform/reporting/ba-320-events-adapter.ts
//
// P1 fix (C-2) — BA 310 (market-risk return) entry point that folds
// FxTradeExecuted primary trade events directly, without routing through the
// trial balance.
//
// Principle 1 violation addressed: routing the open-FX-position charge
// through TrialBalanceSnapshotted couples capital metrics to the posting
// engine. A position exists (FxTradeExecuted) before a SubLedgerPosting is
// emitted — making capital ratios dependent on accounting timing is
// architecturally wrong.
//
// Correct input chain per Principles/1-events-are-truth.md:
//   FxTradeExecuted (primary trade events)
//     → fxPositionCalculator (open positions, net per pair)
//     → fxPositionsToBa310Input (adapter)
//     → generateBa310MarketRisk (pure generator)
//     → Ba310Output
//
// TradeMatured events are folded to identify settled trades so they
// are excluded from the open-position calculation (Reg 28(5) — only open /
// unsettled positions enter the FX charge).
//
// ZAR rates must be supplied by the caller — the rate feed is a separate
// substrate concern (Bea rate-feed integration spec §7; build-phase: caller
// supplies a rate map; production: fetched from the Reuters WM/Bloomberg BFIX
// rate-feed substrate).
//
// Authority:
//   - Principles/1-events-are-truth.md (CEO-approved architecture)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
//   - Regulations Relating to Banks Reg 28(5) — FX open-position charge
//   - BCBS D352 §718(xiii) — 8% × max(longs, shorts)
//
// Authors: Atlas (Core banking platform architect, engineering — P1-fix
//   substrate; C-2 dispatch) + Bea (Accounting & financial reporting
//   engineer, engineering — BA-form generator inputs contract)

import { fxPositionCalculator } from "../accounting/fx-calculators";
import type { EventStore } from "../event-store/store";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import { fxPositionsToBa310Input } from "./ba-320-fx-adapter";
import { generateBa310MarketRisk } from "./ba-320-market-risk";
import type {
  Ba310Output,
  CommodityPositionRow,
  EquityRow,
  IrMaturityBandRow,
  IrSpecificRiskRow,
} from "./ba-320-market-risk";

// ---------------------------------------------------------------------------
// Input contract for the events-first entry point.
// ---------------------------------------------------------------------------

/**
 * Input for `generateBa310MarketRiskFromEvents`.
 *
 * The FX-position sub-charge is derived by replaying `FxTradeExecuted` and
 * `TradeMatured` events directly (P1-compliant). The remaining
 * sub-charges (IR general, IR specific, equity, commodity) are caller-supplied
 * at v0 — their event-fold paths land when the respective trading-book event
 * types (bond positions, equity positions) are implemented.
 *
 * P1-compliance status:
 *   - FX sub-charge: COMPLIANT — folds FxTradeExecuted events directly.
 *   - IR general-risk: COMPLIANT — folds BondTradeExecuted (bond ladder) and
 *     IrdSwapTradeExecuted (IRS maturity-method notional-leg ladder) events
 *     directly, both on the SAME weighted-nominal basis. The combined ladder is
 *     passed in via `irGeneralMaturityLadder`. Any live trading-book swap that
 *     cannot be maturity-method-decomposed (non-vanilla role, or missing
 *     next-reset terms) is surfaced as a substrate gap via `extraPlaceholders`
 *     (WS-BA-RETURNS-FOLLOWON G1; D-IRS-DV01-BUCKETING-CALIBRATION).
 *   - equity / commodity: PLACEHOLDER — caller-supplied numbers until the
 *     corresponding event streams are implemented. Substrate gap surfaced in
 *     the output `placeholders` field.
 */
export interface Ba310FromEventsInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). Throws on non-bank. */
  readonly entity: string;
  /** ISO 8601 — period-end as-of date. */
  readonly asOf: string;
  /** Period identifier (`period:hoz-bank:month:2026-05`). */
  readonly periodId: string;
  /** ISO 4217 functional currency. */
  readonly functionalCurrency: string;
  /**
   * Period window for replaying FxTradeExecuted events.
   * Events with `as_of` in [periodStart, periodEnd] (inclusive) are included.
   * Use the accounting-period open/close dates.
   */
  readonly periodStart: string;
  readonly periodEnd: string;
  /**
   * ZAR exchange rates — map from currency code (e.g. "USD") to ZAR per 1
   * minor unit of that currency (e.g. 0.00001845 for USD/ZAR 18.45).
   *
   * Build-phase: caller supplies rates; production: fetched from the rate-feed
   * substrate (Bea spec §7 — Reuters WM-Fix / Bloomberg BFIX).
   */
  readonly zarRates: ReadonlyMap<string, number>;
  /**
   * Maturity-ladder rows for IR general-risk. Events-first: the caller folds
   * the bond ladder (ba-320-bond-events-adapter) and the IRS maturity-method
   * notional-leg ladder (ba-320-irs-events-adapter) — both on the
   * weighted-nominal basis — and passes the combined per-band nets here.
   */
  readonly irGeneralMaturityLadder: readonly IrMaturityBandRow[];
  /** Issuer rows for IR specific-risk. Caller-supplied at v0. */
  readonly irSpecificRisk: readonly IrSpecificRiskRow[];
  /** Equity rows per market. Caller-supplied at v0. */
  readonly equity: readonly EquityRow[];
  /** Commodity positions. Caller-supplied at v0. */
  readonly commodity: readonly CommodityPositionRow[];
  /** Optional IR disallowances. */
  readonly irGeneralDisallowancesMinor?: number;
  /**
   * Upper bound (inclusive) on the event `sequence` column.
   * Sourced from `AccountingPeriodClosed.eventSequence` (frozen cursor).
   * When supplied, all event-store replays in this adapter are bounded
   * to prevent divergence from concurrent appends.
   * Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
   */
  readonly untilSequence?: number;
  /**
   * Extra substrate-gap / placeholder notes to append to the output
   * `placeholders` field. Used by the period-close subscriber to surface live
   * trading-book IRS swaps that could not be maturity-method-decomposed (a
   * non-vanilla role, or missing next-reset terms — so their IR general-risk
   * contribution could not be folded — not dropped, not fabricated).
   * Authority: WS-BA-RETURNS-FOLLOWON G1; D-IRS-DV01-BUCKETING-CALIBRATION.
   */
  readonly extraPlaceholders?: readonly string[];
}

// ---------------------------------------------------------------------------
// Generator — folds events, then delegates to the pure generator.
// ---------------------------------------------------------------------------

/**
 * Generate the BA 310 (market-risk) projection by folding primary trade
 * events directly from the event store.
 *
 * P1-compliant entry point (C-2 fix). FX positions are computed from
 * `FxTradeExecuted` events (minus `TradeMatured` settled trades)
 * rather than from the trial balance.
 *
 * Citations: Principles/1-events-are-truth.md, D-MARKETS-SCHEMA-FOUNDATION,
 * D-MARKETS-CAPITAL-TIME-SHAPE.
 */
export function generateBa310MarketRiskFromEvents(
  eventStore: EventStore,
  input: Ba310FromEventsInput,
): Ba310Output {
  // Provenance filter: exclude simulated events from production projections.
  // Authority: D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12).
  const provenanceFilter = defaultProvenanceFilter();

  // Frozen-cursor replay opts: when untilSequence is supplied, all replays
  // are bounded to prevent divergence from concurrent appends.
  // Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
  const frozenCursorOpts =
    input.untilSequence !== undefined ? { untilSequence: input.untilSequence } : {};

  // ---- Step 1: replay FxTradeExecuted for the entity within the window. ----
  const tradedPayloads: FxTradeExecutedPayload[] = [];
  const tradeEventIds: string[] = [];

  for (const ev of eventStore.replay({
    entity: input.entity,
    type: "FxTradeExecuted",
    asOf: input.periodEnd,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    // Include trades from the beginning of time up to period end.
    // We want all open positions as of period end, not just trades within
    // the window (a trade from a prior period may still be open).
    // We include all trades ≤ periodEnd and then exclude settled ones.
    tradedPayloads.push(ev.payload as FxTradeExecutedPayload);
    tradeEventIds.push(ev.event_id);
  }

  // ---- Step 2: identify settled trades. ------------------------------------
  //
  // Settled-trade detection folds three event types:
  //
  //   - CDM `SettlementConfirmed` (lifecycle close — 2026-05-20 GL-significant
  //     under PR-FX-LIFECYCLE-CLOSE). Primary canonical signal that both legs
  //     have settled.
  //   - Accounting `TradeMatured` (DEPRECATED 2026-05-20 — kept for
  //     back-compat with legacy test fixtures and any historical events still
  //     in the store).
  //   - PrincipalPayment (per-leg confirmation). Used as a fallback signal —
  //     a tradeId with at least one PrincipalPayment indicates the lifecycle
  //     has progressed past the instruction phase. For BA-310 we treat any
  //     tradeId that has reached the CDM SettlementConfirmed or accounting
  //     TradeMatured as fully settled; PrincipalPayment alone is
  //     not enough (only one leg has confirmed).
  const settledTradeIds = new Set<string>();
  for (const ev of eventStore.replay({
    entity: input.entity,
    type: "SettlementConfirmed",
    asOf: input.periodEnd,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string") settledTradeIds.add(p.tradeId);
  }
  for (const ev of eventStore.replay({
    entity: input.entity,
    type: "TradeMatured",
    asOf: input.periodEnd,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as { tradeId: string };
    if (p.tradeId) settledTradeIds.add(p.tradeId);
  }

  // ---- Step 3: compute open FX positions using the calculator. -------------
  const positions = fxPositionCalculator({
    trades: tradedPayloads,
    settledTradeIds,
    zarRates: input.zarRates,
    asOf: input.asOf,
  });

  // ---- Step 4: adapt positions to Ba310 FxPositionRow[]. ------------------
  const fxPositions = fxPositionsToBa310Input(positions, input.functionalCurrency);

  // ---- Step 5: delegate to the pure generator. ----------------------------
  const generated = generateBa310MarketRisk({
    entity: input.entity,
    asOf: input.asOf,
    periodId: input.periodId,
    functionalCurrency: input.functionalCurrency,
    irGeneralMaturityLadder: input.irGeneralMaturityLadder,
    irSpecificRisk: input.irSpecificRisk,
    equity: input.equity,
    fxPositions,
    commodity: input.commodity,
    ...(input.irGeneralDisallowancesMinor !== undefined
      ? { irGeneralDisallowancesMinor: input.irGeneralDisallowancesMinor }
      : {}),
    // No trialBalanceSnapshotEventId — positions came from primary events.
    // The source event IDs are in tradeEventIds (provenance chain is
    // FxTradeExecuted → fxPositionCalculator → generateBa310MarketRisk).
  });

  // ---- Step 6: append substrate-gap placeholders (events-first IR gaps). ---
  if (input.extraPlaceholders !== undefined && input.extraPlaceholders.length > 0) {
    return {
      ...generated,
      placeholders: [...generated.placeholders, ...input.extraPlaceholders],
    };
  }
  return generated;
}

// Re-export for convenience at the call-sites that import from this module.
export type { Ba310Output };
