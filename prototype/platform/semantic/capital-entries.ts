// platform/semantic/capital-entries.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 4 — capital-classification
// semantic entries. Extends the Slice 1 registry (`entries.ts`) and the
// Slice 3 liquidity-classification entries (`liquidity-entries.ts`) with
// the minimum vocabulary the BA 100 (Capital Adequacy Return) generator
// needs:
//
//   CommonEquityTier1Capital       — CET1 capital after regulatory
//                                    deductions per Reg 38(8) / BCBS Basel
//                                    III §50–§87.
//   AdditionalTier1Capital         — AT1 capital after regulatory
//                                    deductions per Reg 38(8) / BCBS Basel
//                                    III §54.
//   Tier2Capital                   — T2 capital after regulatory
//                                    deductions per Reg 38(8) / BCBS Basel
//                                    III §57.
//   RegulatoryCapitalDeductions    — Aggregate of regulatory deductions
//                                    (goodwill, intangibles, deferred-tax
//                                    assets, significant investments,
//                                    threshold deductions) per Reg 38(8)
//                                    + BCBS Basel III §66–§90.
//   RiskWeightedAssets             — Total RWA (credit + market +
//                                    operational) — denominator of the
//                                    capital-adequacy ratios. Sourced from
//                                    the W2 Slice 3 RWA engine; rehearsal-
//                                    grade fixture inputs accepted v0.
//   CommonEquityTier1Ratio         — CET1 / RWA. Required ≥ 4.5% (BCBS) +
//                                    SA conservation / D-SIB / counter-
//                                    cyclical buffers per Reg 38(2)–(7).
//   Tier1CapitalRatio              — (CET1 + AT1) / RWA. ≥ 6% per BCBS.
//   TotalCapitalRatio              — (CET1 + AT1 + T2) / RWA. ≥ 8% per
//                                    BCBS + SA add-ons.
//
// Per pack §6 Slice 4 + Marc's Q1 default (rehearsal-grade with placeholders),
// each entry carries:
//   - one resolved citation chain (Banks Act 94/1990 §70 + Regulations
//     Relating to Banks Reg 38 + BCBS Basel III), and
//   - a `[citation: TBC]` marker pointing at Mira's WS-INSTRUMENT-ANALYSES
//     workstream which will resolve the precise SARB BA 100 line numbers
//     once the published schema is fully analysed.
//
// Hoz Bank only — Hoz Securities + Hoz Group are not bank-licence-bound
// for BA 100 (the consolidated capital position lands in a later slice
// once the legal-entity-tree group consolidation projection is built).
// Bank-licence scope per `Regulations/_legal-entity-tree.md` and
// `D-REGULATORY-PERIMETER`.
//
// Authors: Anya (Data / analytics engineer, engineering — reports to Devon
//   COO; semantic-layer + projection-runtime curator)
//   + Bea (Accounting & financial reporting engineer, engineering — reports
//   to Camille CFO; BA-form line mapping + reviewer)
//   + Camille (Chief Financial Officer, governance — reports to CEO;
//   accountable signer for capital-stack outputs).

import type { SemanticEntry } from "./types";

const HOZ_BANK = "urn:legal-entity:hoz:hoz-bank:v1";

const FIRST_AUTHORED = "2026-05-10T00:00:00.000Z";

/**
 * `CommonEquityTier1Capital` — CET1 capital, post-deductions. The
 * highest-quality form of regulatory capital (paid-up ordinary shares +
 * retained earnings + accumulated OCI + qualifying minority interests),
 * reduced by the CET1-deduction schedule per Reg 38(8) / BCBS Basel III
 * §66–§90 (goodwill, other intangibles, deferred-tax assets dependent on
 * future profitability, significant investments above threshold).
 *
 * Drives the CET1 ratio (≥ 4.5% under BCBS minimums; SA add-ons via
 * conservation buffer 2.5% + D-SIB surcharge 1–2.5% + counter-cyclical
 * buffer 0–2.5% per Reg 38(2)–(7)).
 */
export const commonEquityTier1Capital: SemanticEntry = {
  id: "CommonEquityTier1Capital",
  version: "v0.1",
  description:
    "Common Equity Tier 1 capital, post regulatory deductions. Paid-up ordinary shares + retained earnings + accumulated OCI + qualifying minority interests, less CET1-tier deductions per Reg 38(8) / BCBS Basel III §66–§90.",
  units: "money-minor",
  dimensions: ["currency", "capitalTier"],
  projection: "capital-stack",
  formula:
    "sum(BalanceForCapitalComponent where {entity, capitalTier='cet1', asOf=asOfQuery}) - sum(RegulatoryDeduction where {entity, deductionTier='cet1', asOf=asOfQuery})",
  regulatoryCells: [
    {
      form: "BA 100",
      line: "Common Equity Tier 1 capital — total (post-deductions)",
      side: "positive",
      note: "Reg 38(8) — net CET1 amount entering the capital-adequacy ratio numerator.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital-adequacy prudential requirements — empowering provision for tiered capital.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-04",
      note: "BCBS Basel III §50–§87 / Regulations Relating to Banks Reg 38 — CET1 composition + deduction schedule.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact SARB BA 100 line-number sequencing for CET1 sub-categories pending published-schema ingestion]",
    },
  ],
  signers: ["Camille", "Helena"],
  entityScope: [HOZ_BANK],
  ifrsClassifications: ["equity"],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Aggregated quantity post-deductions. Build-phase: the bank holds the R300m capital target as a future contribution at licence-day per project_ai_driven_bank; until then synthetic capital fixtures populate. Live numbers populate at licence-day capital-call.",
};

/**
 * `AdditionalTier1Capital` — AT1 capital, post-deductions. Perpetual
 * non-cumulative preference shares + qualifying AT1 instruments meeting
 * the BCBS Basel III §54–§55 criteria (loss-absorbency at point of non-
 * viability; full discretion to cancel distributions; no incentive to
 * redeem). Reduced by AT1-deduction schedule per Reg 38(8).
 *
 * Build-phase posture: Hoz Bank issues no AT1 instruments at v0 (target
 * capital structure per W2 Slice 1 ICAAP framework: CET1-heavy stack,
 * AT1 sized at 1.5% of RWA at steady-state). v0 AT1 stock = 0; the entry
 * exists so the BA 100 generator's three-ratio chain is structurally
 * complete from day one.
 */
export const additionalTier1Capital: SemanticEntry = {
  id: "AdditionalTier1Capital",
  version: "v0.1",
  description:
    "Additional Tier 1 capital, post regulatory deductions. Perpetual non-cumulative preference shares + qualifying AT1 instruments meeting BCBS Basel III §54–§55 criteria, less AT1-tier deductions per Reg 38(8).",
  units: "money-minor",
  dimensions: ["currency", "capitalTier"],
  projection: "capital-stack",
  formula:
    "sum(BalanceForCapitalComponent where {entity, capitalTier='at1', asOf=asOfQuery}) - sum(RegulatoryDeduction where {entity, deductionTier='at1', asOf=asOfQuery})",
  regulatoryCells: [
    {
      form: "BA 100",
      line: "Additional Tier 1 capital — total (post-deductions)",
      side: "positive",
      note: "Reg 38(8) — AT1 amount entering Tier 1 ratio numerator.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital-adequacy prudential requirements — empowering provision.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-04",
      note: "BCBS Basel III §54–§55 / Regulations Relating to Banks Reg 38(8) — AT1 composition + deduction schedule.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — AT1 instrument-eligibility criteria + SARB BA 100 line-mapping per published-schema ingestion]",
    },
  ],
  signers: ["Camille", "Helena"],
  entityScope: [HOZ_BANK],
  ifrsClassifications: ["equity"],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "v0 build-phase stock = 0 (Hoz Bank issues no AT1 instruments yet). Steady-state target per W2 Slice 1 ICAAP framework: ~1.5% of RWA. Capital-stack-issuance event family lands at Slice 6 / capital-stack projection.",
};

/**
 * `Tier2Capital` — T2 capital, post-deductions. Subordinated debt + general
 * loan-loss provisions (capped at 1.25% of credit-RWA under standardised
 * approach) + qualifying T2 instruments meeting BCBS Basel III §57. Reduced
 * by T2-deduction schedule per Reg 38(8).
 *
 * Build-phase posture: Hoz Bank issues no T2 instruments at v0 (target
 * capital structure per W2 Slice 1 ICAAP framework: T2 sized at 2% of RWA
 * at steady-state). v0 T2 stock = 0.
 */
export const tier2Capital: SemanticEntry = {
  id: "Tier2Capital",
  version: "v0.1",
  description:
    "Tier 2 capital, post regulatory deductions. Subordinated debt + general loan-loss provisions (capped at 1.25% of credit-RWA under standardised) + qualifying T2 instruments per BCBS Basel III §57, less T2 deductions per Reg 38(8).",
  units: "money-minor",
  dimensions: ["currency", "capitalTier"],
  projection: "capital-stack",
  formula:
    "sum(BalanceForCapitalComponent where {entity, capitalTier='t2', asOf=asOfQuery}) - sum(RegulatoryDeduction where {entity, deductionTier='t2', asOf=asOfQuery})",
  regulatoryCells: [
    {
      form: "BA 100",
      line: "Tier 2 capital — total (post-deductions)",
      side: "positive",
      note: "Reg 38(8) — T2 amount entering Total Capital ratio numerator.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital-adequacy prudential requirements — empowering provision.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-04",
      note: "BCBS Basel III §57 / Regulations Relating to Banks Reg 38(8) — T2 composition + 1.25%-of-credit-RWA cap on general provisions + deduction schedule.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — T2 sub-debt eligibility criteria + general-provisions cap arithmetic + SARB BA 100 line-mapping per published-schema ingestion]",
    },
  ],
  signers: ["Camille", "Helena"],
  entityScope: [HOZ_BANK],
  ifrsClassifications: ["amortised-cost", "equity"],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "v0 build-phase stock = 0. Steady-state target per W2 Slice 1 ICAAP framework: ~2% of RWA. The 1.25%-of-credit-RWA cap on general loan-loss provisions is generator-arithmetic (Slice 6+ once the credit-RWA decomposition lands).",
};

/**
 * `RegulatoryCapitalDeductions` — aggregate of regulatory deductions
 * applied across the CET1 / AT1 / T2 stack. The decomposition is generator-
 * arithmetic (each tier deducts its own schedule); this entry carries the
 * total magnitude for forensic transparency.
 *
 * Categories per Reg 38(8) + BCBS Basel III §66–§90:
 *   - Goodwill + other intangibles (CET1 deduction).
 *   - Deferred-tax assets dependent on future profitability (CET1).
 *   - Significant investments in unconsolidated financial entities above
 *     10% threshold (CET1 / corresponding-tier deduction).
 *   - Mortgage-servicing rights above threshold (CET1).
 *   - Cash-flow-hedge reserves (CET1 add-back / deduct).
 *   - Cumulative gains and losses on own credit risk (CET1 deduct).
 *   - Defined-benefit-pension net assets (CET1 deduct subject to
 *     prudential-filter relief).
 *
 * The entry is reported as a positive number; the generator subtracts it
 * from the gross CET1 stock to derive net CET1.
 */
export const regulatoryCapitalDeductions: SemanticEntry = {
  id: "RegulatoryCapitalDeductions",
  version: "v0.1",
  description:
    "Aggregate regulatory deductions applied across the CET1 / AT1 / T2 capital stack per Reg 38(8) + BCBS Basel III §66–§90. Goodwill + intangibles + DTAs + significant investments + threshold deductions + own-credit-risk gains + DB-pension assets. Reported as a positive magnitude; generator subtracts from gross capital.",
  units: "money-minor",
  dimensions: ["currency"],
  projection: "capital-stack",
  formula:
    "sum(RegulatoryDeduction where {entity, asOf=asOfQuery}) — decomposed by deductionTier (cet1 / at1 / t2) at the generator",
  regulatoryCells: [
    {
      form: "BA 100",
      line: "Regulatory deductions — aggregate (memo)",
      side: "memo",
      note: "Decomposition into per-tier deductions appears on the BA 100 deduction sub-section; this aggregate is a forensic-transparency line.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital-adequacy prudential requirements — empowering provision.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-04",
      note: "BCBS Basel III §66–§90 / Regulations Relating to Banks Reg 38(8) — full deduction schedule + 10%/15% threshold rules.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — full SARB BA 100 deduction-line mapping + threshold-deduction arithmetic per published-schema ingestion]",
    },
  ],
  signers: ["Camille", "Helena"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Threshold-deduction arithmetic (Reg 38(8) 10%/15% threshold buckets for significant investments, MSRs, DTAs from temporary differences) is generator-side; v0 fixtures use direct deduction amounts pending the chart-of-accounts deduction-tier classification work landing alongside Slice 6.",
};

/**
 * `RiskWeightedAssets` — total Risk-Weighted Assets, the denominator of
 * every capital-adequacy ratio. Sourced from the W2 Slice 3 RWA engine
 * (separate workstream, dispatching now in parallel) which decomposes RWA
 * by risk type per Reg 38 + BCBS Basel III:
 *
 *   - Credit RWA — counterparty exposure × risk weight per asset class
 *     under Standardised Approach (BCBS Basel III §51–§91 of credit-risk
 *     framework) or IRB.
 *   - Market RWA — VaR / stressed-VaR / IRC + securitisation positions
 *     per BCBS FRTB.
 *   - Operational RWA — Standardised Measurement Approach per BCBS Basel
 *     III §148 / Reg 38 BSA.
 *
 * v0 BA 100 generator accepts RWA inputs via the `Ba100GeneratorInput.rwa`
 * field — fixture constants per asset-class for the build-phase rehearsal.
 * The W2 Slice 3 RWA engine wires in once it lands; the generator's
 * downstream contract is unchanged (the engine produces a typed RWA
 * decomposition the generator consumes).
 */
export const riskWeightedAssets: SemanticEntry = {
  id: "RiskWeightedAssets",
  version: "v0.1",
  description:
    "Total Risk-Weighted Assets — credit + market + operational. Denominator of every capital-adequacy ratio. Sourced from the RWA engine (W2 Slice 3); v0 BA 100 accepts fixture inputs.",
  units: "money-minor",
  dimensions: ["currency"],
  projection: "rwa",
  formula: "sum(CreditRwa) + sum(MarketRwa) + sum(OperationalRwa) where {entity, asOf=asOfQuery}",
  regulatoryCells: [
    {
      form: "BA 100",
      line: "Total Risk-Weighted Assets — credit + market + operational",
      side: "positive",
      note: "Decomposition lines by risk type appear in the BA 100 RWA sub-section; this aggregate is the ratio denominator.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital-adequacy prudential requirements — empowering provision.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-04",
      note: "BCBS Basel III credit-risk framework + FRTB market-risk + SMA operational-risk / Regulations Relating to Banks Reg 38 — RWA computation framework.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — SARB BA 100 RWA decomposition cell-numbering + W2 Slice 3 RWA-engine integration once the engine lands]",
    },
  ],
  signers: ["Helena", "Camille", "Bea"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "v0 substrate-gap: BA 100 generator accepts pre-computed RWA components as fixture inputs pending W2 Slice 3 RWA-engine landing. Once the engine lands, the generator switches to consuming the engine's typed decomposition without API change. Documented in the Slice-4 decision record §Substrate gaps.",
};

/**
 * `CommonEquityTier1Ratio` — CET1 / RWA. The most stringent capital-adequacy
 * cell on BA 100. Required ≥ 4.5% under BCBS Basel III §50; SA add-ons
 * raise the *all-in* CET1 minimum via:
 *   - Capital Conservation Buffer (CCB) — 2.5% (BCBS §122–§128)
 *   - Counter-cyclical Buffer (CCyB) — 0–2.5% (BCBS §136–§148; SARB Pillar 1
 *     calibration set per ICAAP cycle)
 *   - D-SIB Buffer — 1–2.5% (FSB / SARB methodology) — Hoz Bank not D-SIB
 *     at build-phase
 *   - SARB-specific Pillar 2A surcharge (Reg 38) — bank-specific
 *
 * Render layer multiplies by 100 for the percentage form the regulator's
 * BA 100 cell shows.
 */
export const commonEquityTier1Ratio: SemanticEntry = {
  id: "CommonEquityTier1Ratio",
  version: "v0.1",
  description:
    "Common Equity Tier 1 ratio = CET1 / RWA. Required ≥ 4.5% under BCBS Basel III §50; SA all-in CET1 minimum raised by Capital Conservation Buffer (2.5%), Counter-cyclical Buffer (0–2.5%), D-SIB surcharge (where applicable), Pillar 2A surcharge per Reg 38.",
  units: "ratio",
  dimensions: ["currency"],
  projection: "capital-stack",
  formula: "CommonEquityTier1Capital / RiskWeightedAssets",
  regulatoryCells: [
    {
      form: "BA 100",
      line: "CET1 ratio (%) — exit cell",
      side: "positive",
      note: "Compared against per-bank minimum (4.5% + buffers + Pillar-2A); render layer multiplies by 100 for percentage display.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital-adequacy prudential requirements — empowering provision.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-04",
      note: "BCBS Basel III §50 + §122–§148 / Regulations Relating to Banks Reg 38(2)–(7) — CET1 minimum + buffer framework.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — bank-specific Pillar-2A SARB add-on calibration + SARB BA 100 CET1-cell line-number per published-schema ingestion]",
    },
  ],
  signers: ["Camille", "Helena"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Exit-criterion semantic entry for BA 100 CET1 cell. RAS B2 (`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`) sets a +1.5pp CET1 management buffer above the regulatory all-in minimum — calibration ratify path tracked under W2 Slice 2 (separate parallel dispatch).",
};

/**
 * `Tier1CapitalRatio` — (CET1 + AT1) / RWA. Required ≥ 6% under BCBS
 * Basel III §50; SA all-in Tier-1 minimum = 6% + buffers + Pillar 2A.
 */
export const tier1CapitalRatio: SemanticEntry = {
  id: "Tier1CapitalRatio",
  version: "v0.1",
  description:
    "Tier 1 capital ratio = (CET1 + AT1) / RWA. Required ≥ 6% under BCBS Basel III §50; SA all-in Tier-1 minimum raised by buffer framework + Pillar 2A.",
  units: "ratio",
  dimensions: ["currency"],
  projection: "capital-stack",
  formula: "(CommonEquityTier1Capital + AdditionalTier1Capital) / RiskWeightedAssets",
  regulatoryCells: [
    {
      form: "BA 100",
      line: "Tier 1 capital ratio (%)",
      side: "positive",
      note: "Compared against per-bank minimum (6% + buffers + Pillar-2A); render layer multiplies by 100.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital-adequacy prudential requirements — empowering provision.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-04",
      note: "BCBS Basel III §50 / Regulations Relating to Banks Reg 38(2) — Tier-1 minimum.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact SARB BA 100 Tier-1-cell line-number per published-schema ingestion]",
    },
  ],
  signers: ["Camille", "Helena"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "v0: AT1 stock = 0, so Tier 1 ratio == CET1 ratio. Diverges once AT1 issuance lands at Slice 6+.",
};

/**
 * `TotalCapitalRatio` — (CET1 + AT1 + T2) / RWA. Required ≥ 8% under BCBS
 * Basel III §50; SA all-in Total minimum = 8% + buffers + Pillar 2A.
 */
export const totalCapitalRatio: SemanticEntry = {
  id: "TotalCapitalRatio",
  version: "v0.1",
  description:
    "Total capital ratio = (CET1 + AT1 + T2) / RWA. Required ≥ 8% under BCBS Basel III §50; SA all-in Total minimum raised by buffer framework + Pillar 2A.",
  units: "ratio",
  dimensions: ["currency"],
  projection: "capital-stack",
  formula:
    "(CommonEquityTier1Capital + AdditionalTier1Capital + Tier2Capital) / RiskWeightedAssets",
  regulatoryCells: [
    {
      form: "BA 100",
      line: "Total capital ratio (%) — exit cell",
      side: "positive",
      note: "Compared against per-bank minimum (8% + buffers + Pillar-2A); render layer multiplies by 100. The regulator-facing 'capital adequacy ratio' in colloquial terms.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital-adequacy prudential requirements — empowering provision.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-04",
      note: "BCBS Basel III §50 / Regulations Relating to Banks Reg 38(2) — Total capital minimum.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact SARB BA 100 Total-capital-cell line-number per published-schema ingestion]",
    },
  ],
  signers: ["Camille", "Helena"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "v0: T2 stock = 0, so Total Capital ratio == Tier 1 ratio. Diverges once T2 issuance lands at Slice 6+.",
};

/**
 * Slice-4 capital-classification entries, exported as a single array for
 * ease of registry construction in tests and downstream consumers (BA 100
 * generator + future capital-stack-projection consumers).
 */
export const SLICE_4_CAPITAL_ENTRIES: readonly SemanticEntry[] = [
  commonEquityTier1Capital,
  additionalTier1Capital,
  tier2Capital,
  regulatoryCapitalDeductions,
  riskWeightedAssets,
  commonEquityTier1Ratio,
  tier1CapitalRatio,
  totalCapitalRatio,
] as const;
