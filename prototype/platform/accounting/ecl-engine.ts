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
import { deriveLoanInstanceExposures } from "./posting-rules-v2/loan-instance-fold";

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
 * by-category fold of the BA 200 (credit-risk loans-and-advances) projection AND
 * the CRE20 standardised risk-weight (the dominant BA 700 credit-RWA denominator).
 *
 * Originally the four debt-securities/interbank classes
 * (sovereign / bank / corporate / retail). EXTENDED (L5-FTR loan-origination
 * slice, D-BA-RETURN-CELL-VALUE-ENGINE item #2) with the two further Reg 23 /
 * CRE20 classes a real loan book spans — `sme-corporate` (corporate sub-treatment)
 * and `residential-mortgage` (LTV-stepped). The born-V2 loan-origination fold sets
 * the class from the instance's typed `loanTerms.exposureClass`; bonds + interbank
 * continue to use the original four. Append-only-safe: existing `DebtExposure`
 * constructors that set sovereign/bank/corporate/retail are unaffected.
 */
export type ExposureClass =
  | "sovereign"
  | "bank"
  | "corporate"
  | "sme-corporate"
  | "retail"
  | "residential-mortgage";

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
  /**
   * Obligor / issuer party identifier — the credit-concentration grain for the
   * BA 210 (large-exposures / LEX) projection. Bonds carry the **issuer** key
   * (all SA-government ISINs collapse to the single sovereign issuer); interbank
   * placements carry the borrowing counterparty's LEI. Optional so existing
   * `DebtExposure` constructors (tests, the BA 200 fold) remain valid; when
   * absent the LEX projection falls back to `instrumentId` (per-instrument
   * grain — never silently nets unrelated obligors together).
   */
  readonly obligorPartyId?: string;
  /** Exposure at default in minor currency units (gross market value). */
  readonly eadMinor: number;
  readonly currency: string;
  /**
   * OPTIONAL CRE20 loan-to-value band — the residential-mortgage risk weight is
   * LTV-stepped (CRE20). Carried by the born-V2 loan-origination fold for a
   * `residential-mortgage` exposure so `debtExposureToCreditExposure` resolves the
   * correct LTV-stepped weight rather than the conservative default. Absent for
   * bonds / interbank / non-mortgage loans (replay-safe; no behaviour change).
   * String-typed (the rwa-engine `LtvBucket` union) to avoid a platform→platform
   * type import here; the bridge narrows it.
   */
  readonly cre20LtvBucket?: string;
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

/**
 * Derive a bond's **issuer** party id from its ISIN — the credit-concentration
 * grain for the BA 210 (large-exposures / LEX) projection. All SA-government
 * ISINs (ZAG / ZAR prefix) collapse to the single RSA sovereign issuer so the
 * LEX fold aggregates them as one connected exposure (which Reg 24(8)(a) then
 * exempts). Any other ISIN keys to itself, pending a SecurityMaster issuer
 * source. This is the issuer obligor, NOT the trading counterparty (`counterpartyLei`):
 * credit concentration is to the entity that owes repayment.
 */
function bondIssuerPartyId(isin: string): string {
  if (isin.startsWith("ZAG") || isin.startsWith("ZAR")) return "issuer:sovereign:RSA";
  return `issuer:isin:${isin}`;
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
      obligorPartyId: bondIssuerPartyId(pos.isin),
      eadMinor,
      currency: pos.currency,
    });
  }

  out.push(...readInterbankExposures(store, provenanceFilter));
  out.push(...readLoanExposures(store, provenanceFilter));
  return out;
}

// ---------------------------------------------------------------------------
// Born-V2 LOAN-ORIGINATION fold (L5-FTR loan-origination slice, D-BA-RETURN-CELL-
// VALUE-ENGINE item #2). The bank-as-LENDER loans-and-advances asset — the credit
// EAD that drives BOTH the BA 200 credit-risk projection AND computeRwaComputed's
// credit leg (the dominant BA 700 capital denominator). Before this fold,
// readDebtExposures had NO loan source at all (only bonds + interbank), so the
// credit-RWA leg from a loan book folded to an honest 0; this fold is the core
// unblock.
//
// CONSUMER-SURFACE DISCIPLINE (D-FIL-CONSUMER-SURFACE-ARCHITECTURE; enforced by
// recon:fil-state-surface-isolation): this accounting / GL surface must NOT replay
// the raw `FilInstrument*` lifecycle for STATE. The loan EAD base is sourced from
// the sanctioned state-derivation module `posting-rules-v2/loan-instance-fold.ts`
// (`deriveLoanInstanceExposures`), which reads the FIL STATE register
// (`foldFilInstances`) for the live-loan set + stage and the CREATED payload for the
// FLOW amount + loanTerms. Here we only map that state-derived exposure onto the
// engine's `DebtExposure` shape (the ECL risk-bucket + LEX obligor grain). The
// exposure class + LTV band ride the DebtExposure so the CRE20 bridge
// (debtExposureToCreditExposure) resolves the LTV-stepped residential-mortgage
// weight (and the SME / mortgage classes) precisely.
//
// BORN-V2 (D-V1-REMOVAL-PHASE-1): the state-derivation reads only V2 FIL lifecycle
// events; never the v1-only `LoanBooked`. Provenance-filtered (the derivation reads
// the CREATED FLOW events under the lens), so a production-only lens excludes a
// simulated loan book (the honest pre-licence-day empty state).
// ---------------------------------------------------------------------------

/**
 * The ECL `riskBucket` (PD/LGD lookup key) for a loan exposure class. Loans use the
 * existing PD/LGD parameter buckets (no new model parameters minted here): the
 * engine-level Stage-1 ECL slice is dominated by the emitted `Ifrs9StageAssigned`
 * staging events in the BA 200 events-first path; this bucket is the fallback used
 * only by `computeStage1Ecl` when no staging event exists. Conservative mapping:
 * sovereign → sovereign-bond; bank → interbank-placement; everything else →
 * corporate-bond (the 80bps/45% conservative corporate bucket). Fail-loud:
 * `requireWeight` throws on any bucket absent from PD_12M_BPS / LGD_BPS.
 */
function loanRiskBucket(cls: ExposureClass): string {
  switch (cls) {
    case "sovereign":
      return "sovereign-bond";
    case "bank":
      return "interbank-placement";
    default:
      return "corporate-bond";
  }
}

/**
 * Map the state-derived born-V2 loan exposures onto the engine's `DebtExposure`
 * shape. The STATE (live-loan set + stage) + FLOW (EAD + loanTerms) derivation lives
 * in the sanctioned `loan-instance-fold.ts` (no raw FIL replay on this accounting
 * surface — D-FIL-CONSUMER-SURFACE-ARCHITECTURE).
 */
function readLoanExposures(store: EventStore, provenanceFilter?: ProvenanceFilter): DebtExposure[] {
  const exposures = deriveLoanInstanceExposures({
    eventStore: store,
    ...(provenanceFilter !== undefined ? { filter: provenanceFilter } : {}),
  });

  return exposures.map((loan) => ({
    instrumentId: `fi:loan:${loan.instance}`,
    tradeId: loan.instance,
    riskBucket: loanRiskBucket(loan.exposureClass),
    productFamily: "loan",
    exposureClass: loan.exposureClass,
    ...(loan.obligorPartyId !== undefined ? { obligorPartyId: loan.obligorPartyId } : {}),
    eadMinor: loan.eadMinor,
    currency: loan.currency,
    ...(loan.ltvBucket !== undefined ? { cre20LtvBucket: loan.ltvBucket } : {}),
  }));
}

/** Live interbank placement folded from InterbankLoanPlaced events. */
interface LivePlacement {
  placementId: string;
  principalMinor: number;
  currency: string;
  exposureClass: ExposureClass;
  /** Borrowing counterparty LEI — the LEX obligor grain for the placement. */
  counterpartyLei?: string;
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
    const counterpartyLei = typeof p.counterpartyLei === "string" ? p.counterpartyLei : undefined;
    live.set(placementId, {
      placementId,
      principalMinor,
      currency: "ZAR",
      exposureClass: readExposureClass(p.exposureClass) ?? "bank",
      ...(counterpartyLei ? { counterpartyLei } : {}),
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
      ...(pos.counterpartyLei ? { obligorPartyId: `lei:${pos.counterpartyLei}` } : {}),
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
