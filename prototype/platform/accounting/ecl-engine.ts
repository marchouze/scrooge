// platform/accounting/ecl-engine.ts
//
// IFRS 9 Expected Credit Loss (ECL) computation engine — the bound calc for the
// `ecl` figure in CALC_BINDINGS. Computes the 12-month Stage-1 ECL over the
// bank's actual debt book.
//
// 12-month ECL = Σ over in-scope debt exposures of (PD × LGD × EAD):
//   - EAD (exposure at default) = gross market value of the net debt position in
//     minor units, folded per ISIN from the store's `BondTradeExecuted` events
//     (the bond-accounting schema the event store validates and persists). Market
//     value = net nominal × latest clean price / 100. This is the same bond-trade
//     event stream the GL bond-posting engine and IFRS 9 staging consume.
//   - PD  (12-month probability of default) — build-phase point-in-time estimate.
//   - LGD (loss given default) — build-phase estimate, secured-vs-unsecured.
//   - Staging — every in-scope debt exposure is assessed via assessIfrs9Stage();
//     this engine surfaces only the *Stage-1* (12-month) ECL slice. Stage-2/3
//     lifetime ECL is a later licence-day deliverable (Slice 2 rehearsal scope).
//
// NO SILENT ZEROS (objective 4 of D-TRUSTED-FIGURES-PROGRAM-V1). When there are
// no in-scope debt exposures, the engine returns `status: "degraded"` with the
// reason "no in-scope debt exposures" — never an unexplained 0. The caller emits
// a CalculationPerformed with the matching status + a SubstrateAlert so the
// /api/data-failures banner surfaces it loudly.
//
// The PD/LGD parameter values consumed here are build-phase placeholders owned by
// the registered PD / LGD models (model:ecl-pd-ifrs9-v1, model:ecl-lgd-ifrs9-v1);
// the staging logic is model:ecl-staging-ifrs9-v1 (assessIfrs9Stage); the EAD read
// is model:ecl-ead-ifrs9-v1; this aggregation is model:ecl-engine-ifrs9-v1. The
// macroeconomic overlay (model:ecl-macro-overlay-ifrs9-v1) is registered but its
// adjustment is a no-op (factor 1.0) in the build phase pending scenario weights.
//
// Regulatory chain:
//   IFRS-9-§B5.5 → FIN-ACCT-01 (IFRS accounting policy) / RISK-MRP-01 §5
//   → PROC-IFRS9-STAGE-01 → assessIfrs9Stage() + computeStage1Ecl()
//
// Authority:
//   - D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 (CEO session-delegation 2026-05-29)
//   - D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29)
//   - IFRS 9 §B5.5; Regulations Relating to Banks Reg 23 (default definition)
//
// Author: Rohan (Risk systems engineer, engineering), coordinating Helena (Chief
//   Risk Officer, governance — methodology accountability) + Camille (Chief
//   Financial Officer, governance — IFRS 9 impairment figure owner); independently
//   validated by Nadia (Independent-validation engineer).

import type { EventStore } from "../event-store/store";
import { type ProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import { requireWeight } from "../types/financial-input";
import { assessIfrs9Stage } from "./ifrs9-staging";

// ---------------------------------------------------------------------------
// Build-phase PD / LGD parameter tables (loud lookups — no silent default)
// ---------------------------------------------------------------------------

/**
 * 12-month point-in-time PD by debt-exposure risk bucket, expressed in basis
 * points (1 bps = 0.01%). Build-phase placeholders owned by
 * model:ecl-pd-ifrs9-v1; conservative and consistent with the pre-licence risk
 * appetite. A bucket absent from this table is a data-integrity fault, not an
 * excuse to silently weight the exposure at 0% — `requireWeight` throws.
 */
const PD_12M_BPS: Readonly<Record<string, number>> = {
  // SA sovereign (SAGB) — non-zero 12-month PD even on local-currency sovereign
  // (IFRS 9 has no sovereign carve-out; a Stage-1 ECL still attaches).
  "sovereign-bond": 10,
  "corporate-bond": 80,
  "covered-bond": 25,
  // Generic / unclassified debt — most conservative of the bond buckets.
  "debt-other": 80,
  // Interbank placements (bank as lender). The borrowing counterparty is a
  // financial institution; PD between sovereign and corporate.
  "interbank-placement": 30,
};

/**
 * LGD by debt-exposure risk bucket, expressed in basis points of EAD
 * (1 bps = 0.01%; 4500 = 45%). Build-phase placeholders owned by
 * model:ecl-lgd-ifrs9-v1. Senior unsecured sovereign / high-grade debt uses the
 * Basel foundation-IRB-style 45% senior-unsecured LGD as a conservative proxy.
 */
const LGD_BPS: Readonly<Record<string, number>> = {
  "sovereign-bond": 4500,
  "corporate-bond": 4500,
  "covered-bond": 2500,
  "debt-other": 4500,
  // Interbank placements — senior unsecured exposure to a bank counterparty.
  "interbank-placement": 4500,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * BA 200 credit-risk exposure class — the obligor classification used by the
 * by-category fold of the BA 200 (credit-risk loans-and-advances) projection.
 */
export type ExposureClass = "sovereign" | "bank" | "corporate" | "retail";

/** A single in-scope debt exposure the ECL engine measures. */
export interface DebtExposure {
  readonly instrumentId: string;
  /**
   * Trade / placement URN of the originating exposure. Used to join emitted
   * `Ifrs9StageAssigned` events back to the exposure (the staging engine keys
   * by tradeId). Bonds use the bond tradeId; interbank placements use the
   * placementId. Empty string only for synthetic exposures constructed in tests.
   */
  readonly tradeId: string;
  /** ECL risk bucket key (PD/LGD table key). */
  readonly riskBucket: string;
  /**
   * IFRS 9 product family for staging fallback (`assessIfrs9Stage`). "bond"
   * for debt securities; "interbank" for interbank placements.
   */
  readonly productFamily: string;
  /** BA 200 obligor exposure class (sovereign / bank / corporate / retail). */
  readonly exposureClass: ExposureClass;
  /** Exposure at default in minor currency units (gross market value). */
  readonly eadMinor: number;
  readonly currency: string;
}

/** Per-exposure ECL breakdown (audit aid). */
export interface ExposureEcl {
  readonly instrumentId: string;
  readonly riskBucket: string;
  readonly stage: 1 | 2 | 3;
  readonly eadMinor: number;
  readonly pdBps: number;
  readonly lgdBps: number;
  readonly eclMinor: number;
}

export type EclStatus = "ok" | "degraded";

/** Result of a 12-month Stage-1 ECL run over the debt book. */
export interface EclResult {
  /** Aggregate 12-month Stage-1 ECL in minor currency units. */
  readonly eclMinor: number;
  /** Aggregate EAD in minor units (the exposure base). */
  readonly eadMinor: number;
  /** Number of in-scope debt exposures measured. */
  readonly exposureCount: number;
  /** Per-exposure breakdown. */
  readonly exposures: readonly ExposureEcl[];
  /**
   * `ok` when ≥1 in-scope debt exposure was measured; `degraded` when the debt
   * book is empty — a loud, reasoned absence, NEVER a silent 0.
   */
  readonly status: EclStatus;
  /** Reason the status is `degraded` (absent when `ok`). */
  readonly degradedReason?: string;
}

// ---------------------------------------------------------------------------
// Exposure base — read the debt book from the unified-position projection
// ---------------------------------------------------------------------------

/**
 * Map a bond ISIN to its ECL risk bucket. SA government bonds (SAGB) carry the
 * ISIN prefix `ZAG`; in the build phase the bond book is SA sovereign, but a
 * non-ZAG ISIN falls into the conservative `debt-other` bucket pending a
 * fuller issuer-classification source (SecurityMaster).
 */
function bucketForIsin(isin: string): string {
  if (isin.startsWith("ZAG") || isin.startsWith("ZAR")) return "sovereign-bond";
  return "debt-other";
}

/** Valid BA 200 exposure-class values (for narrowing event-payload reads). */
const EXPOSURE_CLASSES: readonly ExposureClass[] = ["sovereign", "bank", "corporate", "retail"];

function readExposureClass(value: unknown): ExposureClass | undefined {
  return typeof value === "string" && (EXPOSURE_CLASSES as readonly string[]).includes(value)
    ? (value as ExposureClass)
    : undefined;
}

/** Per-ISIN net bond position folded from BondTradeExecuted events. */
interface NetBondPosition {
  isin: string;
  /** First-seen bond trade id (used for the staging join). */
  tradeId: string;
  /** Net nominal in minor units (signed: + = long, − = net short). */
  netNominalMinor: number;
  /** Latest clean price as percentage of nominal. */
  lastCleanPricePercent: number;
  currency: string;
  /** Explicit exposureClass from the latest trade carrying one (if any). */
  exposureClass?: ExposureClass;
}

/**
 * Default BA 200 exposure class for a bond when the event omits `exposureClass`.
 * SA government bonds (ZAG / ZAR ISIN prefix) are sovereign; any other issuer
 * falls into the conservative `corporate` class pending a fuller issuer source.
 */
function defaultBondExposureClass(isin: string): ExposureClass {
  return isin.startsWith("ZAG") || isin.startsWith("ZAR") ? "sovereign" : "corporate";
}

/**
 * Read the in-scope debt exposures by folding the store's debt-instrument
 * lifecycle events:
 *
 *   - `BondTradeExecuted` per ISIN (debt securities) — EAD is the gross market
 *     value of each net position: |netNominalMinor| × latestCleanPrice / 100.
 *   - `InterbankLoanPlaced` per placement (bank as lender) — EAD is the
 *     outstanding principal; placements that have `InterbankLoanMatured` or
 *     `InterbankLoanRecalledEarly` are derecognised and excluded.
 *
 * `DepositTaken` is deliberately NOT folded — a deposit is a liability (the bank
 * is the obligor), not a debt asset the bank carries ECL on.
 *
 * Flat (net-zero) and derecognised positions are excluded. Pure aggregation of
 * the event log — no bank assumption, so not itself a registered model (the EAD
 * *methodology* is model:ecl-ead-ifrs9-v1; this read is its implementation).
 */
export function readDebtExposures(
  store: EventStore,
  provenanceFilter?: ProvenanceFilter,
): DebtExposure[] {
  const byIsin = new Map<string, NetBondPosition>();

  for (const ev of store.replay({ type: "BondTradeExecuted" })) {
    if (provenanceFilter && !eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as Record<string, unknown>;
    const isin = typeof p.bondIsin === "string" ? p.bondIsin : null;
    const tradeId = typeof p.tradeId === "string" ? p.tradeId : null;
    const nominalMinor = typeof p.nominalMinor === "number" ? p.nominalMinor : null;
    const cleanPricePercent = typeof p.cleanPricePercent === "number" ? p.cleanPricePercent : null;
    const side = p.side === "buy" || p.side === "sell" ? p.side : null;
    if (!isin || !tradeId || nominalMinor === null || cleanPricePercent === null || !side) continue;

    const signed = side === "buy" ? nominalMinor : -nominalMinor;
    const currency = typeof p.currency === "string" ? p.currency : "ZAR";
    const exposureClass = readExposureClass(p.exposureClass);

    const existing = byIsin.get(isin);
    if (existing) {
      existing.netNominalMinor += signed;
      existing.lastCleanPricePercent = cleanPricePercent; // latest trade wins
      if (exposureClass) existing.exposureClass = exposureClass;
    } else {
      byIsin.set(isin, {
        isin,
        tradeId,
        netNominalMinor: signed,
        lastCleanPricePercent: cleanPricePercent,
        currency,
        ...(exposureClass ? { exposureClass } : {}),
      });
    }
  }

  const out: DebtExposure[] = [];
  for (const pos of byIsin.values()) {
    if (pos.netNominalMinor === 0) continue;
    const eadMinor = Math.abs(Math.round((pos.netNominalMinor * pos.lastCleanPricePercent) / 100));
    if (eadMinor === 0) continue;
    out.push({
      instrumentId: `fi:bond:${pos.isin}`,
      tradeId: pos.tradeId,
      riskBucket: bucketForIsin(pos.isin),
      productFamily: "bond",
      exposureClass: pos.exposureClass ?? defaultBondExposureClass(pos.isin),
      eadMinor,
      currency: pos.currency,
    });
  }

  out.push(...readInterbankExposures(store, provenanceFilter));
  return out;
}

/** Live interbank placement folded from InterbankLoanPlaced events. */
interface LivePlacement {
  placementId: string;
  principalMinor: number;
  currency: string;
  exposureClass: ExposureClass;
}

/**
 * Fold live interbank placements (bank as lender) from the store. A placement
 * is live until it emits `InterbankLoanMatured` or `InterbankLoanRecalledEarly`.
 * EAD is the placed principal (`principalZar`, in minor units). IBL principal is
 * carried in ZAR minor units by schema, so the currency is ZAR.
 */
function readInterbankExposures(
  store: EventStore,
  provenanceFilter?: ProvenanceFilter,
): DebtExposure[] {
  const live = new Map<string, LivePlacement>();

  for (const ev of store.replay({ type: "InterbankLoanPlaced" })) {
    if (provenanceFilter && !eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as Record<string, unknown>;
    const placementId = typeof p.placementId === "string" ? p.placementId : null;
    const principalMinor = typeof p.principalZar === "number" ? p.principalZar : null;
    if (!placementId || principalMinor === null || principalMinor <= 0) continue;
    live.set(placementId, {
      placementId,
      principalMinor,
      currency: "ZAR",
      exposureClass: readExposureClass(p.exposureClass) ?? "bank",
    });
  }

  for (const ev of store.replay({ type: "InterbankLoanMatured" })) {
    const id = (ev.payload as Record<string, unknown>).placementId;
    if (typeof id === "string") live.delete(id);
  }
  for (const ev of store.replay({ type: "InterbankLoanRecalledEarly" })) {
    const id = (ev.payload as Record<string, unknown>).placementId;
    if (typeof id === "string") live.delete(id);
  }

  const out: DebtExposure[] = [];
  for (const pos of live.values()) {
    out.push({
      instrumentId: `fi:ibl:${pos.placementId}`,
      tradeId: pos.placementId,
      riskBucket: "interbank-placement",
      productFamily: "interbank",
      exposureClass: pos.exposureClass,
      eadMinor: pos.principalMinor,
      currency: pos.currency,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

/**
 * Compute the 12-month Stage-1 ECL for a single exposure:
 *   ECL = PD × LGD × EAD, with PD and LGD in basis points.
 *
 * PD and LGD are looked up loudly via requireWeight — an unknown risk bucket
 * throws rather than silently weighting the exposure at 0.
 */
export function computeExposureStage1Ecl(exposure: DebtExposure): ExposureEcl {
  const pdBps = requireWeight(PD_12M_BPS, exposure.riskBucket, "ecl.pd-12m");
  const lgdBps = requireWeight(LGD_BPS, exposure.riskBucket, "ecl.lgd");

  // Stage assessment — build-phase debt is performing (Stage 1); the staging
  // model (assessIfrs9Stage) is the authoritative classifier. We surface only
  // the 12-month (Stage-1) ECL slice here.
  const stageResult = assessIfrs9Stage({
    dpd: 0,
    manualSicr: false,
    restructured: false,
    defaultIndicator: false,
    productFamily: exposure.productFamily,
    notionalMinor: exposure.eadMinor,
    currency: exposure.currency,
  });

  // ECL = PD × LGD × EAD. PD and LGD each in bps → divide by 10_000 twice.
  const eclMinor = Math.round((exposure.eadMinor * pdBps * lgdBps) / (10_000 * 10_000));

  return {
    instrumentId: exposure.instrumentId,
    riskBucket: exposure.riskBucket,
    stage: stageResult.stage,
    eadMinor: exposure.eadMinor,
    pdBps,
    lgdBps,
    eclMinor,
  };
}

/**
 * Compute the aggregate 12-month Stage-1 ECL over the bank's debt book.
 *
 * NO SILENT ZEROS — when there are no in-scope debt exposures, returns
 * `status: "degraded"` with a reason, not a bare 0 the caller might surface as
 * a real figure.
 *
 * Authority: D-MODEL-REGISTRY-SCOPE-CLOSURE-V1; IFRS 9 §B5.5.
 */
export function computeStage1Ecl(store: EventStore): EclResult {
  const debtExposures = readDebtExposures(store);

  if (debtExposures.length === 0) {
    return {
      eclMinor: 0,
      eadMinor: 0,
      exposureCount: 0,
      exposures: [],
      status: "degraded",
      degradedReason:
        "no in-scope debt exposures (unified-position bond book is empty) — ECL is 0 by absence of exposure, NOT a computed figure",
    };
  }

  const exposures = debtExposures.map(computeExposureStage1Ecl);
  const eclMinor = exposures.reduce((s, e) => s + e.eclMinor, 0);
  const eadMinor = exposures.reduce((s, e) => s + e.eadMinor, 0);

  return {
    eclMinor,
    eadMinor,
    exposureCount: exposures.length,
    exposures,
    status: "ok",
  };
}
