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
//     Closed by:  SettlementConfirmed (tradeId string), TradeMatured{productKind:"fx-spot"} (tradeId string),
//                 FxTradeCancelled (tradeId string) — a cancelled trade carries no
//                 live market-risk position and must be excluded.
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

import { buildRateMap, convertMinor } from "../accounting/fx-rate-projection";
import { rwaInstrumentClassWeights } from "../config/financial-constants";
import { minorFromMoneyWire } from "../core/money-codec";
import type { BondTradeExecutedPayload } from "../event-store/event-types/bond-accounting";
import type { CcrEadComputedPayloadV2Type } from "../event-store/event-types/counterparty-credit-risk";
import type {
  InterbankLoanPlacedPayload,
  RepoTradeOpenedPayload,
} from "../event-store/event-types/repo-mmd-ibl";
import type { EventStore } from "../event-store/store";
import { isLiveInstance, resolveTradeLifecycle } from "../lifecycle/trade-lifecycle-state";
import type { FxTradeExecutedPayload } from "../markets/cdm/fx";
import type { IrsTradeBookedPayload } from "../markets/cdm/ird";
import { logger } from "../observability/logger";
import { resolveAllCounterpartyClasses } from "../risk/counterparty-classification";
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

  // --- Lifecycle closures across repo / IBL / FX / IRS (D-OPERATING-BOOK-
  //     PROVENANCE-ARCHITECTURE PR4/Phase-B). One canonical registry-driven
  //     resolver replaces the four hand-built closed-Sets: a position is live
  //     iff its instance is not matured / settled / cancelled / failed. FX
  //     closures = SettlementConfirmed + TradeMatured{fx-spot} + FxTradeCancelled;
  //     IRS = IrdSwapTerminated; repo/IBL = their matured/terminated/recalled
  //     events — all now registered in TRADE_LIFECYCLE_REGISTRY. The resolver is
  //     fed asOf-bounded events so a terminal after `asOf` leaves the position
  //     live at `asOf`, and the openings so live instances are recorded.
  const lifecycleIdx = resolveTradeLifecycle([
    ...eventStore.replay({ type: "RepoTradeOpened", asOf }),
    ...eventStore.replay({ type: "RepoEndLegSettled", asOf }),
    ...eventStore.replay({ type: "RepoTradeTerminatedEarly", asOf }),
    ...eventStore.replay({ type: "InterbankLoanPlaced", asOf }),
    ...eventStore.replay({ type: "InterbankLoanMatured", asOf }),
    ...eventStore.replay({ type: "InterbankLoanRecalledEarly", asOf }),
    ...eventStore.replay({ type: "FxTradeExecuted", asOf }),
    ...eventStore.replay({ type: "SettlementConfirmed", asOf }),
    ...eventStore.replay({ type: "TradeMatured", asOf }),
    ...eventStore.replay({ type: "FxTradeCancelled", asOf }),
    ...eventStore.replay({ type: "IrsTradeBooked", asOf }),
    ...eventStore.replay({ type: "IrdSwapTerminated", asOf }),
  ]);

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
    const p = ev.payload as unknown as RepoTradeOpenedPayload;
    if (!p.tradeId || !p.startLegCashZar) continue;
    if (!isLiveInstance(lifecycleIdx.get(p.tradeId))) continue; // settled or terminated

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
    const p = ev.payload as unknown as InterbankLoanPlacedPayload;
    if (!p.placementId || !p.principalZar) continue;
    if (!isLiveInstance(lifecycleIdx.get(p.placementId))) continue; // matured or recalled

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
  // 3b. CcrEadComputed → CreditExposure (FX/IRS derivative counterparty default
  //     risk). SA-CCR EAD is correctly counterparty-class-AGNOSTIC (BCBS CRE52);
  //     the counterparty class is applied HERE at the risk-weight step
  //     (CreditRWA = EAD × RW). Pending an authoritative counterparty Basel-
  //     classification, this uses the most-punitive standard performing class
  //     (corporate-non-ig, unrated → 100% RW) as a PRUDENT interim — it OVER-
  //     states capital and refines DOWN as classification lands. Latest EAD per
  //     netting set wins (SA-CCR re-emits at each close).
  //
  //     UPSTREAM DEPENDENCY (this path is READY but currently INERT): SA-CCR has
  //     no production emitter yet (`computeAndEmitFor` is unwired), so there are
  //     no CcrEadComputed events to consume today and this contributes 0 to
  //     CreditRWA until SA-CCR is invoked to emit (Rohan). Currency: the RWA
  //     engine sums eadMinor in functional currency without FX conversion, so
  //     only ZAR-denominated netting sets are consumed (FX/IRS netting sets are
  //     ZAR today: FX MTM = unrealisedPnlZarMinor; ZARONIA IRS = ZAR). Non-ZAR
  //     EAD is skipped pending a conversion step (follow-up), never mis-summed.
  //
  //     Authority: D-FX-CCR-INTERIM-CONSERVATIVE-RWA (CEO 2026-06-10);
  //     D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL; BCBS-SA-CCR-CRE52.
  // -------------------------------------------------------------------------

  // Authoritative counterparty Basel-class register (D-FX-COUNTERPARTY-BASEL-
  // CLASSIFICATION). A classified counterparty applies its CRO-assigned class;
  // an UNclassified counterparty falls back to the prudent interim
  // (corporate-non-ig, unrated, 100% RW) and is surfaced by
  // recon:counterparty-basel-classification-coverage so the residual is visible.
  const classByCounterparty = resolveAllCounterpartyClasses(eventStore, asOf);

  // Event-sourced FX rate map (D-FX-EAD-FX-CONVERSION). A non-ZAR netting set's
  // EAD is converted to functional currency (ZAR) before it enters CreditRWA —
  // the RWA engine sums eadMinor without FX conversion, so a non-ZAR amount must
  // be converted HERE or it would be mis-summed. Previously non-ZAR EAD was
  // silently dropped; now it converts via the canonical buildRateMap/convertMinor
  // (P1 — rates derived from FxTradeExecuted). A netting set whose currency has
  // NO rate path to ZAR is skipped with a logged note (observable, not silent).
  const fxRates = buildRateMap([...eventStore.replay({ type: "FxTradeExecuted", asOf })]);

  const latestEadByNettingSet = new Map<
    string,
    { p: CcrEadComputedPayloadV2Type; eventId: string }
  >();
  for (const ev of eventStore.replay({ type: "CcrEadComputed", asOf })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as unknown as CcrEadComputedPayloadV2Type;
    if (!p.nettingSetId) continue;
    const prev = latestEadByNettingSet.get(p.nettingSetId);
    if (prev && prev.p.computationDate >= p.computationDate) continue;
    latestEadByNettingSet.set(p.nettingSetId, { p, eventId: ev.event_id });
  }
  for (const { p, eventId } of latestEadByNettingSet.values()) {
    // DECIMAL-MIGRATION (slice 2): p.ead is MoneyWire — decode to minor units for arithmetic.
    const eadMinorRaw = minorFromMoneyWire(p.ead);
    if (eadMinorRaw <= 0) continue;

    // Convert non-ZAR EAD to functional currency (ZAR). ZAR passes through.
    let eadZarMinor = eadMinorRaw;
    let conversionNote = "";
    if (p.currency !== FUNCTIONAL_CURRENCY) {
      const converted = convertMinor(eadMinorRaw, p.currency, FUNCTIONAL_CURRENCY, fxRates);
      if (converted === null) {
        // No rate path ccy→ZAR. Skip — but observable (Vera can assert on a
        // CcrEadComputed with no consuming CreditExposure), not a silent drop.
        logger.warn(
          {
            component: "rwa-from-positions.ccr-ead",
            nettingSetId: p.nettingSetId,
            currency: p.currency,
            asOf,
          },
          "CcrEadComputed in a non-ZAR currency with no FX rate path to ZAR; EAD excluded from CreditRWA pending a rate.",
        );
        continue;
      }
      eadZarMinor = converted;
      conversionNote = ` [converted ${p.currency} ${p.ead.amount} → ZAR ${eadZarMinor}]`;
    }

    const assigned = classByCounterparty.get(p.counterpartyId);
    const note = assigned
      ? `SA-CCR EAD nettingSet=${p.nettingSetId} — authoritative class ${assigned.baselClass} (CRO-assigned ${assigned.sourceEventId}; D-FX-COUNTERPARTY-BASEL-CLASSIFICATION)${conversionNote}`
      : `SA-CCR EAD nettingSet=${p.nettingSetId} — interim conservative class (corporate-non-ig, 100%) pending authoritative counterparty classification (D-FX-CCR-INTERIM-CONSERVATIVE-RWA)${conversionNote}`;
    creditExposures.push({
      counterpartyId: p.counterpartyId,
      counterpartyType: assigned?.baselClass ?? "corporate-non-ig",
      eadMinor: eadZarMinor,
      currency: FUNCTIONAL_CURRENCY,
      ratingBucket: assigned?.ratingBucket ?? "unrated",
      residualMaturity: assigned?.residualMaturity ?? "long-term",
      note,
    });
    sourceEventIds.push(eventId);
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
    const p = ev.payload as unknown as FxTradeExecutedPayload;
    if (!p.tradeId || !p.legs || p.legs.length === 0) continue;

    const tradeIdValue = resolveTradeId(p.tradeId);
    if (!isLiveInstance(lifecycleIdx.get(tradeIdValue))) continue; // settled / matured / cancelled

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
    if (!isLiveInstance(lifecycleIdx.get(tradeIdValue))) continue; // terminated

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
// Type export (RwaDecomposition from ba-100-capital.ts shape)
// ---------------------------------------------------------------------------

/**
 * Derive a `RwaDecomposition` (BA 100 input shape) from a live
 * `RwaFromPositionsResult`.  Shortcut for callers wiring BA 100.
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
