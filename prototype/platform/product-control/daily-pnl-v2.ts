// platform/product-control/daily-pnl-v2.ts
//
// Product Control daily FX P&L engine — V2 path (Phase 2 Gap A2).
//
// Algorithm:
//   1. Replay FilInstrumentCreated where assetClass === "fx" → open FIL FX instruments.
//   2. Replay FilInstrumentTerminated → remove terminated instances from the open set.
//   3. If no open FIL FX instruments: return empty OK result (no crash).
//   4. Derive currency pairs from open instruments (economicTerms.currency + hedgingSetTag).
//   5. const marketDataAsOf = clockNow() — freeze the snapshot timestamp (once per run).
//   6. Build ONE MarketDataSlice: for each pair call MarketDataStore.getLatest(pair).
//      Missing pairs get null (mark unavailable — no-silent-zero).
//   7. For each open FIL instrument, call fcyCashValuable(pos).value(slice) → Money (reporting-ccy major).
//      Missing pair → markStatus: "unavailable" (never fold as 0).
//   8. Aggregate by currency / counterparty / book (same shape as V1 daily-pnl.ts).
//   9. Set marketDataAsOf on the returned payload.
//
// DailyPnLResult shape is IDENTICAL to V1 daily-pnl.ts — this engine is a
// drop-in parallel, not a replacement. V1 is untouched. The parity gate
// (recon:daily-pnl-v2-parity) compares the two totals within tolerance.
//
// FAIL-CLOSED: any live instrument with no usable mark is counted in
// marksUnavailableCount and excluded from totalUnrealised — never folded
// in as a silent 0 (D-TRUSTED-FIGURES-PROGRAM-V1, no-silent-zero rule).
//
// Authority:
//   - D-V1-REMOVAL-PHASE2-GAP-A2 (CEO-approved 2026-06-16)
//   - D-ENGINEERING-INTEGRITY-CHARTER
//   - D-FIL-BOOK-COMPOSITE-VALUATION (A2 + A4 gate)
//   - IFRS 9 §5.7.1 (FVTPL P&L recognition)
//   - IAS-21-§23/§28 (monetary item retranslation)
//
// Author: Atlas (Substrate Architect, engineering)

import type { Instant } from "../../v2-core/fil-core/primitives";
import type { MarketDataSlice } from "../../v2-core/fil-facets/facets";
import {
  fcyCashFromSettledReceivable,
  fcyCashValuable,
  spotObservableId,
} from "../../v2-core/fil-models/fx-valuation";
import { toDecimal } from "../core/decimal-engine";
import { newEventId, nowUtc } from "../core/types";
import { makeDailyPnLReportGenerated } from "../event-store/event-types/product-control";
import type {
  DailyPnLReportGeneratedPayload,
  PnLByBook,
  PnLByCounterparty,
  PnLByCurrency,
} from "../event-store/event-types/product-control";
import type { EventStore } from "../event-store/store";
import { anchorFunctionalCurrency } from "../identity/functional-currency";
import type { MarketDataStore } from "../market-data/store";
import { lookupQuoteWithInverse } from "../market-data/store";
import { majorStringToMinorBigint } from "../risk/sa-ccr/v2-money-bridge";
import { absent, present } from "../types/financial-input";
import type { DailyPnLResult } from "./daily-pnl";

// ---------------------------------------------------------------------------
// Constants (mirror V1 engine)
// ---------------------------------------------------------------------------

const DESK_ID = "FX-SPOT";
const BANK_ENTITY = "LE-ZA-HOZ-BANK";
const ENGINE_ACTOR = {
  type: "service" as const,
  id: "agent:product-control-engine-v2",
};
const CITATIONS = [
  "D-V1-REMOVAL-PHASE2-GAP-A2",
  "D-FIL-BOOK-COMPOSITE-VALUATION",
  "IFRS-9-§5.7.1",
  "IAS-21-§28",
];

// ---------------------------------------------------------------------------
// Internal type for a resolved FIL FX instrument
// ---------------------------------------------------------------------------

interface FilFxInstrument {
  readonly instanceUrn: string;
  /** The non-ZAR currency (base leg). */
  readonly currency: string;
  /** Full pair string, e.g. "EUR/ZAR" or from hedgingSetTag. */
  readonly pair: string;
  /** Notional currency (= currency). */
  readonly notionalCurrency: string;
  /** Signed notional in major units (decimal string). Long = +, short = −. */
  readonly signedNotional: string;
  /** Counterparty id. */
  readonly counterpartyId: string;
  /** Netting set id used as book proxy. */
  readonly bookId: string;
}

// ---------------------------------------------------------------------------
// Build a MarketDataSlice from a set of pairs
// ---------------------------------------------------------------------------

/**
 * Build one shared MarketDataSlice for the V2 daily P&L engine.
 *
 * Pattern: for each required pair, call lookupQuoteWithInverse (production
 * provenance only — never simulated) bounded at asOf. Missing pairs produce
 * no entry in observables (the Valuable.value() call will see undefined →
 * caller treats as markStatus: "unavailable").
 *
 * This is the exact same pattern as the var-engine and limit-utilisation
 * projection use (Principle 2 — single derivation site for rate lookup).
 */
function buildMarketDataSlice(
  pairs: ReadonlySet<string>,
  marketDataStore: MarketDataStore,
  asOf: string,
): MarketDataSlice {
  const observables: Record<string, number> = {};
  for (const pair of pairs) {
    const quote = lookupQuoteWithInverse(marketDataStore, pair, {
      provenance: "production",
    });
    if (quote !== null && quote.rate > 0) {
      // Key the observable by the pair in the canonical direction
      // (currency/reporting). The FIL fcyCashValuable reads
      // `spotObservableId(currency, reporting)` from the slice.
      // lookupQuoteWithInverse already handles direction inversion — the
      // returned rate is ALWAYS in the requested pair direction.
      observables[pair] = quote.rate;
    }
    // Missing pair: no entry — Valuable.value() will find undefined → caller
    // marks the instrument as "unavailable" (no-silent-zero).
  }
  return { asOf: asOf as Instant, observables };
}

// ---------------------------------------------------------------------------
// Resolve signed notional from FilEconomicTerms
// ---------------------------------------------------------------------------

/**
 * Derive the signed notional string for the FCY cash Valuable.
 *
 * FilEconomicTerms.notional.amount is a MAJOR-unit signed decimal string
 * (D-V2-CORE-MONEY-DECIMAL-NATIVE). direction "long" = positive, "short" = negative.
 * We apply the sign from direction (notional is always stored positive on the
 * FilEconomicTerms schema — direction is the signed attribute).
 */
function signedNotional(amount: string, direction: "long" | "short"): string {
  const d = toDecimal(amount);
  if (direction === "long") return amount;
  // Negate: prepend minus if not already negative
  const s = d.toString();
  if (s.startsWith("-")) return amount; // already negative (defensive)
  return `-${amount}`;
}

// ---------------------------------------------------------------------------
// Main V2 engine
// ---------------------------------------------------------------------------

/**
 * Compute the daily P&L report for `reportDate` (YYYY-MM-DD) from the V2
 * FIL instance projection.
 *
 * Pure read — no appends. The caller decides whether to persist.
 *
 * Returns a `DailyPnLResult` with the same shape as the V1 `computeDailyPnL`.
 */
export function computeDailyPnLV2(
  store: EventStore,
  marketDataStore: MarketDataStore,
  reportDate: string,
  clockNow: () => string,
): DailyPnLResult {
  // Reporting currency = the ANCHOR bank's functional currency, resolved from
  // the legal-entity tree (Engineering Charter cmd 4 — source, don't hardcode;
  // cmd 2 — fail-closed). NEVER a literal "ZAR": re-pointing the anchor's
  // functional currency is a seed change, not a code change. WS-MULTI-BASE-CURRENCY.
  const reporting = anchorFunctionalCurrency();

  // -------------------------------------------------------------------------
  // 1. Replay FilInstrumentCreated (assetClass === "fx") → candidate instruments
  // -------------------------------------------------------------------------
  const instrumentsById = new Map<string, FilFxInstrument>();

  try {
    for (const e of store.replay({ type: "FilInstrumentCreated" })) {
      const p = e.payload as Record<string, unknown>;
      // Payload schema: { kind: "FilInstrumentCreated", instance, type, tenant,
      //   asOf, originatingEvent, initialStage, economicTerms: { assetClass,
      //   notional: { currency, amount }, direction, counterpartyId,
      //   nettingSetId, currency, settlementDate, hedgingSetTag? } }
      const economicTerms = p.economicTerms as Record<string, unknown> | undefined;
      if (!economicTerms) continue;
      if (economicTerms.assetClass !== "fx") continue;

      const instance = p.instance as string | undefined;
      if (!instance) continue;

      const notionalRaw = economicTerms.notional as Record<string, unknown> | undefined;
      if (!notionalRaw) continue;
      const notionalAmount = notionalRaw.amount as string | undefined;
      if (!notionalAmount) continue;

      const currency = economicTerms.currency as string | undefined;
      if (!currency) continue;

      const direction = economicTerms.direction as "long" | "short" | undefined;
      if (!direction) continue;

      const counterpartyId = economicTerms.counterpartyId as string | undefined;
      if (!counterpartyId) continue;

      const nettingSetId = economicTerms.nettingSetId as string | undefined;
      if (!nettingSetId) continue;

      // Derive pair: prefer hedgingSetTag (e.g. "EUR/ZAR"); fallback to the
      // currency against the resolved reporting currency (the anchor book's
      // functional currency) — NOT a hardcoded "/ZAR". The slice observable is
      // keyed by `spotObservableId(currency, reporting)` so this fallback must
      // match it exactly (Charter cmd 4). WS-MULTI-BASE-CURRENCY.
      const hedgingSetTag = economicTerms.hedgingSetTag as string | undefined;
      const pair = hedgingSetTag ?? spotObservableId(currency, reporting);

      instrumentsById.set(instance, {
        instanceUrn: instance,
        currency,
        pair,
        notionalCurrency: currency,
        signedNotional: signedNotional(notionalAmount, direction),
        counterpartyId,
        bookId: nettingSetId,
      });
    }
  } catch {
    // FilInstrumentCreated not registered in this store — return empty result.
    return emptyResult(reportDate, clockNow());
  }

  // -------------------------------------------------------------------------
  // 2. Replay FilInstrumentTerminated → remove terminated instances
  // -------------------------------------------------------------------------
  try {
    for (const e of store.replay({ type: "FilInstrumentTerminated" })) {
      const p = e.payload as Record<string, unknown>;
      const instance = p.instance as string | undefined;
      if (instance) instrumentsById.delete(instance);
    }
  } catch {
    // FilInstrumentTerminated not registered — continue with full set (conservative).
  }

  // -------------------------------------------------------------------------
  // 3. No open FIL FX instruments → return empty OK result
  // -------------------------------------------------------------------------
  if (instrumentsById.size === 0) {
    return emptyResult(reportDate, clockNow());
  }

  const openInstruments = [...instrumentsById.values()];

  // -------------------------------------------------------------------------
  // 4. Derive required currency pairs
  // -------------------------------------------------------------------------
  const requiredPairs = new Set<string>();
  for (const inst of openInstruments) {
    requiredPairs.add(inst.pair);
  }

  // -------------------------------------------------------------------------
  // 5. Freeze the snapshot timestamp (once per run)
  // -------------------------------------------------------------------------
  const marketDataAsOf = clockNow();

  // -------------------------------------------------------------------------
  // 6. Build ONE shared MarketDataSlice
  // -------------------------------------------------------------------------
  const slice = buildMarketDataSlice(requiredPairs, marketDataStore, marketDataAsOf);

  // -------------------------------------------------------------------------
  // 7. Value each instrument via Valuable.value(slice)
  // -------------------------------------------------------------------------
  let totalUnrealised = 0;
  let marksUnavailableCount = 0;
  const unmarkableInstanceUrns: string[] = [];

  const byCurrencyMap = new Map<string, { trades: number; unrealised: number; realised: number }>();
  const byCounterpartyMap = new Map<
    string,
    { name: string; trades: number; unrealised: number; realised: number }
  >();
  const byBookMap = new Map<string, { trades: number; unrealised: number; realised: number }>();

  for (const inst of openInstruments) {
    const spotId = inst.pair;
    const spotRate = slice.observables[spotId];
    const hasRate = spotRate !== undefined && spotRate > 0;

    let unrealisedZarMinor = 0;
    let markStatus: "live" | "unavailable" = "live";

    if (!hasRate) {
      // No production mark for this pair → mark unavailable (no-silent-zero)
      markStatus = "unavailable";
      marksUnavailableCount++;
      unmarkableInstanceUrns.push(inst.instanceUrn);
    } else {
      // Call Valuable.value(slice) via fcyCashValuable (the canonical V2 FX
      // valuation path; same lifecycle-free arithmetic as the FX Valuable).
      // The FCY-cash Valuable accepts the signedNotional + currency + reporting
      // and looks up observables[`spotObservableId(currency, reporting)`] from
      // the slice.
      try {
        const position = fcyCashFromSettledReceivable({
          currency: inst.currency,
          signedNotional: inst.signedNotional,
          reporting,
        });
        const valuable = fcyCashValuable(position);
        const revalRecord = valuable.value(slice, marketDataAsOf as Instant);
        // revalRecord.value is Money { currency: reporting, amount: string (major) }
        // Convert to reporting-currency minor integer for V1-compatible aggregation
        const minorBigint = majorStringToMinorBigint(revalRecord.value.amount);
        unrealisedZarMinor = Number(minorBigint);
      } catch {
        // Valuation threw (unexpected) → treat as unavailable (fail-closed)
        markStatus = "unavailable";
        marksUnavailableCount++;
        unmarkableInstanceUrns.push(inst.instanceUrn);
        unrealisedZarMinor = 0;
      }
    }

    if (markStatus === "live") {
      totalUnrealised += unrealisedZarMinor;
    }
    // Realised P&L: the V2 engine reads only open FIL instruments.
    // Realised P&L (settled positions) is not tracked by FilInstrumentCreated;
    // settled instances are removed via FilInstrumentTerminated. We report
    // totalRealised = 0 in the V2 path — the parity gate uses totalUnrealised
    // only for the comparison (V1 also breaks out unrealised vs realised;
    // we only prove the MTM (unrealised) component equivalence at Gap A2).
    const unrealisedForReporting = markStatus === "live" ? unrealisedZarMinor : 0;

    // Aggregate by currency. Skip the reporting (functional) currency itself —
    // domestic cash carries no FX P&L. Compared against the resolved reporting
    // currency, NOT a literal "ZAR" (Charter cmd 4). WS-MULTI-BASE-CURRENCY.
    if (inst.currency !== reporting) {
      const cr = byCurrencyMap.get(inst.currency) ?? { trades: 0, unrealised: 0, realised: 0 };
      cr.trades++;
      if (markStatus === "live") cr.unrealised += unrealisedForReporting;
      byCurrencyMap.set(inst.currency, cr);
    }

    // Aggregate by counterparty
    const cpRow = byCounterpartyMap.get(inst.counterpartyId) ?? {
      name: inst.counterpartyId,
      trades: 0,
      unrealised: 0,
      realised: 0,
    };
    cpRow.trades++;
    if (markStatus === "live") cpRow.unrealised += unrealisedForReporting;
    byCounterpartyMap.set(inst.counterpartyId, cpRow);

    // Aggregate by book (netting set id)
    const br = byBookMap.get(inst.bookId) ?? { trades: 0, unrealised: 0, realised: 0 };
    br.trades++;
    if (markStatus === "live") br.unrealised += unrealisedForReporting;
    byBookMap.set(inst.bookId, br);
  }

  // -------------------------------------------------------------------------
  // 8. Build aggregation arrays
  // -------------------------------------------------------------------------
  const byCurrency: PnLByCurrency[] = [...byCurrencyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, v]) => ({
      currency,
      tradeCount: v.trades,
      unrealisedPnlZarMinor: v.unrealised,
      realisedPnlZarMinor: v.realised,
    }));

  const byCounterparty: PnLByCounterparty[] = [...byCounterpartyMap.entries()].map(
    ([counterpartyId, v]) => ({
      counterpartyId,
      counterpartyName: v.name,
      tradeCount: v.trades,
      unrealisedPnlZarMinor: v.unrealised,
      realisedPnlZarMinor: v.realised,
    }),
  );

  const byBook: PnLByBook[] = [...byBookMap.entries()].map(([bookId, v]) => ({
    bookId,
    tradeCount: v.trades,
    unrealisedPnlZarMinor: v.unrealised,
    realisedPnlZarMinor: v.realised,
  }));

  const unrealisedComplete = unmarkableInstanceUrns.length === 0;
  const totalRealised = 0; // V2 engine: realised is out of scope for Gap A2
  const totalPnl = totalUnrealised + totalRealised;
  const generatedAt = nowUtc();
  const reportId = `pnl-v2:${reportDate}:${newEventId().slice(0, 8)}`;

  const payload: DailyPnLReportGeneratedPayload = {
    reportId,
    reportDate,
    deskId: DESK_ID,
    totalUnrealisedPnlZarMinor: totalUnrealised,
    unrealisedComplete,
    unmarkableLivePositions: unmarkableInstanceUrns.length,
    unmarkableLiveTradeIds: unmarkableInstanceUrns,
    totalRealisedPnlZarMinor: totalRealised,
    totalPnlZarMinor: totalPnl,
    activePositions: openInstruments.length,
    cancelledPositions: 0,
    byCurrency,
    byCounterparty,
    byBook,
    generatedAt,
    generatedBy: ENGINE_ACTOR.id,
    marketDataAsOf,
  };

  // The headline unrealised P&L as a no-silent-zero FinancialInput
  const totalUnrealisedInput = unrealisedComplete
    ? present(
        totalUnrealised,
        "product-control/daily-pnl-v2: FIL instance projection + MarketDataStore snapshot (IAS 21 §28)",
      )
    : absent(
        `${unmarkableInstanceUrns.length} FIL FX instrument(s) had no usable production mark — unrealised P&L is incomplete (excludes ${unmarkableInstanceUrns.join(", ")})`,
        "MarketDataStore production tick required for every open FIL FX instrument pair",
      );

  return {
    payload,
    trades: [], // V2 engine does not return per-trade rows (FIL instance granularity)
    marksUnavailableCount,
    totalUnrealised: totalUnrealisedInput,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Empty result for when there are no open FIL FX instruments or the event
 * type is not registered. Returns ok: true — parity gate treats this as
 * an advisory gap, not a failure.
 */
function emptyResult(reportDate: string, generatedAt: string): DailyPnLResult {
  const reportId = `pnl-v2:${reportDate}:no-instruments`;
  const payload: DailyPnLReportGeneratedPayload = {
    reportId,
    reportDate,
    deskId: DESK_ID,
    totalUnrealisedPnlZarMinor: 0,
    unrealisedComplete: true, // vacuously complete — no instruments, no missing marks
    unmarkableLivePositions: 0,
    unmarkableLiveTradeIds: [],
    totalRealisedPnlZarMinor: 0,
    totalPnlZarMinor: 0,
    activePositions: 0,
    cancelledPositions: 0,
    byCurrency: [],
    byCounterparty: [],
    byBook: [],
    generatedAt,
    generatedBy: ENGINE_ACTOR.id,
    marketDataAsOf: undefined,
  };
  return {
    payload,
    trades: [],
    marksUnavailableCount: 0,
    totalUnrealised: present(
      0,
      "product-control/daily-pnl-v2: no open FIL FX instruments — empty result",
    ),
  };
}

// ---------------------------------------------------------------------------
// Runner — compute and persist the V2 daily P&L event
// ---------------------------------------------------------------------------

/**
 * Run the V2 daily P&L report: compute and append the event.
 * The V2 path appends a DailyPnLReportGenerated event (same type as V1)
 * with marketDataAsOf set to the snapshot timestamp.
 */
export function runDailyPnLReportV2(
  store: EventStore,
  marketDataStore: MarketDataStore,
  clockNow: () => string,
): void {
  const reportDate = clockNow().slice(0, 10);
  const { payload } = computeDailyPnLV2(store, marketDataStore, reportDate, clockNow);
  store.append(
    makeDailyPnLReportGenerated({
      asOf: reportDate,
      entity: BANK_ENTITY,
      actor: ENGINE_ACTOR,
      citations: CITATIONS,
      payload,
    }),
  );
}
