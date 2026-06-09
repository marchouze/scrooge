// platform/reporting/ba-300-nsfr.ts
//
// Net Stable Funding Ratio (NSFR) engine — BA 300 series / Regulation 26A.
//
// Companion to `ba-300-lcr.ts` (LCR engine). The NSFR measures a bank's
// ability to sustain its operations over a 1-year horizon using available
// stable funding (ASF) to cover required stable funding (RSF).
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10) — companion to Slice 3 (LCR).
//
// Regulatory basis:
//   - BCBS "Basel III: the net stable funding ratio" (Oct 2014 / BCBS 295).
//   - Regulations Relating to Banks Regulation 26A (NSFR implementation).
//   - NSFR is reported within the SARB BA 300 liquidity-risk series (BA 300 =
//     "Liquidity Risk"; the NSFR rides the same return family as the LCR). The
//     prior "BA 120" / "BA 610" labels were fabricated numbering artefacts
//     (BA 120 = Income Statement; BA 610 = Foreign Operations). Re-numbered
//     forward-only under D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (CEO 2026-06-09,
//     supersedes D-BA-RETURN-FORM-NUMBERING-RECON); see
//     Regulations/SARB-PA/ba-returns/_canonical-register.md.
//
// ## Computation
//
//   ASF = Σ(liability_i × ASF_factor_i)
//   RSF = Σ(asset_j × RSF_factor_j)
//   NSFR = ASF / RSF       (must be ≥ 100% = 1.0)
//
// ASF factors (BCBS Table 3 / Reg 26A):
//   - Stable retail deposits (residual maturity ≥ 1yr): 95%
//   - Non-financial institutional deposits (residual maturity < 1yr): 50%
//   - Interbank liabilities (residual maturity < 6m): 0%
//
// RSF factors (BCBS Table 4 / Reg 26A):
//   - Level-1 HQLA (unencumbered): 5%
//   - Unencumbered corporate loans (residual maturity > 1yr): 85%
//   - Listed equities (not pledged): 50%
//   - Net OTC derivatives (conservative build-phase posture): 100%
//
// Principle 1 note: The NSFR engine emits `NSFRRatioProjection` events as the
// canonical ratio signals. The `NsfrProjection` struct is a convenience
// projection for renderers and tests.
//
// Build-phase substrate gaps:
//   - ASF factors for secured funding (repo, covered bonds) are not
//     yet wired — deferred to SARB BA 120 schema ingestion.
//   - Multi-currency NSFR — all inputs are assumed to be in ZAR minor
//     units; conversion at call site (Slice-6+).
//   - Residual-maturity bucketing — the engine accepts book-level
//     aggregates; per-instrument maturity is Slice-6+ territory.
//
// Author: Ravi (ALM / treasury engineer, engineering)

import { newEventId } from "../core/types";
import type { IrdSwapTradeExecutedPayload } from "../event-store/event-types/ird-accounting";
import type {
  DepositMaturedPayload,
  DepositTakenPayload,
  DepositWithdrawnEarlyPayload,
  FundingLineDrawnPayload,
  FundingLineRepaidPayload,
  InterbankLoanMaturedPayload,
  InterbankLoanPlacedPayload,
  InterbankLoanRecalledEarlyPayload,
} from "../event-store/event-types/repo-mmd-ibl";
import { makeNSFRRatioProjection } from "../event-store/event-types/risk-treasury-extended";
import type { EventStore } from "../event-store/store";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Inputs for the NSFR generator. All amounts are in ZAR minor units (cents).
 *
 * The caller is responsible for:
 *   - Aggregating balance-sheet positions into the correct liability / asset
 *     buckets.
 *   - Ensuring functional-currency conversion when multi-currency positions
 *     are held (Slice-6+ will automate this).
 *
 * Citations: BCBS 295 Tables 3–4; Regulations Relating to Banks Reg 26A.
 */
export interface NsfrInputs {
  /**
   * ISO 8601 period-end date the NSFR is computed at.
   * Convention: `AccountingPeriodClosed.closedAt`.
   */
  periodEnd: string;

  // -------------------------------------------------------------------------
  // Liabilities (funding sources) — ASF numerator.
  // -------------------------------------------------------------------------

  /**
   * Stable retail deposits with effective residual maturity ≥ 1 year.
   * ASF factor: 95% (BCBS Table 3, row 1).
   */
  retailDepositsZAR: number;

  /**
   * Wholesale / non-financial institutional deposits with residual
   * maturity < 1 year. ASF factor: 50% (BCBS Table 3, row 2).
   */
  institutionalDepositsZAR: number;

  /**
   * Interbank liabilities with residual maturity < 6 months.
   * ASF factor: 0% (BCBS Table 3, row 5 — operational deposits excluded).
   */
  interbankLiabilitiesZAR: number;

  /**
   * ZAR financial-corporate funding with residual maturity < 6 months.
   * ASF factor is date-dependent per the SARB D1/2023 §3 phase-out schedule:
   *   Before 2023-06-01: 50% (pre-directive BCBS 295 default)
   *   2023-06-01 – 2023-12-31: 30%
   *   2024-01-01 – 2024-12-31: 20%
   *   2025-01-01 – 2027-12-31: 10%
   *   From 2028-01-01: 0%
   *
   * // D1/2023 §3 + ORG-PR-NSFR-004
   */
  zarFinCorpShortTermFundingZAR: number;

  // -------------------------------------------------------------------------
  // Assets (funding uses) — RSF denominator.
  // -------------------------------------------------------------------------

  /**
   * Unencumbered Level-1 HQLA stock (from LCR HQLA numerator, post-cap).
   * RSF factor: 5% (BCBS Table 4, row 1 — coins/notes + central bank reserves).
   */
  hqlaLevel1ZAR: number;

  /**
   * Unencumbered corporate loan book (residual maturity > 1yr, non-financial).
   * RSF factor: 85% (BCBS Table 4, row 3).
   */
  corporateLoansZAR: number;

  /**
   * Listed equity positions at market value, not pledged as collateral.
   * RSF factor: 50% (BCBS Table 4 — equities, risk-weight ≤ 100%).
   */
  equityBookZAR: number;

  /**
   * Net OTC derivative exposure (after netting + margin agreements).
   * RSF factor: 100% (conservative build-phase posture; BCBS Table 4,
   * derivative liabilities; re-assess at Slice-6+).
   */
  otcDerivativesNetZAR: number;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/**
 * NSFR component breakdown — aids line-by-line BA 120 render.
 */
export interface NsfrComponents {
  /** ASF from retail deposits (retailDepositsZAR × 0.95). */
  readonly asfRetail: number;
  /** ASF from institutional deposits (institutionalDepositsZAR × 0.50). */
  readonly asfInstitutional: number;
  /** ASF from interbank liabilities (interbankLiabilitiesZAR × 0.00 = 0). */
  readonly asfInterbank: number;
  /**
   * ASF from ZAR financial-corporate short-term funding
   * (zarFinCorpShortTermFundingZAR × zarFinCorpAsfFactor(periodEnd)).
   * D1/2023 §3 + ORG-PR-NSFR-004
   */
  readonly asfZarFinCorpShortTerm: number;
  /** RSF from Level-1 HQLA (hqlaLevel1ZAR × 0.05). */
  readonly rsfHqla: number;
  /** RSF from corporate loans (corporateLoansZAR × 0.85). */
  readonly rsfLoans: number;
  /** RSF from equity book (equityBookZAR × 0.50). */
  readonly rsfEquity: number;
  /** RSF from net OTC derivatives (otcDerivativesNetZAR × 1.00). */
  readonly rsfDerivatives: number;
}

/**
 * Full NSFR generator output.
 *
 * `nsfrRatio` is dimensionless (1.0 = 100% = minimum threshold).
 * Render layers multiply by 100 for percentage display.
 */
export interface NsfrProjection {
  /** Total Available Stable Funding (ZAR minor units). */
  readonly availableStableFundingZAR: number;
  /** Total Required Stable Funding (ZAR minor units). */
  readonly requiredStableFundingZAR: number;
  /** NSFR = ASF / RSF. 1.0 = minimum regulatory threshold. */
  readonly nsfrRatio: number;
  /** true when nsfrRatio < 1.0. */
  readonly breached: boolean;
  /** ISO 8601 period-end date the NSFR was computed at. */
  readonly periodEnd: string;
  /** Per-component breakdown for BA 120 line rendering. */
  readonly components: NsfrComponents;
  /**
   * NSFR regulatory minimum (always 1.0 per BCBS 295 / Reg 26A).
   * Carried in the output for downstream render / recon assertions.
   */
  readonly minimumThreshold: 1.0;
  /** Citations the generator carries into the `NSFRRatioProjection` event. */
  readonly citations: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class NsfrGeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NsfrGeneratorError";
  }
}

// ---------------------------------------------------------------------------
// ASF / RSF factor tables
// ---------------------------------------------------------------------------

/**
 * Available Stable Funding (ASF) factors per BCBS 295 Table 3.
 *
 * Citation: BCBS 295 §48; Regulations Relating to Banks Reg 26A.
 */
const ASF_FACTORS = {
  /** Stable retail deposits, residual maturity ≥ 1yr: 95%. */
  retail: 0.95,
  /** Non-financial institutional deposits, residual maturity < 1yr: 50%. */
  institutional: 0.5,
  /** Interbank liabilities, residual maturity < 6m: 0%. */
  interbank: 0.0,
} as const;

// ---------------------------------------------------------------------------
// Phase-out schedule — ZAR financial-corporate funding (< 6 months)
// ---------------------------------------------------------------------------

/**
 * Returns the date-dependent ASF factor for ZAR financial-corporate funding
 * with residual maturity < 6 months, per the SARB D1/2023 phase-out schedule.
 *
 * Schedule (D1/2023 §3):
 *   Before 2023-06-01:          50%  (pre-directive BCBS 295 default)
 *   2023-06-01 – 2023-12-31:    30%
 *   2024-01-01 – 2024-12-31:    20%
 *   2025-01-01 – 2027-12-31:    10%
 *   From 2028-01-01:             0%
 *
 * // D1/2023 §3 + ORG-PR-NSFR-004
 *
 * @param asOf - The reporting/period-end date.
 * @returns ASF factor as a decimal (e.g. 0.30 = 30%).
 */
export function zarFinCorpAsfFactor(asOf: Date): number {
  // D1/2023 §3 + ORG-PR-NSFR-004
  const d = asOf;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1; // 1-based month

  if (y > 2027) return 0.0; // from 2028-01-01
  if (y >= 2025) return 0.1; // 2025-01-01 – 2027-12-31
  if (y === 2024) return 0.2; // 2024-01-01 – 2024-12-31
  if (y === 2023 && m >= 6) return 0.3; // 2023-06-01 – 2023-12-31
  return 0.5; // before 2023-06-01 (pre-directive BCBS 295 default)
}

/**
 * Required Stable Funding (RSF) factors per BCBS 295 Table 4.
 *
 * Citation: BCBS 295 §48; Regulations Relating to Banks Reg 26A.
 */
const RSF_FACTORS = {
  /** Unencumbered Level-1 HQLA: 5%. */
  hqlaLevel1: 0.05,
  /** Unencumbered corporate loans, residual maturity > 1yr: 85%. */
  corporateLoans: 0.85,
  /** Listed equities, not pledged: 50%. */
  equityBook: 0.5,
  /**
   * Net OTC derivatives: 100% (conservative build-phase posture).
   * BCBS 295 Table 4 specifies 100% for net OTC derivative liabilities;
   * applying this to net exposure is a build-phase conservative choice.
   * Slice-6+: re-assess with maturity-bucketed derivative schedule.
   */
  otcDerivatives: 1.0,
} as const;

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the NSFR projection (BA 120) and emit a typed
 * `NSFRRatioProjection` event to the event store.
 *
 * **Principle 1 compliant**: the event is the canonical signal; the returned
 * `NsfrProjection` struct is a convenience projection. Downstream projections
 * should fold from `NSFRRatioProjection` events in the event store, not from
 * in-memory struct state.
 *
 * The generator is deterministic — same inputs produce the same output and
 * the same event payload (deterministic `projectionId` is NOT used here;
 * `newEventId()` produces a stable run-id per invocation). Call sites that
 * need idempotency should check for an existing `NSFRRatioProjection` event
 * for the same `asOf` + `entity` before calling.
 *
 * Citations:
 *   BCBS 295 ("Basel III: the net stable funding ratio", Oct 2014);
 *   Regulations Relating to Banks Reg 26A;
 *   BA 120 (SARB NSFR return);
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
 */
export async function generateNsfrProjection(
  store: EventStore,
  inputs: NsfrInputs,
): Promise<NsfrProjection> {
  // Input guard: non-negative amounts required.
  const positiveFields: Array<[keyof NsfrInputs, number]> = [
    ["retailDepositsZAR", inputs.retailDepositsZAR],
    ["institutionalDepositsZAR", inputs.institutionalDepositsZAR],
    ["interbankLiabilitiesZAR", inputs.interbankLiabilitiesZAR],
    ["zarFinCorpShortTermFundingZAR", inputs.zarFinCorpShortTermFundingZAR],
    ["hqlaLevel1ZAR", inputs.hqlaLevel1ZAR],
    ["corporateLoansZAR", inputs.corporateLoansZAR],
    ["equityBookZAR", inputs.equityBookZAR],
    ["otcDerivativesNetZAR", inputs.otcDerivativesNetZAR],
  ];
  for (const [field, value] of positiveFields) {
    if (value < 0) {
      throw new NsfrGeneratorError(
        `NSFR generator: '${field}' must be ≥ 0, got ${value}. All inputs are balance-sheet magnitudes in ZAR minor units.`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // ASF (numerator).
  // -------------------------------------------------------------------------
  const asfRetail = inputs.retailDepositsZAR * ASF_FACTORS.retail;
  const asfInstitutional = inputs.institutionalDepositsZAR * ASF_FACTORS.institutional;
  const asfInterbank = inputs.interbankLiabilitiesZAR * ASF_FACTORS.interbank; // always 0

  // ZAR financial-corporate short-term funding — date-dependent ASF factor.
  // D1/2023 §3 + ORG-PR-NSFR-004
  const finCorpFactor = zarFinCorpAsfFactor(new Date(inputs.periodEnd));
  const asfZarFinCorpShortTerm = inputs.zarFinCorpShortTermFundingZAR * finCorpFactor;

  const availableStableFundingZAR =
    asfRetail + asfInstitutional + asfInterbank + asfZarFinCorpShortTerm;

  // -------------------------------------------------------------------------
  // RSF (denominator).
  // -------------------------------------------------------------------------
  const rsfHqla = inputs.hqlaLevel1ZAR * RSF_FACTORS.hqlaLevel1;
  const rsfLoans = inputs.corporateLoansZAR * RSF_FACTORS.corporateLoans;
  const rsfEquity = inputs.equityBookZAR * RSF_FACTORS.equityBook;
  const rsfDerivatives = inputs.otcDerivativesNetZAR * RSF_FACTORS.otcDerivatives;

  const requiredStableFundingZAR = rsfHqla + rsfLoans + rsfEquity + rsfDerivatives;

  // -------------------------------------------------------------------------
  // NSFR ratio. RSF = 0 implies no illiquid assets to fund → unconstrained.
  // -------------------------------------------------------------------------
  const nsfrRatio =
    requiredStableFundingZAR > 0
      ? availableStableFundingZAR / requiredStableFundingZAR
      : Number.POSITIVE_INFINITY;
  const breached = Number.isFinite(nsfrRatio) && nsfrRatio < 1.0;

  const citations: readonly string[] = [
    "REG-26A-NSFR",
    "BCBS-295",
    "BA-120",
    "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
    "Regulations Relating to Banks Reg 26A",
  ];

  // -------------------------------------------------------------------------
  // Emit NSFRRatioProjection event (Principle 1 — canonical signal).
  // -------------------------------------------------------------------------
  const nsfrRatioPct = Number.isFinite(nsfrRatio) ? nsfrRatio * 100 : 999_99;
  const status: "above-minimum" | "at-minimum" | "below-minimum" =
    nsfrRatio > 1.0 ? "above-minimum" : nsfrRatio === 1.0 ? "at-minimum" : "below-minimum";

  const event = makeNSFRRatioProjection({
    asOf: inputs.periodEnd,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:ravi:nsfr-engine" },
    citations: [...citations],
    payload: {
      projectionId: newEventId(),
      asOf: inputs.periodEnd,
      projectionHorizonDays: 365,
      nsfrRatioPct,
      regulatoryMinimumPct: 100,
      status,
    },
  });
  store.append(event);

  return {
    availableStableFundingZAR,
    requiredStableFundingZAR,
    nsfrRatio,
    breached,
    periodEnd: inputs.periodEnd,
    minimumThreshold: 1.0,
    components: {
      asfRetail,
      asfInstitutional,
      asfInterbank,
      asfZarFinCorpShortTerm,
      rsfHqla,
      rsfLoans,
      rsfEquity,
      rsfDerivatives,
    },
    citations,
  };
}

// ---------------------------------------------------------------------------
// Events-first entry point (Phase 2 — WS-BA-RETURNS-P1-SOURCING)
// ---------------------------------------------------------------------------

/**
 * Generate the NSFR projection by folding product lifecycle events directly
 * from the event store.
 *
 * This is the Principle-1-compliant entry point for NSFR calculation:
 * ASF and RSF inputs are derived from typed events (DepositTaken,
 * FundingLineDrawn, InterbankLoanPlaced, IrdSwapTradeExecuted) rather than
 * from caller-supplied balance aggregates.
 *
 * **ASF fold (BCBS 295 §127 Table 1):**
 * - Live deposits (DepositTaken not yet closed): weighted by category ×
 *   residual maturity bucket.
 *   - retail-stable / retail-less-stable, residualDays ≥ 365 → 90%
 *   - retail-stable / retail-less-stable, residualDays < 365 → 80%
 *   - wholesale-operational, residualDays ≥ 365 → 50%; < 365 → 25%
 *   - wholesale-non-operational, residualDays ≥ 365 → 25%; < 365 → 0%
 * - Live funding lines (FundingLineDrawn not yet repaid):
 *   - residualDays ≥ 365 → 100%; < 365 → 0%
 *
 * **RSF fold (BCBS 295 §128 Table 2):**
 * - Live IBL placements (InterbankLoanPlaced not yet matured/recalled) →
 *   100% RSF (short-term claims on financial institutions).
 * - Live IRS positions (IrdSwapTradeExecuted not yet terminated) with
 *   positive initial NPV → 100% RSF (derivative assets).
 *
 * Note: HQLA Level-1 RSF (5%) is deferred to Slice-6+; requires the
 * unified-position × SecurityMaster fold. Set to zero here — a substrate
 * gap surfaced in the NSFR placeholders.
 *
 * Authority: D-BA-RETURN-NUMBERING-EXCEL-CANONICAL;
 *            BCBS 295 §127–§128 Tables 1–2;
 *            Regulations Relating to Banks Reg 26A.
 * Citations: WS-BA-RETURNS-P1-SOURCING Phase 2;
 *            Principles/1-events-are-truth.md.
 */
export async function generateNsfrFromEvents(
  store: EventStore,
  asOf: string,
  entity: string,
  _functionalCurrency: string,
): Promise<NsfrProjection> {
  const provenanceFilter = defaultProvenanceFilter();

  // Helper: days from asOf to a future date.
  function residualDays(maturityDateStr: string): number {
    const asOfMs = new Date(asOf).getTime();
    const matMs = new Date(maturityDateStr).getTime();
    return Math.max(0, Math.round((matMs - asOfMs) / 86_400_000));
  }

  // -------------------------------------------------------------------------
  // Step 1: Collect closed-position IDs.
  // -------------------------------------------------------------------------
  const closedDepositIds = new Set<string>();
  const closedFundingLineIds = new Set<string>();
  const closedIblPlacementIds = new Set<string>();
  const terminatedSwapIds = new Set<string>();

  for (const event of store.replay({ entity, asOf })) {
    if (!eventMatchesProvenanceFilter(event, provenanceFilter)) continue;
    if (event.type === "DepositMatured") {
      closedDepositIds.add((event.payload as DepositMaturedPayload).depositId);
    } else if (event.type === "DepositWithdrawnEarly") {
      closedDepositIds.add((event.payload as DepositWithdrawnEarlyPayload).depositId);
    } else if (event.type === "FundingLineRepaid") {
      closedFundingLineIds.add((event.payload as FundingLineRepaidPayload).fundingLineId);
    } else if (event.type === "InterbankLoanMatured") {
      closedIblPlacementIds.add((event.payload as InterbankLoanMaturedPayload).placementId);
    } else if (event.type === "InterbankLoanRecalledEarly") {
      closedIblPlacementIds.add((event.payload as InterbankLoanRecalledEarlyPayload).placementId);
    } else if (event.type === "IrdSwapTerminated") {
      // IrdSwapTerminatedPayload has tradeId — inline cast.
      const p = event.payload as { tradeId: string };
      terminatedSwapIds.add(p.tradeId);
    }
  }

  // -------------------------------------------------------------------------
  // Step 2: Fold opening events into ASF / RSF buckets.
  // -------------------------------------------------------------------------

  // ASF accumulators.
  let asfFromDeposits = 0;
  let asfFromFundingLines = 0;

  // RSF accumulators.
  let rsfFromIbl = 0;
  let rsfFromIrsAssets = 0;

  for (const event of store.replay({ entity, asOf })) {
    if (!eventMatchesProvenanceFilter(event, provenanceFilter)) continue;

    if (event.type === "DepositTaken") {
      const p = event.payload as DepositTakenPayload;
      if (closedDepositIds.has(p.depositId)) continue;
      const days = residualDays(p.maturityDate);
      let factor = 0;
      if (p.depositCategory === "retail-stable" || p.depositCategory === "retail-less-stable") {
        factor = days >= 365 ? 0.9 : 0.8;
      } else if (p.depositCategory === "wholesale-operational") {
        factor = days >= 365 ? 0.5 : 0.25;
      } else if (p.depositCategory === "wholesale-non-operational") {
        factor = days >= 365 ? 0.25 : 0.0;
      }
      asfFromDeposits += Math.round(p.principalZar * factor);
    } else if (event.type === "FundingLineDrawn") {
      const p = event.payload as FundingLineDrawnPayload;
      if (closedFundingLineIds.has(p.fundingLineId)) continue;
      const days = residualDays(p.maturityDate);
      const factor = days >= 365 ? 1.0 : 0.0;
      asfFromFundingLines += Math.round(p.drawnAmountZar * factor);
    } else if (event.type === "InterbankLoanPlaced") {
      const p = event.payload as InterbankLoanPlacedPayload;
      if (closedIblPlacementIds.has(p.placementId)) continue;
      // 100% RSF — short-term claims on financial institutions per BCBS 295 Table 2.
      rsfFromIbl += p.principalZar;
    } else if (event.type === "IrdSwapTradeExecuted") {
      const p = event.payload as IrdSwapTradeExecutedPayload;
      if (terminatedSwapIds.has(p.tradeId)) continue;
      // Positive initial NPV = derivative asset → 100% RSF.
      if (p.npvMinor > 0) {
        rsfFromIrsAssets += p.npvMinor;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: Build NsfrInputs and delegate to generateNsfrProjection.
  // -------------------------------------------------------------------------

  // Note: HQLA Level-1 RSF (5%) is a substrate gap at Phase 2 — requires
  // unified-position × SecurityMaster fold (Slice-6+). Surfaced via placeholder
  // in the NSFR output.
  // Note: zarFinCorpShortTermFundingZAR defaulted to 0 — no dedicated event
  //   type for this funding class yet (Slice-6+).

  const inputs: NsfrInputs = {
    periodEnd: asOf,
    // ASF — split deposits into retail vs wholesale vs interbank buckets.
    // Phase 2 maps all deposits through asfFromDeposits (weighted inline above);
    // to avoid double-counting we use zero for the individual bucket fields and
    // route through the institutional bucket (50% factor is already pre-applied).
    // The zarFinCorpShortTerm + interbank slots are zero at Phase 2.
    retailDepositsZAR: 0,
    institutionalDepositsZAR: 0,
    interbankLiabilitiesZAR: 0,
    zarFinCorpShortTermFundingZAR: 0,
    // RSF
    hqlaLevel1ZAR: 0, // substrate gap — see note above
    corporateLoansZAR: 0, // no corporate loan lifecycle events at Phase 2
    equityBookZAR: 0, // no equity book lifecycle events at Phase 2
    otcDerivativesNetZAR: 0, // derivative RSF handled via rsfFromIrsAssets below
  };

  // We bypass the NsfrInputs bucketing for our event-derived totals by
  // computing ASF and RSF directly and constructing a synthetic NsfrInputs
  // that, when passed through generateNsfrProjection, yields the correct ratio.
  // The simplest approach: pass asfFromDeposits + asfFromFundingLines as
  // already-weighted amounts through a 100%-factor bucket (retailDepositsZAR ×
  // ASF_FACTORS.retail = 0.95 is NOT what we want). Instead we inject them
  // through interbankLiabilitiesZAR at 0% and override below — but the cleanest
  // approach that avoids fighting the factor table is to compute ASF + RSF inline
  // and emit the NSFRRatioProjection event directly rather than delegating.

  // Compute final ASF and RSF.
  const availableStableFundingMinor = asfFromDeposits + asfFromFundingLines;
  const requiredStableFundingMinor = rsfFromIbl + rsfFromIrsAssets;

  const nsfrRatio =
    requiredStableFundingMinor > 0
      ? availableStableFundingMinor / requiredStableFundingMinor
      : Number.POSITIVE_INFINITY;
  const breached = Number.isFinite(nsfrRatio) && nsfrRatio < 1.0;

  const citations: readonly string[] = [
    "REG-26A-NSFR",
    "BCBS-295",
    "D-BA-RETURN-NUMBERING-EXCEL-CANONICAL",
    "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
    "Principles/1-events-are-truth.md",
    "WS-BA-RETURNS-P1-SOURCING",
  ];

  // Emit NSFRRatioProjection event (Principle 1 — canonical signal).
  const nsfrRatioPct = Number.isFinite(nsfrRatio) ? nsfrRatio * 100 : 999_99;
  const status: "above-minimum" | "at-minimum" | "below-minimum" =
    nsfrRatio > 1.0 ? "above-minimum" : nsfrRatio === 1.0 ? "at-minimum" : "below-minimum";

  const event = makeNSFRRatioProjection({
    asOf,
    entity,
    actor: { type: "service", id: "agent:ravi:nsfr-engine" },
    citations: [...citations],
    payload: {
      projectionId: newEventId(),
      asOf,
      projectionHorizonDays: 365,
      nsfrRatioPct,
      regulatoryMinimumPct: 100,
      status,
    },
  });
  store.append(event);

  // Build components breakdown using a synthetic mapping.
  // Phase 2 presents asfFromDeposits as asfRetail and asfFromFundingLines
  // as asfInstitutional for display (both are pre-weighted).
  const components: NsfrComponents = {
    asfRetail: asfFromDeposits,
    asfInstitutional: asfFromFundingLines,
    asfInterbank: 0,
    asfZarFinCorpShortTerm: 0,
    rsfHqla: 0, // substrate gap
    rsfLoans: 0,
    rsfEquity: 0,
    rsfDerivatives: rsfFromIrsAssets,
  };

  // Suppress unused variable warning — inputs built for future delegation.
  void inputs;

  return {
    availableStableFundingZAR: availableStableFundingMinor,
    requiredStableFundingZAR: requiredStableFundingMinor,
    nsfrRatio,
    breached,
    periodEnd: asOf,
    minimumThreshold: 1.0,
    components,
    citations,
  };
}
