// platform/semantic/liquidity-entries.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 3 — liquidity-classification
// semantic entries. Extends the Slice 1 registry (`entries.ts`) with the
// minimum vocabulary the BA 325 (LCR) generator needs:
//
//   HqlaLevel1                     — High-Quality Liquid Assets, Level 1.
//                                    100% factor in the LCR numerator.
//   HqlaLevel2A                    — HQLA Level 2A. 85% factor in the
//                                    numerator, capped at 40% of total HQLA.
//   HqlaLevel2B                    — HQLA Level 2B. 50% factor (lower bound;
//                                    asset-specific factors apply for
//                                    common shares + RMBS), capped at 15%
//                                    of total HQLA.
//   LcrCashOutflows30D             — Stressed cash outflows over the next
//                                    30 calendar days (denominator gross).
//   LcrCashInflows30D              — Stressed cash inflows over the next
//                                    30 calendar days, capped at 75% of
//                                    outflows per BCBS D295 / Reg 26(11).
//   LiquidityCoverageRatio         — derived ratio (HQLA stock / net cash
//                                    outflows). Exit-criterion quantity for
//                                    the BA 325 form.
//
// Per pack §6 Slice 3 + Marc's Q1 default (rehearsal-grade with placeholders),
// each entry carries:
//   - one resolved citation chain (Banks Act 94/1990 + Regulations Relating
//     to Banks Reg 26 + BCBS D295), and
//   - a `[citation: TBC]` marker pointing at Mira's WS-INSTRUMENT-ANALYSES
//     workstream which will resolve the precise SARB BA 325 line numbers
//     once the published schema is fully analysed.
//
// The Slice-1 `CashAndBalancesAtSARB` entry already carries the
// `BA 325 — HQLA Level 1 — central-bank reserves (LCR)` mapping; this slice
// adds the *general* HqlaLevel1/2A/2B + outflow/inflow + ratio entries that
// downstream cells (BA 325 sub-lines beyond central-bank reserves; future
// BA 326 NSFR) compose against.
//
// Hoz Bank only — Hoz Securities + Hoz Group are not LCR-bound. Bank-licence
// scope per `Regulations/_legal-entity-tree.md` and `D-REGULATORY-PERIMETER`.
//
// Authors: Anya (Data / analytics engineer, engineering — reports to Devon
//   COO; semantic-layer + projection-runtime curator)
//   + Eitan (Treasurer, governance — reports to Camille CFO; LCR / liquidity
//   methodology owner)
//   + Bea (Accounting & financial reporting engineer, engineering — reports
//   to Camille CFO; BA-form line mapping + reviewer).

import type { SemanticEntry } from "./types";

const HOZ_BANK = "urn:legal-entity:hoz:hoz-bank:v1";

const FIRST_AUTHORED = "2026-05-10T00:00:00.000Z";

/**
 * `HqlaLevel1` — money-units stock of Level-1 HQLA held by the bank, as-of
 * a given date. Level-1 assets are coins + banknotes, central-bank reserves
 * (subject to drawdown criteria), and Level-1 sovereign / supranational
 * securities. 100% factor in the LCR numerator (no haircut).
 *
 * Per BCBS D295 §50(a)–(c) and Regulations Relating to Banks Reg 26(7)(a):
 * Level-1 assets carry no cap relative to total HQLA.
 */
export const hqlaLevel1: SemanticEntry = {
  id: "HqlaLevel1",
  version: "v0.1",
  description:
    "Stock of High-Quality Liquid Assets — Level 1 (BCBS D295 / Reg 26(7)(a)). Cash, central-bank reserves (drawdown-eligible portion), Level-1 sovereign / supranational securities. 100% factor in LCR numerator; no concentration cap.",
  units: "money-minor",
  dimensions: ["currency", "account", "hqlaLevel"],
  projection: "liquidity-projection",
  formula:
    "sum(Balance where {entity, hqlaLevel='level-1', asOf=asOfQuery}) — equivalent to sum(CashAndBalancesAtSARB) + sum(BalancesAtOtherCentralBanks) + sum(Level1SovereignSecurities)",
  regulatoryCells: [
    {
      form: "BA 325",
      line: "HQLA Level 1 — total stock (LCR numerator component)",
      side: "positive",
      note: "Aggregated Level-1 stock per Reg 26(7)(a); CashAndBalancesAtSARB is the worked Slice-1 sub-line.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Liquid-asset prudential requirements — empowering provision for LCR.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "BCBS D295 / Regulations Relating to Banks Reg 26(7)(a) — Level-1 HQLA composition + 100% factor.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact SARB BA 325 line-number sequencing for Level-1 sub-categories pending published-schema ingestion]",
    },
  ],
  signers: ["Eitan", "Camille"],
  entityScope: [HOZ_BANK],
  ifrsClassifications: ["amortised-cost", "fvoci-debt", "fvtpl"],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Aggregated quantity. The Slice-1 CashAndBalancesAtSARB entry is one sub-line that contributes to this aggregate; future Level-1 sub-lines (other-central-bank balances, sovereign securities, supranational securities) land as additional Slice-1-shape entries that this aggregate composes.",
};

/**
 * `HqlaLevel2A` — money-units stock of Level-2A HQLA. 85% factor (15%
 * haircut) per BCBS D295 §52 / Reg 26(7)(b). Capped at 40% of total HQLA
 * (Level 1 + Level 2A + Level 2B) per BCBS D295 §47 / Reg 26(7).
 *
 * Eligibility: 20% risk-weight sovereign / PSE / multilateral-development-bank
 * securities; corporate debt + covered bonds rated AA- or higher and meeting
 * the operational requirements.
 */
export const hqlaLevel2A: SemanticEntry = {
  id: "HqlaLevel2A",
  version: "v0.1",
  description:
    "Stock of High-Quality Liquid Assets — Level 2A. 85% factor (15% haircut). Subject to the 40%-of-total-HQLA cap per BCBS D295 §47 / Reg 26(7).",
  units: "money-minor",
  dimensions: ["currency", "account", "hqlaLevel"],
  projection: "liquidity-projection",
  formula:
    "min(sum(Balance where {entity, hqlaLevel='level-2a', asOf=asOfQuery}) * 0.85, 0.4 * totalHqlaPostCap)",
  regulatoryCells: [
    {
      form: "BA 325",
      line: "HQLA Level 2A — post-haircut stock (LCR numerator component, post-cap)",
      side: "positive",
      note: "Cap arithmetic per Reg 26(7); generator applies cap at numerator-assembly time.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Liquid-asset prudential requirements — empowering provision for LCR.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "BCBS D295 §52 / Regulations Relating to Banks Reg 26(7)(b) — Level-2A HQLA composition + 85% factor + 40% cap.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — Level-2A asset eligibility per SARB BA 325 published taxonomy]",
    },
  ],
  signers: ["Eitan", "Camille"],
  entityScope: [HOZ_BANK],
  ifrsClassifications: ["amortised-cost", "fvoci-debt", "fvtpl"],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Aggregated quantity post-haircut. The 40%-cap is a property of the LCR numerator assembly, not of this entry alone; the BA 325 generator (Slice 3) carries the cap arithmetic.",
};

/**
 * `HqlaLevel2B` — money-units stock of Level-2B HQLA. Asset-specific factors
 * (50% lower bound for corporate debt rated A+ to BBB-; 50% for common
 * equities; 25% for qualifying RMBS) per BCBS D295 §54 / Reg 26(7)(c).
 * Capped at 15% of total HQLA per BCBS D295 §47 / Reg 26(7).
 */
export const hqlaLevel2B: SemanticEntry = {
  id: "HqlaLevel2B",
  version: "v0.1",
  description:
    "Stock of High-Quality Liquid Assets — Level 2B. Asset-specific factors (50% lower bound; 25% RMBS). Subject to the 15%-of-total-HQLA cap per BCBS D295 §47 / Reg 26(7).",
  units: "money-minor",
  dimensions: ["currency", "account", "hqlaLevel"],
  projection: "liquidity-projection",
  formula:
    "min(sum(Balance * assetSpecificFactor where {entity, hqlaLevel='level-2b', asOf=asOfQuery}), 0.15 * totalHqlaPostCap)",
  regulatoryCells: [
    {
      form: "BA 325",
      line: "HQLA Level 2B — post-haircut stock (LCR numerator component, post-cap)",
      side: "positive",
      note: "Asset-specific factor + 15% cap applied at numerator-assembly time per Reg 26(7).",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Liquid-asset prudential requirements — empowering provision for LCR.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "BCBS D295 §54 / Regulations Relating to Banks Reg 26(7)(c) — Level-2B HQLA composition, asset-specific factors, + 15% cap.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — Level-2B asset eligibility + per-asset factor table per SARB BA 325 published taxonomy]",
    },
  ],
  signers: ["Eitan", "Camille"],
  entityScope: [HOZ_BANK],
  ifrsClassifications: ["fvoci-debt", "fvoci-equity", "fvtpl"],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Aggregated quantity post-haircut. Per-asset factors (50% / 25%) are an entry-formula concern, not a generator-arithmetic concern; this slice ships the aggregate with a stub factor of 50% for non-RMBS Level-2B assets. Mira's WS-INSTRUMENT-ANALYSES will refine.",
};

/**
 * `LcrCashOutflows30D` — total stressed cash outflows over the next 30
 * calendar days, before any inflow offset. Drives the LCR denominator's
 * gross outflow component.
 *
 * Per BCBS D295 §69–§141 / Reg 26(8): outflow categories include retail
 * deposits (5–10%), unsecured wholesale funding (5–100% by counterparty
 * type), secured funding (0–100% by collateral level), derivatives (100%
 * outflows + valuation-change-on-collateral), other contingent funding
 * obligations (variable rates).
 */
export const lcrCashOutflows30D: SemanticEntry = {
  id: "LcrCashOutflows30D",
  version: "v0.1",
  description:
    "Stressed cash outflows over the next 30 calendar days (LCR denominator, gross). Aggregated across retail / wholesale / secured-funding / derivatives / contingent-funding categories per BCBS D295 §69–§141 / Reg 26(8).",
  units: "money-minor",
  dimensions: ["currency"],
  projection: "liquidity-projection",
  formula:
    "sum(category.outstandingBalance * category.runOffRate for category in outflowCategories where entity = entity and asOf <= asOfQuery)",
  regulatoryCells: [
    {
      form: "BA 325",
      line: "Total cash outflows (LCR denominator, gross)",
      side: "positive",
      note: "Pre-inflow-cap aggregate per Reg 26(8); generator decomposes into category sub-lines for line-by-line render.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Liquid-asset prudential requirements — empowering provision for LCR.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "BCBS D295 §69–§141 / Regulations Relating to Banks Reg 26(8) — outflow category run-off rates.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact SARB BA 325 outflow sub-category line-numbering + run-off-rate calibration per published-schema ingestion]",
    },
  ],
  signers: ["Eitan", "Camille"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Aggregated quantity. Build-phase: the bank holds no real customer deposits (Niko's lifecycle paused per buildPhaseStatus) so wholesale + retail categories trial as zero in the dry-run scenario; the formula scaffold is exercised against a synthetic stress fixture. Live numbers populate at commencement-of-trading.",
};

/**
 * `LcrCashInflows30D` — total stressed cash inflows over the next 30
 * calendar days, capped at 75% of LcrCashOutflows30D per BCBS D295 §142 /
 * Reg 26(11).
 *
 * The cap means the LCR denominator (`net cash outflows`) is bounded below
 * by 25% of gross outflows — a bank cannot rely on inflows to fully offset
 * outflows during a stress.
 */
export const lcrCashInflows30D: SemanticEntry = {
  id: "LcrCashInflows30D",
  version: "v0.1",
  description:
    "Stressed cash inflows over the next 30 calendar days, capped at 75% of LcrCashOutflows30D per BCBS D295 §142 / Reg 26(11). LCR denominator inflow-offset component.",
  units: "money-minor",
  dimensions: ["currency"],
  projection: "liquidity-projection",
  formula:
    "min(sum(category.outstandingBalance * category.inflowRate for category in inflowCategories), 0.75 * LcrCashOutflows30D)",
  regulatoryCells: [
    {
      form: "BA 325",
      line: "Total cash inflows (LCR denominator, post-cap)",
      side: "negative",
      note: "Cap arithmetic at min(75% × outflows, gross-inflows); generator carries it.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Liquid-asset prudential requirements — empowering provision for LCR.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "BCBS D295 §142 / Regulations Relating to Banks Reg 26(11) — inflow categories + 75% cap.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact SARB BA 325 inflow sub-category line-numbering per published-schema ingestion]",
    },
  ],
  signers: ["Eitan", "Camille"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Cap arithmetic is generator-level, not entry-level; the entry stores the definition. BCBS 248 (intraday liquidity monitoring) is a separate operational lens that does not feed BA 325 directly; the intraday monitoring family is downstream substrate.",
};

/**
 * `LiquidityCoverageRatio` — the derived ratio (HQLA stock / net cash
 * outflows over 30 days). Required to be ≥ 100% per BCBS D295 §22 / Reg
 * 26(2). Exit-criterion quantity for the BA 325 form: the cell that the
 * supervisor reads to assess compliance.
 *
 * Computation:
 *   numerator   = HqlaLevel1 + min(HqlaLevel2A * 0.85, 0.40 * stockHQLA)
 *                              + min(HqlaLevel2B * factor, 0.15 * stockHQLA)
 *                 (the cap arithmetic is iterative; the generator handles it)
 *   denominator = max(LcrCashOutflows30D − min(LcrCashInflows30D, 0.75 *
 *                 LcrCashOutflows30D), 0.25 * LcrCashOutflows30D)
 *   LCR        = numerator / denominator   (ratio, dimensionless)
 *
 * Render layer multiplies by 100 for the percentage form the regulator's
 * BA 325 cell shows.
 */
export const liquidityCoverageRatio: SemanticEntry = {
  id: "LiquidityCoverageRatio",
  version: "v0.1",
  description:
    "Liquidity Coverage Ratio — stock of HQLA divided by total net cash outflows over a 30-day stress period. Required ≥ 100% per BCBS D295 §22 / Reg 26(2). Reported on BA 325.",
  units: "ratio",
  dimensions: ["currency"],
  projection: "liquidity-projection",
  formula:
    "(HqlaLevel1 + min(HqlaLevel2A*0.85, 0.40*stockHQLA) + min(HqlaLevel2B*factor, 0.15*stockHQLA)) / max(LcrCashOutflows30D - min(LcrCashInflows30D, 0.75*LcrCashOutflows30D), 0.25*LcrCashOutflows30D)",
  regulatoryCells: [
    {
      form: "BA 325",
      line: "Liquidity Coverage Ratio (%) — exit cell",
      side: "positive",
      note: "The single cell the regulator reads for compliance assessment; render layer multiplies by 100 for percentage display.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Liquid-asset prudential requirements — empowering provision for LCR.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "BCBS D295 §22 / Regulations Relating to Banks Reg 26(2) — LCR ≥ 100% requirement.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact SARB BA 325 LCR-cell line-number per published-schema ingestion; SARB transitional buffer waivers if any]",
    },
  ],
  signers: ["Eitan", "Camille", "Helena"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "The exit-criterion semantic entry for BA 325. Reported as a ratio; render-layer formats as percentage. RAS B7 (`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`) classifies the LCR model as Tier-1; independent validation per the Tier-1 model-validation pipeline (Helena CRO + future model-validation function) gates production use post-licence-day. Build-phase trials are rehearsal-grade.",
};

/**
 * Slice-3 liquidity-classification entries, exported as a single array for
 * ease of registry construction in tests and downstream consumers (BA 325
 * generator).
 */
export const SLICE_3_LIQUIDITY_ENTRIES: readonly SemanticEntry[] = [
  hqlaLevel1,
  hqlaLevel2A,
  hqlaLevel2B,
  lcrCashOutflows30D,
  lcrCashInflows30D,
  liquidityCoverageRatio,
] as const;
