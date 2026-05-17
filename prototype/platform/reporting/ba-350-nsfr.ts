// platform/reporting/ba-350-nsfr.ts
//
// Net Stable Funding Ratio (NSFR) engine — BA 300 / Regulation 26A.
//
// Companion to `ba-325-lcr.ts` (LCR engine). The NSFR measures a bank's
// ability to sustain its operations over a 1-year horizon using available
// stable funding (ASF) to cover required stable funding (RSF).
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10) — companion to Slice 3 (LCR).
//
// Regulatory basis:
//   - BCBS "Basel III: the net stable funding ratio" (Oct 2014 / BCBS 295).
//   - Regulations Relating to Banks Regulation 26A (NSFR implementation).
//   - BA 300 (SARB return for NSFR).
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
//     yet wired — deferred to SARB BA 300 schema ingestion.
//   - Multi-currency NSFR — all inputs are assumed to be in ZAR minor
//     units; conversion at call site (Slice-6+).
//   - Residual-maturity bucketing — the engine accepts book-level
//     aggregates; per-instrument maturity is Slice-6+ territory.
//
// Author: Ravi (ALM / treasury engineer, engineering)

import { newEventId } from "../core/types";
import { makeNSFRRatioProjection } from "../event-store/event-types/risk-treasury-extended";
import type { EventStore } from "../event-store/store";

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
 * NSFR component breakdown — aids line-by-line BA 300 render.
 */
export interface NsfrComponents {
  /** ASF from retail deposits (retailDepositsZAR × 0.95). */
  readonly asfRetail: number;
  /** ASF from institutional deposits (institutionalDepositsZAR × 0.50). */
  readonly asfInstitutional: number;
  /** ASF from interbank liabilities (interbankLiabilitiesZAR × 0.00 = 0). */
  readonly asfInterbank: number;
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
  /** Per-component breakdown for BA 300 line rendering. */
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
 * Generate the NSFR projection (BA 300) and emit a typed
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
 *   BA-300 (SARB NSFR return);
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

  const availableStableFundingZAR = asfRetail + asfInstitutional + asfInterbank;

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
    "BA-300",
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
    entity: "BANK-ZA-001",
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
      rsfHqla,
      rsfLoans,
      rsfEquity,
      rsfDerivatives,
    },
    citations,
  };
}
