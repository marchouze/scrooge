// platform/markets/products/dcam-mapping.ts
//
// DCAM taxonomy integration — ProductFamily → three-layer classification.
//
// Completes the deferred work from PR #377 (DCAM foundation). Maps every
// ProductFamily value to:
//   - DCAM scope code (bridges to PHYSICAL_PRODUCT_SCOPE in layer3-physical.ts)
//   - DCAM Layer 1 (FIBO conceptual anchor)
//   - DCAM Layer 2 (CDM/ESMA-CFI/BCBS logical standard)
//   - DCAM Layer 3 (ISO 20022 message types + bank code)
//
// Every ProductFamily must have an entry. The `dcam:validate` recon
// (platform/recon/dcam-taxonomy-coverage.ts) asserts this invariant at CI.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07).
// Enables: M2/M3 data-quality reporting — every event classified by DCAM domain.
// Principle 2 (single-graph discipline): every product code has a citable
// DCAM classification node in the regulatory knowledge graph (CLASSIFIES edges
// seeded in platform/regulatory/graph/seed-projection.ts).
//
// Author: Kai (Quantitative Markets Architect, engineering)

import type { ProductFamily } from "./types";
import { getProductDcamAlignment } from "../../taxonomies";
import type { DcamAlignment } from "../../taxonomies";

// ---------------------------------------------------------------------------
// ProductFamily → DCAM product scope code bridge
//
// The ProductFamily values (fine-grained product kinds) map to the
// PHYSICAL_PRODUCT_SCOPE codes (broader DCAM data-domain categories).
// This is the canonical bridge that allows the three-layer assembly
// functions to work for ProductFamily inputs.
// ---------------------------------------------------------------------------

export type DcamScopeCode =
  | "equity-securities"
  | "debt-securities"
  | "money-market-instruments"
  | "interest-rate-derivatives"
  | "fx-instruments"
  | "securities-financing"
  | "multi-asset";

/**
 * Maps every ProductFamily to its DCAM product scope code.
 *
 * Design notes:
 * - `listed-equity` → equity-securities: JSE listed ordinary shares + ETFs.
 *   Data domain: equity reference data, corporate-action events, settlement records.
 * - `listed-bond` → debt-securities: SAGBs, SOE bonds, corporate bonds.
 *   Data domain: fixed-income reference data, coupon schedules, bond pricing.
 * - `repo` → securities-financing: open + term repos under GMRA.
 *   Data domain: repo-rate events, collateral schedules, haircut data.
 * - `otc-ird` → interest-rate-derivatives: IRS, basis swaps, FRAs, swaptions.
 *   Data domain: yield-curve data, reset events, NPV/PFE vectors.
 * - `fx` → fx-instruments: FX spot, forward, swap, NDF.
 *   Data domain: FX rate quotes, FinSurv trade reports, PvP settlement records.
 * - `structured` → multi-asset: reserved; no FIBO anchor at this phase.
 *   Data domain: cross-product; NPA gate deferred to commencement-of-trading.
 */
export const PRODUCT_FAMILY_TO_SCOPE_CODE: Record<ProductFamily, DcamScopeCode> = {
  "listed-equity": "equity-securities",
  "listed-bond": "debt-securities",
  repo: "securities-financing",
  "otc-ird": "interest-rate-derivatives",
  fx: "fx-instruments",
  structured: "multi-asset",
};

// ---------------------------------------------------------------------------
// Per-family Layer 3 DCAM data-attribute groups
//
// Layer 3 in the EDM Council DCAM sense: the specific data attribute groups
// (data concepts) that flow through each product family's lifecycle events.
// These supplement the ISO 20022 message type mappings in layer3-physical.ts
// with the bank's own data-domain concepts.
// ---------------------------------------------------------------------------

export interface ProductFamilyDcamLayer3 {
  /** DCAM Layer 3 data concept / attribute group identifiers for this family. */
  readonly dataAttributeGroups: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly description: string;
    /** Lifecycle event types that carry this attribute group. */
    readonly carriedByEvents: ReadonlyArray<string>;
  }>;
}

export const PRODUCT_FAMILY_LAYER3: Record<ProductFamily, ProductFamilyDcamLayer3> = {
  "listed-equity": {
    dataAttributeGroups: [
      {
        id: "DAG-EQ-INSTRUMENT",
        label: "Equity Instrument Reference",
        description:
          "ISIN, JSE listed-share class, ticker, currency, issuer LEI, listing date. " +
          "FIBO anchor: SEC:ListedShare. CDM: cdm.base.staticdata.asset.common.EquityTypeEnum.EQUITY.",
        carriedByEvents: ["EquityTradeBooked"],
      },
      {
        id: "DAG-EQ-TRADE-ECON",
        label: "Equity Trade Economics",
        description:
          "Quantity (shares), execution price (ZAR), consideration, commission, JSE levy, STT. " +
          "ISO 20022 sese.023 payload. T+3 settlement calendar (JIHCAL).",
        carriedByEvents: ["EquityTradeBooked", "EquitySettlementInstructed"],
      },
      {
        id: "DAG-EQ-CORPORATE-ACTION",
        label: "Equity Corporate Action",
        description:
          "Corporate-action type (dividend, rights, stock-split), ex-date, record-date, " +
          "entitlement amount. ISO 20022 seev.036.",
        carriedByEvents: ["EquityCorporateActionApplied"],
      },
      {
        id: "DAG-EQ-SETTLEMENT",
        label: "Equity Settlement Record",
        description:
          "Strate CSD settlement reference, settlement status, custodian, securities account. " +
          "ISO 20022 sese.023 settlement confirmation.",
        carriedByEvents: ["EquitySettlementInstructed"],
      },
    ],
  },

  "listed-bond": {
    dataAttributeGroups: [
      {
        id: "DAG-BOND-INSTRUMENT",
        label: "Bond Instrument Reference",
        description:
          "ISIN, SAGB bond code (R-series), issuer LEI, coupon rate, day-count (ACT/365 SA), " +
          "maturity date, face value. FIBO anchor: SEC:Bond. CDM: cdm.base.staticdata.asset.common.DebtClassEnum.BOND.",
        carriedByEvents: ["BondTradeBooked"],
      },
      {
        id: "DAG-BOND-TRADE-ECON",
        label: "Bond Trade Economics",
        description:
          "Consideration (clean + accrued interest), settlement amount, yield, duration, " +
          "DV01. ISO 20022 sese.023. T+3 Strate-bond settlement.",
        carriedByEvents: ["BondTradeBooked", "BondSettlementInstructed"],
      },
      {
        id: "DAG-BOND-COUPON",
        label: "Bond Coupon Schedule",
        description:
          "Semi-annual coupon dates, coupon amount per face value, ex-coupon date. " +
          "ACT/365 SA day-count. BA325 regulatory reporting feed.",
        carriedByEvents: ["BondCouponPaid"],
      },
      {
        id: "DAG-BOND-REDEMPTION",
        label: "Bond Redemption",
        description:
          "Maturity date, redemption amount (par), final accrued interest. " +
          "Strate-bond final settlement instruction.",
        carriedByEvents: ["BondRedeemed", "BondSettlementInstructed"],
      },
    ],
  },

  repo: {
    dataAttributeGroups: [
      {
        id: "DAG-REPO-LEGS",
        label: "Repo Leg Economics",
        description:
          "Start leg (sale price, settlement date), end leg (repurchase price, maturity date), " +
          "repo rate, term. GMRA 2011 election fields. FIBO anchor: SEC:RepurchaseAgreement. " +
          "CDM: cdm.product.repo.RepurchaseAgreement. ISO 20022 sese.023 for both legs.",
        carriedByEvents: ["RepoTradeBooked", "RepoStartLegSettled", "RepoEndLegSettled"],
      },
      {
        id: "DAG-REPO-COLLATERAL",
        label: "Repo Collateral Schedule",
        description:
          "Collateral ISIN, market value, haircut %, margin call threshold, substitution rights. " +
          "SFTR reporting fields (auth.001). Eligible collateral: SAGBs and JSE-listed equities.",
        carriedByEvents: ["RepoTradeBooked", "RepoMarginCallIssued"],
      },
      {
        id: "DAG-REPO-MARGIN",
        label: "Repo Margin / Variation",
        description:
          "Daily mark-to-market of collateral, variation margin calls, cash or securities " +
          "margin transfers. BA100 regulatory capital feed.",
        carriedByEvents: ["RepoMarginCallIssued"],
      },
    ],
  },

  "otc-ird": {
    dataAttributeGroups: [
      {
        id: "DAG-IRD-TRADE",
        label: "OTC IRD Trade Economics",
        description:
          "Fixed/float legs, notional, currency (ZAR), start date, maturity, reset frequency, " +
          "day-count (ACT/365 or 30/360), spread. FIBO anchor: DER:InterestRateDerivative. " +
          "CDM: cdm.product.asset.InterestRatePayout. ISDA 2002 election fields.",
        carriedByEvents: ["OtcIrdTradeBooked"],
      },
      {
        id: "DAG-IRD-RESET",
        label: "IRD Rate Reset",
        description:
          "Reference rate (JIBAR, SOFR where applicable), fixing date, reset amount, " +
          "payment date, accrual period. ISO 20022 auth.001 (EMIR) reporting trigger.",
        carriedByEvents: ["OtcIrdRateReset", "OtcIrdCouponPaid"],
      },
      {
        id: "DAG-IRD-VALUATION",
        label: "IRD Mark-to-Market / NPV",
        description:
          "Daily NPV (ZAR), DV01, PV01, sensitivity vectors per tenor bucket. " +
          "FRTB SBA input (BCBS d352). BA350 market-risk return feed.",
        carriedByEvents: ["OtcIrdMarkToMarket"],
      },
      {
        id: "DAG-IRD-CSA",
        label: "IRD Collateral / CSA",
        description:
          "IM/VM thresholds, MTA, eligible collateral, margin call frequency. " +
          "ISDA CSA (2016 VM Credit Support Annex). BA300 counterparty-credit feed.",
        carriedByEvents: ["OtcIrdMarginCallIssued"],
      },
      {
        id: "DAG-IRD-TRADE-REPORT",
        label: "IRD Regulatory Trade Report",
        description:
          "EMIR UTI, counterparty LEIs, product classification (ESMA-CFI: SR), " +
          "notional, valuation, collateral. DTCC/SAFE trade repository. auth.001.",
        carriedByEvents: ["TradeReportSubmitted"],
      },
    ],
  },

  fx: {
    dataAttributeGroups: [
      {
        id: "DAG-FX-TRADE",
        label: "FX Trade Economics",
        description:
          "Currency pair (ZAR/USD), spot rate (SARB fixing / Reuters), buy/sell notionals, " +
          "settlement date (T+2, ZA+US calendar). FIBO anchor: FBC:ForeignExchange. " +
          "CDM: cdm.product.asset.FxSingle. ISO 20022 fxtr.014.",
        carriedByEvents: ["FxTradeExecuted"],
      },
      {
        id: "DAG-FX-SETTLEMENT",
        label: "FX Settlement Record",
        description:
          "PvP settlement reference (correspondent bank), SWIFT MT202 / pacs.009 reference, " +
          "value date, correspondent confirmation. D-FX-CLS-MEMBERSHIP settlement path.",
        carriedByEvents: ["FxSettlementInstructed", "SettlementConfirmed"],
      },
      {
        id: "DAG-FX-FINSURV",
        label: "FX FinSurv Regulatory Report",
        description:
          "FinSurv category (ORG-EXCON-ODP-001), AD-status reference, ZAR flow amount, " +
          "counterparty type, purpose code. SARB Exchange Control Regulations reporting. " +
          "BA700 RWA-FX feed.",
        carriedByEvents: ["TradeReportSubmitted"],
      },
      {
        id: "DAG-FX-RATE",
        label: "FX Rate Observable",
        description:
          "SARB ZAR Fixing Rate (ORG-MK-08), Reuters spot rate, bid/ask spread, " +
          "intraday rate snapshots. Level-1 fair value (IFRS 13). BA350 FX open-position feed.",
        carriedByEvents: ["FxTradeExecuted", "FxSettlementInstructed"],
      },
    ],
  },

  structured: {
    dataAttributeGroups: [
      {
        id: "DAG-STRUCT-PLACEHOLDER",
        label: "Structured Product — Deferred",
        description:
          "Structured products are reserved (M5+, out of scope at v1). " +
          "DCAM Layer 3 attribute groups deferred to NPA gate at commencement-of-trading. " +
          "Scope code: multi-asset (no FIBO conceptual anchor at this phase).",
        carriedByEvents: [],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Assembly function — ProductFamily full DCAM three-layer record
// ---------------------------------------------------------------------------

export interface ProductFamilyDcamRecord {
  readonly family: ProductFamily;
  readonly scopeCode: DcamScopeCode;
  /** Full three-layer DCAM alignment (undefined only for 'structured'/'multi-asset'). */
  readonly dcamAlignment: DcamAlignment | undefined;
  /** Layer 3 data attribute groups for this product family. */
  readonly layer3: ProductFamilyDcamLayer3;
}

/**
 * Assemble the complete DCAM three-layer record for a ProductFamily.
 *
 * Traversal:
 *   ProductFamily → PRODUCT_FAMILY_TO_SCOPE_CODE → DcamScopeCode
 *   DcamScopeCode → PHYSICAL_PRODUCT_SCOPE → Layer 1 conceptKey
 *   Layer 1 conceptKey → CONCEPTUAL_REGISTRY (FIBO anchor)
 *   Layer 1 conceptKey → LOGICAL_MAPPINGS (CDM/ESMA-CFI/BCBS)
 *   DcamScopeCode → PHYSICAL_PRODUCT_SCOPE → iso20022 (ISO 20022)
 *   ProductFamily → PRODUCT_FAMILY_LAYER3 (bank-specific attribute groups)
 */
export function getProductFamilyDcamRecord(family: ProductFamily): ProductFamilyDcamRecord {
  const scopeCode = PRODUCT_FAMILY_TO_SCOPE_CODE[family];
  const dcamAlignment = getProductDcamAlignment(scopeCode);
  const layer3 = PRODUCT_FAMILY_LAYER3[family];

  return {
    family,
    scopeCode,
    dcamAlignment,
    layer3,
  };
}

/**
 * Returns the complete DCAM mapping for all ProductFamily values.
 * Used by the dcam:validate recon and the graph seeder.
 */
export function getAllProductFamilyDcamRecords(): ReadonlyArray<ProductFamilyDcamRecord> {
  const families: ProductFamily[] = [
    "listed-equity",
    "listed-bond",
    "repo",
    "otc-ird",
    "fx",
    "structured",
  ];
  return families.map(getProductFamilyDcamRecord);
}
