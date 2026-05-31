// platform/config/financial-constants.ts
//
// Registry of owned financial calibration constants (objective 2 of
// D-TRUSTED-FIGURES-PROGRAM-V1). Every regulatory calibration number that
// previously lived as a buried literal inside a calc file (LCR run-off /
// haircut / caps / minimum, NSFR ASF/RSF factors, capital baselines +
// appetite thresholds) is declared here exactly once, with its owning seat
// and regulatory citation. The calc engines read from this registry; the
// Constants page (/api/constants) renders it; recon:financial-constants-
// coverage asserts the calc files hold no inline rate tables.
//
// Ownership follows the CLAUDE.md decision-authority routing table:
//   - LCR / NSFR / capital-calibration baselines  → CFO (Chief Financial Officer)
//   - capital + leverage appetite bands           → CRO (Chief Risk Officer)
//   - per-instrument-class RWA weights            → CRO (Chief Risk Officer)
// Nadia (Model validator) validates calibration changes.
//
// NOTE: the flat per-instrument-class RWA weight table that the per-product
// marginal-RWA estimator (platform/markets/products/rwa-delta.ts) consumes now
// lives here (category "rwa-instrument-weight"), replacing the buried literals
// it previously read from capital-funding-stub.json. The bucketed standardised-
// approach risk-weight *switch* in platform/risk/rwa-engine.ts and the BIC
// OPE25 thresholds remain in-engine: they are exhaustively cited inline against
// BCBS CRE20/OPE25 clause-by-clause, are not flat config tables, and fail loudly
// (RwaEngineError) rather than defaulting — flattening them into this registry
// would shed the clause citations and create a drift surface.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (Core banking platform architect, engineering).

export type ConstantUnit = "ratio" | "percentage-points" | "zar-minor";

export type ConstantCategory =
  | "lcr-runoff"
  | "lcr-inflow"
  | "lcr-haircut"
  | "lcr-cap"
  | "lcr-threshold"
  | "nsfr-asf"
  | "nsfr-rsf"
  | "nsfr-threshold"
  | "capital-baseline"
  | "capital-threshold"
  | "leverage-threshold"
  | "rwa-instrument-weight"
  | "product-control-tolerance";

export interface FinancialConstant {
  /** Stable dotted key. Calc files address constants by this key. */
  readonly key: string;
  /** The numeric value (interpret with `unit`). */
  readonly value: number;
  /** How to read `value`: a 0–1 ratio, percentage-points, or ZAR cents. */
  readonly unit: ConstantUnit;
  /** Grouping for the Constants page + coverage gate. */
  readonly category: ConstantCategory;
  /** Short human title. */
  readonly label: string;
  /** What the constant calibrates and where it is applied. */
  readonly description: string;
  /** Position that owns this constant (decision-authority routing). */
  readonly owningRole: string;
  /** Regulatory / decision citation. */
  readonly citation: string;
}

export const FINANCIAL_CONSTANTS: readonly FinancialConstant[] = [
  // ── LCR run-off rates (BA 325 calibration) — CFO ──────────────────────────
  {
    key: "lcr.runoff.retail-stable",
    value: 0.03,
    unit: "ratio",
    category: "lcr-runoff",
    label: "Run-off — retail stable",
    description: "30-day stressed run-off rate for stable retail deposits.",
    owningRole: "Chief Financial Officer",
    citation: "BA 325",
  },
  {
    key: "lcr.runoff.retail-less-stable",
    value: 0.1,
    unit: "ratio",
    category: "lcr-runoff",
    label: "Run-off — retail less stable",
    description: "30-day stressed run-off rate for less-stable retail deposits.",
    owningRole: "Chief Financial Officer",
    citation: "BA 325",
  },
  {
    key: "lcr.runoff.wholesale-operational",
    value: 0.25,
    unit: "ratio",
    category: "lcr-runoff",
    label: "Run-off — wholesale operational",
    description: "Run-off rate for unsecured operational wholesale funding.",
    owningRole: "Chief Financial Officer",
    citation: "BA 325",
  },
  {
    key: "lcr.runoff.wholesale-non-operational",
    value: 1.0,
    unit: "ratio",
    category: "lcr-runoff",
    label: "Run-off — wholesale non-operational",
    description: "Run-off rate for unsecured non-operational wholesale funding.",
    owningRole: "Chief Financial Officer",
    citation: "BA 325",
  },
  {
    key: "lcr.runoff.secured-level1",
    value: 0.0,
    unit: "ratio",
    category: "lcr-runoff",
    label: "Run-off — secured (L1 collateral)",
    description: "Run-off rate for secured funding backed by Level-1 collateral.",
    owningRole: "Chief Financial Officer",
    citation: "BA 325",
  },
  {
    key: "lcr.runoff.secured-level2",
    value: 0.15,
    unit: "ratio",
    category: "lcr-runoff",
    label: "Run-off — secured (L2 collateral)",
    description: "Run-off rate for secured funding backed by Level-2 collateral.",
    owningRole: "Chief Financial Officer",
    citation: "BA 325",
  },

  // ── LCR inflow rates — CFO ─────────────────────────────────────────────────
  {
    key: "lcr.inflow.contractual",
    value: 1.0,
    unit: "ratio",
    category: "lcr-inflow",
    label: "Inflow — contractual",
    description: "Recognition rate for fully-contractual 30-day inflows.",
    owningRole: "Chief Financial Officer",
    citation: "BA 325",
  },
  {
    key: "lcr.inflow.other",
    value: 0.5,
    unit: "ratio",
    category: "lcr-inflow",
    label: "Inflow — other",
    description: "Recognition rate for other (non-contractual) 30-day inflows.",
    owningRole: "Chief Financial Officer",
    citation: "BA 325",
  },

  // ── LCR HQLA haircuts (BA 325 Annex 1) — CFO ──────────────────────────────
  {
    key: "lcr.haircut.L1",
    value: 0.0,
    unit: "ratio",
    category: "lcr-haircut",
    label: "Haircut — Level 1",
    description: "Haircut applied to Level-1 HQLA (cash, reserves, 0% RW sovereigns).",
    owningRole: "Chief Financial Officer",
    citation: "BA 325 Annex 1",
  },
  {
    key: "lcr.haircut.L2a",
    value: 0.15,
    unit: "ratio",
    category: "lcr-haircut",
    label: "Haircut — Level 2a",
    description: "Haircut applied to Level-2a HQLA (20% RW sovereigns, AA- corporates).",
    owningRole: "Chief Financial Officer",
    citation: "BA 325 Annex 1",
  },
  {
    key: "lcr.haircut.L2b",
    value: 0.25,
    unit: "ratio",
    category: "lcr-haircut",
    label: "Haircut — Level 2b",
    description: "Build-phase floor haircut for Level-2b HQLA (actual up to 50%).",
    owningRole: "Chief Financial Officer",
    citation: "BA 325 Annex 1",
  },

  // ── LCR caps + recognition + minimum — CFO ────────────────────────────────
  {
    key: "lcr.cap.l2-of-hqla",
    value: 0.4,
    unit: "ratio",
    category: "lcr-cap",
    label: "Cap — L2 as share of HQLA",
    description: "Maximum Level-2 (post-haircut) as a fraction of total HQLA.",
    owningRole: "Chief Financial Officer",
    citation: "BA 325 §37-40",
  },
  {
    key: "lcr.cap.l2b-of-hqla",
    value: 0.15,
    unit: "ratio",
    category: "lcr-cap",
    label: "Cap — L2b as share of HQLA",
    description: "Maximum Level-2b (post-haircut) as a fraction of total HQLA.",
    owningRole: "Chief Financial Officer",
    citation: "BA 325 §37-40",
  },
  {
    key: "lcr.inflow-recognition-cap",
    value: 0.75,
    unit: "ratio",
    category: "lcr-cap",
    label: "Inflow recognition cap",
    description: "Recognised inflows capped at this fraction of stressed outflows.",
    owningRole: "Chief Financial Officer",
    citation: "BA 325 §19",
  },
  {
    key: "lcr.minimum-ratio",
    value: 1.0,
    unit: "ratio",
    category: "lcr-threshold",
    label: "LCR regulatory minimum",
    description: "Minimum LCR (1.00 = 100%) below which the bank is non-compliant.",
    owningRole: "Chief Financial Officer",
    citation: "BA 325",
  },
  {
    key: "lcr.at-minimum-tolerance-pct",
    value: 5,
    unit: "percentage-points",
    category: "lcr-threshold",
    label: "LCR at-minimum tolerance band",
    description: "Percentage points above the minimum still flagged as at-minimum.",
    owningRole: "Chief Financial Officer",
    citation: "D-TREASURY-GAPS-WAVE1",
  },

  // ── NSFR ASF weights (BA 326) — CFO ───────────────────────────────────────
  {
    key: "nsfr.asf.tier1-capital",
    value: 1.0,
    unit: "ratio",
    category: "nsfr-asf",
    label: "ASF — Tier-1 capital",
    description: "Available stable funding factor for Tier-1 capital.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.asf.tier2-capital-gt1y",
    value: 1.0,
    unit: "ratio",
    category: "nsfr-asf",
    label: "ASF — Tier-2 capital >1Y",
    description: "ASF factor for Tier-2 capital with residual maturity over one year.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.asf.retail-stable-lt1y",
    value: 0.95,
    unit: "ratio",
    category: "nsfr-asf",
    label: "ASF — retail stable <1Y",
    description: "ASF factor for stable retail deposits under one year.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.asf.retail-less-stable-lt1y",
    value: 0.9,
    unit: "ratio",
    category: "nsfr-asf",
    label: "ASF — retail less stable <1Y",
    description: "ASF factor for less-stable retail deposits under one year.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.asf.wholesale-gt1y",
    value: 1.0,
    unit: "ratio",
    category: "nsfr-asf",
    label: "ASF — wholesale >1Y",
    description: "ASF factor for wholesale deposits over one year.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.asf.wholesale-lt1y-operational",
    value: 0.5,
    unit: "ratio",
    category: "nsfr-asf",
    label: "ASF — wholesale <1Y operational",
    description: "ASF factor for operational wholesale deposits under one year.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.asf.wholesale-lt1y-non-operational",
    value: 0.0,
    unit: "ratio",
    category: "nsfr-asf",
    label: "ASF — wholesale <1Y non-operational",
    description: "ASF factor for non-operational wholesale deposits under one year.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },

  // ── NSFR RSF weights (BA 326) — CFO ───────────────────────────────────────
  {
    key: "nsfr.rsf.hqla-l1",
    value: 0.05,
    unit: "ratio",
    category: "nsfr-rsf",
    label: "RSF — HQLA L1",
    description: "Required stable funding factor for Level-1 HQLA.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.rsf.hqla-l2a",
    value: 0.15,
    unit: "ratio",
    category: "nsfr-rsf",
    label: "RSF — HQLA L2a",
    description: "RSF factor for Level-2a HQLA.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.rsf.hqla-l2b",
    value: 0.5,
    unit: "ratio",
    category: "nsfr-rsf",
    label: "RSF — HQLA L2b",
    description: "RSF factor for Level-2b HQLA.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.rsf.loan-lt6m",
    value: 0.1,
    unit: "ratio",
    category: "nsfr-rsf",
    label: "RSF — loans <6M",
    description: "RSF factor for loans maturing within six months.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.rsf.loan-6m-1y",
    value: 0.5,
    unit: "ratio",
    category: "nsfr-rsf",
    label: "RSF — loans 6M–1Y",
    description: "RSF factor for loans maturing in six months to one year.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.rsf.loan-gt1y-standard",
    value: 0.65,
    unit: "ratio",
    category: "nsfr-rsf",
    label: "RSF — loans >1Y standard",
    description: "RSF factor for standard loans maturing beyond one year.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.rsf.loan-gt1y-residential",
    value: 0.85,
    unit: "ratio",
    category: "nsfr-rsf",
    label: "RSF — loans >1Y residential",
    description: "RSF factor for residential loans maturing beyond one year.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.rsf.security-lt1y",
    value: 0.1,
    unit: "ratio",
    category: "nsfr-rsf",
    label: "RSF — securities <1Y",
    description: "RSF factor for securities maturing within one year.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.rsf.security-gt1y-non-hqla",
    value: 0.85,
    unit: "ratio",
    category: "nsfr-rsf",
    label: "RSF — securities >1Y non-HQLA",
    description: "RSF factor for non-HQLA securities maturing beyond one year.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.rsf.operational-deposit-at-fi",
    value: 0.1,
    unit: "ratio",
    category: "nsfr-rsf",
    label: "RSF — operational deposit at FI",
    description: "RSF factor for operational deposits placed at other financial institutions.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.rsf.derivative-net",
    value: 1.0,
    unit: "ratio",
    category: "nsfr-rsf",
    label: "RSF — derivatives (net)",
    description: "RSF factor for net derivative positions (simplified; full netting deferred).",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },

  // ── NSFR threshold — CFO ──────────────────────────────────────────────────
  {
    key: "nsfr.minimum-ratio",
    value: 1.0,
    unit: "ratio",
    category: "nsfr-threshold",
    label: "NSFR regulatory minimum",
    description: "Minimum NSFR (1.00 = 100%) below which the bank is non-compliant.",
    owningRole: "Chief Financial Officer",
    citation: "BA 326",
  },
  {
    key: "nsfr.at-minimum-tolerance-pct",
    value: 5,
    unit: "percentage-points",
    category: "nsfr-threshold",
    label: "NSFR at-minimum tolerance band",
    description: "Percentage points above the minimum still flagged as at-minimum.",
    owningRole: "Chief Financial Officer",
    citation: "D-TREASURY-GAPS-WAVE1",
  },

  // ── Capital baseline (ICAAP v1 build-phase) — CFO ─────────────────────────
  {
    key: "capital.build-phase.total-capital-minor",
    value: 30_000_000_000,
    unit: "zar-minor",
    category: "capital-baseline",
    label: "Build-phase total capital envelope",
    description: "R300,000,000 ICAAP v1 build-phase total capital envelope (ZAR cents).",
    owningRole: "Chief Financial Officer",
    citation: "D-MARKETS-CAPITAL-TIME-SHAPE",
  },
  {
    key: "capital.build-phase.total-rwa-minor",
    value: 7_375_000_000,
    unit: "zar-minor",
    category: "capital-baseline",
    label: "Build-phase total RWA",
    description: "R73,750,000 franchise-design-scale total RWA (ICAAP v1, ZAR cents).",
    owningRole: "Chief Financial Officer",
    citation: "D-MARKETS-CAPITAL-TIME-SHAPE",
  },
  {
    key: "capital.ticr-minor",
    value: 3_667_500_000,
    unit: "zar-minor",
    category: "capital-baseline",
    label: "Total Internal Capital Requirement (TICR)",
    description: "R36,675,000 TICR / ICAAP v1 capital floor (ZAR cents).",
    owningRole: "Chief Financial Officer",
    citation: "D-MARKETS-CAPITAL-TIME-SHAPE",
  },

  // ── Capital appetite thresholds (RAS §B3 bands) — CRO ─────────────────────
  {
    key: "capital.threshold.ceo-escalation-minor",
    value: 10_000_000_000,
    unit: "zar-minor",
    category: "capital-threshold",
    label: "Capital headroom — CEO escalation",
    description: "Headroom below R100,000,000 (ZAR cents) trips amber / CEO escalation.",
    owningRole: "Chief Risk Officer",
    citation: "D-RAS",
  },
  {
    key: "capital.threshold.board-notification-minor",
    value: 5_000_000_000,
    unit: "zar-minor",
    category: "capital-threshold",
    label: "Capital headroom — Board notification",
    description: "Headroom below R50,000,000 (ZAR cents) trips red / Board notification.",
    owningRole: "Chief Risk Officer",
    citation: "D-RAS",
  },

  // ── Leverage-ratio appetite bands (RAS) — CRO ─────────────────────────────
  {
    key: "leverage.threshold.green",
    value: 0.045,
    unit: "ratio",
    category: "leverage-threshold",
    label: "Leverage ratio — green floor",
    description: "Leverage ratio at or above 4.5% is green.",
    owningRole: "Chief Risk Officer",
    citation: "D-RAS",
  },
  {
    key: "leverage.threshold.amber",
    value: 0.04,
    unit: "ratio",
    category: "leverage-threshold",
    label: "Leverage ratio — amber floor",
    description: "Leverage ratio at or above 4.0% (below 4.5%) is amber.",
    owningRole: "Chief Risk Officer",
    citation: "D-RAS",
  },
  {
    key: "leverage.threshold.red",
    value: 0.035,
    unit: "ratio",
    category: "leverage-threshold",
    label: "Leverage ratio — red floor",
    description: "Leverage ratio below 3.5% is critical / red.",
    owningRole: "Chief Risk Officer",
    citation: "D-RAS",
  },

  // ── Per-instrument-class market-RWA weights (CRE20) — CRO ──────────────────
  // Flat instrument-class → market-risk weight table read by the per-product
  // marginal-RWA estimator (markets/products/rwa-delta.ts). Migrated out of
  // capital-funding-stub.json so the weights are owned + cited, not buried.
  {
    key: "rwa.instrument-weight.OTC-IRD",
    value: 0.5,
    unit: "ratio",
    category: "rwa-instrument-weight",
    label: "RWA weight — OTC interest-rate derivative",
    description: "Market-RWA weight for OTC interest-rate derivative positions.",
    owningRole: "Chief Risk Officer",
    citation: "Reg38-CRE20",
  },
  {
    key: "rwa.instrument-weight.FX-spot",
    value: 0.2,
    unit: "ratio",
    category: "rwa-instrument-weight",
    label: "RWA weight — FX spot",
    description: "Market-RWA weight for FX spot positions.",
    owningRole: "Chief Risk Officer",
    citation: "Reg38-CRE20",
  },
  {
    key: "rwa.instrument-weight.FX-forward",
    value: 0.2,
    unit: "ratio",
    category: "rwa-instrument-weight",
    label: "RWA weight — FX forward",
    description: "Market-RWA weight for FX forward positions.",
    owningRole: "Chief Risk Officer",
    citation: "Reg38-CRE20",
  },
  {
    key: "rwa.instrument-weight.JSE-EQUITY",
    value: 0.35,
    unit: "ratio",
    category: "rwa-instrument-weight",
    label: "RWA weight — JSE-listed equity",
    description: "Market-RWA weight for JSE-listed equity positions.",
    owningRole: "Chief Risk Officer",
    citation: "Reg38-CRE20",
  },
  {
    key: "rwa.instrument-weight.ZA-GOV-BOND",
    value: 0.0,
    unit: "ratio",
    category: "rwa-instrument-weight",
    label: "RWA weight — ZA government bond",
    description: "Market-RWA weight for South African government bond positions (0% RW sovereign).",
    owningRole: "Chief Risk Officer",
    citation: "Reg38-CRE20",
  },

  // ── Product Control P&L-attribution tolerance — CFO ───────────────────────
  // The unexplained-residual tolerance for the day-over-day P&L Explain
  // (FRTB-PLA analogue). A residual within tolerance is acceptable rounding /
  // de-minimis noise; a breach raises a typed PnLAttributionExceptionRaised.
  // Two-part band: a ZAR 1.00 rounding floor (integer ZAR-minor arithmetic
  // accumulates ≤ cent-level dust across components) PLUS a bps-of-notional
  // band the engine adds on top of the floor (scales the floor with desk size).
  {
    key: "product-control.pnl-attribution.residual-floor-minor",
    value: 100,
    unit: "zar-minor",
    category: "product-control-tolerance",
    label: "P&L-attribution residual floor",
    description:
      "ZAR 1.00 (100 minor) rounding floor on the unexplained residual of the daily P&L Explain. " +
      "Below this the residual is de-minimis integer-arithmetic dust, not an attribution gap.",
    owningRole: "Chief Financial Officer",
    citation: "D-TRUSTED-FIGURES-PROGRAM-V1",
  },
  {
    key: "product-control.pnl-attribution.residual-band-bps",
    value: 0.5,
    unit: "percentage-points",
    category: "product-control-tolerance",
    label: "P&L-attribution residual band (bps of notional)",
    description:
      "0.5 basis points of the desk's gross live notional, added on top of the rounding floor to " +
      "scale the residual tolerance with desk size (FRTB-PLA materiality analogue).",
    owningRole: "Chief Financial Officer",
    citation: "FRTB-PLA",
  },
];

const BY_KEY: ReadonlyMap<string, FinancialConstant> = new Map(
  FINANCIAL_CONSTANTS.map((c) => [c.key, c]),
);

/**
 * Resolve an owned financial constant by key. Throws (loud failure — never a
 * silent default) when the key is absent, so a typo cannot silently calibrate
 * a regulatory figure to an unintended value.
 */
export function getFinancialConstant(key: string): number {
  const c = BY_KEY.get(key);
  if (c === undefined) {
    throw new Error(
      `financial-constants: unknown constant key "${key}" — every calibration constant must be declared in FINANCIAL_CONSTANTS`,
    );
  }
  return c.value;
}

/** All constants in a category. */
export function constantsInCategory(category: ConstantCategory): FinancialConstant[] {
  return FINANCIAL_CONSTANTS.filter((c) => c.category === category);
}

/**
 * Build a `Record<localKey, value>` from a category by stripping a key prefix.
 * The home for the rate-table literals that calc engines used to inline.
 */
function recordForCategory(category: ConstantCategory, prefix: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of FINANCIAL_CONSTANTS) {
    if (c.category === category) out[c.key.slice(prefix.length)] = c.value;
  }
  return out;
}

/** LCR funding-category → 30-day run-off rate. */
export function lcrRunoffRates(): Record<string, number> {
  return recordForCategory("lcr-runoff", "lcr.runoff.");
}

/** LCR HQLA tier (L1/L2a/L2b) → haircut. */
export function lcrHaircutRates(): Record<string, number> {
  return recordForCategory("lcr-haircut", "lcr.haircut.");
}

/** NSFR ASF category → available-stable-funding factor. */
export function nsfrAsfWeights(): Record<string, number> {
  return recordForCategory("nsfr-asf", "nsfr.asf.");
}

/** NSFR RSF category → required-stable-funding factor. */
export function nsfrRsfWeights(): Record<string, number> {
  return recordForCategory("nsfr-rsf", "nsfr.rsf.");
}

/** Instrument class (OTC-IRD / FX-spot / FX-forward / JSE-EQUITY / ZA-GOV-BOND) → market-RWA weight. */
export function rwaInstrumentClassWeights(): Record<string, number> {
  return recordForCategory("rwa-instrument-weight", "rwa.instrument-weight.");
}
