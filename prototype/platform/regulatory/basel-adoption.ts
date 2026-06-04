// platform/regulatory/basel-adoption.ts
//
// Basel baseline + jurisdictional adoption registry — the machine-readable
// spine of the BCBS catalogue (Regulations/BCBS/*.md is the human render).
//
// WHY THIS EXISTS
// ---------------
// The bank is SARB-licensed but multi-jurisdiction by design (Principle 5).
// Prudential rules are substantially BCBS-derived, so the durable architecture
// is: catalogue the Basel Framework ONCE as the baseline, layer each
// jurisdiction's adoption deltas over it, and fall back to Basel where a local
// regulator is silent. Adding a second jurisdiction later means mapping only
// the national *deltas* — never re-cataloguing the substantive rule.
//
// This module is the typed "register" extraction of that model (per the
// regulatory-graph ontology, extractionMethod "register"). It is consumed by:
//   - resolve-applicable-rule.ts  (jurisdiction + provision + date -> rule)
//   - recon/basel-constants-coverage.ts  (every live Basel-derived constant
//     must cite a baseline provision that exists here)
// and is projectable into the SQLite regulatory graph (Provision nodes +
// TRANSPOSES/SUPERSEDES adoption edges) as a later slice.
//
// ADOPTION SEMANTICS (reconciled with the existing ontology edge set)
// -------------------------------------------------------------------
//   ADOPTS      jurisdiction takes the Basel provision unchanged
//               -> projects to a TRANSPOSES edge, no delta.
//   MODIFIES    jurisdiction adopts with a variation (national discount,
//               different transition date, add-on) -> TRANSPOSES + delta.
//   GOLD_PLATES jurisdiction is STRICTER than Basel (common; material for
//               capital planning) -> TRANSPOSES + delta + stricter:true.
//   SUPERSEDES  local rule replaces the Basel position entirely
//               -> projects to a SUPERSEDES edge.
//   (SILENT)    Basel speaks, the local regulator has not — modelled as the
//               ABSENCE of any adoption edge; the resolver falls back to the
//               Basel baseline. There is no SILENT row; silence is the default.
//
// Authority: D-BASEL-CATALOGUE-PILLAR-1 (CEO session-delegation 2026-06-04).
// Owner: Mira (Compliance / RegTech engineer, engineering); Basel-linked
// numeric baselines co-owned by CFO (LCR/NSFR/capital) and CRO (capital /
// leverage appetite + RWA weights), validated by Nadia (Model validator).
// Author: Mira (Compliance / RegTech engineer, engineering).

/** Pillar-1 Basel standard groups catalogued in this first slice. */
export type BaselStandard = "CAP" | "CRE" | "MAR" | "OPE" | "LCR" | "NSF" | "LEV" | "LEX";

/** How a jurisdiction relates a local instrument to a Basel baseline provision. */
export type AdoptionType = "ADOPTS" | "MODIFIES" | "GOLD_PLATES" | "SUPERSEDES";

/**
 * A Basel baseline provision. The `urn` is the canonical citation
 * (`urn:reg:bcbs:<standard-lc>:<chapter.para>`); `rule` is the plain-English
 * baseline requirement; `value`/`unit`/`operator` are populated where the
 * provision sets a quantitative floor/limit that a live engine consumes.
 */
export interface BaselProvision {
  /** `urn:reg:bcbs:lcr:20.1` etc. */
  readonly urn: string;
  readonly standard: BaselStandard;
  /** BIS chapter.paragraph identifier, e.g. "20.1", "40.3". */
  readonly paragraph: string;
  readonly title: string;
  /** Plain-English baseline requirement. */
  readonly rule: string;
  /** Quantitative floor/limit, where the provision sets one. */
  readonly value?: number;
  readonly unit?: "ratio" | "percentage-points" | "count";
  readonly operator?: ">=" | "<=" | "=" | ">" | "<";
  /** ISO date the (consolidated-framework) provision is effective from. */
  readonly effectiveFrom: string;
}

/**
 * A jurisdiction's adoption of a Basel baseline provision via a local
 * instrument. Encodes the typed delta where the adoption is not verbatim.
 */
export interface AdoptionEdge {
  /** The Basel baseline provision URN this edge adopts/modifies/supersedes. */
  readonly baselProvision: string;
  /** Lowercase jurisdiction code (`za`, `kw`, ...). */
  readonly jurisdiction: string;
  /** The local instrument that effects the adoption (a `urn:reg:<jur>:...`). */
  readonly localInstrument: string;
  readonly adoptionType: AdoptionType;
  /** Typed description of the variation (MODIFIES / GOLD_PLATES / SUPERSEDES). */
  readonly delta?: string;
  /** True when the local position is stricter than Basel (GOLD_PLATES). */
  readonly stricter?: boolean;
  readonly effectiveFrom: string;
  /** ISO date the edge ceases to apply (undefined = still in force). */
  readonly effectiveTo?: string;
}

// ---------------------------------------------------------------------------
// A. Basel baseline provisions (Pillar-1 spine)
//
// Numeric values mirror the BIS consolidated framework floors. They are the
// BASELINE; the live calc engines read the *operative* number from
// financial-constants.ts, which cites back here via `baselProvision`.
// ---------------------------------------------------------------------------

export const BASEL_PROVISIONS: readonly BaselProvision[] = [
  // ── CAP — Definition of capital ────────────────────────────────────────
  {
    urn: "urn:reg:bcbs:cap:10.1",
    standard: "CAP",
    paragraph: "10.1",
    title: "Common Equity Tier 1 minimum",
    rule: "CET1 capital must be at least 4.5% of risk-weighted assets at all times.",
    value: 0.045,
    unit: "ratio",
    operator: ">=",
    effectiveFrom: "2019-12-15",
  },
  {
    urn: "urn:reg:bcbs:cap:10.2",
    standard: "CAP",
    paragraph: "10.2",
    title: "Tier 1 minimum",
    rule: "Tier 1 capital (CET1 + AT1) must be at least 6.0% of risk-weighted assets.",
    value: 0.06,
    unit: "ratio",
    operator: ">=",
    effectiveFrom: "2019-12-15",
  },
  {
    urn: "urn:reg:bcbs:cap:10.3",
    standard: "CAP",
    paragraph: "10.3",
    title: "Total capital minimum",
    rule: "Total capital (Tier 1 + Tier 2) must be at least 8.0% of risk-weighted assets.",
    value: 0.08,
    unit: "ratio",
    operator: ">=",
    effectiveFrom: "2019-12-15",
  },
  {
    urn: "urn:reg:bcbs:cap:30.1",
    standard: "CAP",
    paragraph: "30.1",
    title: "Capital conservation buffer",
    rule: "A capital conservation buffer of 2.5% of RWA, met with CET1, sits above the minima; breach constrains distributions.",
    value: 0.025,
    unit: "ratio",
    operator: ">=",
    effectiveFrom: "2019-12-15",
  },
  // ── CRE — Credit risk (standardised) ───────────────────────────────────
  {
    urn: "urn:reg:bcbs:cre:20.6",
    standard: "CRE",
    paragraph: "20.6",
    title: "Sovereign risk weight (standardised)",
    rule: "Exposures to a sovereign in its own currency may attract a 0% risk weight at national discretion; otherwise risk-weighted by external rating.",
    value: 0,
    unit: "ratio",
    operator: "=",
    effectiveFrom: "2023-01-01",
  },
  {
    urn: "urn:reg:bcbs:cre:20.40",
    standard: "CRE",
    paragraph: "20.40",
    title: "Corporate risk weight (standardised)",
    rule: "Corporate exposures are risk-weighted 20%–150% by external rating; unrated investment-grade corporates 65%.",
    effectiveFrom: "2023-01-01",
  },
  {
    urn: "urn:reg:bcbs:cre:51.1",
    standard: "CRE",
    paragraph: "51.1",
    title: "Counterparty credit risk — SA-CCR EAD",
    rule: "Exposure at default for derivative counterparty credit risk is computed under SA-CCR: EAD = 1.4 × (replacement cost + potential future exposure).",
    value: 1.4,
    unit: "ratio",
    operator: "=",
    effectiveFrom: "2017-03-01",
  },
  // ── MAR — Market risk ──────────────────────────────────────────────────
  {
    urn: "urn:reg:bcbs:mar:20.1",
    standard: "MAR",
    paragraph: "20.1",
    title: "Standardised approach — market-risk capital",
    rule: "Market-risk capital under the standardised approach is the sum of the risk-class capital charges (sensitivities-based method, default risk charge, residual risk add-on).",
    effectiveFrom: "2023-01-01",
  },
  {
    urn: "urn:reg:bcbs:mar:33.1",
    standard: "MAR",
    paragraph: "33.1",
    title: "Internal-models expected shortfall",
    rule: "Under the internal models approach, market-risk capital uses expected shortfall at a 97.5% one-tailed confidence level.",
    value: 0.975,
    unit: "ratio",
    operator: "=",
    effectiveFrom: "2023-01-01",
  },
  {
    urn: "urn:reg:bcbs:mar:99.1",
    standard: "MAR",
    paragraph: "99.1",
    title: "Legacy VaR confidence / window",
    rule: "Legacy (Basel 2.5) market-risk VaR uses a 99% one-tailed confidence level over a minimum one-year (≈250 business day) observation window.",
    value: 0.99,
    unit: "ratio",
    operator: "=",
    effectiveFrom: "2011-12-31",
  },
  // ── OPE — Operational risk ─────────────────────────────────────────────
  {
    urn: "urn:reg:bcbs:ope:25.1",
    standard: "OPE",
    paragraph: "25.1",
    title: "Basic Indicator Approach alpha",
    rule: "Operational-risk capital under the Basic Indicator Approach is 15% (alpha) of average positive annual gross income over the prior three years.",
    value: 0.15,
    unit: "ratio",
    operator: "=",
    effectiveFrom: "2006-06-30",
  },
  // ── LCR — Liquidity Coverage Ratio ─────────────────────────────────────
  {
    urn: "urn:reg:bcbs:lcr:20.1",
    standard: "LCR",
    paragraph: "20.1",
    title: "LCR minimum",
    rule: "The stock of HQLA must be at least 100% of total net cash outflows over a 30 calendar-day stress.",
    value: 1.0,
    unit: "ratio",
    operator: ">=",
    effectiveFrom: "2019-12-15",
  },
  {
    urn: "urn:reg:bcbs:lcr:40.3",
    standard: "LCR",
    paragraph: "40.3",
    title: "HQLA haircuts by level",
    rule: "Level 1 assets 0% haircut; Level 2A 15%; Level 2B 25%–50%. Level 2 capped at 40% of HQLA; Level 2B at 15%.",
    effectiveFrom: "2019-12-15",
  },
  {
    urn: "urn:reg:bcbs:lcr:40.10",
    standard: "LCR",
    paragraph: "40.10",
    title: "Stressed outflow run-off rates",
    rule: "Run-off rates by funding type: stable retail 3%–5%, less-stable retail 10%, operational wholesale 25%, non-operational wholesale up to 100%.",
    effectiveFrom: "2019-12-15",
  },
  {
    urn: "urn:reg:bcbs:lcr:40.40",
    standard: "LCR",
    paragraph: "40.40",
    title: "Inflow recognition cap",
    rule: "Total cash inflows recognised are capped at 75% of total expected cash outflows.",
    value: 0.75,
    unit: "ratio",
    operator: "<=",
    effectiveFrom: "2019-12-15",
  },
  // ── NSF — Net Stable Funding Ratio ─────────────────────────────────────
  {
    urn: "urn:reg:bcbs:nsf:20.1",
    standard: "NSF",
    paragraph: "20.1",
    title: "NSFR minimum",
    rule: "Available stable funding must be at least 100% of required stable funding on an ongoing (one-year) basis.",
    value: 1.0,
    unit: "ratio",
    operator: ">=",
    effectiveFrom: "2019-12-15",
  },
  {
    urn: "urn:reg:bcbs:nsf:30.1",
    standard: "NSF",
    paragraph: "30.1",
    title: "Available stable funding factors",
    rule: "ASF factors: capital and >1y liabilities 100%; stable retail <1y 95%; less-stable retail 90%; operational wholesale 50%; non-operational <1y 0%.",
    effectiveFrom: "2019-12-15",
  },
  {
    urn: "urn:reg:bcbs:nsf:40.1",
    standard: "NSF",
    paragraph: "40.1",
    title: "Required stable funding factors",
    rule: "RSF factors by asset class: HQLA L1 5%, L2A 15%, L2B 50%; loans by residual maturity 10%–85%; net derivative liabilities 100%.",
    effectiveFrom: "2019-12-15",
  },
  // ── LEV — Leverage ratio ───────────────────────────────────────────────
  {
    urn: "urn:reg:bcbs:lev:20.1",
    standard: "LEV",
    paragraph: "20.1",
    title: "Leverage ratio minimum",
    rule: "Tier 1 capital divided by the total exposure measure must be at least 3%.",
    value: 0.03,
    unit: "ratio",
    operator: ">=",
    effectiveFrom: "2019-12-15",
  },
  // ── LEX — Large exposures ──────────────────────────────────────────────
  {
    urn: "urn:reg:bcbs:lex:30.1",
    standard: "LEX",
    paragraph: "30.1",
    title: "Large-exposure limit",
    rule: "Exposure to a single counterparty or group of connected counterparties must not exceed 25% of Tier 1 capital.",
    value: 0.25,
    unit: "ratio",
    operator: "<=",
    effectiveFrom: "2019-01-01",
  },
] as const;

// ---------------------------------------------------------------------------
// B. Adoption edges — South Africa (first adopting jurisdiction)
//
// SARB's Prudential Authority adopts the Basel Pillar-1 framework via the
// Banks Act 94 of 1990 and the Regulations Relating to Banks. Where SA takes
// the baseline verbatim the edge is ADOPTS; where it tightens (e.g. RAS
// management buffers above the Basel floor) it is GOLD_PLATES with the delta.
// ---------------------------------------------------------------------------

export const ADOPTION_EDGES: readonly AdoptionEdge[] = [
  // CAP — capital minima adopted verbatim via Reg 38.
  {
    baselProvision: "urn:reg:bcbs:cap:10.1",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg38",
    adoptionType: "ADOPTS",
    effectiveFrom: "2013-01-01",
  },
  {
    baselProvision: "urn:reg:bcbs:cap:10.2",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg38",
    adoptionType: "ADOPTS",
    effectiveFrom: "2013-01-01",
  },
  {
    baselProvision: "urn:reg:bcbs:cap:10.3",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg38",
    adoptionType: "ADOPTS",
    effectiveFrom: "2013-01-01",
  },
  {
    baselProvision: "urn:reg:bcbs:cap:30.1",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg38",
    adoptionType: "MODIFIES",
    delta:
      "PA sets the conservation buffer at the 2.5% Basel level but adds bank-specific Pillar 2A add-ons and a countercyclical buffer set by SARB from time to time.",
    effectiveFrom: "2016-01-01",
  },
  // CRE — credit + counterparty credit risk via Reg 38.
  {
    baselProvision: "urn:reg:bcbs:cre:20.6",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg38",
    adoptionType: "ADOPTS",
    delta:
      "PA exercises the national discretion to 0%-weight ZAR-denominated RSA sovereign exposures.",
    effectiveFrom: "2013-01-01",
  },
  {
    baselProvision: "urn:reg:bcbs:cre:20.40",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg38",
    adoptionType: "ADOPTS",
    effectiveFrom: "2023-01-01",
  },
  {
    baselProvision: "urn:reg:bcbs:cre:51.1",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg38",
    adoptionType: "ADOPTS",
    effectiveFrom: "2019-10-01",
  },
  // MAR — market risk via Reg 38 (FRTB-SA commencement deferred locally).
  {
    baselProvision: "urn:reg:bcbs:mar:99.1",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg38",
    adoptionType: "ADOPTS",
    effectiveFrom: "2013-01-01",
  },
  {
    baselProvision: "urn:reg:bcbs:mar:20.1",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg38",
    adoptionType: "MODIFIES",
    delta:
      "The bank applies a simplified instrument-class market-RWA proxy during the build phase, pending FRTB-SA commencement (PA PC 18/2024).",
    effectiveFrom: "2013-01-01",
  },
  // OPE — operational risk via Reg 33.
  {
    baselProvision: "urn:reg:bcbs:ope:25.1",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg33",
    adoptionType: "ADOPTS",
    effectiveFrom: "2013-01-01",
  },
  // LCR — liquidity coverage via Reg 26 / BA 325.
  {
    baselProvision: "urn:reg:bcbs:lcr:20.1",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg26",
    adoptionType: "ADOPTS",
    effectiveFrom: "2015-01-01",
  },
  {
    baselProvision: "urn:reg:bcbs:lcr:40.3",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg26",
    adoptionType: "ADOPTS",
    delta: "Operationalised in BA 325 Annex 1 haircut schedule.",
    effectiveFrom: "2015-01-01",
  },
  {
    baselProvision: "urn:reg:bcbs:lcr:40.10",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg26",
    adoptionType: "ADOPTS",
    delta: "BA 325 run-off schedule.",
    effectiveFrom: "2015-01-01",
  },
  {
    baselProvision: "urn:reg:bcbs:lcr:40.40",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg26",
    adoptionType: "ADOPTS",
    effectiveFrom: "2015-01-01",
  },
  // NSF — net stable funding via Reg 26A / BA 326.
  {
    baselProvision: "urn:reg:bcbs:nsf:20.1",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg26a",
    adoptionType: "ADOPTS",
    effectiveFrom: "2018-01-01",
  },
  {
    baselProvision: "urn:reg:bcbs:nsf:30.1",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg26a",
    adoptionType: "ADOPTS",
    effectiveFrom: "2018-01-01",
  },
  {
    baselProvision: "urn:reg:bcbs:nsf:40.1",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg26a",
    adoptionType: "ADOPTS",
    effectiveFrom: "2018-01-01",
  },
  // LEV — leverage ratio via Reg 38; bank RAS gold-plates above the 3% floor.
  {
    baselProvision: "urn:reg:bcbs:lev:20.1",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg38",
    adoptionType: "GOLD_PLATES",
    delta:
      "PA adopts the 3% Basel minimum; the bank's RAS operates a stricter green/amber/red appetite band (green ≥4.5%) above it (D-RAS).",
    stricter: true,
    effectiveFrom: "2018-01-01",
  },
  // LEX — large exposures via Reg 38 / BA 330.
  {
    baselProvision: "urn:reg:bcbs:lex:30.1",
    jurisdiction: "za",
    localInstrument: "urn:reg:za:regs-relating-to-banks:reg38",
    adoptionType: "ADOPTS",
    effectiveFrom: "2019-01-01",
  },
] as const;

// ---------------------------------------------------------------------------
// C. Lookup helpers
// ---------------------------------------------------------------------------

/** Returns the baseline provision with this URN, or undefined. */
export function findBaselProvision(urn: string): BaselProvision | undefined {
  return BASEL_PROVISIONS.find((p) => p.urn === urn);
}

/** True if a Basel baseline provision with this URN exists in the catalogue. */
export function isCataloguedBaselProvision(urn: string): boolean {
  return BASEL_PROVISIONS.some((p) => p.urn === urn);
}
