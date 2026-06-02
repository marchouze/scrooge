// platform/projections/rwa-from-positions.ts
//
// Live RWA projection from booked trade positions.
//
// Replays trade booking events from the event store, maps each trade to a
// `CreditExposure` or `TradingBookPosition`, and calls `computeRwa()` to
// produce a live `RwaEngineOutput`.  This is the bridge between the
// event-sourced position register and the RWA engine — it closes the stub
// that kept `computeCapitalMetrics()` permanently returning the frozen
// ICAAP v1 constant `BUILD_PHASE_TOTAL_RWA_MINOR`.
//
// Trade → exposure mapping (per brief authority):
//
//   BondTradeExecuted      → CreditExposure
//     counterpartyType = "sovereign-domestic-currency" if ISIN prefix "ZAG"
//                        (JSE government bond); else "corporate-ig" (ZAR IG)
//     eadMinor          = nominalMinor (face value, cost not yet MTM)
//
//   RepoTradeOpened        → CreditExposure
//     counterpartyType = "bank" (secured lending to a bank counterparty)
//     eadMinor          = startLegCashZar (principal of secured asset leg)
//     Closed by:  RepoEndLegSettled, RepoTradeTerminatedEarly  (both carry tradeId)
//
//   DepositTaken           → CreditExposure (liability-side — 0 credit risk to bank)
//     NOTE: deposits are inflows (liabilities); they carry 0 credit-risk RWA
//     to the bank as depositor.  Excluded from credit-exposure fold.
//
//   InterbankLoanPlaced    → CreditExposure
//     counterpartyType = "bank" (lending principal to another institution)
//     eadMinor          = principalZar (principal of interbank asset)
//     Closed by:  InterbankLoanMatured, InterbankLoanRecalledEarly  (both carry placementId)
//
//   FxTradeExecuted        → TradingBookPosition
//     riskType          = "fx"
//     notionalMinor     = near-leg notional.amountMinor (base-currency notional)
//     marketRiskWeight  = rwaInstrumentClassWeights()["FX-spot"] (registry)
//     Closed by:  SettlementConfirmed (tradeId string), TradeMatured{productKind:"fx-spot"} (tradeId string)
//
//   IrsTradeBooked         → TradingBookPosition
//     riskType          = "interest-rate"
//     notionalMinor     = notional.amountMinor
//     marketRiskWeight  = rwaInstrumentClassWeights()["OTC-IRD"]
//     Closed by:  IrdSwapTerminated (tradeId string)
//
//   EquityTradeBooked      → TradingBookPosition
//     riskType          = "equity"
//     notionalMinor     = quantity × price (minor units, approximation)
//     marketRiskWeight  = rwaInstrumentClassWeights()["JSE-EQUITY"]
//
// Graceful fallback:
//   If no trade booking events exist the function returns a zeroed output
//   with `buildPhaseFallback: true`.  Callers use `BUILD_PHASE_TOTAL_RWA_MINOR`
//   in that case (same as the pre-W2-Slice-3 behaviour).
//
// Gap documented:
//   BusinessIndicatorInput is zeroed — no income events exist yet.
//   A real BI feed requires GL trial-balance projection (Bea M2) decomposed
//   into OPE25 ILDC/SC/FC lines.  Operational RWA will be non-zero only
//   after that projection lands.  EUR ↔ ZAR rate is the build-phase
//   approximation (20 ZAR/EUR, ~20_00 minor/minor) per rwa-delta.ts precedent.
//
// Authority: D-RWA-LIVE-POSITIONS-PROJECTION-V1 (CEO-approved 2026-05-30);
//   D-REGULATORY-READINESS-W2-SLICE-3;
//   D-REGULATORY-READINESS-GATE-PLAN (CEO-approved 2026-05-10)
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { rwaInstrumentClassWeights } from "../config/financial-constants";
import type { BondTradeExecutedPayload } from "../event-store/event-types/bond-accounting";
import type {
  InterbankLoanPlacedPayload,
  RepoTradeOpenedPayload,
} from "../event-store/event-types/repo-mmd-ibl";
import type { EventStore } from "../event-store/store";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import type { IrsTradeBookedPayload } from "../markets/cdm/ird";
import {
  type CreditExposure,
  RWA_BANK_ENTITIES,
  type RwaEngineOutput,
  type TradingBookPosition,
  computeRwa,
} from "../risk/rwa-engine";
import { requireWeight } from "../types/financial-input";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "./filter";

// ---------------------------------------------------------------------------
// Helper — extract a plain-string trade ID from an identifier that may be
// either a CDM Identifier object ({scheme, value}) or already a string.
// ---------------------------------------------------------------------------

function resolveTradeId(raw: unknown): string {
  if (raw !== null && typeof raw === "object" && "value" in (raw as object)) {
    return String((raw as { value: unknown }).value);
  }
  return String(raw);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_ID = "LE-ZA-HOZ-BANK";
const FUNCTIONAL_CURRENCY = "ZAR";
// Build-phase EUR ↔ ZAR rate: ~20 ZAR per EUR, expressed as minor/minor
// (cents per euro-cent).  Per rwa-delta.ts precedent (same constant, same
// rationale: operational RWA is zeroed via zero BI so the rate has no effect
// on the output until the BI projection lands).
const EUR_TO_ZAR_MINOR_RATE = 20_00;
const RWA_WEIGHT_TABLE_LABEL = "rwa.instrument-weight";

// ---------------------------------------------------------------------------
// Output wrapper
// ---------------------------------------------------------------------------

export interface RwaFromPositionsResult {
  /** Full RWA engine output. Only meaningful when buildPhaseFallback = false. */
  readonly output: RwaEngineOutput;
  /**
   * True when no trade-booking events were found in the store — the caller
   * should substitute BUILD_PHASE_TOTAL_RWA_MINOR (the ICAAP v1 constant)
   * in this case.
   */
  readonly buildPhaseFallback: boolean;
  /** Number of trade positions folded into the computation. */
  readonly tradeCount: number;
}

// ---------------------------------------------------------------------------
// Zero-output fallback helper
// ---------------------------------------------------------------------------

function makeZeroOutput(asOf: string): RwaEngineOutput {
  return {
    meta: {
      engine: "rwa-engine",
      engineVersion: "v0.1",
      approach: "standardised",
      entityId: ENTITY_ID,
      asOf,
      functionalCurrency: FUNCTIONAL_CURRENCY,
      sourceEventIds: [],
    },
    credit: { totalMinor: 0, lines: [] },
    market: { totalMinor: 0, capitalChargeMinor: 0, lines: [] },
    operational: { totalMinor: 0, biMinor: 0, bicMinor: 0, ilm: 1, bicBucket: "bucket-1" },
    cvaMinor: 0,
    totalRwaMinor: 0,
    outputFloorBinding: false,
    citations: ["D-RWA-LIVE-POSITIONS-PROJECTION-V1"],
    placeholders: [
      "[buildPhaseFallback: true — no trade-booking events found; caller uses BUILD_PHASE_TOTAL_RWA_MINOR]",
    ],
  };
}

// ---------------------------------------------------------------------------
// Main projection function
// ---------------------------------------------------------------------------

/**
 * Compute RWA from booked trade positions in the event store.
 *
 * Replays the following booking event types:
 *   BondTradeExecuted, RepoTradeOpened, InterbankLoanPlaced,
 *   FxTradeExecuted, IrsTradeBooked, EquityTradeBooked
 *
 * Returns a `RwaFromPositionsResult`.  When `buildPhaseFallback` is true
 * (no trades in store), the `output.totalRwaMinor` is 0 and callers must
 * substitute BUILD_PHASE_TOTAL_RWA_MINOR.
 *
 * @param eventStore  Singleton event store.
 * @param asOf        ISO 8601 as-of timestamp (used for replay filter + engine meta).
 */
export function computeRwaFromPositions(
  eventStore: EventStore,
  asOf: string,
  filter?: ProvenanceFilter,
): RwaFromPositionsResult {
  // Load market-risk weights from the canonical registry (CRO-owned,
  // cited — same pattern as rwa-delta.ts).
  const RWA_WEIGHTS = rwaInstrumentClassWeights();

  const creditExposures: CreditExposure[] = [];
  const tradingBookPositions: TradingBookPosition[] = [];
  const sourceEventIds: string[] = [];

  const provenanceFilter = filter ?? defaultProvenanceFilter();

  // =========================================================================
  // Pass 1 — collect closed trade IDs per product.
  //
  // Done before the booking-event passes so that a single linear scan of each
  // closing-event type suffices.  Sets are keyed on the same identifier that
  // the opening event uses (tradeId for Repo/FX/IRS; placementId for IBL).
  // =========================================================================

  // --- Repo closures: RepoEndLegSettled + RepoTradeTerminatedEarly ----------
  const closedRepoIds = new Set<string>();
  for (const ev of eventStore.replay({ type: "RepoEndLegSettled", asOf })) {
    const p = ev.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string") closedRepoIds.add(p.tradeId);
  }
  for (const ev of eventStore.replay({ type: "RepoTradeTerminatedEarly", asOf })) {
    const p = ev.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string") closedRepoIds.add(p.tradeId);
  }

  // --- IBL closures: InterbankLoanMatured + InterbankLoanRecalledEarly ------
  const closedIblIds = new Set<string>();
  for (const ev of eventStore.replay({ type: "InterbankLoanMatured", asOf })) {
    const p = ev.payload as { placementId?: unknown };
    if (typeof p.placementId === "string") closedIblIds.add(p.placementId);
  }
  for (const ev of eventStore.replay({ type: "InterbankLoanRecalledEarly", asOf })) {
    const p = ev.payload as { placementId?: unknown };
    if (typeof p.placementId === "string") closedIblIds.add(p.placementId);
  }

  // --- FX closures: SettlementConfirmed + TradeMatured{productKind:fx-spot} -
  const closedFxIds = new Set<string>();
  for (const ev of eventStore.replay({ type: "SettlementConfirmed", asOf })) {
    const p = ev.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string") closedFxIds.add(p.tradeId);
  }
  for (const ev of eventStore.replay({ type: "TradeMatured", asOf })) {
    const p = ev.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string") closedFxIds.add(p.tradeId);
  }

  // --- IRS closures: IrdSwapTerminated (tradeId is a plain string) ----------
  const closedIrsIds = new Set<string>();
  for (const ev of eventStore.replay({ type: "IrdSwapTerminated", asOf })) {
    const p = ev.payload as { tradeId?: unknown };
    if (typeof p.tradeId === "string") closedIrsIds.add(p.tradeId);
  }

  // =========================================================================
  // Pass 2 — build exposures, skipping any closed position.
  // =========================================================================

  // -------------------------------------------------------------------------
  // 1. BondTradeExecuted → CreditExposure
  //    Bonds in the banking book are FVOCI or amortised-cost assets — credit
  //    exposure at face value (nominalMinor).  Risk weight depends on issuer:
  //    "ZAG" ISIN prefix = RSA government bond = 0% (sovereign-domestic-currency
  //    per CRE20 + SARB national discretion); otherwise "corporate-ig" (65%).
  //    BondSold events are skipped (side="sell" check below).
  // -------------------------------------------------------------------------

  for (const ev of eventStore.replay({ type: "BondTradeExecuted", asOf })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    if ((ev.provenance as { kind?: string } | null)?.kind === "build-phase-fixture") continue;
    const p = ev.payload as unknown as BondTradeExecutedPayload;
    if (!p.tradeId || !p.nominalMinor) continue;
    // Side "sell" means the bank is short the bond — skip (no credit asset).
    if (p.side === "sell") continue;

    const isRsaGovtBond = (p.bondIsin ?? "").startsWith("ZAG");
    const counterpartyType = isRsaGovtBond ? "sovereign-domestic-currency" : "corporate-ig";

    creditExposures.push({
      counterpartyId: p.counterpartyLei ?? p.tradeId,
      counterpartyType,
      eadMinor: p.nominalMinor,
      currency: p.currency ?? FUNCTIONAL_CURRENCY,
      // exactOptionalPropertyTypes: omit ratingBucket for sovereign (0% weight;
      // undefined is not assignable to optional CreditRatingBucket with exactOptional).
      ...(isRsaGovtBond ? {} : { ratingBucket: "unrated" as const }),
      residualMaturity: "long-term",
      note: `BondTradeExecuted tradeId=${p.tradeId} isin=${p.bondIsin}`,
    });
    sourceEventIds.push(ev.event_id);
  }

  // -------------------------------------------------------------------------
  // 2. RepoTradeOpened → CreditExposure
  //    Repo = secured lending.  The bank's credit exposure is the cash
  //    advanced (startLegCashZar).  Counterparty type = "bank" (repos are
  //    predominantly interbank).  Risk weight = bank unrated, long-term = 75%.
  //    Settled / terminated repos are excluded (closedRepoIds first pass).
  // -------------------------------------------------------------------------

  for (const ev of eventStore.replay({ type: "RepoTradeOpened", asOf })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    if ((ev.provenance as { kind?: string } | null)?.kind === "build-phase-fixture") continue;
    const p = ev.payload as unknown as RepoTradeOpenedPayload;
    if (!p.tradeId || !p.startLegCashZar) continue;
    if (closedRepoIds.has(p.tradeId)) continue; // settled or terminated

    creditExposures.push({
      counterpartyId: p.counterpartyLei ?? p.tradeId,
      counterpartyType: "bank",
      eadMinor: p.startLegCashZar,
      currency: FUNCTIONAL_CURRENCY,
      ratingBucket: "unrated",
      residualMaturity: "long-term",
      note: `RepoTradeOpened tradeId=${p.tradeId}`,
    });
    sourceEventIds.push(ev.event_id);
  }

  // -------------------------------------------------------------------------
  // 3. InterbankLoanPlaced → CreditExposure
  //    Bank lends to another institution.  Credit exposure = principal placed
  //    (principalZar).  Counterparty type = "bank" (interbank lending).
  //    Risk weight = bank unrated, long-term = 75%.
  //    Matured / recalled loans are excluded (closedIblIds first pass).
  // -------------------------------------------------------------------------

  for (const ev of eventStore.replay({ type: "InterbankLoanPlaced", asOf })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    if ((ev.provenance as { kind?: string } | null)?.kind === "build-phase-fixture") continue;
    const p = ev.payload as unknown as InterbankLoanPlacedPayload;
    if (!p.placementId || !p.principalZar) continue;
    if (closedIblIds.has(p.placementId)) continue; // matured or recalled

    const maturityBucket: "short-term" | "long-term" =
      p.placementType === "call" ? "short-term" : "long-term";

    creditExposures.push({
      counterpartyId: p.counterpartyLei ?? p.placementId,
      counterpartyType: "bank",
      eadMinor: p.principalZar,
      currency: FUNCTIONAL_CURRENCY,
      ratingBucket: "unrated",
      residualMaturity: maturityBucket,
      note: `InterbankLoanPlaced placementId=${p.placementId} type=${p.placementType}`,
    });
    sourceEventIds.push(ev.event_id);
  }

  // -------------------------------------------------------------------------
  // 4. FxTradeExecuted → TradingBookPosition
  //    FX = market-risk position.  Notional = near-leg base-currency
  //    notional.amountMinor.  marketRiskWeight sourced from registry
  //    "FX-spot" entry (CRO-owned).
  //    Settled trades are excluded (closedFxIds first pass).
  // -------------------------------------------------------------------------

  const fxWeight = requireWeight(RWA_WEIGHTS, "FX-spot", RWA_WEIGHT_TABLE_LABEL);

  for (const ev of eventStore.replay({ type: "FxTradeExecuted", asOf })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    if ((ev.provenance as { kind?: string } | null)?.kind === "build-phase-fixture") continue;
    const p = ev.payload as unknown as FxTradeExecutedPayload;
    if (!p.tradeId || !p.legs || p.legs.length === 0) continue;

    const tradeIdValue = resolveTradeId(p.tradeId);
    if (closedFxIds.has(tradeIdValue)) continue; // settled

    // Near-leg is always index 0 per the CDM schema.
    const nearLeg = p.legs[0];
    const notionalMinor = nearLeg?.notional?.amountMinor;
    if (!notionalMinor || notionalMinor <= 0) continue;

    const currency = nearLeg?.notional?.currency ?? FUNCTIONAL_CURRENCY;
    const side = p.side === "sell" ? ("short" as const) : ("long" as const);

    tradingBookPositions.push({
      positionId: `fx-${tradeIdValue}`,
      riskType: "fx",
      notionalMinor,
      currency,
      side,
      marketRiskWeight: fxWeight,
      note: `FxTradeExecuted tradeId=${tradeIdValue}`,
    });
    sourceEventIds.push(ev.event_id);
  }

  // -------------------------------------------------------------------------
  // 5. IrsTradeBooked → TradingBookPosition
  //    IRS = interest-rate market-risk.  Notional = notional.amountMinor.
  //    marketRiskWeight sourced from registry "OTC-IRD" entry.
  //    Terminated swaps are excluded (closedIrsIds first pass).
  // -------------------------------------------------------------------------

  const irsWeight = requireWeight(RWA_WEIGHTS, "OTC-IRD", RWA_WEIGHT_TABLE_LABEL);

  for (const ev of eventStore.replay({ type: "IrsTradeBooked", asOf })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as unknown as IrsTradeBookedPayload;
    if (!p.tradeId || !p.notional?.amountMinor) continue;

    const tradeIdValue = resolveTradeId(p.tradeId);
    if (closedIrsIds.has(tradeIdValue)) continue; // terminated

    const notionalMinor = p.notional.amountMinor;
    if (notionalMinor <= 0) continue;

    tradingBookPositions.push({
      positionId: `irs-${tradeIdValue}`,
      riskType: "interest-rate",
      notionalMinor,
      currency: p.notional.currency ?? FUNCTIONAL_CURRENCY,
      // IRS: bank receives fixed = long interest-rate risk; bank pays fixed = short.
      side: "long", // conservative default — direction not structurally asymmetric at v0.1
      marketRiskWeight: irsWeight,
      note: `IrsTradeBooked tradeId=${tradeIdValue}`,
    });
    sourceEventIds.push(ev.event_id);
  }

  // -------------------------------------------------------------------------
  // 6. EquityTradeBooked → TradingBookPosition
  //    Equity held in trading-book = market-risk position.  Notional
  //    approximation: quantity × price.  marketRiskWeight from registry
  //    "JSE-EQUITY" entry.
  // -------------------------------------------------------------------------

  const equityWeight = requireWeight(RWA_WEIGHTS, "JSE-EQUITY", RWA_WEIGHT_TABLE_LABEL);

  for (const ev of eventStore.replay({ type: "EquityTradeBooked", asOf })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as Record<string, unknown>;
    // Backward-compat: both old and new EquityTradeBooked shapes in the store.
    const tradeId = (p.tradeId as string | undefined) ?? "";
    const quantity = typeof p.quantity === "number" ? p.quantity : 0;
    const price = typeof p.executionPrice === "number" ? p.executionPrice : 0;
    const currency = typeof p.currency === "string" ? p.currency : FUNCTIONAL_CURRENCY;

    const notionalMinor = Math.round(Math.abs(quantity) * price);
    if (notionalMinor <= 0) continue;

    tradingBookPositions.push({
      positionId: `equity-${tradeId}-${ev.event_id.slice(0, 8)}`,
      riskType: "equity",
      notionalMinor,
      currency,
      side: (p.side === "sell" ? "short" : "long") as "long" | "short",
      marketRiskWeight: equityWeight,
      note: `EquityTradeBooked tradeId=${tradeId}`,
    });
    sourceEventIds.push(ev.event_id);
  }

  // -------------------------------------------------------------------------
  // Graceful fallback: no trades → build-phase fallback
  // -------------------------------------------------------------------------

  const tradeCount = creditExposures.length + tradingBookPositions.length;

  if (tradeCount === 0) {
    return {
      output: makeZeroOutput(asOf),
      buildPhaseFallback: true,
      tradeCount: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Build RwaEngineInput and call the engine
  // -------------------------------------------------------------------------

  const output = computeRwa({
    entityId: ENTITY_ID,
    asOf,
    functionalCurrency: FUNCTIONAL_CURRENCY,
    creditExposures,
    tradingBookPositions,
    // Zero BI — no income-event projection yet.
    // Gap: real ILDC/SC/FC requires Bea M2 GL projection decomposed into
    //   OPE25 lines (SubLedgerPostingEmitted → income/expense classification).
    //   Until that lands, operational RWA = 0 (correct direction: conservative
    //   overstatement on RWA denominator when BI > 0 is suppressed here).
    businessIndicator: {
      ildcMinor: 0,
      scMinor: 0,
      fcMinor: 0,
      eurToFunctionalRate: EUR_TO_ZAR_MINOR_RATE,
      ilm: 1,
    },
    sourceEventIds,
  });

  return {
    output,
    buildPhaseFallback: false,
    tradeCount,
  };
}

// ---------------------------------------------------------------------------
// Type export (RwaDecomposition from ba-700-capital.ts shape)
// ---------------------------------------------------------------------------

/**
 * Derive a `RwaDecomposition` (BA 700 input shape) from a live
 * `RwaFromPositionsResult`.  Shortcut for callers wiring BA 700.
 */
export function toRwaDecomposition(result: RwaFromPositionsResult): {
  readonly creditRwaMinor: number;
  readonly marketRwaMinor: number;
  readonly operationalRwaMinor: number;
  readonly source: string;
} {
  const { output, buildPhaseFallback } = result;
  return {
    creditRwaMinor: output.credit.totalMinor,
    marketRwaMinor: output.market.totalMinor,
    operationalRwaMinor: output.operational.totalMinor,
    source: buildPhaseFallback ? "fixture-rehearsal" : "live-positions",
  };
}

// Re-export the entity scope constant for convenience at call-sites.
export { RWA_BANK_ENTITIES };
