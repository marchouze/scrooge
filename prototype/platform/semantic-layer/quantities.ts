// platform/semantic-layer/quantities.ts
//
// Semantic-layer quantity registry — 20 core bank quantities used by
// analytics, reporting, and risk systems.
//
// Each quantity carries its canonical definition, formula, regulatory source,
// and data lineage. This is the single authoritative lookup for what a named
// metric IS and WHERE it comes from. Downstream consumers (SARB BA returns,
// ALCO pack, risk dashboards, P&L attribution) cite by quantity code.
//
// Design:
//   - `QuantityDefinition` is a lighter schema than `SemanticEntry` (the full
//     append-only-versioned entry in `platform/semantic/`). This module exists
//     for the analytics layer to enumerate quantities by domain, report
//     frequency, or owner without needing the full citation + projection
//     machinery.
//   - Every quantity maps to at least one `SemanticEntry` (or will when the
//     corresponding slice lands) and at least one BA-return cell (where
//     applicable). Cross-references are prose-only here; the `SemanticEntry`
//     is the authoritative citation chain (Principle 2).
//
// Authority: Anya (Data / analytics engineer, engineering — reports to Devon
//   COO; semantic-layer + projection-runtime curator).
// Principles: P1 (events are truth), P2 (single-graph discipline).
//
// Author: Anya (Data / analytics engineer, engineering)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Machine-readable domain tag. */
export type QuantityDomain =
  | "capital"
  | "liquidity"
  | "credit"
  | "market-risk"
  | "pnl"
  | "treasury";

/** The unit a quantity is expressed in. */
export type QuantityUnit =
  /** Dimensionless ratio (0..N). Render layer multiplies by 100 for % display. */
  | "ratio"
  /** Basis points (1/100 of 1%). */
  | "bps"
  /** South African Rand (minor units, i.e. cents). */
  | "zar"
  /** Percentage already expressed as 0..100. */
  | "pct"
  /** Number of calendar days. */
  | "days";

/** Reporting frequency for scheduled production of this quantity. */
export type ReportingFrequency = "daily" | "monthly" | "quarterly";

/**
 * A single registered quantity definition.
 *
 * Field semantics:
 *   code              — machine-readable key; matches TYPED_QUANTITY_CODES.
 *   name              — human-readable display name.
 *   domain            — which desk / function owns the quantity.
 *   unit              — unit the value is expressed in.
 *   formula           — human-readable derivation formula (not executable here;
 *                       the executable form lives in the projection layer).
 *   regulatorySource  — governing regulation, statute or standard.
 *   sarbReturnCell    — the BA-return form + cell label where this quantity
 *                       appears (omitted for internal metrics with no direct
 *                       regulatory cell).
 *   dataLineage       — event types or system capabilities the quantity is
 *                       derived from. These are documentation anchors; the
 *                       full lineage graph lives in `platform/semantic/`.
 *   reportingFrequency — how often the quantity is scheduled for production.
 *   owner             — the agent (name + position) responsible for producing
 *                       this quantity at each scheduled tick.
 */
export interface QuantityDefinition {
  readonly code: string;
  readonly name: string;
  readonly domain: QuantityDomain;
  readonly unit: QuantityUnit;
  readonly formula: string;
  readonly regulatorySource: string;
  readonly sarbReturnCell?: string;
  readonly dataLineage: readonly string[];
  readonly reportingFrequency: ReportingFrequency;
  readonly owner: string;
}

// ---------------------------------------------------------------------------
// Registry entries
// ---------------------------------------------------------------------------

/** All 20 core quantity definitions. */
export const QUANTITY_REGISTRY: readonly QuantityDefinition[] = [
  // -------------------------------------------------------------------------
  // Capital (Basel III / Banks Act Reg 23)
  // -------------------------------------------------------------------------

  {
    code: "CET1_RATIO",
    name: "Common Equity Tier 1 Ratio",
    domain: "capital",
    unit: "ratio",
    formula: "CommonEquityTier1Capital / RiskWeightedAssets",
    regulatorySource:
      "Basel III / Banks Act 94 of 1990 §70 / Regulations Relating to Banks Reg 23 + Reg 38(2)",
    sarbReturnCell: "BA 700 — CET1 ratio (%) exit cell",
    dataLineage: [
      "capital-stack projection",
      "BankAccountOpened",
      "TrialBalanceSnapshotted",
      "AccountingPeriodClosed",
    ],
    reportingFrequency: "monthly",
    owner: "Camille (Chief Financial Officer, governance)",
  },

  {
    code: "LEVERAGE_RATIO",
    name: "Leverage Ratio",
    domain: "capital",
    unit: "ratio",
    formula: "Tier1Capital / TotalExposureMeasure",
    regulatorySource:
      "Basel III / Banks Act 94 of 1990 §70 / Regulations Relating to Banks Reg 38(12) — minimum 3%",
    sarbReturnCell: "BA 700 — Leverage ratio (%) exit cell",
    dataLineage: [
      "capital-stack projection",
      "BankAccountOpened",
      "TrialBalanceSnapshotted",
    ],
    reportingFrequency: "monthly",
    owner: "Camille (Chief Financial Officer, governance)",
  },

  {
    code: "RWA_TOTAL",
    name: "Total Risk-Weighted Assets",
    domain: "capital",
    unit: "zar",
    formula: "sum(CreditRwa) + sum(MarketRwa) + sum(OperationalRwa)",
    regulatorySource:
      "Basel III / BCBS credit-risk framework + FRTB + SMA / Regulations Relating to Banks Reg 38",
    sarbReturnCell: "BA 700 — Total Risk-Weighted Assets",
    dataLineage: [
      "rwa projection",
      "OrderApprovedAtGateway",
      "TradeBooked",
      "TrialBalanceSnapshotted",
    ],
    reportingFrequency: "monthly",
    owner: "Helena (Chief Risk Officer, governance)",
  },

  {
    code: "CAPITAL_ADEQUACY",
    name: "Capital Adequacy Ratio (CAR)",
    domain: "capital",
    unit: "ratio",
    formula: "(CommonEquityTier1Capital + AdditionalTier1Capital + Tier2Capital) / RiskWeightedAssets",
    regulatorySource:
      "Banks Act 94 of 1990 §70 / Regulations Relating to Banks Reg 38(2) — Total capital ≥ 8%",
    sarbReturnCell: "BA 700 — Total capital ratio (%) exit cell",
    dataLineage: [
      "capital-stack projection",
      "BankAccountOpened",
      "TrialBalanceSnapshotted",
    ],
    reportingFrequency: "monthly",
    owner: "Camille (Chief Financial Officer, governance)",
  },

  // -------------------------------------------------------------------------
  // Liquidity (Basel III / Reg 26)
  // -------------------------------------------------------------------------

  {
    code: "LCR",
    name: "Liquidity Coverage Ratio",
    domain: "liquidity",
    unit: "ratio",
    formula:
      "HqlaStock / max(LcrCashOutflows30D - min(LcrCashInflows30D, 0.75*LcrCashOutflows30D), 0.25*LcrCashOutflows30D)",
    regulatorySource:
      "Basel III (BCBS D295) / Banks Act 94 of 1990 §70 / Regulations Relating to Banks Reg 26(2) — LCR ≥ 100%",
    sarbReturnCell: "BA 325 — Liquidity Coverage Ratio (%) exit cell",
    dataLineage: [
      "liquidity-projection",
      "BankAccountOpened",
      "TrialBalanceSnapshotted",
    ],
    reportingFrequency: "monthly",
    owner: "Eitan (Treasurer, governance)",
  },

  {
    code: "NSFR",
    name: "Net Stable Funding Ratio",
    domain: "liquidity",
    unit: "ratio",
    formula: "AvailableStableFunding / RequiredStableFunding",
    regulatorySource:
      "Basel III (BCBS d295-nsfr) / Regulations Relating to Banks Reg 26A — NSFR ≥ 100%",
    sarbReturnCell: "BA 326 — Net Stable Funding Ratio (%) exit cell",
    dataLineage: [
      "liquidity-projection",
      "BankAccountOpened",
      "TrialBalanceSnapshotted",
    ],
    reportingFrequency: "monthly",
    owner: "Eitan (Treasurer, governance)",
  },

  {
    code: "HQLA",
    name: "High Quality Liquid Assets",
    domain: "liquidity",
    unit: "zar",
    formula:
      "HqlaLevel1 + min(HqlaLevel2A*0.85, 0.40*totalHqla) + min(HqlaLevel2B*assetFactor, 0.15*totalHqla)",
    regulatorySource:
      "BCBS D295 §47–§55 / Regulations Relating to Banks Reg 26(7) — HQLA composition and haircuts",
    sarbReturnCell: "BA 325 — HQLA stock (LCR numerator)",
    dataLineage: [
      "liquidity-projection",
      "BankAccountOpened",
      "TrialBalanceSnapshotted",
    ],
    reportingFrequency: "daily",
    owner: "Eitan (Treasurer, governance)",
  },

  {
    code: "OUTFLOW_30D",
    name: "Total Net Cash Outflows (30-day)",
    domain: "liquidity",
    unit: "zar",
    formula:
      "max(LcrCashOutflows30D - min(LcrCashInflows30D, 0.75*LcrCashOutflows30D), 0.25*LcrCashOutflows30D)",
    regulatorySource:
      "BCBS D295 §69–§142 / Regulations Relating to Banks Reg 26(8)+(11) — outflow run-off rates + 75% inflow cap",
    sarbReturnCell: "BA 325 — Total net cash outflows (LCR denominator)",
    dataLineage: [
      "liquidity-projection",
      "BankAccountOpened",
      "TrialBalanceSnapshotted",
    ],
    reportingFrequency: "daily",
    owner: "Eitan (Treasurer, governance)",
  },

  // -------------------------------------------------------------------------
  // Credit / IFRS 9
  // -------------------------------------------------------------------------

  {
    code: "ECL_STAGE1",
    name: "Expected Credit Loss — Stage 1",
    domain: "credit",
    unit: "zar",
    formula:
      "sum(EAD * PD_12M * LGD) for all exposures in Stage 1 (no significant increase in credit risk since origination)",
    regulatorySource: "IFRS 9 §5.5.5 — 12-month ECL for Stage 1 performing exposures",
    dataLineage: [
      "ecl-projection",
      "TradeBooked",
      "TrialBalanceSnapshotted",
      "AccountingPeriodClosed",
    ],
    reportingFrequency: "monthly",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
  },

  {
    code: "ECL_STAGE2",
    name: "Expected Credit Loss — Stage 2",
    domain: "credit",
    unit: "zar",
    formula:
      "sum(EAD_t * PD_lifetime_t * LGD_t discounted at EIR) for all exposures in Stage 2 (significant increase in credit risk)",
    regulatorySource:
      "IFRS 9 §5.5.3 — lifetime ECL for Stage 2 exposures with significant increase in credit risk",
    dataLineage: [
      "ecl-projection",
      "TradeBooked",
      "TrialBalanceSnapshotted",
      "AccountingPeriodClosed",
    ],
    reportingFrequency: "monthly",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
  },

  {
    code: "ECL_STAGE3",
    name: "Expected Credit Loss — Stage 3",
    domain: "credit",
    unit: "zar",
    formula:
      "sum(EAD_t * LGD_t discounted at EIR) for credit-impaired exposures (objective evidence of impairment)",
    regulatorySource: "IFRS 9 §5.5.3 + §B5.5.37 — lifetime ECL for credit-impaired (Stage 3) exposures",
    dataLineage: [
      "ecl-projection",
      "TradeBooked",
      "TrialBalanceSnapshotted",
      "AccountingPeriodClosed",
    ],
    reportingFrequency: "monthly",
    owner: "Bea (Accounting & financial reporting engineer, engineering)",
  },

  // -------------------------------------------------------------------------
  // P&L
  // -------------------------------------------------------------------------

  {
    code: "NII",
    name: "Net Interest Income",
    domain: "pnl",
    unit: "zar",
    formula: "InterestAndSimilarIncome - InterestAndSimilarExpense",
    regulatorySource:
      "IFRS 9 §5.4 (effective interest method) / IAS 1 §82(a) — income-statement line",
    dataLineage: [
      "income-projection",
      "TrialBalanceSnapshotted",
      "AccountingPeriodClosed",
      "TradeBooked",
    ],
    reportingFrequency: "monthly",
    owner: "Camille (Chief Financial Officer, governance)",
  },

  {
    code: "NIM",
    name: "Net Interest Margin",
    domain: "pnl",
    unit: "ratio",
    formula: "NetInterestIncome / AverageInterestEarningAssets",
    regulatorySource: "IFRS 9 / IAS 1 — management metric derived from income statement",
    dataLineage: [
      "income-projection",
      "TrialBalanceSnapshotted",
      "AccountingPeriodClosed",
    ],
    reportingFrequency: "monthly",
    owner: "Camille (Chief Financial Officer, governance)",
  },

  // -------------------------------------------------------------------------
  // Market Risk (Basel III)
  // -------------------------------------------------------------------------

  {
    code: "VAR_99_1D",
    name: "Value at Risk (99%, 1-day)",
    domain: "market-risk",
    unit: "zar",
    formula:
      "quantile(PnLDistribution, 0.99) over 1 trading day holding period; historical simulation or parametric",
    regulatorySource:
      "Basel III FRTB / Regulations Relating to Banks Reg 38 — internal models approach IMA",
    sarbReturnCell: "BA 350 — VaR (99%, 1-day)",
    dataLineage: [
      "market-risk-projection",
      "OrderApprovedAtGateway",
      "BacktestRun",
      "MarkToMarketObserved",
    ],
    reportingFrequency: "daily",
    owner: "Helena (Chief Risk Officer, governance)",
  },

  {
    code: "SVAR",
    name: "Stressed Value at Risk",
    domain: "market-risk",
    unit: "zar",
    formula:
      "quantile(PnLDistribution, 0.99) over 1-day holding period using 12-month stressed market data window",
    regulatorySource:
      "Basel 2.5 / BCBS 158 / Regulations Relating to Banks Reg 38 — stressed VaR capital charge",
    sarbReturnCell: "BA 350 — Stressed VaR",
    dataLineage: [
      "market-risk-projection",
      "BacktestRun",
      "MarkToMarketObserved",
    ],
    reportingFrequency: "daily",
    owner: "Helena (Chief Risk Officer, governance)",
  },

  {
    code: "DV01",
    name: "Dollar Value of 1bp (IR sensitivity)",
    domain: "market-risk",
    unit: "zar",
    formula:
      "sum(position.dv01) = sum(-(dPrice/dYield) * notional * 0.0001) across all interest-rate positions",
    regulatorySource:
      "BCBS FRTB SA §330 — sensitivity-based method; SARB BA 350 interest-rate risk",
    sarbReturnCell: "BA 350 — DV01 sensitivity",
    dataLineage: [
      "market-risk-projection",
      "OrderApprovedAtGateway",
      "MarkToMarketObserved",
    ],
    reportingFrequency: "daily",
    owner: "Helena (Chief Risk Officer, governance)",
  },

  {
    code: "CS01",
    name: "Credit Spread 01 (credit sensitivity)",
    domain: "market-risk",
    unit: "zar",
    formula:
      "sum(position.cs01) = sum(-(dPrice/dCreditSpread) * notional * 0.0001) across all credit positions",
    regulatorySource:
      "BCBS FRTB SA §330 — sensitivity-based method, CSR non-securitisation bucket",
    sarbReturnCell: "BA 350 — CS01 credit spread sensitivity",
    dataLineage: [
      "market-risk-projection",
      "OrderApprovedAtGateway",
      "MarkToMarketObserved",
    ],
    reportingFrequency: "daily",
    owner: "Helena (Chief Risk Officer, governance)",
  },

  {
    code: "DURATION_MOD",
    name: "Modified Duration",
    domain: "market-risk",
    unit: "ratio",
    formula:
      "MacaulayDuration / (1 + yield/n) = -1/P * dP/dy; portfolio-weighted average across fixed-income holdings",
    regulatorySource:
      "BCBS FRTB / ALCO interest-rate risk in the banking book (IRRBB) — duration gap analysis",
    dataLineage: [
      "market-risk-projection",
      "OrderApprovedAtGateway",
      "MarkToMarketObserved",
    ],
    reportingFrequency: "daily",
    owner: "Helena (Chief Risk Officer, governance)",
  },

  // -------------------------------------------------------------------------
  // Treasury / ALM
  // -------------------------------------------------------------------------

  {
    code: "FTP_RATE",
    name: "Funds Transfer Pricing Rate",
    domain: "treasury",
    unit: "bps",
    formula:
      "BaseRate (JIBAR / ZARONIA) + LiquidityPremium + CreditSpread + OptionadjSpread for each instrument tenor bucket",
    regulatorySource:
      "Internal ALM Policy / Basel III IRRBB supervisory guidelines (BCBS 368) — internal rate used to price liquidity cost/benefit",
    dataLineage: [
      "alm-projection",
      "TrialBalanceSnapshotted",
      "BankAccountOpened",
    ],
    reportingFrequency: "daily",
    owner: "Eitan (Treasurer, governance)",
  },

  {
    code: "ALCO_NII_AT_RISK",
    name: "NII at Risk (ALCO metric)",
    domain: "treasury",
    unit: "zar",
    formula:
      "NII_BaseScenario - NII_StressScenario; stress = parallel rate shock of ±200bp applied to repricing cash flows over 12-month horizon",
    regulatorySource:
      "Basel III IRRBB (BCBS 368 §§40–72) / Regulations Relating to Banks Reg 28 — interest-rate risk in the banking book (IRRBB)",
    dataLineage: [
      "alm-projection",
      "TrialBalanceSnapshotted",
      "BankAccountOpened",
    ],
    reportingFrequency: "monthly",
    owner: "Eitan (Treasurer, governance)",
  },
] as const;

// ---------------------------------------------------------------------------
// Typed code union — derived from the registry so the type is always in sync
// ---------------------------------------------------------------------------

export const TYPED_QUANTITY_CODES = QUANTITY_REGISTRY.map((q) => q.code);

export type QuantityCode = (typeof QUANTITY_REGISTRY)[number]["code"];
