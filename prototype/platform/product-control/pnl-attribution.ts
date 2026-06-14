// platform/product-control/pnl-attribution.ts
//
// Product Control P&L Attribution ("P&L Explain") engine — FX-spot MVP.
//
// Decomposes the day-over-day CLEAN P&L move for the FX-spot desk into
// additive components that reconcile EXACTLY to the total move:
//
//   actualMove === newTrade + marketMove + carry + realised + residual
//
// Components:
//   1. New-trade P&L  — trades booked on reportDate: their contribution to the
//      day's unrealised P&L (the FxPositionRevalued delta whose revaluedAt is
//      on reportDate for a trade whose tradeDate is reportDate).
//   2. Market-move P&L — existing positions: Σ FxPositionRevalued.unrealised
//      PnlZarMinor whose revaluedAt is on reportDate, for trades booked BEFORE
//      reportDate. Cross-checked against OfficialMarkAdopted per-instrumentKey
//      deltas between prior and report date.
//   3. Carry/funding — derived from FtpCurvePublished (ZAR, overnight tenor ON/1D).
//      Absent (NOT 0) when no matching curve is in the event store.
//   4. Realised P&L — settlement increment: totalRealised(reportDate) −
//      totalRealised(priorDate), cross-checked against SettlementConfirmed /
//      TradeMatured dated reportDate.
//   5. Residual — the unexplained remainder = actualMove − (the four above).
//      The residual ALWAYS makes the components sum to actualMove (the invariant
//      holds by construction); a residual beyond tolerance is the control signal.
//
// No-silent-zero (the whole point): the per-position prior-mark lookup is the
// only `?? 0` collapse risk. It returns a FinancialInput<number> per trade; an
// absent prior mark pushes the tradeId to `unattributablePositions`, EXCLUDES it
// from marketMove (does NOT add 0), and surfaces the aggregate marketMove and
// carry as FinancialInput<number>. Mirrors the `unmarkableLiveTradeIds` pattern
// in daily-pnl.ts. Uses present/absent/isPresent from types/financial-input.
//
// Method: full-reval (P&L-vector). No Greeks events exist, so we do NOT use a
// Taylor / Greeks decomposition. The non-FX extension adds a risk-factor
// sensitivity sub-split (delta/vega/gamma/theta) on each component's
// `subComponents` array — the component object is shaped to hold it today so the
// event never has to change.
//
// Authority:
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (Camille CFO recommendation R1)
//   - IFRS 9 §5.7.1 (FVTPL P&L recognition)
//   - FRTB-PLA (P&L attribution test analogue)
//   - brief:bea:p-l-attribution-engine-fx-spot-mvp:2026-05-31
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { getFinancialConstant } from "../config/financial-constants";
import { absD, divD, mulD, roundDecimal, toDecimal } from "../core/decimal-engine";
import { newEventId, nowUtc } from "../core/types";
import type { FtpCurvePublishedPayload } from "../event-store/event-types/ftp";
import type { FxPositionRevaluedPayload } from "../event-store/event-types/fx-accounting";
import {
  type AttributionComponent,
  type PnLAttributionExceptionRaisedPayload,
  type PnLAttributionGeneratedPayload,
  makePnLAttributionExceptionRaised,
  makePnLAttributionGenerated,
} from "../event-store/event-types/product-control";
import type { OfficialMarkAdoptedPayload } from "../event-store/event-types/valuation";
import type { EventStore } from "../event-store/store";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import { type FinancialInput, absent, isPresent, present } from "../types/financial-input";
import { computeDailyPnL } from "./daily-pnl";
import { computeDeskCashPositions } from "./desk-cash-positions";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DESK_ID = "FX-SPOT";
const BANK_ENTITY = "LE-ZA-HOZ-BANK";
const ENGINE_ACTOR = {
  type: "service" as const,
  id: "agent:product-control-pnl-attribution-engine",
};
const CITATIONS = ["D-TRUSTED-FIGURES-PROGRAM-V1", "IFRS-9-§5.7.1", "FRTB-PLA"];

/** Funding tenor the FX-SPOT desk's carry component prices against (MVP). */
const FX_SPOT_FUNDING_TENOR = "ON";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface PnLAttributionResult {
  /** The generated event payload (additive invariant already holds). */
  payload: PnLAttributionGeneratedPayload;
  /**
   * The exception to emit ALONGSIDE the generated event, or null when the
   * attribution reconciles within tolerance AND every component is complete.
   */
  exception: PnLAttributionExceptionRaisedPayload | null;
  /**
   * Headline market-move as a no-silent-zero FinancialInput: `present` when
   * every live position carried a usable prior-day mark; `absent` (degraded)
   * when ≥1 was excluded — the partial sum stays on the payload but a consumer
   * cannot read it as complete.
   */
  marketMove: FinancialInput<number>;
  /**
   * Carry/funding as a FinancialInput: `present` only when an FTP curve covers
   * the desk funding tenor for reportDate; `absent` in the MVP (no curve), never 0.
   */
  carry: FinancialInput<number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/** Inclusive end-of-day ISO instant for `YYYY-MM-DD` (point-in-time bound). */
function endOfDay(day: string): string {
  return `${day}T23:59:59.999Z`;
}

/**
 * Resolve the residual tolerance (ZAR minor) from the registry-backed
 * constants: a ZAR 1.00 rounding floor PLUS a bps-of-notional band. Both come
 * from FINANCIAL_CONSTANTS (never an inline literal); a missing key throws loudly.
 */
function resolveToleranceZarMinor(grossLiveNotionalZarMinor: number): number {
  const floorMinor = getFinancialConstant("product-control.pnl-attribution.residual-floor-minor");
  const bandBps = getFinancialConstant("product-control.pnl-attribution.residual-band-bps");
  // bps → fraction: 1 bp = 0.0001. bandBps is in basis points (unit
  // percentage-points carries the bps figure directly; 0.5 == 0.5 bp here).
  // Decimal-native tolerance band: HALF_EVEN at the ZAR minor boundary.
  // Authority: D-DECIMAL-NATIVE-MONEY-ARITHMETIC (WS-DECIMAL-NATIVE-MONEY-ARITHMETIC).
  const bandMinor = Number(
    roundDecimal(
      divD(
        mulD(absD(toDecimal(String(grossLiveNotionalZarMinor))), toDecimal(String(bandBps))),
        toDecimal("10000"),
      ),
      0,
      "HALF_EVEN",
    ).toFixed(0),
  );
  return floorMinor + bandMinor;
}

/** Build a { complete, amount, reason? } attribution component. */
function component(
  amountZarMinor: number,
  complete: boolean,
  absentReason?: string,
): AttributionComponent {
  return {
    amountZarMinor,
    complete,
    ...(absentReason !== undefined ? { absentReason } : {}),
    // FX-spot MVP: full-reval method, no risk-factor sub-split. The non-FX
    // extension populates this without reshaping the event.
    subComponents: [],
  };
}

/**
 * Fold OfficialMarkAdopted fx-rate marks up to (and including) `asOfDay` into a
 * latest-per-instrument map. Used to cross-check market-move and to detect a
 * position whose instrument had NO prior-day mark at all.
 */
function foldFxMarksUpTo(store: EventStore, asOfDay: string): Map<string, number> {
  const byInstrument = new Map<string, number>();
  for (const e of store.replay({ type: "OfficialMarkAdopted" })) {
    const p = e.payload as unknown as OfficialMarkAdoptedPayload;
    if (p.markType !== "fx-rate") continue;
    if (dayOf(p.markAsOf) > asOfDay) continue;
    const v = Number(p.mark);
    if (Number.isFinite(v)) byInstrument.set(p.instrumentKey, v);
  }
  return byInstrument;
}

// ---------------------------------------------------------------------------
// Engine (pure read)
// ---------------------------------------------------------------------------

/**
 * Compute the P&L attribution explaining the clean-P&L move from
 * `priorReportDate` to `reportDate`. Pure read — no appends.
 */
export function computePnLAttribution(
  store: EventStore,
  reportDate: string,
  priorReportDate: string,
): PnLAttributionResult {
  // -------------------------------------------------------------------------
  // 0. Two point-in-time daily-P&L snapshots — reuse the governed daily-pnl
  //    engine, each bounded as-of the END of its respective day so the
  //    day-over-day move is real (not two reads of the same full history).
  // -------------------------------------------------------------------------
  const today = computeDailyPnL(store, reportDate, endOfDay(reportDate));
  const prior = computeDailyPnL(store, priorReportDate, endOfDay(priorReportDate));

  // The day-over-day clean-P&L move to explain. The unrealised half attributes
  // to new-trade + market-move; the realised half attributes to the realised
  // component (the realised-level diff below); any gap lands in the residual.
  const actualMoveZarMinor = today.payload.totalPnlZarMinor - prior.payload.totalPnlZarMinor;

  // -------------------------------------------------------------------------
  // 1. Index trades + the two snapshots' per-trade unrealised LEVELS. The
  //    daily-pnl engine carries each position's unrealised P&L as a level
  //    (the latest reval's value as of the snapshot day), so the per-position
  //    day-over-day move is the difference of the two levels — guaranteeing the
  //    components reconcile to the unrealised move.
  // -------------------------------------------------------------------------
  const tradeMap = new Map<string, FxTradeExecutedPayload>();
  for (const e of store.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as unknown as FxTradeExecutedPayload;
    tradeMap.set(p.tradeId.value, p);
  }

  // Per-trade unrealised LEVELS in each snapshot. A trade that has left the
  // live book by reportDate (settled/cancelled) has a today-level of 0 — the
  // drop from its prior level is a genuine unrealised move (the crystallisation
  // leg), captured here and offset by the realised increment below so the two
  // halves of a settlement net correctly.
  const priorLevelByTrade = new Map<string, number>();
  for (const row of prior.trades) {
    if (row.status === "cancelled") continue;
    priorLevelByTrade.set(row.tradeId, row.unrealisedPnlZarMinor);
  }
  const todayLevelByTrade = new Map<string, number>();
  const todayStatusByTrade = new Map<string, "live" | "settled" | "cancelled">();
  for (const row of today.trades) {
    todayLevelByTrade.set(row.tradeId, row.unrealisedPnlZarMinor);
    todayStatusByTrade.set(row.tradeId, row.status);
  }

  // Latest reval per trade DATED reportDate — used only to detect that the
  // position was actually revalued on reportDate (a fresh mark, not a stale
  // carry-forward) and to total gross notional for the tolerance band.
  const revalOnReportDateByTrade = new Map<string, FxPositionRevaluedPayload>();
  for (const e of store.replay({ type: "FxPositionRevalued" })) {
    const p = e.payload as unknown as FxPositionRevaluedPayload;
    if (dayOf(p.revaluedAt) !== reportDate) continue;
    const existing = revalOnReportDateByTrade.get(p.tradeId);
    if (!existing || p.revaluedAt > existing.revaluedAt) {
      revalOnReportDateByTrade.set(p.tradeId, p);
    }
  }

  // Prior-date fx marks, for the per-position prior-mark lookup (no-silent-zero).
  const priorMarks = foldFxMarksUpTo(store, priorReportDate);

  // -------------------------------------------------------------------------
  // 2. New-trade vs market-move split, with the no-silent-zero prior-mark gate.
  //
  // For each non-cancelled live/settled position in today's snapshot:
  //   - booked ON reportDate → new-trade P&L: its full unrealised LEVEL today
  //     (no prior level to net against).
  //   - booked BEFORE reportDate (existing position) → market-move P&L: the
  //     change in its unrealised level (today − prior), BUT only if a usable
  //     prior-day mark exists for its instrument. If not, the position is
  //     unattributable: EXCLUDED from market-move (NOT zeroed) and tracked so
  //     the figure declares itself incomplete.
  // -------------------------------------------------------------------------
  let newTradeZarMinor = 0;
  let marketMoveZarMinor = 0;
  let grossLiveNotionalZarMinor = 0;
  const unattributablePositions: string[] = [];

  // Iterate the UNION of trades present in either snapshot so a position that
  // appears today (new trade) and one that left today (settled) are both seen.
  const allTradeIds = new Set<string>([...priorLevelByTrade.keys(), ...todayLevelByTrade.keys()]);

  for (const tradeId of allTradeIds) {
    const trade = tradeMap.get(tradeId);
    if (!trade) continue;
    // A position cancelled by reportDate carries no P&L in either component.
    if (todayStatusByTrade.get(tradeId) === "cancelled") continue;

    const reval = revalOnReportDateByTrade.get(tradeId);
    if (reval) grossLiveNotionalZarMinor += Math.abs(reval.notionalBaseMinor);

    const todayLevel = todayLevelByTrade.get(tradeId) ?? 0; // 0 if gone from book
    const priorLevel = priorLevelByTrade.get(tradeId);
    const bookedOnReportDate = dayOf(trade.tradeDate.iso) === reportDate;

    if (bookedOnReportDate && priorLevel === undefined) {
      // New trade: its full unrealised level today IS the new-trade P&L (it had
      // no position yesterday to net against).
      newTradeZarMinor += todayLevel;
      continue;
    }

    // Existing position → market-move (the change in its unrealised level,
    // including any crystallisation drop to 0 on settlement). Look up the
    // prior-day mark as a FinancialInput. This is the ONLY silent-zero collapse
    // risk in the engine. A position that was already settled BEFORE the prior
    // date (priorLevel 0, todayLevel 0) contributes nothing and needs no mark.
    if ((priorLevel ?? 0) === 0 && todayLevel === 0) continue;
    const priorMark = priorMarkFor(trade, priorMarks);
    if (isPresent(priorMark)) {
      marketMoveZarMinor += todayLevel - (priorLevel ?? 0);
    } else {
      // EXCLUDE — do not add 0. Track so the aggregate is declared incomplete.
      unattributablePositions.push(tradeId);
    }
  }

  // Desk FX cash retranslation is a market move (IAS 21 §28): the closing-rate
  // revaluation of the settled foreign-currency balance an FX trade leaves
  // behind. The daily-pnl total now folds this cash unrealised, so its
  // day-over-day level delta must attribute to market-move — otherwise the cash
  // valuation move would land in the residual and breach tolerance. Two
  // point-in-time snapshots (end of each day) give a real delta. An unmarkable
  // cash instrument is EXCLUDED (no silent 0) and pushed to the unattributable
  // ledger, exactly as for an existing FX position with no prior-day mark.
  const cashToday = computeDeskCashPositions(store, endOfDay(reportDate));
  const cashPrior = computeDeskCashPositions(store, endOfDay(priorReportDate));
  marketMoveZarMinor += cashToday.markableUnrealisedZarMinor - cashPrior.markableUnrealisedZarMinor;
  for (const key of cashToday.unmarkableKeys) unattributablePositions.push(key);

  const marketMoveComplete = unattributablePositions.length === 0;
  const marketMoveInput: FinancialInput<number> = marketMoveComplete
    ? present(
        marketMoveZarMinor,
        "product-control/pnl-attribution: Σ FxPositionRevalued delta on reportDate (existing positions)",
      )
    : absent(
        `${unattributablePositions.length} live position(s) had no usable prior-day mark — market-move excludes ${unattributablePositions.join(", ")} (no silent 0)`,
        "OfficialMarkAdopted (prior-day fx-rate mark) for every existing FX position's instrument",
      );

  // -------------------------------------------------------------------------
  // 3. Carry/funding — resolved from FtpCurvePublished (ZAR, overnight tenor).
  //    Funded notional = Σ |unrealisedPnlZarMinor| for positions on reportDate.
  //    Carry = fundedNotional × overnightRate × (1/365). NEVER a silent 0.
  // -------------------------------------------------------------------------
  let fundedNotionalZarMinor = 0;
  for (const reval of revalOnReportDateByTrade.values()) {
    fundedNotionalZarMinor += Math.abs(reval.unrealisedPnlZarMinor ?? 0);
  }
  const carryInput = resolveCarry(store, reportDate, fundedNotionalZarMinor);
  const carryZarMinor = isPresent(carryInput) ? carryInput.value : 0;
  const carryComplete = isPresent(carryInput);

  // -------------------------------------------------------------------------
  // 4. Realised P&L — settlement increment between the two dates.
  // -------------------------------------------------------------------------
  const realisedZarMinor =
    today.payload.totalRealisedPnlZarMinor - prior.payload.totalRealisedPnlZarMinor;

  // -------------------------------------------------------------------------
  // 5. Residual — absorbs the gap so the components always sum to actualMove.
  //    The invariant holds by construction; a residual beyond tolerance is the
  //    control signal (raises an exception), not an invariant violation.
  // -------------------------------------------------------------------------
  const residualZarMinor =
    actualMoveZarMinor - (newTradeZarMinor + marketMoveZarMinor + carryZarMinor + realisedZarMinor);

  const toleranceZarMinor = resolveToleranceZarMinor(grossLiveNotionalZarMinor);
  const residualWithinTolerance = Math.abs(residualZarMinor) <= toleranceZarMinor;

  const generatedAt = nowUtc();
  const attributionId = `pnl-attr:${reportDate}:${newEventId().slice(0, 8)}`;

  const payload: PnLAttributionGeneratedPayload = {
    attributionId,
    reportDate,
    priorReportDate,
    deskId: DESK_ID,
    actualMoveZarMinor,
    newTrade: component(newTradeZarMinor, true),
    marketMove: component(
      marketMoveZarMinor,
      marketMoveComplete,
      marketMoveComplete
        ? undefined
        : `excludes ${unattributablePositions.length} unmarkable position(s): ${unattributablePositions.join(", ")}`,
    ),
    carry: component(
      carryZarMinor,
      carryComplete,
      carryComplete
        ? undefined
        : `no FTP curve for FX-SPOT funding (tenor ${FX_SPOT_FUNDING_TENOR}) on ${reportDate}`,
    ),
    realised: component(realisedZarMinor, true),
    residual: component(residualZarMinor, true),
    residualWithinTolerance,
    toleranceZarMinor,
    unattributablePositions,
    generatedAt,
    generatedBy: ENGINE_ACTOR.id,
  };

  // -------------------------------------------------------------------------
  // 6. Exception — raised when the attribution cannot be read as clean.
  //    incomplete-inputs takes precedence (a missing mark is the more
  //    fundamental fault); else residual-breach when the residual is too large.
  // -------------------------------------------------------------------------
  let exception: PnLAttributionExceptionRaisedPayload | null = null;
  if (!marketMoveComplete) {
    exception = {
      attributionId,
      reportDate,
      deskId: DESK_ID,
      breachType: "incomplete-inputs",
      residualZarMinor,
      toleranceZarMinor,
      unattributablePositions,
      detail: `P&L attribution incomplete: ${unattributablePositions.length} live position(s) had no usable prior-day mark and were excluded from market-move (no silent zero). Positions: ${unattributablePositions.join(", ")}.`,
    };
  } else if (!residualWithinTolerance) {
    exception = {
      attributionId,
      reportDate,
      deskId: DESK_ID,
      breachType: "residual-breach",
      residualZarMinor,
      toleranceZarMinor,
      unattributablePositions: [],
      detail: `P&L attribution residual ${residualZarMinor} ZAR minor exceeds tolerance ${toleranceZarMinor} ZAR minor — the clean-P&L move is not fully explained by new-trade + market-move + carry + realised.`,
    };
  }

  return {
    payload,
    exception,
    marketMove: marketMoveInput,
    carry: carryInput,
  };
}

/**
 * Look up the prior-day mark for a trade's instrument as a FinancialInput.
 * This is the single no-silent-zero collapse point: an instrument with no
 * prior-day OfficialMarkAdopted mark returns `absent`, NOT a 0 that would fold
 * the position silently into market-move.
 */
function priorMarkFor(
  trade: FxTradeExecutedPayload,
  priorMarks: Map<string, number>,
): FinancialInput<number> {
  // Instrument keys an FX mark may be adopted under: the canonical pair and the
  // base/quote string. Try both so a position matches whichever convention the
  // valuation engine adopted the mark under.
  const base = trade.currencyPair.base;
  const quote = trade.currencyPair.quote;
  const candidates = [`${base}/${quote}`, `${quote}/${base}`];
  for (const key of candidates) {
    const m = priorMarks.get(key);
    if (m !== undefined) {
      return present(m, `OfficialMarkAdopted fx-rate prior-day mark for ${key}`);
    }
  }
  return absent(
    `no prior-day fx-rate mark for ${base}/${quote}`,
    "OfficialMarkAdopted (markType fx-rate) dated on or before the prior report date",
  );
}

/**
 * Resolve the carry/funding component as a FinancialInput.
 *
 * Reads the canonical FtpCurvePublished schema: matches on currency=ZAR +
 * effectiveDate=reportDate, then looks up the overnight rate (tenor "ON" or "1D").
 * Carry = fundedNotionalZarMinor × overnightRate × (1/365) [act/365, ZAR convention].
 *
 * Returns absent — never a silent 0 — when no matching curve or no overnight tenor.
 */
function resolveCarry(
  store: EventStore,
  reportDate: string,
  fundedNotionalZarMinor: number,
): FinancialInput<number> {
  try {
    for (const e of store.replay({ type: "FtpCurvePublished" })) {
      const p = e.payload as FtpCurvePublishedPayload;
      if (p.currency !== "ZAR" || p.effectiveDate !== reportDate) continue;
      const overnight =
        p.tenors.find((t) => t.tenor === "ON") ?? p.tenors.find((t) => t.tenor === "1D");
      if (!overnight) continue;
      // Decimal-native carry computation: HALF_EVEN at the ZAR minor boundary.
      // Authority: D-DECIMAL-NATIVE-MONEY-ARITHMETIC (WS-DECIMAL-NATIVE-MONEY-ARITHMETIC).
      const carryZarMinor = Number(
        roundDecimal(
          divD(
            mulD(
              mulD(toDecimal(String(fundedNotionalZarMinor)), toDecimal(String(overnight.rate))),
              toDecimal("1"),
            ),
            toDecimal("365"),
          ),
          0,
          "HALF_EVEN",
        ).toFixed(0),
      );
      return present(
        carryZarMinor,
        `FtpCurvePublished ZAR carry for ${reportDate}: ${overnight.tenor} @ ${(overnight.rate * 100).toFixed(2)}% × ${fundedNotionalZarMinor} funded ZAR-minor (act/365)`,
      );
    }
  } catch {
    // FtpCurvePublished not registered — fall through to absence.
  }
  return absent(
    `no FtpCurvePublished for ZAR on ${reportDate} with overnight tenor (ON or 1D)`,
    "FtpCurvePublished (currency=ZAR, effectiveDate=reportDate, tenor=ON or 1D)",
  );
}

// ---------------------------------------------------------------------------
// Run wrapper (append) — mirrors runDailyPnLReport
// ---------------------------------------------------------------------------

/**
 * Run the P&L attribution for `clockNow`'s date against the prior calendar day:
 * compute and append the PnLAttributionGenerated event (and, when the
 * attribution is not clean, the paired PnLAttributionExceptionRaised event).
 */
export function runPnLAttribution(store: EventStore, clockNow: () => string): void {
  const reportDate = clockNow().slice(0, 10);
  const priorReportDate = priorDay(reportDate);
  const { payload, exception } = computePnLAttribution(store, reportDate, priorReportDate);

  store.append(
    makePnLAttributionGenerated({
      asOf: reportDate,
      entity: BANK_ENTITY,
      actor: ENGINE_ACTOR,
      citations: CITATIONS,
      payload,
    }),
  );

  // Note: CalculationPerformed provenance for pnl-attribution is now emitted by
  // emitAllCalculationProvenance() (boot-suite path in calculation-provenance.ts)
  // so the figure is always fresh on dashboard boot, even when this agent is idle.
  // Do NOT emit buildCalculationPerformed here — that would double-emit on days
  // when both the boot suite and this agent run.

  if (exception) {
    store.append(
      makePnLAttributionExceptionRaised({
        asOf: reportDate,
        entity: BANK_ENTITY,
        actor: ENGINE_ACTOR,
        citations: CITATIONS,
        payload: exception,
      }),
    );
  }
}

/** Prior calendar day (YYYY-MM-DD). Exported for reuse in the boot-suite provenance emitter. */
export function priorDay(reportDate: string): string {
  const d = new Date(`${reportDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
