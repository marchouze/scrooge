// platform/product-control/pnl-signoff.ts
//
// P&L Sign-off & Commentary engine — Slice 4 of the Product Control stack.
//
// Bea (Accounting & financial reporting engineer, engineering) builds this
// engine as a set of pure-read functions; callers append the returned payloads.
//
// Functions:
//   buildPnLSignOff     — reads the latest DailyPnLReportGenerated +
//                         PnLAttributionGenerated for a reportDate; builds a
//                         PnLSignedOffPayload. attributionComplete =
//                         residualWithinTolerance && no unattributablePositions.
//                         Returns null when no report/attribution exists (no
//                         fabrication of figures).
//
//   buildPnLCommentary  — reads the PnLAttributionExceptionRaised for a given
//                         attributionId; builds a PnLCommentaryRecordedPayload
//                         with a programmatic commentary string describing the
//                         component, amount, threshold, and residual vs tolerance.
//                         Thresholds from registry-backed financial constants.
//
//   buildFlashPnL       — MVP: uses today's open positions × most recent
//                         OfficialMarkAdopted marks as the flash estimate.
//                         Returns FinancialInput<PnLFlashRecordedPayload>:
//                         absent if no marks exist for any open position.
//
//   buildFlashActualReconciliation — reads prior-day flash + current actual
//                         DailyPnLReportGenerated; computes variance.
//                         Returns null if either is missing.
//
// No-silent-zero (Trusted-Figures): buildFlashPnL returns absent (not 0)
// when no OfficialMarkAdopted marks cover any open position. Individual
// open positions with no mark are excluded (not zeroed) from the flash.
//
// Authority:
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (Camille CFO recommendation R4)
//   - IFRS 9 §5.7.1 (FVTPL P&L recognition)
//   - FIN-BSS-01 (balance sheet substantiation policy)
//   - brief:bea:p-l-sign-off-commentary-slice-4:2026-05-31
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { getFinancialConstant } from "../config/financial-constants";
import { newEventId, nowUtc } from "../core/types";
import type { FxPositionRevaluedPayload } from "../event-store/event-types/fx-accounting";
import type {
  PnLAttributionExceptionRaisedPayload,
  PnLAttributionGeneratedPayload,
  PnLCommentaryRecordedPayload,
  PnLFlashActualReconciledPayload,
  PnLFlashRecordedPayload,
  PnLSignedOffPayload,
} from "../event-store/event-types/product-control";
import type { OfficialMarkAdoptedPayload } from "../event-store/event-types/valuation";
import type { EventStore } from "../event-store/store";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import { type FinancialInput, absent, present } from "../types/financial-input";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DESK_ID = "FX-SPOT";
const ENGINE_ACTOR_ID = "agent:product-control-signoff-engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Find the latest DailyPnLReportGenerated payload for reportDate.
 * Returns null when no report has been emitted for that date.
 */
function latestDailyReport(
  store: EventStore,
  reportDate: string,
): { reportId: string; totalPnlZarMinor: number; unrealisedComplete: boolean } | null {
  let latest: { reportId: string; totalPnlZarMinor: number; unrealisedComplete: boolean } | null =
    null;
  let latestAt = "";
  for (const e of store.replay({ type: "DailyPnLReportGenerated" })) {
    const p = e.payload as {
      reportDate?: string;
      generatedAt?: string;
      reportId?: string;
      totalPnlZarMinor?: number;
      unrealisedComplete?: boolean;
    };
    if (p.reportDate !== reportDate) continue;
    const at = typeof p.generatedAt === "string" ? p.generatedAt : "";
    if (at >= latestAt) {
      latestAt = at;
      latest = {
        reportId: typeof p.reportId === "string" ? p.reportId : "",
        totalPnlZarMinor: typeof p.totalPnlZarMinor === "number" ? p.totalPnlZarMinor : 0,
        unrealisedComplete:
          typeof p.unrealisedComplete === "boolean" ? p.unrealisedComplete : false,
      };
    }
  }
  return latest;
}

/**
 * Find the latest PnLAttributionGenerated payload for reportDate.
 * Returns null when no attribution has been emitted for that date.
 */
function latestAttribution(
  store: EventStore,
  reportDate: string,
): PnLAttributionGeneratedPayload | null {
  let latest: PnLAttributionGeneratedPayload | null = null;
  let latestAt = "";
  for (const e of store.replay({ type: "PnLAttributionGenerated" })) {
    const p = e.payload as unknown as PnLAttributionGeneratedPayload;
    if (p.reportDate !== reportDate) continue;
    if (p.generatedAt >= latestAt) {
      latestAt = p.generatedAt;
      latest = p;
    }
  }
  return latest;
}

/**
 * Find the PnLAttributionExceptionRaised payload for a given attributionId.
 * Returns null when no exception has been emitted for that attribution.
 */
function exceptionForAttribution(
  store: EventStore,
  attributionId: string,
): PnLAttributionExceptionRaisedPayload | null {
  for (const e of store.replay({ type: "PnLAttributionExceptionRaised" })) {
    const p = e.payload as unknown as PnLAttributionExceptionRaisedPayload;
    if (p.attributionId === attributionId) return p;
  }
  return null;
}

/**
 * Find the latest PnLFlashRecorded payload for reportDate.
 * Returns null when no flash was recorded for that date.
 */
function latestFlash(store: EventStore, reportDate: string): PnLFlashRecordedPayload | null {
  let latest: PnLFlashRecordedPayload | null = null;
  let latestAt = "";
  for (const e of store.replay({ type: "PnLFlashRecorded" })) {
    const p = e.payload as unknown as PnLFlashRecordedPayload;
    if (p.reportDate !== reportDate) continue;
    if (p.generatedAt >= latestAt) {
      latestAt = p.generatedAt;
      latest = p;
    }
  }
  return latest;
}

// ---------------------------------------------------------------------------
// buildPnLSignOff
// ---------------------------------------------------------------------------

/**
 * Build a PnLSignedOffPayload for the given reportDate and signing role.
 *
 * Reads the latest DailyPnLReportGenerated + PnLAttributionGenerated for the
 * reportDate. attributionComplete = residualWithinTolerance AND no
 * unattributablePositions. Returns null when no daily report exists for the
 * date (the engine never fabricates figures).
 */
export function buildPnLSignOff(
  store: EventStore,
  reportDate: string,
  signingRole: "trader" | "product-control",
): PnLSignedOffPayload | null {
  const report = latestDailyReport(store, reportDate);
  if (report === null) return null;

  const attribution = latestAttribution(store, reportDate);

  // attributionComplete requires: attribution exists + residual within
  // tolerance + no unattributable positions (missing-mark exclusions).
  const attributionComplete =
    attribution !== null &&
    attribution.residualWithinTolerance === true &&
    attribution.unattributablePositions.length === 0;

  const exceptions: string[] = [];
  if (!report.unrealisedComplete) {
    exceptions.push("unrealised P&L is incomplete — ≥1 live position had no usable mark");
  }
  if (attribution === null) {
    exceptions.push("no P&L attribution available for this report date");
  } else {
    if (!attribution.residualWithinTolerance) {
      exceptions.push(
        `P&L attribution residual (${attribution.residual.amountZarMinor} ZAR minor) exceeds tolerance (${attribution.toleranceZarMinor} ZAR minor)`,
      );
    }
    if (attribution.unattributablePositions.length > 0) {
      exceptions.push(
        `${attribution.unattributablePositions.length} position(s) have no prior-day mark and are excluded from market-move: ${attribution.unattributablePositions.join(", ")}`,
      );
    }
  }

  return {
    signOffId: `signoff:${reportDate}:${newEventId().slice(0, 8)}`,
    reportDate,
    deskId: DESK_ID,
    signedOffBy: {
      role: signingRole,
      agentId: ENGINE_ACTOR_ID,
    },
    figuresSigned: {
      totalPnlZarMinor: report.totalPnlZarMinor,
      unrealisedComplete: report.unrealisedComplete,
      attributionComplete,
    },
    exceptions,
    signedOffAt: nowUtc(),
    generatedBy: ENGINE_ACTOR_ID,
  };
}

// ---------------------------------------------------------------------------
// buildPnLCommentary
// ---------------------------------------------------------------------------

/**
 * Build a PnLCommentaryRecordedPayload for the given attributionId.
 *
 * Reads the PnLAttributionExceptionRaised for that attributionId and constructs
 * a programmatic commentary string describing the breach. Thresholds come from
 * the registry-backed financial constants (never inline literals).
 *
 * Returns null when no exception has been emitted for the attribution (i.e.
 * the attribution is clean and no commentary is required).
 */
export function buildPnLCommentary(
  store: EventStore,
  attributionId: string,
): PnLCommentaryRecordedPayload | null {
  const exception = exceptionForAttribution(store, attributionId);
  if (exception === null) return null;

  const largeMoveThreshold = getFinancialConstant(
    "product-control.pnl-commentary.large-move-threshold-minor",
  );

  let commentaryType: PnLCommentaryRecordedPayload["commentaryType"];
  let componentKey: string | null;
  let amountZarMinor: number;
  let thresholdDescription: string;
  let thresholdZarMinor: number;
  let commentary: string;

  if (exception.breachType === "incomplete-inputs") {
    commentaryType = "incomplete-inputs";
    componentKey = "marketMove";
    amountZarMinor = exception.residualZarMinor;
    thresholdDescription = "all live positions must carry a usable prior-day mark for market-move";
    thresholdZarMinor = 0;
    const positionList = exception.unattributablePositions.join(", ");
    commentary = `P&L attribution incomplete for desk ${exception.deskId} on ${exception.reportDate}: ${exception.unattributablePositions.length} live position(s) had no usable prior-day OfficialMarkAdopted mark and were excluded from the market-move component (no silent zero, per D-TRUSTED-FIGURES-PROGRAM-V1). Excluded positions: ${positionList}. Residual at time of breach: ${exception.residualZarMinor} ZAR minor (tolerance: ${exception.toleranceZarMinor} ZAR minor). Action required: obtain prior-day marks for the excluded positions and re-run attribution.`;
  } else {
    // residual-breach
    commentaryType = "residual-breach";
    componentKey = "residual";
    amountZarMinor = exception.residualZarMinor;
    thresholdDescription = `unexplained residual must not exceed ${exception.toleranceZarMinor} ZAR minor`;
    thresholdZarMinor = exception.toleranceZarMinor;
    commentary = `P&L attribution residual breach for desk ${exception.deskId} on ${exception.reportDate}: unexplained residual of ${exception.residualZarMinor} ZAR minor exceeds tolerance of ${exception.toleranceZarMinor} ZAR minor. The clean-P&L move is not fully explained by new-trade + market-move + carry + realised components. Investigation required: check for unbooked trades, mark errors, or carry/funding gaps. Detail: ${exception.detail}`;
  }

  // Additionally surface a large-move commentary note if the absolute residual
  // exceeds the large-move threshold (indicating a systemic, not just noise, gap).
  const absAmount = Math.abs(amountZarMinor);
  if (absAmount >= largeMoveThreshold) {
    commentary +=
      ` Note: the absolute amount (${absAmount} ZAR minor) exceeds the large-move ` +
      `commentary threshold (${largeMoveThreshold} ZAR minor = ZAR ${largeMoveThreshold / 100}).`;
  }

  return {
    commentaryId: `commentary:${attributionId}:${newEventId().slice(0, 8)}`,
    reportDate: exception.reportDate,
    deskId: exception.deskId,
    linkedAttributionId: attributionId,
    commentaryType,
    componentKey,
    amountZarMinor,
    threshold: {
      description: thresholdDescription,
      zarMinor: thresholdZarMinor,
    },
    commentary,
    recordedBy: {
      role: "product-control",
      agentId: ENGINE_ACTOR_ID,
    },
    recordedAt: nowUtc(),
  };
}

// ---------------------------------------------------------------------------
// buildFlashPnL
// ---------------------------------------------------------------------------

/**
 * Build a flash P&L estimate for the given reportDate.
 *
 * MVP: open positions × most recent OfficialMarkAdopted marks. A position
 * with no usable mark is excluded from the flash unrealised total (no silent
 * zero). The flash realised total uses the same settled-trade fold as the
 * daily P&L engine.
 *
 * Returns FinancialInput<PnLFlashRecordedPayload>:
 *   - present  when ≥1 open position carries a usable mark.
 *   - absent   when no OfficialMarkAdopted marks exist for any open position
 *              (cannot produce even a partial estimate).
 */
export function buildFlashPnL(
  store: EventStore,
  reportDate: string,
): FinancialInput<PnLFlashRecordedPayload> {
  // ---- 1. Collect cancelled trade IDs ------------------------------------
  const cancelledIds = new Set<string>();
  try {
    for (const e of store.replay({ type: "FxTradeCancelled" })) {
      const p = e.payload as { tradeId?: string | { value?: string } };
      const tid = p.tradeId;
      const idStr =
        typeof tid === "object" && tid !== null && "value" in tid
          ? (tid.value ?? "")
          : String(tid ?? "");
      if (idStr) cancelledIds.add(idStr);
    }
  } catch {
    // FxTradeCancelled not registered — silently continue.
  }

  // ---- 2. Collect all FX trades -----------------------------------------
  const tradeMap = new Map<string, FxTradeExecutedPayload>();
  for (const e of store.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as unknown as FxTradeExecutedPayload;
    tradeMap.set(p.tradeId.value, p);
  }

  // ---- 3. Collect settled trade IDs --------------------------------------
  const settledIds = new Set<string>();
  for (const e of store.replay({ type: "TradeMatured" })) {
    const p = e.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string") settledIds.add(p.tradeId);
  }
  for (const e of store.replay({ type: "SettlementConfirmed" })) {
    const p = e.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string") settledIds.add(p.tradeId);
  }

  // ---- 4. Latest OfficialMarkAdopted fx-rate marks -----------------------
  // Fold all fx-rate marks up to (and including) reportDate.
  const latestMarkByInstrument = new Map<string, number>();
  for (const e of store.replay({ type: "OfficialMarkAdopted" })) {
    const p = e.payload as unknown as OfficialMarkAdoptedPayload;
    if (p.markType !== "fx-rate") continue;
    if (dayOf(p.markAsOf) > reportDate) continue;
    const v = Number(p.mark);
    if (Number.isFinite(v)) latestMarkByInstrument.set(p.instrumentKey, v);
  }

  // ---- 5. Latest FxPositionRevalued per trade ----------------------------
  // Use the most recent reval for each open position as the flash unrealised.
  const latestRevalByTrade = new Map<string, FxPositionRevaluedPayload>();
  for (const e of store.replay({ type: "FxPositionRevalued" })) {
    const p = e.payload as unknown as FxPositionRevaluedPayload;
    if (cancelledIds.has(p.tradeId)) continue;
    const existing = latestRevalByTrade.get(p.tradeId);
    if (!existing || p.revaluedAt > existing.revaluedAt) {
      latestRevalByTrade.set(p.tradeId, p);
    }
  }

  // ---- 6. Realised P&L from confirmed settlements -----------------------
  let flashRealised = 0;
  const realisedByTrade = new Map<string, number>();
  for (const e of store.replay({ type: "TradeMatured" })) {
    const p = e.payload as { tradeId?: unknown; realisedPnlZarMinor?: unknown };
    if (typeof p.tradeId !== "string") continue;
    if (typeof p.realisedPnlZarMinor === "number") {
      const ex = realisedByTrade.get(p.tradeId) ?? 0;
      realisedByTrade.set(p.tradeId, ex + p.realisedPnlZarMinor);
    }
  }
  for (const e of store.replay({ type: "SettlementConfirmed" })) {
    const p = e.payload as { tradeId?: unknown; realisedPnlDelta?: unknown };
    if (typeof p.tradeId !== "string") continue;
    if (typeof p.realisedPnlDelta === "number") {
      const ex = realisedByTrade.get(p.tradeId) ?? 0;
      realisedByTrade.set(p.tradeId, ex + p.realisedPnlDelta);
    }
  }
  for (const [, v] of realisedByTrade) flashRealised += v;

  // ---- 7. Flash unrealised: open positions × latest mark -----------------
  let flashUnrealised = 0;
  let positionsWithMark = 0;
  let positionsWithoutMark = 0;

  for (const [tradeId, trade] of tradeMap) {
    if (cancelledIds.has(tradeId)) continue;
    if (settledIds.has(tradeId)) continue;
    // Open position — look for the latest reval as the flash proxy.
    const reval = latestRevalByTrade.get(tradeId);
    if (reval) {
      flashUnrealised += reval.unrealisedPnlZarMinor;
      positionsWithMark++;
    } else {
      // No reval — check if a raw mark exists for this instrument.
      const base = trade.currencyPair.base;
      const quote = trade.currencyPair.quote;
      const hasMark =
        latestMarkByInstrument.has(`${base}/${quote}`) ||
        latestMarkByInstrument.has(`${quote}/${base}`);
      if (hasMark) {
        // Mark exists but no reval computed — skip (no silent zero). The reval
        // engine hasn't run yet; we exclude rather than fabricate a number.
        positionsWithoutMark++;
      } else {
        positionsWithoutMark++;
      }
    }
  }

  // No-silent-zero: if no open position carried a usable mark, return absent.
  if (positionsWithMark === 0 && tradeMap.size > 0) {
    // Only return absent if there are trades — an empty book is trivially valued.
    const openCount = [...tradeMap.keys()].filter(
      (id) => !cancelledIds.has(id) && !settledIds.has(id),
    ).length;
    if (openCount > 0) {
      return absent(
        `no open positions carried a usable mark for flash P&L (${positionsWithoutMark} open position(s) had no FxPositionRevalued event) — flash estimate cannot be produced`,
        "FxPositionRevalued (latest reval) for every open FX position",
      );
    }
  }

  const generatedAt = nowUtc();
  const flashId = `flash:${reportDate}:${newEventId().slice(0, 8)}`;

  const payload: PnLFlashRecordedPayload = {
    flashId,
    reportDate,
    deskId: DESK_ID,
    flashTotalZarMinor: flashUnrealised + flashRealised,
    flashUnrealisedZarMinor: flashUnrealised,
    flashRealisedZarMinor: flashRealised,
    generatedAt,
    generatedBy: ENGINE_ACTOR_ID,
  };

  return present(
    payload,
    `product-control/pnl-signoff: FxPositionRevalued (${positionsWithMark} positions with mark) + settled trade realised P&L`,
  );
}

// ---------------------------------------------------------------------------
// buildFlashActualReconciliation
// ---------------------------------------------------------------------------

/**
 * Build a flash-vs-actual reconciliation payload.
 *
 * Reads the latest flash for reportDate (from PnLFlashRecorded events) and
 * the latest actual EOD report (from DailyPnLReportGenerated). Computes the
 * variance = actual − flash. Tolerance from the financial constants registry.
 *
 * Returns null when either the flash or the actual EOD report is missing
 * (e.g. day 1, or no flash was recorded). Callers skip when null.
 */
export function buildFlashActualReconciliation(
  store: EventStore,
  flashId: string,
  reportDate: string,
): PnLFlashActualReconciledPayload | null {
  // Look up the specific flash by flashId.
  let flash: PnLFlashRecordedPayload | null = null;
  for (const e of store.replay({ type: "PnLFlashRecorded" })) {
    const p = e.payload as unknown as PnLFlashRecordedPayload;
    if (p.flashId === flashId) {
      flash = p;
      break;
    }
  }
  if (flash === null) {
    // Also try finding the latest flash for reportDate (caller may pass
    // the reportDate of the flash if the flashId is not yet known).
    flash = latestFlash(store, reportDate);
  }
  if (flash === null) return null;

  // Find the latest actual EOD report for the same reportDate.
  const report = latestDailyReport(store, reportDate);
  if (report === null) return null;

  const toleranceZarMinor = getFinancialConstant(
    "product-control.pnl-flash-reconciliation.tolerance-minor",
  );

  const varianceZarMinor = report.totalPnlZarMinor - flash.flashTotalZarMinor;
  const varianceWithinTolerance = Math.abs(varianceZarMinor) <= toleranceZarMinor;

  return {
    reconciliationId: `flash-recon:${reportDate}:${newEventId().slice(0, 8)}`,
    reportDate,
    deskId: DESK_ID,
    flashTotalZarMinor: flash.flashTotalZarMinor,
    actualTotalZarMinor: report.totalPnlZarMinor,
    varianceZarMinor,
    varianceWithinTolerance,
    toleranceZarMinor,
    linkedFlashId: flash.flashId,
    linkedAttributionId: report.reportId,
    reconciledAt: nowUtc(),
    generatedBy: ENGINE_ACTOR_ID,
  };
}
