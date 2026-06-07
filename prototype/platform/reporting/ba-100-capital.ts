// platform/reporting/ba-100-capital.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 4 — BA 100 (Capital
// Adequacy Return) projection. The second SARB return rendered end-to-end
// after BA 110 (LCR, Slice 3).
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), pack §6 Slice 4.
//
// This module is a *pure projection* over the period-close `TrialBalance`
// (Slice 2) plus an explicit capital-classification map plus an explicit
// regulatory-deductions map plus typed RWA inputs (fixture-grade v0;
// real RWA-engine integration when W2 Slice 3 lands). No event side-
// effects; no document-store writes; no event-store reads. Callers (the
// CLI wrapper at `prototype/scripts/render-ba-100.ts`, downstream
// `ReportGenerated` event emitters in Slice 5) compose the inputs and
// consume the output.
//
// Pipeline (mirrors Slice 3's BA 110 architecture — one harness, two
// returns now):
//
//   EVENT LOG          (Principle 1 — sole truth)
//      → PROJECTION RUNTIME    — folds events into balances
//      → PERIOD CLOSE          — Slice 2 — snapshots the trial balance
//      → SEMANTIC LAYER        — Slice 1 + Slice 4 capital entries
//      → BA 100 PROJECTION     — this module — pure function
//      → RENDER + STORE        — `ba-100-render.ts` + RMS doc store
//
// Computation per Banks Act 94 of 1990 §70 + Regulations Relating to
// Banks Reg 38 + BCBS Basel III §50–§90:
//
//   netCET1 = grossCET1 − cet1Deductions
//   netAT1  = grossAT1  − at1Deductions
//   netT2   = grossT2   − t2Deductions
//
//   tier1   = netCET1 + netAT1
//   total   = tier1   + netT2
//
//   cet1Ratio  = netCET1 / totalRWA      (≥ 4.5% + buffers)
//   tier1Ratio = tier1   / totalRWA      (≥ 6%   + buffers)
//   totalRatio = total   / totalRWA      (≥ 8%   + buffers)
//
// Per-entity. Bank-licence-bound returns; only Hoz Bank LE-ZA-HOZ-BANK is
// in scope (Hoz Securities is securities-firm scoped — JSE-regulated;
// Hoz Group consolidated capital lands at a later slice once the group-
// consolidation projection is built per `D-REGULATORY-PERIMETER`). The
// generator throws if asked to produce a BA 100 for a non-bank entity.
//
// Substrate gaps surfaced (forward-link in the decision record):
//   - **RWA inputs are caller-supplied** at v0 — pass typed
//     `RwaDecomposition` (credit + market + operational components in
//     minor units). Real RWA-engine integration lands when **W2 Slice 3**
//     (RWA engine) merges; the generator's input-shape is forward-
//     compatible (the engine's typed output will match `RwaDecomposition`).
//   - **Capital-classification map** is supplied externally for now. The
//     chart-of-accounts schema will gain a `capitalTier` field at Slice 6+
//     once Mira's `WS-INSTRUMENT-ANALYSES` lands the SARB BA 100 published-
//     schema mapping. Until then the map lives at the call site.
//   - **Regulatory-deductions map** is also supplied externally. Threshold-
//     deduction arithmetic per Reg 38(8) (10%/15% buckets for significant
//     investments / DTAs / MSRs) is generator-side; v0 fixtures take
//     direct deduction amounts pre-computed.
//   - **capital-stack projection** is named on the Slice-4 semantic
//     entries (see `capital-entries.ts`) but the executable form is
//     Slice 6 territory — at v0 the generator computes from the trial
//     balance directly using the supplied classification + deduction maps.
//   - **Buffer framework** (CCB / CCyB / D-SIB / Pillar 2A) is reported
//     as the *required minimum overlay* in the output `bufferRequirements`
//     section; the generator does not enforce ratify-pathway calibration
//     (that's the W2 Slice 2 RAS B2 calibration brief).
//   - **Group-consolidated BA 100** (LE-ZA-HOZ-GROUP look-through per
//     Banks Act §60) lands at Slice 7 — solo entity only at v0.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner)
//   + Atlas (Core banking platform architect, engineering — substrate
//   consult; generator-input contract for the W2 Slice 3 RWA-engine hand-
//   off)
//   + Anya (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration).

import type { TrialBalanceSnapshotRow } from "../event-store/event-types";
import {
  BCBS_LEVERAGE_RATIO_REGULATORY_MINIMUM,
  type LeverageExposureDecomposition,
  type LeverageRatioOutput,
  generateLeverageRatio,
} from "./ba-400-leverage-ratio";

// P1 fix note (C-3): the events-first entry point for BA 100 lives at
// `ba-100-events-adapter.ts` → `generateBa100CapitalFromEvents()`. Callers
// that have access to an EventStore should prefer that path.
// Authority: Principles/1-events-are-truth.md, D-MARKETS-CAPITAL-TIME-SHAPE.

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Capital tier per Reg 38(8) / BCBS Basel III §50–§57. Each leaf account
 * classified as a capital-stack component carries exactly one tier; non-
 * capital accounts carry no tier.
 */
export type CapitalTier = "cet1" | "at1" | "t2";

/**
 * Per-leaf-account capital classification for the BA 100 generator. An
 * account is a member of one capital tier (CET1 / AT1 / T2) and contributes
 * to the gross stock of that tier. Most accounts (assets, non-capital
 * liabilities, P&L items) are not capital instruments and are simply
 * omitted from the map.
 *
 * Sign convention: capital instruments are credit-side balances on the GL
 * (equity / liability conventions); the generator takes absolute value so
 * the contribution is reported as a positive stock magnitude.
 */
export interface AccountCapitalClassification {
  readonly leafAccountId: string;
  readonly capitalTier: CapitalTier;
  /** Free-form sub-category label for line-by-line BA 100 render. */
  readonly subCategory?: string;
}

/**
 * Regulatory deduction line per Reg 38(8) / BCBS Basel III §66–§90. Each
 * deduction is applied to a specific tier (CET1 / AT1 / T2 — the
 * "corresponding-tier" approach); the generator subtracts the deduction
 * from the gross stock of that tier to derive the net stock.
 *
 * `category` is a free-form label for the BA 100 sub-line render
 * (e.g. "goodwill", "other-intangibles", "deferred-tax-assets",
 * "significant-investments-above-threshold"). The recon pipeline will
 * gate the category vocabulary against the Mira-resolved SARB BA 100
 * published taxonomy at Slice 6+.
 */
export interface RegulatoryDeduction {
  readonly deductionTier: CapitalTier;
  readonly category: string;
  readonly amountMinor: number;
  readonly currency: string;
  /** Optional source-account reference for forensic provenance. */
  readonly sourceAccountId?: string;
}

/**
 * Risk-Weighted Asset decomposition. The denominator of every capital-
 * adequacy ratio. v0 contract: caller supplies fixture-grade RWA values
 * per risk type. The W2 Slice 3 RWA engine produces this exact shape
 * once it lands (forward-compatible — no API change at the generator
 * boundary).
 *
 * All amounts are in `functionalCurrency` minor units. Negative values
 * are rejected — RWA is a non-negative quantity by construction.
 */
export interface RwaDecomposition {
  readonly creditRwaMinor: number;
  readonly marketRwaMinor: number;
  readonly operationalRwaMinor: number;
  /**
   * Optional citation: when the W2 Slice 3 RWA engine produces this
   * decomposition, the engine emits a `RwaComputed` event whose event_id
   * threads here for chain-of-custody under Principle 1.
   */
  readonly rwaComputationEventId?: string;
  /**
   * Optional source label. v0 default is "fixture-rehearsal" so the
   * forensic record makes the placeholder origin obvious.
   */
  readonly source?: string;
}

/**
 * Buffer-requirements declaration. Per Reg 38(2)–(7) + BCBS Basel III
 * §122–§148, the *all-in* CET1 minimum is:
 *
 *   minCET1Required = baseCET1 (4.5%)
 *                   + capitalConservationBuffer (2.5%)
 *                   + counterCyclicalBuffer (0–2.5%, per-jurisdiction)
 *                   + dSibSurcharge (1–2.5% if D-SIB; 0 otherwise)
 *                   + pillar2ASurcharge (bank-specific, set by SARB)
 *
 * The Tier 1 + Total minimums add 1.5pp + 3.5pp respectively over CET1.
 *
 * v0 build-phase: Hoz Bank not D-SIB; Pillar 2A not yet calibrated;
 * defaults reflect the BCBS minimums + 2.5% CCB only. RAS B2 calibration
 * (W2 Slice 2 — separate parallel dispatch) sets the +1.5pp management
 * buffer over regulatory minimum.
 */
export interface BufferRequirements {
  /** BCBS minimum CET1 — 4.5%. Constant unless SARB raises Pillar 1. */
  readonly baseCet1Ratio: number;
  /** BCBS minimum Tier 1 — 6.0%. */
  readonly baseTier1Ratio: number;
  /** BCBS minimum Total — 8.0%. */
  readonly baseTotalRatio: number;
  /** Capital Conservation Buffer — 2.5% (BCBS §122–§128). */
  readonly capitalConservationBufferRatio: number;
  /** Counter-cyclical Buffer — 0–2.5% (BCBS §136–§148; SARB-published rate). */
  readonly counterCyclicalBufferRatio: number;
  /** D-SIB Surcharge — 1–2.5% if classified D-SIB; 0 otherwise. */
  readonly dSibSurchargeRatio: number;
  /** Pillar-2A bank-specific add-on (SARB-set; 0 if not yet calibrated). */
  readonly pillar2ASurchargeRatio: number;
}

/**
 * Build-phase default buffer requirements. Reflects BCBS Basel III
 * minimums + the 2.5% Capital Conservation Buffer; CCyB / D-SIB /
 * Pillar-2A are zero (Hoz Bank not D-SIB at build-phase; Pillar-2A not
 * yet calibrated by SARB).
 */
export const BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS: BufferRequirements = {
  baseCet1Ratio: 0.045,
  baseTier1Ratio: 0.06,
  baseTotalRatio: 0.08,
  capitalConservationBufferRatio: 0.025,
  counterCyclicalBufferRatio: 0.0,
  dSibSurchargeRatio: 0.0,
  pillar2ASurchargeRatio: 0.0,
};

/**
 * The complete generator input. The trial balance comes from Slice 2's
 * `TrialBalanceSnapshotted` payload (or directly from `closePeriod`'s
 * return value). The classification + deductions + RWA inputs come from
 * the caller. The currency to render in is the entity's functional
 * currency from `AccountingPeriodOpened.functionalCurrency`.
 */
export interface Ba100GeneratorInput {
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). The generator throws on non-bank entities. */
  readonly entity: string;
  /** ISO 8601 — the period-end as-of date the BA 100 is reported at. */
  readonly asOf: string;
  /** Period identifier (`period:hoz-bank:month:2026-05`). */
  readonly periodId: string;
  /** ISO 4217 functional currency from `AccountingPeriodOpened.functionalCurrency`. */
  readonly functionalCurrency: string;
  /**
   * Trial-balance rows from `TrialBalanceSnapshotted.rows` / `closePeriod` result.
   *
   * @deprecated — P1 violation (C-3): the trial balance is a *projection* of
   * posting events, not a primary event. Capital positions exist in the event
   * stream (SubLedgerPostingEmitted, CapitalContributionRecorded) before a
   * TrialBalanceSnapshotted event is produced by the period-close orchestration.
   * Use `generateBa100CapitalFromEvents()` from `ba-100-events-adapter.ts` when
   * an EventStore is available. This field is retained for backward compatibility
   * with tests and for callers that do not have direct EventStore access.
   * Authority: Principles/1-events-are-truth.md, D-MARKETS-CAPITAL-TIME-SHAPE.
   */
  readonly trialBalance: readonly TrialBalanceSnapshotRow[];
  /** Per-account capital-tier classification. Accounts without an entry are not capital-stack-relevant. */
  readonly classifications: readonly AccountCapitalClassification[];
  /** Regulatory deductions per tier. May be empty (gross == net). */
  readonly deductions: readonly RegulatoryDeduction[];
  /** RWA decomposition (caller-supplied at v0; W2 Slice 3 engine downstream). */
  readonly rwa: RwaDecomposition;
  /** Buffer requirements; defaults to `BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS`. */
  readonly bufferRequirements?: BufferRequirements;
  /**
   * Optional Basel III leverage-ratio exposure-measure decomposition
   * (per BCBS §147–§165). When supplied, the BA 100 output ships a
   * `leverageRatio` section alongside the CET1/T1/Total ratios. When
   * omitted, the `leverageRatio` field is absent — backwards-compatible
   * for callers that have not yet wired exposure-measure inputs.
   *
   * v0 contract: caller-supplied. Mirrors the `rwa` field's posture —
   * the periodic SA-CCR + commitment-snapshot projection waves will
   * feed this once they land. Coordinate with the credit-limit-engine
   * SA-CCR v1 (D-CREDIT-LIMIT-ENGINE-BUILD Phase 5) for derivative-
   * exposure composition.
   */
  readonly leverageExposureMeasure?: LeverageExposureDecomposition;
  /**
   * Optional: cite the source `TrialBalanceSnapshotted.event_id` so the
   * downstream `ReportGenerated` event can chain back to the trial-balance
   * snapshot under Principle 1.
   */
  readonly trialBalanceSnapshotEventId?: string;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/**
 * One line item on the BA 100 form. Lines compose into sections; sections
 * compose into the full return. The render layer can present these as a
 * tabular form, JSON tree, or PDF — the projection emits the typed shape
 * and the renderer presents it.
 *
 * Per Marc's Q1 (rehearsal-grade with placeholders), `[citation: TBC]`
 * markers on `lineId` indicate the line numbering is awaiting Mira's
 * `WS-INSTRUMENT-ANALYSES` publication.
 */
export interface Ba100LineItem {
  readonly lineId: string;
  readonly lineLabel: string;
  readonly amountMinor: number;
  readonly currency: string;
  /** Line provenance — which trial-balance rows / deduction lines fed this line. */
  readonly contributingAccounts: readonly string[];
  readonly subCategory?: string;
  readonly note?: string;
}

/**
 * One tier of the capital stack — gross stock, deductions applied, net
 * stock, and the per-account contributing line items.
 */
export interface Ba100CapitalTierSection {
  readonly tier: CapitalTier;
  readonly grossStockMinor: number;
  readonly totalDeductionsMinor: number;
  readonly netStockMinor: number;
  readonly stockLineItems: readonly Ba100LineItem[];
  readonly deductionLineItems: readonly Ba100LineItem[];
}

/**
 * The capital-stack section. Three tiers + their derived totals.
 */
export interface Ba100CapitalStackSection {
  readonly cet1: Ba100CapitalTierSection;
  readonly at1: Ba100CapitalTierSection;
  readonly t2: Ba100CapitalTierSection;
  readonly netTier1Minor: number;
  readonly netTotalCapitalMinor: number;
}

/**
 * The RWA-denominator section. Decomposition by risk type + total.
 */
export interface Ba100RwaSection {
  readonly creditRwaMinor: number;
  readonly marketRwaMinor: number;
  readonly operationalRwaMinor: number;
  readonly totalRwaMinor: number;
  readonly source: string;
  readonly rwaComputationEventId?: string;
}

/**
 * The capital-adequacy ratios — three ratios + their per-bank required
 * minimums (base + buffers + Pillar-2A) + compliance flags.
 */
export interface Ba100RatiosSection {
  readonly cet1Ratio: number;
  readonly cet1RatioRequiredMinimum: number;
  readonly cet1Compliant: boolean;
  readonly tier1Ratio: number;
  readonly tier1RatioRequiredMinimum: number;
  readonly tier1Compliant: boolean;
  readonly totalRatio: number;
  readonly totalRatioRequiredMinimum: number;
  readonly totalCompliant: boolean;
}

/**
 * The full BA 100 generator output.
 *
 * `meta` carries provenance the regulator-portal slice (Slice 5) needs:
 * the entity, the as-of, the period, the functional currency, the
 * generator version, the classification + deductions fingerprints (BLAKE3
 * over deterministic-stringified inputs — for forensic reproducibility),
 * and the trial-balance snapshot event_id (when supplied).
 *
 * `bufferRequirements` echoes the input so the regulator-facing form can
 * show "minimum-required CET1 ratio = 7.0% (4.5% + 2.5% CCB)" on the face
 * of the return.
 */
export interface Ba100Output {
  readonly meta: {
    readonly form: "BA 100";
    readonly formVersion: "v0.1-rehearsal";
    readonly entity: string;
    readonly asOf: string;
    readonly periodId: string;
    readonly functionalCurrency: string;
    readonly generatorVersion: "v0.1";
    readonly trialBalanceSnapshotEventId?: string;
    readonly classificationsFingerprint: string;
    readonly deductionsFingerprint: string;
    readonly rwaFingerprint: string;
  };
  readonly capitalStack: Ba100CapitalStackSection;
  readonly rwa: Ba100RwaSection;
  readonly bufferRequirements: BufferRequirements;
  readonly ratios: Ba100RatiosSection;
  /**
   * Basel III leverage-ratio section (BCBS §147–§165). Present when
   * the caller supplies `leverageExposureMeasure` in the input;
   * absent otherwise.
   *
   * The leverage ratio is computed via the standalone
   * `generateLeverageRatio` generator with Tier-1 capital equal to
   * the net Tier-1 stock here. Composing through a single typed
   * primitive guarantees the BA 100 leverage view and a stand-alone
   * leverage report match byte-for-byte.
   */
  readonly leverageRatio?: LeverageRatioOutput;
  /**
   * Citations the generator carries forward into the `ReportGenerated`
   * event (Slice 5). Includes the standing authority + the regulatory
   * anchors per Principle 2.
   */
  readonly citations: readonly string[];
  /**
   * Per Marc's Q1 default — placeholder markers surfaced in the output so
   * the recon pipeline tracks placeholder density.
   */
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class Ba100GeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Ba100GeneratorError";
  }
}

// ---------------------------------------------------------------------------
// Per-entity scope guard
// ---------------------------------------------------------------------------

/**
 * Bank-licence-bound entity short-ids that are in scope for BA 100. The
 * Hoz tree has exactly one bank-licensed entity at v0 per
 * `Regulations/_legal-entity-tree.md`. Securities-firm + group-consolidated
 * BA 100 are out of scope at this slice — see `D-REGULATORY-PERIMETER`
 * (CEO-approved 2026-05-10); group consolidation lands at Slice 7.
 */
export const BA_100_BANK_ENTITIES: readonly string[] = ["LE-ZA-HOZ-BANK"];

function assertBankEntity(entity: string): void {
  if (!BA_100_BANK_ENTITIES.includes(entity)) {
    throw new Ba100GeneratorError(
      `BA 100 (Capital Adequacy) is bank-licence-bound; entity '${entity}' is not in BA_100_BANK_ENTITIES (${BA_100_BANK_ENTITIES.join(", ")}). See Regulations/_legal-entity-tree.md + D-REGULATORY-PERIMETER. Group-consolidated BA 100 lands at Slice 7.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Computed required-minimum overlays (base + buffers + Pillar 2A)
// ---------------------------------------------------------------------------

/**
 * Sum the all-in required minimum ratios from the buffer-requirements
 * declaration. The base + buffer + Pillar-2A overlay applies uniformly
 * across CET1 / Tier 1 / Total minimums per BCBS Basel III §50 + §122–§148.
 *
 * Note: the buffer framework has a 2.5% CCB conservation-range that
 * triggers earnings-distribution restrictions when breached but does not
 * make the bank "non-compliant" with the hard floor (4.5% / 6% / 8%).
 * The compliance flag here is the conservative reading: `compliant ⇔
 * actual ≥ all-in-required`. The render layer surfaces both the hard-
 * floor flag and the all-in flag for downstream use.
 */
export function computeRequiredMinimums(b: BufferRequirements): {
  readonly cet1: number;
  readonly tier1: number;
  readonly total: number;
} {
  const overlay =
    b.capitalConservationBufferRatio +
    b.counterCyclicalBufferRatio +
    b.dSibSurchargeRatio +
    b.pillar2ASurchargeRatio;
  return {
    cet1: b.baseCet1Ratio + overlay,
    tier1: b.baseTier1Ratio + overlay,
    total: b.baseTotalRatio + overlay,
  };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the BA 100 (Capital Adequacy) projection from a trial balance
 * + capital classifications + regulatory deductions + RWA inputs +
 * (optional) buffer requirements. Pure function; deterministic.
 *
 * The classification map identifies accounts as CET1 / AT1 / T2 capital
 * components. Trial-balance accounts not in the map are simply ignored
 * (most chart-of-accounts rows are not capital instruments).
 *
 * The deductions list applies regulatory-deduction amounts per tier. The
 * generator does NOT compute threshold-deduction arithmetic at v0 (10%/15%
 * buckets per Reg 38(8) for significant investments / DTAs / MSRs); the
 * caller pre-computes deduction amounts. Threshold arithmetic lands when
 * the chart-of-accounts deduction-tier classification work merges
 * alongside Slice 6.
 *
 * RWA inputs are caller-supplied at v0 (fixture-grade rehearsal). The
 * W2 Slice 3 RWA engine produces this same shape once it lands — no
 * generator API change.
 *
 * Sign convention: capital instruments are credit-side balances; the
 * generator takes absolute value (`Math.abs(amountMinor)`) so stocks are
 * reported as positive magnitudes. A note flags accounts where the
 * convention appears violated (debit balance on a capital-classified
 * account).
 *
 * Multi-currency note: the function works in `functionalCurrency` only.
 * Multi-currency capital is a Slice-6+ concern (FX-translation reserves
 * within OCI count toward CET1 per BCBS Basel III §53; build-phase scope
 * is the consolidated functional-currency view per the strategic-
 * foundation single-branch posture).
 */
export function generateBa100Capital(input: Ba100GeneratorInput): Ba100Output {
  assertBankEntity(input.entity);
  if (!input.functionalCurrency || input.functionalCurrency.length !== 3) {
    throw new Ba100GeneratorError(
      `BA 100 generator: functionalCurrency must be ISO-4217 (3 chars), got '${input.functionalCurrency}'`,
    );
  }
  if (
    input.rwa.creditRwaMinor < 0 ||
    input.rwa.marketRwaMinor < 0 ||
    input.rwa.operationalRwaMinor < 0
  ) {
    throw new Ba100GeneratorError(
      `BA 100 generator: RWA components must be non-negative; got credit=${input.rwa.creditRwaMinor}, market=${input.rwa.marketRwaMinor}, operational=${input.rwa.operationalRwaMinor}`,
    );
  }

  const ccy = input.functionalCurrency;
  const buffers = input.bufferRequirements ?? BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS;
  validateBuffers(buffers);

  // Index classifications by account — duplicate detection.
  const classMap = new Map<string, AccountCapitalClassification>();
  for (const c of input.classifications) {
    if (classMap.has(c.leafAccountId)) {
      throw new Ba100GeneratorError(
        `BA 100 generator: duplicate classification for account '${c.leafAccountId}'`,
      );
    }
    classMap.set(c.leafAccountId, c);
  }

  // Filter trial balance to the functional currency.
  const tbInCurrency = input.trialBalance.filter((r) => r.currency === ccy);

  // Bucket trial-balance rows by tier.
  const cet1Lines: Ba100LineItem[] = [];
  const at1Lines: Ba100LineItem[] = [];
  const t2Lines: Ba100LineItem[] = [];
  let cet1Gross = 0;
  let at1Gross = 0;
  let t2Gross = 0;

  // Stable iteration — sort by leafAccountId.
  const sorted = [...tbInCurrency].sort((a, b) =>
    a.leafAccountId < b.leafAccountId ? -1 : a.leafAccountId > b.leafAccountId ? 1 : 0,
  );

  for (const row of sorted) {
    const c = classMap.get(row.leafAccountId);
    if (!c) continue;
    const stockMinor = Math.abs(row.amountMinor);
    const note =
      row.amountMinor > 0 ? "warning: capital-classified account has debit balance" : undefined;
    const lineItem: Ba100LineItem = {
      lineId: `${c.capitalTier}.${row.leafAccountId}`,
      lineLabel: c.subCategory ?? `Capital ${c.capitalTier.toUpperCase()} — ${row.leafAccountId}`,
      amountMinor: stockMinor,
      currency: ccy,
      contributingAccounts: [row.leafAccountId],
      ...(c.subCategory ? { subCategory: c.subCategory } : {}),
      ...(note ? { note } : {}),
    };
    if (c.capitalTier === "cet1") {
      cet1Lines.push(lineItem);
      cet1Gross += stockMinor;
    } else if (c.capitalTier === "at1") {
      at1Lines.push(lineItem);
      at1Gross += stockMinor;
    } else {
      t2Lines.push(lineItem);
      t2Gross += stockMinor;
    }
  }

  // Bucket deductions by tier.
  const cet1DeductLines: Ba100LineItem[] = [];
  const at1DeductLines: Ba100LineItem[] = [];
  const t2DeductLines: Ba100LineItem[] = [];
  let cet1DeductTotal = 0;
  let at1DeductTotal = 0;
  let t2DeductTotal = 0;

  // Stable iteration — sort by (deductionTier, category).
  const sortedDeductions = [...input.deductions].sort((a, b) => {
    if (a.deductionTier !== b.deductionTier) return a.deductionTier < b.deductionTier ? -1 : 1;
    return a.category < b.category ? -1 : a.category > b.category ? 1 : 0;
  });

  for (const d of sortedDeductions) {
    if (d.currency !== ccy) {
      throw new Ba100GeneratorError(
        `BA 100 generator: deduction '${d.category}' is in '${d.currency}', expected functional currency '${ccy}'. Multi-currency deductions land at Slice 6+.`,
      );
    }
    if (d.amountMinor < 0) {
      throw new Ba100GeneratorError(
        `BA 100 generator: deduction '${d.category}' amountMinor must be non-negative, got ${d.amountMinor}. Deductions are reported as positive magnitudes; the generator subtracts them.`,
      );
    }
    const lineItem: Ba100LineItem = {
      lineId: `deduction.${d.deductionTier}.${d.category}`,
      lineLabel: `Deduction (${d.deductionTier.toUpperCase()}) — ${d.category}`,
      amountMinor: d.amountMinor,
      currency: ccy,
      contributingAccounts: d.sourceAccountId ? [d.sourceAccountId] : [],
      subCategory: d.category,
    };
    if (d.deductionTier === "cet1") {
      cet1DeductLines.push(lineItem);
      cet1DeductTotal += d.amountMinor;
    } else if (d.deductionTier === "at1") {
      at1DeductLines.push(lineItem);
      at1DeductTotal += d.amountMinor;
    } else {
      t2DeductLines.push(lineItem);
      t2DeductTotal += d.amountMinor;
    }
  }

  const cet1Net = Math.max(cet1Gross - cet1DeductTotal, 0);
  const at1Net = Math.max(at1Gross - at1DeductTotal, 0);
  const t2Net = Math.max(t2Gross - t2DeductTotal, 0);
  const tier1Net = cet1Net + at1Net;
  const totalCapNet = tier1Net + t2Net;

  const totalRwa =
    input.rwa.creditRwaMinor + input.rwa.marketRwaMinor + input.rwa.operationalRwaMinor;

  // Capital-adequacy ratios. Per Reg 38(2): division by zero (no RWA)
  // means the bank has no risk to cover — render as
  // Number.POSITIVE_INFINITY so the consumer sees the absence loudly. The
  // compliance flag treats infinite ratios as compliant.
  const cet1Ratio = totalRwa > 0 ? cet1Net / totalRwa : Number.POSITIVE_INFINITY;
  const tier1Ratio = totalRwa > 0 ? tier1Net / totalRwa : Number.POSITIVE_INFINITY;
  const totalRatio = totalRwa > 0 ? totalCapNet / totalRwa : Number.POSITIVE_INFINITY;

  const minimums = computeRequiredMinimums(buffers);

  const ratios: Ba100RatiosSection = {
    cet1Ratio,
    cet1RatioRequiredMinimum: minimums.cet1,
    cet1Compliant: cet1Ratio >= minimums.cet1,
    tier1Ratio,
    tier1RatioRequiredMinimum: minimums.tier1,
    tier1Compliant: tier1Ratio >= minimums.tier1,
    totalRatio,
    totalRatioRequiredMinimum: minimums.total,
    totalCompliant: totalRatio >= minimums.total,
  };

  const placeholders: string[] = [];
  if (input.rwa.source === undefined || input.rwa.source === "fixture-rehearsal") {
    placeholders.push(
      "[citation: TBC — RWA inputs are fixture-grade pending W2 Slice 3 RWA-engine landing; engine produces RwaDecomposition shape — no generator API change]",
    );
  }
  if (input.classifications.some((c) => c.subCategory === undefined)) {
    placeholders.push(
      "[citation: TBC — capital-tier classification subCategory missing for one or more accounts; Mira's WS-INSTRUMENT-ANALYSES will resolve to SARB-published BA 100 line labels]",
    );
  }
  placeholders.push(
    "[citation: TBC — exact SARB BA 100 line-numbering pending Mira's WS-INSTRUMENT-ANALYSES schema ingestion]",
  );

  const classificationsFingerprint = fingerprintClassifications(input.classifications);
  const deductionsFingerprint = fingerprintDeductions(input.deductions);
  const rwaFingerprint = fingerprintRwa(input.rwa);

  // Optional Basel III leverage ratio — produced when the caller supplied
  // an exposure-measure decomposition. Uses the net Tier-1 stock so the
  // numerator matches the BA 100 Tier-1 view exactly.
  let leverageRatio: LeverageRatioOutput | undefined;
  if (input.leverageExposureMeasure !== undefined) {
    leverageRatio = generateLeverageRatio({
      entity: input.entity,
      asOf: input.asOf,
      periodId: input.periodId,
      functionalCurrency: ccy,
      tier1CapitalMinor: tier1Net,
      exposureMeasure: input.leverageExposureMeasure,
      regulatoryMinimumRatio: BCBS_LEVERAGE_RATIO_REGULATORY_MINIMUM,
    });
    // Propagate leverage-ratio placeholders into the BA 100 placeholder
    // density so the recon pipeline tracks them uniformly.
    for (const p of leverageRatio.placeholders) {
      placeholders.push(p);
    }
  }

  return {
    meta: {
      form: "BA 100",
      formVersion: "v0.1-rehearsal",
      entity: input.entity,
      asOf: input.asOf,
      periodId: input.periodId,
      functionalCurrency: ccy,
      generatorVersion: "v0.1",
      ...(input.trialBalanceSnapshotEventId
        ? { trialBalanceSnapshotEventId: input.trialBalanceSnapshotEventId }
        : {}),
      classificationsFingerprint,
      deductionsFingerprint,
      rwaFingerprint,
    },
    capitalStack: {
      cet1: {
        tier: "cet1",
        grossStockMinor: cet1Gross,
        totalDeductionsMinor: cet1DeductTotal,
        netStockMinor: cet1Net,
        stockLineItems: cet1Lines,
        deductionLineItems: cet1DeductLines,
      },
      at1: {
        tier: "at1",
        grossStockMinor: at1Gross,
        totalDeductionsMinor: at1DeductTotal,
        netStockMinor: at1Net,
        stockLineItems: at1Lines,
        deductionLineItems: at1DeductLines,
      },
      t2: {
        tier: "t2",
        grossStockMinor: t2Gross,
        totalDeductionsMinor: t2DeductTotal,
        netStockMinor: t2Net,
        stockLineItems: t2Lines,
        deductionLineItems: t2DeductLines,
      },
      netTier1Minor: tier1Net,
      netTotalCapitalMinor: totalCapNet,
    },
    rwa: {
      creditRwaMinor: input.rwa.creditRwaMinor,
      marketRwaMinor: input.rwa.marketRwaMinor,
      operationalRwaMinor: input.rwa.operationalRwaMinor,
      totalRwaMinor: totalRwa,
      source: input.rwa.source ?? "fixture-rehearsal",
      ...(input.rwa.rwaComputationEventId
        ? { rwaComputationEventId: input.rwa.rwaComputationEventId }
        : {}),
    },
    bufferRequirements: buffers,
    ratios,
    ...(leverageRatio !== undefined ? { leverageRatio } : {}),
    citations: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "D-REPORTING-CAPABILITY-SLICE-4",
      "Banks Act 94 of 1990 §70",
      "Regulations Relating to Banks Reg 38",
      "BCBS Basel III §50–§90",
      "BCBS Basel III §122–§148",
      ...(leverageRatio !== undefined ? ["BCBS Basel III §147–§165"] : []),
    ],
    placeholders,
  };
}

function validateBuffers(b: BufferRequirements): void {
  const fields: ReadonlyArray<readonly [keyof BufferRequirements, number]> = [
    ["baseCet1Ratio", b.baseCet1Ratio],
    ["baseTier1Ratio", b.baseTier1Ratio],
    ["baseTotalRatio", b.baseTotalRatio],
    ["capitalConservationBufferRatio", b.capitalConservationBufferRatio],
    ["counterCyclicalBufferRatio", b.counterCyclicalBufferRatio],
    ["dSibSurchargeRatio", b.dSibSurchargeRatio],
    ["pillar2ASurchargeRatio", b.pillar2ASurchargeRatio],
  ];
  for (const [name, value] of fields) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Ba100GeneratorError(
        `BA 100 generator: buffer-requirement '${String(name)}' must be a finite ratio in [0,1], got ${value}`,
      );
    }
  }
  if (b.baseCet1Ratio > b.baseTier1Ratio || b.baseTier1Ratio > b.baseTotalRatio) {
    throw new Ba100GeneratorError(
      `BA 100 generator: buffer-requirement base-ratio ordering violated; expected baseCet1Ratio ≤ baseTier1Ratio ≤ baseTotalRatio, got ${b.baseCet1Ratio} ≤ ${b.baseTier1Ratio} ≤ ${b.baseTotalRatio}`,
    );
  }
}

/**
 * Deterministic fingerprint of a classification map for forensic
 * reproducibility. Sorted-stable JSON.
 */
function fingerprintClassifications(
  classifications: readonly AccountCapitalClassification[],
): string {
  const sorted = [...classifications].sort((a, b) =>
    a.leafAccountId < b.leafAccountId ? -1 : a.leafAccountId > b.leafAccountId ? 1 : 0,
  );
  return JSON.stringify(sorted);
}

function fingerprintDeductions(deductions: readonly RegulatoryDeduction[]): string {
  const sorted = [...deductions].sort((a, b) => {
    if (a.deductionTier !== b.deductionTier) return a.deductionTier < b.deductionTier ? -1 : 1;
    return a.category < b.category ? -1 : a.category > b.category ? 1 : 0;
  });
  return JSON.stringify(sorted);
}

function fingerprintRwa(rwa: RwaDecomposition): string {
  return JSON.stringify({
    creditRwaMinor: rwa.creditRwaMinor,
    marketRwaMinor: rwa.marketRwaMinor,
    operationalRwaMinor: rwa.operationalRwaMinor,
    rwaComputationEventId: rwa.rwaComputationEventId ?? null,
    source: rwa.source ?? "fixture-rehearsal",
  });
}
