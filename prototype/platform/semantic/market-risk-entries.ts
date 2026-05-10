// platform/semantic/market-risk-entries.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 5 (this dispatch) —
// market-risk semantic-layer entries. Extends the Slice-1 / Slice-3
// registry with the minimum vocabulary the BA 350 (market-risk) generator
// needs.
//
// Per pack §6 Slice 4 (BA 350 + BA 700 + BA 600) consolidated with §6
// Slice 5 (XML render layer) into the dispatch's "Slice 5". The parallel
// dispatch handles BA 700 (IRRBB) + the rate-risk semantic family; this
// file lands the *market-risk-trading-book* family that BA 350 consumes.
//
// Entries:
//
//   InterestRateGeneralRisk        — Pillar-1 IR general-risk capital
//                                    charge under the standardised approach
//                                    (BCBS D352 §709-§718, Reg 28(3)(a)).
//   InterestRateSpecificRisk       — Pillar-1 IR specific-risk capital
//                                    charge (issuer-by-issuer; BCBS D352
//                                    §710, Reg 28(3)(b)).
//   EquityPositionRisk             — Pillar-1 equity general + specific
//                                    risk (BCBS D352 §718(xix)-(xxiv),
//                                    Reg 28(4)).
//   ForeignExchangeRisk            — Pillar-1 FX risk capital charge —
//                                    standardised net-open-position
//                                    method (BCBS D352 §718(xxxix), Reg
//                                    28(5)).
//   CommodityRisk                  — Pillar-1 commodity risk (BCBS D352
//                                    §718(xli)-(lii), Reg 28(6)).
//   MarketRiskRwa                  — Aggregate market-risk RWA (sum of
//                                    above × 12.5).
//
// Per pack §9 Q1 default (rehearsal-grade with placeholders), each entry
// carries one resolved citation chain plus one `[citation: TBC]` marker
// pointing at Mira's WS-INSTRUMENT-ANALYSES workstream that resolves the
// precise SARB BA 350 line numbers post published-schema ingestion.
//
// Hoz Bank only — Hoz Securities + Hoz Group are not bank-licence-bound.
// Bank-licence scope per `Regulations/_legal-entity-tree.md` and
// `D-REGULATORY-PERIMETER`.
//
// Authors: Anya (Data / analytics engineer, engineering — reports to Devon
//   COO; semantic-layer + projection-runtime curator)
//   + Helena (Chief Risk Officer, governance — reports to CEO; market-risk
//   methodology owner — citation: typed reference)
//   + Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping + reviewer).

import type { SemanticEntry } from "./types";

const HOZ_BANK = "urn:legal-entity:hoz:hoz-bank:v1";
const FIRST_AUTHORED = "2026-05-10T00:00:00.000Z";

/**
 * `InterestRateGeneralRisk` — capital charge for the general (parallel-
 * shift) component of trading-book interest-rate risk under the
 * standardised approach. Maturity-band ladder method per BCBS D352 §718(ii)
 * / Reg 28(3)(a). Money-units; ZAR functional currency for Hoz Bank.
 */
export const interestRateGeneralRisk: SemanticEntry = {
  id: "InterestRateGeneralRisk",
  version: "v0.1",
  description:
    "Pillar-1 interest-rate general-risk capital charge (trading-book), standardised maturity-method per BCBS D352 §718(ii) / Reg 28(3)(a). Sum of weighted long+short positions across the maturity-band ladder, plus vertical / horizontal disallowances.",
  units: "money-minor",
  dimensions: ["currency"],
  projection: "market-risk-projection",
  formula:
    "sum(maturityBand.weightedNet for band in maturityLadder) + verticalDisallowances + horizontalDisallowances",
  regulatoryCells: [
    {
      form: "BA 350",
      line: "Interest-rate risk — general-risk capital requirement",
      side: "positive",
      note: "Maturity-method per Reg 28(3)(a); sub-sums by currency for multi-currency books (build-phase: ZAR only).",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital adequacy — empowering provision for Pillar-1 market-risk capital requirement.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "BCBS D352 §718(ii) / Regulations Relating to Banks Reg 28(3)(a) — interest-rate general-risk standardised maturity-method.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact SARB BA 350 maturity-ladder line numbering pending published-schema ingestion]",
    },
  ],
  signers: ["Helena", "Camille"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Build-phase: trading-book is a JSE-bonds + OTC-IRD scaffold per strategic-foundation; live positions populate at commencement-of-trading. Independent model validation per RAS B7 Tier-1 pipeline gates production use post-licence-day.",
};

/**
 * `InterestRateSpecificRisk` — issuer-specific component of trading-book
 * IR risk. Distinct from general-risk; charge is per-issuer / per-rating
 * grade per BCBS D352 §710 / Reg 28(3)(b).
 */
export const interestRateSpecificRisk: SemanticEntry = {
  id: "InterestRateSpecificRisk",
  version: "v0.1",
  description:
    "Pillar-1 interest-rate specific-risk capital charge (trading-book), issuer-specific. Per-issuer / per-rating-grade weights per BCBS D352 §710 / Reg 28(3)(b).",
  units: "money-minor",
  dimensions: ["currency", "counterparty"],
  projection: "market-risk-projection",
  formula:
    "sum(grossPosition × specificRiskWeight for instrument in tradingBook where issuer = counterparty)",
  regulatoryCells: [
    {
      form: "BA 350",
      line: "Interest-rate risk — specific-risk capital requirement",
      side: "positive",
      note: "Per-issuer/rating risk weight per Reg 28(3)(b).",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital adequacy — empowering provision for Pillar-1 market-risk capital requirement.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "BCBS D352 §710 / Regulations Relating to Banks Reg 28(3)(b) — specific-risk weights per issuer/rating.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact SARB BA 350 specific-risk line numbering + per-rating weight calibration]",
    },
  ],
  signers: ["Helena", "Camille"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Build-phase: rating-grade taxonomy + issuer mapping land at Slice 6+; v0 generator carries a stub-rate path for synthetic-fixture exercise.",
};

/**
 * `EquityPositionRisk` — Pillar-1 equity-position risk. General-market +
 * specific risk per BCBS D352 §718(xix)-(xxiv) / Reg 28(4).
 */
export const equityPositionRisk: SemanticEntry = {
  id: "EquityPositionRisk",
  version: "v0.1",
  description:
    "Pillar-1 equity position risk (trading-book). 8% general-market + 8% specific (4% liquid + diversified) per BCBS D352 §718(xix)-(xxiv) / Reg 28(4).",
  units: "money-minor",
  dimensions: ["currency"],
  projection: "market-risk-projection",
  formula:
    "0.08 × |netLongShortByMarket| + 0.08 × grossPositionByMarket  (4% if liquid + diversified)",
  regulatoryCells: [
    {
      form: "BA 350",
      line: "Equity position risk — capital requirement",
      side: "positive",
      note: "Standardised approach per Reg 28(4); diversification factor applies for qualifying portfolios.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital adequacy — empowering provision for Pillar-1 market-risk capital requirement.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "BCBS D352 §718(xix)-(xxiv) / Regulations Relating to Banks Reg 28(4) — equity position risk standardised method.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — JSE-listed-equity diversification-factor eligibility per SARB BA 350]",
    },
  ],
  signers: ["Helena", "Camille"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Build-phase: JSE-equity book is per strategic-foundation — institutional dealer flow only. Diversification factor for JSE Top-40 qualifying portfolios deferred to Slice 6+.",
};

/**
 * `ForeignExchangeRisk` — capital charge for FX positions. Net-open-
 * position method; the larger of the sum-of-net-longs vs sum-of-net-shorts,
 * × 8% per BCBS D352 §718(xxxix) / Reg 28(5).
 */
export const foreignExchangeRisk: SemanticEntry = {
  id: "ForeignExchangeRisk",
  version: "v0.1",
  description:
    "Pillar-1 FX risk capital charge — standardised net-open-position method (the larger of sum-net-longs vs sum-net-shorts × 8%) per BCBS D352 §718(xxxix) / Reg 28(5).",
  units: "money-minor",
  dimensions: [],
  projection: "market-risk-projection",
  formula:
    "0.08 × max(sum(netOpenPosition where side='long' across non-functional currencies), sum(netOpenPosition where side='short' across non-functional currencies))",
  regulatoryCells: [
    {
      form: "BA 350",
      line: "Foreign-exchange risk — capital requirement",
      side: "positive",
      note: "Net-open-position method per Reg 28(5); functional-currency leg excluded.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital adequacy — empowering provision for Pillar-1 market-risk capital requirement.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "BCBS D352 §718(xxxix) / Regulations Relating to Banks Reg 28(5) — FX net-open-position standardised method.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — SARB BA 350 FX-position line numbering + structural-position carve-out criteria]",
    },
  ],
  signers: ["Helena", "Camille"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Build-phase: FX desk is a Phase-A scenario; live FX positions populate at commencement-of-trading. Structural FX-position carve-out (BCBS D352 §718(xliii)) requires SARB approval and is out of build-phase scope.",
};

/**
 * `CommodityRisk` — capital charge for commodity-derivative positions per
 * BCBS D352 §718(xli)-(lii) / Reg 28(6). Build-phase: zero exposure
 * planned; entry registered for completeness so the generator can render
 * the line as a placeholder zero with citations.
 */
export const commodityRisk: SemanticEntry = {
  id: "CommodityRisk",
  version: "v0.1",
  description:
    "Pillar-1 commodity-position capital charge — simplified or maturity-ladder method per BCBS D352 §718(xli)-(lii) / Reg 28(6).",
  units: "money-minor",
  dimensions: [],
  projection: "market-risk-projection",
  formula: "sum(commodityPosition × 15%) + sum(grossPosition × 3%)  (simplified method)",
  regulatoryCells: [
    {
      form: "BA 350",
      line: "Commodity position risk — capital requirement",
      side: "positive",
      note: "Simplified method per Reg 28(6); build-phase zero exposure planned.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital adequacy — empowering provision for Pillar-1 market-risk capital requirement.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "BCBS D352 §718(xli)-(lii) / Regulations Relating to Banks Reg 28(6) — commodity standardised methods.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — SARB BA 350 commodity-line numbering]",
    },
  ],
  signers: ["Helena", "Camille"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Build-phase + steady-state: no commodity book planned per strategic-foundation (institutional global-markets bonds + equities + IRD). Entry held for return-shape completeness.",
};

/**
 * `MarketRiskRwa` — aggregate market-risk RWA. Capital × 12.5 conversion
 * per Banks-Act / Basel scaling; sum across the four / five sub-charges.
 */
export const marketRiskRwa: SemanticEntry = {
  id: "MarketRiskRwa",
  version: "v0.1",
  description:
    "Aggregate Pillar-1 market-risk RWA — sum of (interest-rate general + specific + equity + FX + commodity) capital charges × 12.5 (the inverse of the 8% minimum capital ratio).",
  units: "money-minor",
  dimensions: [],
  projection: "market-risk-projection",
  formula:
    "12.5 × (InterestRateGeneralRisk + InterestRateSpecificRisk + EquityPositionRisk + ForeignExchangeRisk + CommodityRisk)",
  regulatoryCells: [
    {
      form: "BA 350",
      line: "Total market-risk RWA",
      side: "positive",
      note: "RWA equivalent of the aggregated capital charge; flows up to BA 700 capital-adequacy aggregate.",
    },
  ],
  citations: [
    {
      type: "statute",
      statuteRef: "Banks Act 94 of 1990 §70",
      note: "Capital adequacy — empowering provision for Pillar-1 market-risk capital requirement.",
    },
    {
      type: "regulation",
      regulationId: "ORG-PR-06",
      note: "Regulations Relating to Banks Reg 28 — market-risk RWA aggregation.",
    },
    {
      type: "tbc",
      note: "[citation: TBC — Mira's WS-INSTRUMENT-ANALYSES — exact SARB BA 350 RWA-aggregate line]",
    },
  ],
  signers: ["Helena", "Camille"],
  entityScope: [HOZ_BANK],
  status: "in-force",
  firstAuthored: FIRST_AUTHORED,
  notes:
    "Aggregated quantity. Forward-link to Slice 6 capital-stack projection — MarketRiskRwa is one component of total RWA (credit + market + operational).",
};

/**
 * Slice-5 market-risk semantic entries, exported as a single array for
 * registry construction in tests and downstream consumers (BA 350
 * generator).
 */
export const SLICE_5_MARKET_RISK_ENTRIES: readonly SemanticEntry[] = [
  interestRateGeneralRisk,
  interestRateSpecificRisk,
  equityPositionRisk,
  foreignExchangeRisk,
  commodityRisk,
  marketRiskRwa,
] as const;
