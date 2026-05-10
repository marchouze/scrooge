// platform/semantic/op-risk-entries.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 5 (this dispatch) —
// operational-risk semantic-layer entries. Extends the Slice-1 / Slice-3 /
// Slice-5-market-risk registry with the minimum vocabulary the BA 600
// (operational-risk) generator needs.
//
// Entries:
//
//   GrossIncomeBusinessLine   — annual gross-income, decomposed by
//                                Basel business line (BIA / TSA inputs).
//                                BCBS D196 §645–§654 / Reg 33.
//   OpRiskCapitalBia          — Basic Indicator Approach capital charge
//                                (15% × 3-year average positive gross
//                                income). Reg 33(3).
//   OpRiskCapitalTsa          — Standardised Approach capital charge
//                                (per-business-line β × gross income, 3-
//                                year average of annual sums). Reg 33(4).
//   OpRiskRwa                 — Aggregate operational-risk RWA (capital ×
//                                12.5). Reg 33 read with Reg 38(3).
//
// Notes on approach:
//   The Basel III Standardised Measurement Approach (SMA) replaces BIA /
//   TSA / AMA in BCBS D424 ("Basel III: Finalising post-crisis reforms",
//   2017) and SARB has adopted SMA in the latest Regulations Relating to
//   Banks revision. Build-phase ships *both* BIA and TSA scaffolds (still
//   the workhorse approaches in many jurisdictions during transition) and
//   surfaces SMA as a substrate gap forward-linked to Mira's WS-
//   INSTRUMENT-ANALYSES.
//
// Per pack §9 Q1 default (rehearsal-grade with placeholders), each entry
// carries one resolved citation chain plus one `[citation: TBC]` marker.
//
// Hoz Bank only — bank-licence-bound entity.
//
// Authors: Anya (Data / analytics engineer, engineering — reports to Devon
//   COO; semantic-layer + projection-runtime curator)
//   + Helena (Chief Risk Officer, governance — reports to CEO; op-risk
//   methodology owner)
//   + Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping + reviewer).

import type { SemanticEntry } from "./types";

const HOZ_BANK = "urn:legal-entity:hoz:hoz-bank:v1";
const FIRST_AUTHORED = "2026-05-10T00:00:00.000Z";

/**
 * `GrossIncomeBusinessLine` — annual gross income decomposed by Basel
 * business line. BIA uses the bank-aggregate; TSA uses the per-business-
 * line decomposition with regulator β factors.
 */
export const grossIncomeBusinessLine: SemanticEntry = {
  id: "GrossIncomeBusinessLine",
  version: "v0.1",
  description:
    "Annual gross income (net interest income + net non-interest income before deducting any provisions, operating expenses, or extraordinary items) decomposed by Basel business line for BIA / TSA op-risk inputs. Per BCBS D196 §646–§654 / Reg 33(2).",
  units: "money-minor",
  dimensions: ["currency"],
  projection: "income-projection",
  formula:
    "sum(grossIncome where businessLine = bl and fiscalYear = fy) for bl in {corporate-finance, trading-and-sales, retail-banking, commercial-banking, payment-and-settlement, agency-services, asset-management, retail-brokerage}",
  regulatoryCells: [
    {
      form: "BA 600",
      line: "Gross income by business line — input to op-risk capital",
      side: "positive",
      note: "BIA uses bank-aggregate gross income; TSA uses per-business-line decomposition.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital adequacy — empowering provision for Pillar-1 op-risk capital requirement.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "BCBS D196 §646–§654 / Regulations Relating to Banks Reg 33(2) — gross-income definition + business-line mapping.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact SARB BA 600 business-line line numbering + SMA Business Indicator Component crosswalk]",
    },
  ],
  signers: ["Helena", "Camille"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Build-phase: P&L lines populate from M1 ledger projections at commencement-of-trading. Business-line mapping requires Saskia (Head of Global Markets) input — the institutional dealer book maps mostly to trading-and-sales (β=18%).",
};

/**
 * `OpRiskCapitalBia` — Basic Indicator Approach. Capital = 15% × 3-year
 * average of positive gross income. Per BCBS D196 §649 / Reg 33(3).
 *
 * The "positive" qualifier means years with negative gross income are
 * excluded from numerator AND denominator (n is the count of positive
 * years over the 3-year window, not always 3).
 */
export const opRiskCapitalBia: SemanticEntry = {
  id: "OpRiskCapitalBia",
  version: "v0.1",
  description:
    "Basic Indicator Approach op-risk capital charge — 15% × 3-year average of *positive* gross income. Per BCBS D196 §649 / Reg 33(3).",
  units: "money-minor",
  dimensions: [],
  projection: "income-projection",
  formula: "0.15 × (sum(grossIncome over last 3 fiscal years where grossIncome > 0) / nPositive)",
  regulatoryCells: [
    {
      form: "BA 600",
      line: "Op-risk capital charge — Basic Indicator Approach",
      side: "positive",
      note: "Build-phase default approach; Reg 33(3).",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital adequacy — empowering provision for Pillar-1 op-risk capital requirement.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "BCBS D196 §649 / Regulations Relating to Banks Reg 33(3) — BIA α=15%, 3-year positive-year average.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — SARB BA 600 BIA cell line numbering + SMA transition timeline]",
    },
  ],
  signers: ["Helena", "Camille"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Build-phase: rehearsal-grade. Live numbers populate when 3 years of audited gross income exist (post-licence-day + 3 fiscal years). Until then the generator emits the formula with [citation: TBC] markers on the inputs.",
};

/**
 * `OpRiskCapitalTsa` — Standardised Approach. Capital = 3-year average of
 * sum across business lines of (β_i × gross income_i). β factors are
 * regulator-set (12% / 15% / 18% — Reg 33 Annex). Negative annual sums in
 * a year are floored at zero in the average. Per BCBS D196 §651 / Reg 33(4).
 */
export const opRiskCapitalTsa: SemanticEntry = {
  id: "OpRiskCapitalTsa",
  version: "v0.1",
  description:
    "Standardised Approach op-risk capital charge — 3-year average of max(0, sum_i(β_i × grossIncome_i)) where β is the per-business-line factor (12% / 15% / 18%). Per BCBS D196 §651 / Reg 33(4).",
  units: "money-minor",
  dimensions: [],
  projection: "income-projection",
  formula:
    "(1/3) × sum_y max(0, sum_i (β_i × grossIncome_{y,i})) for y in {y-2, y-1, y}",
  regulatoryCells: [
    {
      form: "BA 600",
      line: "Op-risk capital charge — Standardised Approach",
      side: "positive",
      note: "TSA per Reg 33(4) Annex β-factor table.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital adequacy — empowering provision for Pillar-1 op-risk capital requirement.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "BCBS D196 §651 / Regulations Relating to Banks Reg 33(4) — TSA β factors + 3-year averaging.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact SARB Reg 33 Annex β-factor table reference + SMA transition timeline]",
    },
  ],
  signers: ["Helena", "Camille"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Available alternative to BIA. Switch to TSA requires SARB approval per Reg 33(4); build-phase carries the scaffold so the engine can render either approach when licence-day approves a path. SMA (BCBS D424) replaces both BIA + TSA at SARB transition; tracked as substrate gap.",
};

/**
 * `OpRiskRwa` — operational-risk RWA. Capital × 12.5. Sums into total RWA
 * (forward-link Slice 6 capital-stack projection).
 */
export const opRiskRwa: SemanticEntry = {
  id: "OpRiskRwa",
  version: "v0.1",
  description:
    "Operational-risk RWA — selected approach (BIA / TSA / SMA) capital × 12.5. Per Banks Act read with Reg 38(3).",
  units: "money-minor",
  dimensions: [],
  projection: "income-projection",
  formula: "12.5 × selectedApproachCapital",
  regulatoryCells: [
    {
      form: "BA 600",
      line: "Total operational-risk RWA",
      side: "positive",
      note: "Aggregate that flows into BA 700 / capital-stack.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital adequacy — empowering provision for Pillar-1 op-risk capital requirement.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "Regulations Relating to Banks Reg 33 read with Reg 38(3) — 12.5× capital-to-RWA conversion.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact SARB BA 600 RWA-aggregate line]",
    },
  ],
  signers: ["Helena", "Camille"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Aggregated quantity. Forward-link to Slice 6 capital-stack — OpRiskRwa is one of three RWA components (credit + market + operational).",
};

/**
 * Slice-5 op-risk semantic entries, exported as a single array.
 */
export const SLICE_5_OP_RISK_ENTRIES: readonly SemanticEntry[] = [
  grossIncomeBusinessLine,
  opRiskCapitalBia,
  opRiskCapitalTsa,
  opRiskRwa,
] as const;
