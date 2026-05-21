// platform/reporting/ba-700-leverage-ratio.ts
//
// WS-CAPITAL-LEVERAGE-RATIO — Basel III Leverage Ratio module.
//
// The Basel III leverage ratio is a non-risk-weighted backstop to the
// risk-based capital ratios computed by `ba-700-capital.ts`. It catches
// the failure mode where a bank's RWA-denominated ratios look healthy
// because of low risk-weight buckets while gross balance-sheet leverage
// has been quietly building. Mandatory minimum is 3 % (BCBS §147); SARB
// adopts the same floor through RRTB Reg 38 read with Banks Act §70.
//
// Computation (BCBS Basel III §147–§165):
//
//   leverageRatio = tier1Capital / totalExposureMeasure
//
//   totalExposureMeasure =
//       on-balance-sheet exposures (gross of specific provisions; net of
//         regulatory deductions from the corresponding Tier-1 capital
//         numerator — BCBS §149)
//     + derivative exposures (RC + α·PFE per SA-CCR — BCBS §157, OR
//         current-exposure-method equivalent — BCBS §163; v0 carries
//         either form via caller-supplied `derivativeExposureMinor`)
//     + securities-financing transaction (SFT) exposures (BCBS §164)
//     + off-balance-sheet items, post credit-conversion factor (BCBS
//         §165; CCF banded 10 %–100 % depending on commitment type)
//
// Build-phase posture (CLAUDE.md "build phase vs licence-day"):
//   No real positions exist. Until commencement of trading the
//   `BUILD_PHASE_LEVERAGE_BASELINE` constant lets Helena's daily run
//   produce a non-`unmeasured` status against the ICAAP v1 capital
//   envelope (R300m). The exposure measure in build phase is the
//   notional value of committed-but-unsettled rehearsal trades plus
//   any drawn cash positions. Until any of those exist, exposure
//   measure is zero and the ratio is `Infinity` (regulator-floor
//   compliant by convention — same as the BA 700 divide-by-zero case).
//
// Module is a pure projection: inputs are caller-supplied, no event
// side-effects, no event-store reads. Mirrors the v0 contract of
// `ba-700-capital.ts` (RWA inputs caller-supplied at v0 — see C-3
// substrate gap note). Once SA-CCR is fully wired into a periodic
// projection (D-CREDIT-LIMIT-ENGINE-BUILD Phase 5 is already live but
// only at pre-deal-check granularity), the caller composes EAD by
// folding `SaCcrEadComputed` events; until then `derivativeExposureMinor`
// is supplied by the BA-700 generator caller.
//
// Authority:
//   - D-RAS (CEO-approved 2026-05-06)
//   - D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)
//   - Banks Act 94 of 1990 §70
//   - Regulations Relating to Banks Reg 38 (capital + leverage ratio)
//   - BCBS Basel III §147–§165 (leverage ratio framework)
//
// Authors: Helena (Chief Risk Officer, governance) co-routed Rohan (Market
//   risk quantitative engineer, engineering — measurement substrate).

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Exposure-measure decomposition per BCBS Basel III §147–§165. Each
 * component is the post-regulatory-treatment value in functional-currency
 * minor units (ZAR cents). The generator sums them into
 * `totalExposureMeasureMinor` and divides Tier-1 capital by the total to
 * produce the leverage ratio.
 *
 * Sign convention: every component is reported as a non-negative
 * magnitude. The leverage ratio framework does not net long against
 * short on-balance-sheet exposures (BCBS §149) — derivative netting is
 * handled separately within the SA-CCR `derivativeExposureMinor` value
 * the caller supplies.
 *
 * Citation provenance: where the caller has chained an SA-CCR computation
 * back to a `SaCcrEadComputed` event, threading the event_id through
 * `saccrEventId` preserves the Principle-1 chain-of-custody.
 */
export interface LeverageExposureDecomposition {
  /**
   * On-balance-sheet exposures: gross carrying value of all assets net
   * of specific provisions, less the same Tier-1-deductions that have
   * already been subtracted from the capital numerator (BCBS §149 —
   * avoids double-counting). Includes cash, securities, loans, repo
   * receivables.
   */
  readonly onBalanceSheetExposureMinor: number;

  /**
   * Derivative exposures per BCBS §157 + §162. v0 contract: caller
   * passes the SA-CCR EAD value (RC + α·PFE) summed across netting sets
   * for derivatives in scope. Coordinate with the credit-limit engine's
   * SA-CCR v1 implementation at `platform/risk/sa-ccr/ead.ts`.
   *
   * The current-exposure-method (CEM) is the BCBS-permitted alternative
   * during transition (BCBS §163); SA-Ccr is the preferred method and
   * what Hoz Bank uses end-to-end.
   */
  readonly derivativeExposureMinor: number;

  /**
   * Securities-financing transaction exposures (BCBS §164) — repos,
   * reverse repos, securities lending, securities borrowing, margin
   * lending. Computed gross of any cash payable/receivable; bilateral
   * netting permitted only where master-netting-agreement conditions
   * met (BCBS §165(g)).
   */
  readonly sftExposureMinor: number;

  /**
   * Off-balance-sheet exposures, post credit-conversion factor (BCBS
   * §165). v0 contract: caller pre-applies the CCF (10 %–100 % per
   * commitment-type bucket) and supplies the post-CCF magnitude.
   * Common categories: undrawn revolving commitments (10 % CCF for
   * unconditionally cancellable; 40 % otherwise), letters of credit
   * (20 %), guarantees (100 %).
   */
  readonly offBalanceSheetExposurePostCcfMinor: number;

  /**
   * Optional citation: when the SA-CCR EAD value is sourced from a
   * `SaCcrEadComputed` event in the store, threading the event_id here
   * preserves the chain-of-custody under Principle 1.
   */
  readonly saccrEventId?: string;

  /**
   * Optional source label. v0 default is "fixture-rehearsal" — the
   * forensic record makes the placeholder origin obvious.
   */
  readonly source?: string;
}

/**
 * Input for the leverage-ratio generator. Pure-function contract:
 * caller composes Tier-1 capital + exposure decomposition + (optional)
 * appetite thresholds. The generator does not call into the event store.
 */
export interface LeverageRatioGeneratorInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). Throws on non-bank. */
  readonly entity: string;
  /** ISO 8601 — period-end as-of date. */
  readonly asOf: string;
  /** Period identifier (`period:hoz-bank:month:2026-05`). */
  readonly periodId: string;
  /** ISO 4217 functional currency. */
  readonly functionalCurrency: string;
  /**
   * Tier-1 capital in functional-currency minor units. Typically the
   * `netTier1Minor` field of a `Ba700Output.capitalStack` — pass the
   * same number the BA 700 ratios are computed against to guarantee
   * consistency between the risk-based and leverage views.
   */
  readonly tier1CapitalMinor: number;
  /** Exposure-measure decomposition per BCBS §147–§165. */
  readonly exposureMeasure: LeverageExposureDecomposition;
  /**
   * Optional regulatory-minimum override. Defaults to 3 % per BCBS
   * §147 + RRTB Reg 38. SARB has not, as of 2026-05-21, exercised
   * its discretion to set a higher floor; the field is present so
   * the framework can absorb a future Pillar-2-style add-on without
   * a schema change.
   */
  readonly regulatoryMinimumRatio?: number;
}

/**
 * BCBS Basel III §147 regulatory minimum leverage ratio. SARB adopts
 * this floor unchanged through RRTB Reg 38 as of 2026-05-21.
 */
export const BCBS_LEVERAGE_RATIO_REGULATORY_MINIMUM = 0.03;

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/**
 * Exposure-measure section — per-component contribution and total.
 * Mirrors the `Ba700RwaSection` shape so the JSON render renders both
 * the risk-based denominator and the leverage denominator with the
 * same structural pattern.
 */
export interface LeverageExposureSection {
  readonly onBalanceSheetExposureMinor: number;
  readonly derivativeExposureMinor: number;
  readonly sftExposureMinor: number;
  readonly offBalanceSheetExposurePostCcfMinor: number;
  readonly totalExposureMeasureMinor: number;
  readonly source: string;
  readonly saccrEventId?: string;
}

/**
 * Leverage-ratio output. The ratio, the regulatory minimum, the
 * compliance flag, the tier-1 numerator, the exposure denominator
 * decomposition, and a fingerprint of the exposure inputs for forensic
 * reproducibility.
 *
 * `placeholders` mirrors the BA 700 generator's convention: any caller-
 * supplied fixture-grade input is surfaced here so the recon pipeline
 * can track placeholder density across the regulatory-output stack.
 */
export interface LeverageRatioOutput {
  readonly meta: {
    readonly form: "Leverage Ratio";
    readonly formVersion: "v0.1-rehearsal";
    readonly entity: string;
    readonly asOf: string;
    readonly periodId: string;
    readonly functionalCurrency: string;
    readonly generatorVersion: "v0.1";
    readonly exposureFingerprint: string;
  };
  readonly tier1CapitalMinor: number;
  readonly exposureMeasure: LeverageExposureSection;
  /** Tier-1 / total exposure measure. Infinity when exposure = 0. */
  readonly leverageRatio: number;
  readonly regulatoryMinimumRatio: number;
  /** True when leverageRatio ≥ regulatoryMinimumRatio. */
  readonly compliant: boolean;
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class LeverageRatioGeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeverageRatioGeneratorError";
  }
}

// ---------------------------------------------------------------------------
// Per-entity scope guard — same set as BA 700 (bank-licence-bound)
// ---------------------------------------------------------------------------

export const LEVERAGE_RATIO_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

function assertBankEntity(entity: string): void {
  if (!LEVERAGE_RATIO_BANK_ENTITIES.includes(entity)) {
    throw new LeverageRatioGeneratorError(
      `Leverage ratio is bank-licence-bound; entity '${entity}' is not in LEVERAGE_RATIO_BANK_ENTITIES (${LEVERAGE_RATIO_BANK_ENTITIES.join(", ")}). See Regulations/_legal-entity-tree.md + D-REGULATORY-PERIMETER. Group-consolidated leverage lands alongside Slice 7 BA 700 consolidation.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the Basel III leverage-ratio projection from Tier-1 capital
 * + exposure decomposition. Pure function; deterministic.
 *
 * Sign convention: every exposure component is reported as a positive
 * magnitude. Negative inputs are rejected — the leverage exposure
 * framework does not permit netting beyond the BCBS-specified rules,
 * which the caller applies inside the supplied `derivativeExposureMinor`
 * and `sftExposureMinor` values before invoking this generator.
 *
 * Divide-by-zero: zero total exposure measure ⇒ ratio = `Infinity`. The
 * compliance flag treats infinity as compliant (no exposure to leverage).
 * Mirrors the `generateBa700Capital` divide-by-zero treatment.
 */
export function generateLeverageRatio(input: LeverageRatioGeneratorInput): LeverageRatioOutput {
  assertBankEntity(input.entity);
  if (!input.functionalCurrency || input.functionalCurrency.length !== 3) {
    throw new LeverageRatioGeneratorError(
      `Leverage ratio generator: functionalCurrency must be ISO-4217 (3 chars), got '${input.functionalCurrency}'`,
    );
  }
  if (input.tier1CapitalMinor < 0) {
    throw new LeverageRatioGeneratorError(
      `Leverage ratio generator: tier1CapitalMinor must be non-negative, got ${input.tier1CapitalMinor}. Negative Tier 1 capital is a special case that requires Board attention before reporting; the generator does not silently render a negative-numerator ratio.`,
    );
  }
  const exposureFields: ReadonlyArray<readonly [string, number]> = [
    ["onBalanceSheetExposureMinor", input.exposureMeasure.onBalanceSheetExposureMinor],
    ["derivativeExposureMinor", input.exposureMeasure.derivativeExposureMinor],
    ["sftExposureMinor", input.exposureMeasure.sftExposureMinor],
    [
      "offBalanceSheetExposurePostCcfMinor",
      input.exposureMeasure.offBalanceSheetExposurePostCcfMinor,
    ],
  ];
  for (const [name, value] of exposureFields) {
    if (!Number.isFinite(value) || value < 0) {
      throw new LeverageRatioGeneratorError(
        `Leverage ratio generator: exposure component '${name}' must be a non-negative finite number, got ${value}. BCBS §147–§165 reports all exposure components as positive magnitudes; netting beyond the framework's allowance is applied inside the SA-CCR / SFT primitives before invocation.`,
      );
    }
  }

  const regulatoryMinimum = input.regulatoryMinimumRatio ?? BCBS_LEVERAGE_RATIO_REGULATORY_MINIMUM;
  if (!Number.isFinite(regulatoryMinimum) || regulatoryMinimum < 0 || regulatoryMinimum > 1) {
    throw new LeverageRatioGeneratorError(
      `Leverage ratio generator: regulatoryMinimumRatio must be a finite ratio in [0,1], got ${regulatoryMinimum}`,
    );
  }

  const totalExposureMeasureMinor =
    input.exposureMeasure.onBalanceSheetExposureMinor +
    input.exposureMeasure.derivativeExposureMinor +
    input.exposureMeasure.sftExposureMinor +
    input.exposureMeasure.offBalanceSheetExposurePostCcfMinor;

  // Divide-by-zero — zero exposure ⇒ infinite ratio (compliant by convention).
  const leverageRatio =
    totalExposureMeasureMinor > 0
      ? input.tier1CapitalMinor / totalExposureMeasureMinor
      : Number.POSITIVE_INFINITY;

  const compliant = leverageRatio >= regulatoryMinimum;

  const placeholders: string[] = [];
  if (
    input.exposureMeasure.source === undefined ||
    input.exposureMeasure.source === "fixture-rehearsal"
  ) {
    placeholders.push(
      "[citation: TBC — exposure-measure inputs are fixture-grade pending end-to-end SA-CCR + SFT + commitment projections; coordinate with credit-limit-engine SA-CCR v1 (D-CREDIT-LIMIT-ENGINE-BUILD)]",
    );
  }
  if (input.exposureMeasure.saccrEventId === undefined) {
    placeholders.push(
      "[citation: TBC — derivative-exposure component not chained to a SaCcrEadComputed event_id; chain-of-custody under Principle 1 incomplete until the periodic SA-CCR projection lands]",
    );
  }

  return {
    meta: {
      form: "Leverage Ratio",
      formVersion: "v0.1-rehearsal",
      entity: input.entity,
      asOf: input.asOf,
      periodId: input.periodId,
      functionalCurrency: input.functionalCurrency,
      generatorVersion: "v0.1",
      exposureFingerprint: fingerprintExposure(input.exposureMeasure),
    },
    tier1CapitalMinor: input.tier1CapitalMinor,
    exposureMeasure: {
      onBalanceSheetExposureMinor: input.exposureMeasure.onBalanceSheetExposureMinor,
      derivativeExposureMinor: input.exposureMeasure.derivativeExposureMinor,
      sftExposureMinor: input.exposureMeasure.sftExposureMinor,
      offBalanceSheetExposurePostCcfMinor:
        input.exposureMeasure.offBalanceSheetExposurePostCcfMinor,
      totalExposureMeasureMinor,
      source: input.exposureMeasure.source ?? "fixture-rehearsal",
      ...(input.exposureMeasure.saccrEventId
        ? { saccrEventId: input.exposureMeasure.saccrEventId }
        : {}),
    },
    leverageRatio,
    regulatoryMinimumRatio: regulatoryMinimum,
    compliant,
    citations: [
      "D-RAS",
      "D-MARKETS-CAPITAL-TIME-SHAPE",
      "Banks Act 94 of 1990 §70",
      "Regulations Relating to Banks Reg 38",
      "BCBS Basel III §147–§165",
    ],
    placeholders,
  };
}

function fingerprintExposure(e: LeverageExposureDecomposition): string {
  return JSON.stringify({
    onBalanceSheetExposureMinor: e.onBalanceSheetExposureMinor,
    derivativeExposureMinor: e.derivativeExposureMinor,
    sftExposureMinor: e.sftExposureMinor,
    offBalanceSheetExposurePostCcfMinor: e.offBalanceSheetExposurePostCcfMinor,
    saccrEventId: e.saccrEventId ?? null,
    source: e.source ?? "fixture-rehearsal",
  });
}

// ---------------------------------------------------------------------------
// Build-phase baseline — RAS appetite-line measurement substrate
// ---------------------------------------------------------------------------

/**
 * Build-phase leverage-ratio baseline aligned with the ICAAP v1 figures
 * carried in `platform/projections/capital-metrics.ts`. The Tier-1
 * capital envelope is R300m; the exposure measure is zero in the
 * pre-trading window (no positions, no derivatives, no commitments).
 * Ratio is `Infinity` (compliant — no exposure to leverage).
 *
 * When the first rehearsal trade settles or the first commitment is
 * booked, the exposure-measure projection takes over and produces a
 * real number. The build-phase baseline is the floor while the substrate
 * comes up.
 *
 * Authority: D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12).
 */
export const BUILD_PHASE_LEVERAGE_BASELINE_TIER1_MINOR = 30_000_000_000;
export const BUILD_PHASE_LEVERAGE_BASELINE_EXPOSURE_MINOR = 0;
