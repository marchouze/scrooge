// dashboard/regulatory-returns-view.ts
//
// WS-V2-AUTHORITATIVE S9 — read-only regulatory-returns presentation boundary
// for the BA-700 (capital adequacy) and BA-320 (FX market-risk) returns, with a
// V1↔V2 dual-read selected at the route boundary under the `useV2Store` flag.
//
// This is the route-boundary presentation adapter that closes
// recon:dashboard-v2-coverage route #8: until S9 there was no dashboard HTTP
// route surfacing a BA-700/BA-320 return, so there was nothing to dual-read. The
// returns were only generated inside the period-close subscribers
// (platform/returns/ba700/period-close-subscriber.ts and the BA-320 one), never
// served on demand.
//
// ## Dual-read pattern (mirrors Phase-4 #1385 / W1-S5 #1390)
//
//   V1 path  — the existing BA-return generators:
//                BA-700: generateBA700Return (events-first capital fold).
//                BA-320: fxPositionCalculator + fxPositionsToBa310Input over
//                        FxTradeExecuted / TradeMatured (the same V1 derivation
//                        recon:ba320-fx-v2-parity validates).
//   V2 path  — the V2 projections (selected ONLY when useV2Store is ON):
//                BA-700: computeBA700V2 (GlPostingEmitted + CcrEadComputed).
//                BA-320: computeBA320V2 (FilInstrumentCreated/Terminated FIL FX).
//
// The flag defaults OFF, so V1 stays authoritative and the dual-read is fully
// reversible (D-V1-REMOVAL-PHASE-4). Flipping useV2Store ON by default is the
// SEPARATE authoritative cutover — NOT done here.
//
// ## Faithfulness (Charter cmd 4 — source, don't hardcode; cmd 2 — fail-closed)
//
//   - The functional currency is resolved from the anchor bank's legal-entity
//     tree entry (anchorFunctionalCurrency) and passed EXPLICITLY into every
//     generator — never a literal "ZAR" and never relying on a generator's own
//     "ZAR" default param.
//   - BA-320 FX rates resolve from the SAME MarketDataStore production fx-quote
//     ticks both the V2 projection and the parity gate read (single rate-lookup
//     site, Principle 2). A pair with no production tick is FAIL-CLOSED — its
//     net position is reported in base-currency minor units only and the
//     open-position charge stays null. No fabricated rate, no zero-fill.
//   - The view is a faithful projection of the underlying return events: every
//     figure is sourced; nothing is fabricated or zero-filled to make a tile
//     look populated.
//
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-PHASE-4 (CEO-approved 2026-06-16).
// Citations: Banks Act 94 §70; Reg 38; Reg 28(5); BCBS Basel III §50–§90;
//            BCBS D352 §718(xiii); P1-EVENTS-AS-TRUTH.
// Author: Atlas (Core banking platform architect, engineering).

import { coaToCapitalClassifications } from "../platform/accounting/coa-registry";
import { fxPositionCalculator } from "../platform/accounting/fx-calculators";
import { isFlagEnabled } from "../platform/config/loader";
import { mulD, roundDecimal, toDecimal, toMinorUnits } from "../platform/core/decimal-engine";
import type { EventStore } from "../platform/event-store/store";
import { anchorFunctionalCurrency } from "../platform/identity/functional-currency";
import { type MarketDataStore, lookupQuoteWithInverse } from "../platform/market-data/store";
import type { FxTradeExecutedPayload } from "../platform/markets/cdm/fx";
import { computeBA320V2 } from "../platform/projections/ba320-fx-v2";
import { computeBA700V2 } from "../platform/projections/ba700-v2";
import {
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../platform/projections/filter";
import { fxPositionsToBa310Input } from "../platform/reporting/ba-320-fx-adapter";
import { generateBA700Return } from "../platform/returns/ba700/generator";
import { spotObservableId } from "../v2-core/fil-models/fx-valuation/methodology";

// ---------------------------------------------------------------------------
// Constants — the build-phase reporting window, mirrored from the parity gates
// (recon:ba700-v2-parity / recon:ba320-fx-v2-parity) so the route and the gates
// fold the same population.
// ---------------------------------------------------------------------------

const ANCHOR_ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2099-12-31"; // broad window capturing all build-phase events
const PERIOD_ID = "period:hoz-bank:build-phase";
const PERIOD_START = "2026-01-01";
const PERIOD_END = "2099-12-31";

// ---------------------------------------------------------------------------
// View shapes — a thin, faithful presentation projection over the returns.
// ---------------------------------------------------------------------------

export interface RegulatoryReturnView {
  /** Which return this view describes. */
  readonly return: "BA 700" | "BA 320";
  /** "v1" (default) or "v2" — which read path produced the figures. */
  readonly readPath: "v1" | "v2";
  /** Whether the useV2Store flag was ON when this view was produced. */
  readonly useV2Store: boolean;
  /** ISO-4217 functional (reporting) currency — sourced, never a literal. */
  readonly functionalCurrency: string;
  /** Entity short-id. */
  readonly entity: string;
  /** As-of date the fold was bounded to. */
  readonly asOf: string;
  /** Lineage string describing the source events / projection. */
  readonly lineage: string;
  /** The return-specific payload (BA-700 capital, or BA-320 FX). */
  readonly figures: BA700ViewFigures | BA320ViewFigures;
}

/** BA-700 capital-adequacy figures (functional-currency minor units). */
export interface BA700ViewFigures {
  readonly tier1Capital: number;
  readonly tier2Capital: number;
  readonly totalRwa: number;
  /** Total capital ratio = (T1 + T2) / RWA; `null` when RWA is zero. */
  readonly carRatio: number | null;
  /**
   * Coverage status. V1: "v1-generated". V2: the projection's coverageStatus
   * ("partial" / "no-data"). Surfaces honest build-phase no-data states rather
   * than masking them with zeros.
   */
  readonly coverageStatus: string;
  /** Advisory gap markers carried through from the V2 projection (empty for V1). */
  readonly gaps: readonly string[];
}

/** BA-320 FX market-risk figures (functional-currency minor units). */
export interface BA320ViewFigures {
  readonly positions: readonly {
    readonly baseCurrency: string;
    /** Net open position in functional-currency minor units; null = no rate. */
    readonly netPositionFunctionalMinor: number | null;
    readonly rateAvailable: boolean;
  }[];
  /**
   * Reg 28(5) FX open-position capital charge = 8% × max(Σ|long|, Σ|short|) in
   * functional-currency minor units; `null` when a rate is missing (fail-closed).
   */
  readonly openPositionChargeMinor: number | null;
  readonly coverageStatus: string;
  readonly gaps: readonly string[];
}

// ---------------------------------------------------------------------------
// Rate map — resolve the functional-currency spot mid for each non-functional
// currency from the SAME MarketDataStore production fx-quote ticks the V2
// projection and parity gate read (single rate-lookup derivation site,
// Principle 2). A pair with no usable production tick is omitted → fail-closed
// downstream (charge stays null; no fabricated rate).
// ---------------------------------------------------------------------------

function buildSharedRateMap(
  marketData: MarketDataStore,
  currencies: Iterable<string>,
  functionalCurrency: string,
): Map<string, number> {
  const rates = new Map<string, number>();
  for (const ccy of currencies) {
    if (ccy === functionalCurrency || rates.has(ccy)) continue;
    const quote = lookupQuoteWithInverse(marketData, spotObservableId(ccy, functionalCurrency), {
      provenance: "production",
    });
    if (quote !== null && quote.rate > 0) rates.set(ccy, quote.rate);
  }
  return rates;
}

// ---------------------------------------------------------------------------
// BA-700 — V1 and V2 builders.
// ---------------------------------------------------------------------------

function buildBA700V1(eventStore: EventStore, functionalCurrency: string): RegulatoryReturnView {
  // Same events-first invocation recon:ba700-v2-parity uses for the V1 side:
  // the canonical COA capital classifications + build-phase period window. The
  // functional currency is passed explicitly (no generator-internal default).
  const v1 = generateBA700Return({
    entityId: ANCHOR_ENTITY,
    reportingDate: AS_OF,
    periodId: PERIOD_ID,
    functionalCurrency,
    eventStore,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    classifications: coaToCapitalClassifications(),
    deductions: [],
  });

  const ca = v1.return.capitalAdequacy;
  return {
    return: "BA 700",
    readPath: "v1",
    useV2Store: false,
    functionalCurrency,
    entity: ANCHOR_ENTITY,
    asOf: AS_OF,
    lineage:
      "V1 read (useV2Store OFF): generateBA700Return — events-first capital fold " +
      "(SubLedgerPostingEmitted + CapitalContributionRecorded; RWA from RwaComputed / " +
      "computeRwaFromPositions). Authority: D-V1-REMOVAL-PHASE-4.",
    figures: {
      tier1Capital: ca.tier1Capital,
      tier2Capital: ca.tier2Capital,
      totalRwa: ca.rwa,
      // V1 carRatio is a number (0 when RWA is zero); present null when RWA is
      // zero so the contract matches V2 (no false "0.00 ratio" reading).
      carRatio: ca.rwa > 0 ? ca.carRatio : null,
      coverageStatus: `v1-generated:${v1.return.status}`,
      gaps: [],
    } satisfies BA700ViewFigures,
  };
}

function buildBA700V2(
  eventStore: EventStore,
  marketData: MarketDataStore,
  functionalCurrency: string,
): RegulatoryReturnView {
  // Pass the MarketDataStore so the market-risk RWA term (12.5 × BA-320 V2 FX
  // open-position charge) can be derived from the SAME production fx-quote rate
  // source the BA-320 view uses. Fail-closed when a pair has no production tick
  // (market RWA excluded, marketRwaAvailable=false).
  const v2 = computeBA700V2({
    eventStore,
    asOf: AS_OF,
    entity: ANCHOR_ENTITY,
    functionalCurrency,
    marketDataStore: marketData,
  });

  const ca = v2.capitalAdequacy;
  return {
    return: "BA 700",
    readPath: "v2",
    useV2Store: true,
    functionalCurrency,
    entity: ANCHOR_ENTITY,
    asOf: AS_OF,
    lineage: `V2 read (useV2Store ON): computeBA700V2 — GlPostingEmitted (capital accounts) + CcrEadComputed (credit RWA) + 12.5 × BA-320 V2 FX charge (market RWA, marketRwaAvailable=${v2.meta.marketRwaAvailable}). coverageStatus=${v2.meta.coverageStatus}. Authority: D-BANK-WIDE-V2-MIGRATION; D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING; D-V1-REMOVAL-PHASE-4.`,
    figures: {
      tier1Capital: ca.tier1Capital,
      tier2Capital: ca.tier2Capital,
      totalRwa: ca.totalRwa,
      carRatio: ca.carRatio,
      coverageStatus: v2.meta.coverageStatus,
      gaps: v2.gaps,
    } satisfies BA700ViewFigures,
  };
}

// ---------------------------------------------------------------------------
// BA-320 — V1 and V2 builders.
// ---------------------------------------------------------------------------

function buildBA320V1(
  eventStore: EventStore,
  marketData: MarketDataStore,
  functionalCurrency: string,
): RegulatoryReturnView {
  // Mirror recon:ba320-fx-v2-parity's V1 derivation: FxTradeExecuted +
  // TradeMatured / FxTradeCancelled → fxPositionCalculator on the shared rate
  // map → fxPositionsToBa310Input. The functional currency is passed explicitly
  // to fxPositionsToBa310Input (NOT its "ZAR" default param).
  const provenanceFilter = defaultProvenanceFilter();
  const trades: FxTradeExecutedPayload[] = [];
  const settledTradeIds = new Set<string>();

  for (const ev of eventStore.replay({
    entity: ANCHOR_ENTITY,
    type: "FxTradeExecuted",
    asOf: AS_OF,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    trades.push(ev.payload as FxTradeExecutedPayload);
  }
  for (const settledType of ["TradeMatured", "FxTradeCancelled"] as const) {
    for (const ev of eventStore.replay({
      entity: ANCHOR_ENTITY,
      type: settledType,
      asOf: AS_OF,
    })) {
      if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
      const p = ev.payload as { tradeId?: string };
      if (p.tradeId) settledTradeIds.add(p.tradeId);
    }
  }

  const candidateCurrencies = new Set<string>();
  for (const t of trades) {
    if (t.currencyPair?.base) candidateCurrencies.add(t.currencyPair.base);
    if (t.currencyPair?.quote) candidateCurrencies.add(t.currencyPair.quote);
  }
  const rates = buildSharedRateMap(marketData, candidateCurrencies, functionalCurrency);

  const positions = fxPositionCalculator({
    trades,
    settledTradeIds,
    zarRates: rates,
    asOf: AS_OF,
  });
  const rows = fxPositionsToBa310Input(positions, functionalCurrency);

  // Reg 28(5) / BCBS §718(xiii): 8% × max(Σ|long|, Σ|short|). Computed with the
  // decimal engine (D-DECIMAL-NATIVE-MONEY-ARITHMETIC — no float on a money
  // figure), mirroring the V2 computeBA320V2 charge derivation exactly so the
  // dual-read paths are byte-for-byte comparable.
  let sumLong = 0;
  let sumShort = 0;
  for (const row of rows) {
    if (row.netPositionFunctionalMinor >= 0) sumLong += row.netPositionFunctionalMinor;
    else sumShort += Math.abs(row.netPositionFunctionalMinor);
  }
  const openPositionChargeMinor =
    rows.length > 0
      ? Number(
          toMinorUnits(
            roundDecimal(
              mulD(toDecimal(String(Math.max(sumLong, sumShort))), toDecimal("0.08")),
              0,
              "HALF_UP",
            ),
            0,
          ),
        )
      : null;

  return {
    return: "BA 320",
    readPath: "v1",
    useV2Store: false,
    functionalCurrency,
    entity: ANCHOR_ENTITY,
    asOf: AS_OF,
    lineage:
      "V1 read (useV2Store OFF): fxPositionCalculator over FxTradeExecuted + " +
      "TradeMatured / FxTradeCancelled (production fx-quote rates). " +
      "Authority: D-V1-REMOVAL-PHASE-4.",
    figures: {
      positions: rows.map((r) => ({
        baseCurrency: r.currency,
        netPositionFunctionalMinor: r.netPositionFunctionalMinor,
        // V1 rows always carry a functional figure (charge computed above).
        rateAvailable: true,
      })),
      openPositionChargeMinor,
      coverageStatus: rows.length > 0 ? "v1-generated" : "no-data",
      gaps: [],
    } satisfies BA320ViewFigures,
  };
}

function buildBA320V2(
  eventStore: EventStore,
  marketData: MarketDataStore,
  functionalCurrency: string,
): RegulatoryReturnView {
  const v2 = computeBA320V2({
    eventStore,
    asOf: AS_OF,
    entity: ANCHOR_ENTITY,
    functionalCurrency,
    marketDataStore: marketData,
  });

  return {
    return: "BA 320",
    readPath: "v2",
    useV2Store: true,
    functionalCurrency,
    entity: ANCHOR_ENTITY,
    asOf: AS_OF,
    lineage: `V2 read (useV2Store ON): computeBA320V2 — FilInstrumentCreated/Terminated FIL FX instances; production fx-quote rate source. coverageStatus=${v2.meta.coverageStatus}. Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-PHASE-4.`,
    figures: {
      positions: v2.fx.positions.map((p) => ({
        baseCurrency: p.baseCurrency,
        netPositionFunctionalMinor: p.netPositionFunctionalMinor,
        rateAvailable: p.rateAvailable,
      })),
      openPositionChargeMinor: v2.fx.openPositionChargeMinor,
      coverageStatus: v2.meta.coverageStatus,
      gaps: v2.gaps,
    } satisfies BA320ViewFigures,
  };
}

// ---------------------------------------------------------------------------
// selectRegulatoryReturn — the route-boundary dual-read.
//
// WIRED-MARKER: this function is the V2 read path selector asserted by
// recon:dashboard-v2-coverage (route #8). When useV2Store is ON it calls
// buildBA700V2 / buildBA320V2; when OFF (default) it calls the V1 builders.
// ---------------------------------------------------------------------------

export function selectRegulatoryReturn(
  which: "ba700" | "ba320",
  eventStore: EventStore,
  marketData: MarketDataStore,
): RegulatoryReturnView {
  // Functional currency resolves from the anchor bank's legal-entity tree entry
  // (fail-closed) — NOT a literal "ZAR" default (Charter cmd 4 / cmd 2).
  const functionalCurrency = anchorFunctionalCurrency();
  const v2 = isFlagEnabled("useV2Store");

  if (which === "ba700") {
    return v2
      ? buildBA700V2(eventStore, marketData, functionalCurrency)
      : buildBA700V1(eventStore, functionalCurrency);
  }
  return v2
    ? buildBA320V2(eventStore, marketData, functionalCurrency)
    : buildBA320V1(eventStore, marketData, functionalCurrency);
}
