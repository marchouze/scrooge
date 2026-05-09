// platform/markets/products/fixtures.ts
//
// M1 (and forthcoming M2) realistic Product fixtures used by the type
// round-trip test (Slice 1) and by the composition runtime test
// (Slice 3). Realistic JSE equity-cash data; field values are coherent
// with `prototype/platform/markets/cdm/primitives.ts` + `cdm/equity.ts`.
//
// Authority: D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO approved 2026-05-10).
// Source brief §3.1 — M1 listed-equity worked example.
//
// Author: Atlas + Kai.

import type { Product } from "./types";

/**
 * M1 — JSE listed equity (cash). The first product the substrate
 * supports end-to-end. `productId` URN matches the source brief §3.1.
 */
export const M1_JSE_EQUITY_CASH_FIXTURE: Product = {
  productId: "prd:bank:equity:jse-equity-cash",
  family: "listed-equity",
  version: "1.0.0",
  name: "JSE Listed Equity (cash)",
  description:
    "Cash-settled JSE-listed equity. Trading + settlement covers JSE-listed ordinary shares including ETFs. Strate is the central securities depository; T+3 settlement convention; ZAR-denominated.",
  franchiseScope: "institutional",
  legalEntityId: "LE-BANK-SA",
  currency: "ZAR",
  jurisdiction: "ZA",
  cdmComposition: {
    primitives: [
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "instrumentSchema",
        role: "the listed equity instrument (class: listed-equity)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "identifierSchema",
        role: "ISIN identifier (JSE primary listing)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "cdmDateSchema",
        role: "trade date + settlement date (T+3, JIHCAL)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "priceSchema",
        role: "execution price per share (ZAR)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "quantitySchema",
        role: "quantity in shares",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "moneySchema",
        role: "consideration in ZAR (price × quantity, before fees)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "partySchema",
        role: "counterparty + custodian (Strate as CSD)",
      },
      {
        module: "@platform/markets/cdm/equity",
        symbol: "equitySettlementInstructedPayloadSchema",
        role: "Strate physical-settlement leg",
      },
    ],
    extensions: [
      {
        name: "JSE corporate-actions",
        module: "@platform/markets/cdm/equity",
        citationUrn: "JSE-RULES-EQUITIES",
      },
    ],
    compositionRule:
      "Asset(equity) + Identification(ISIN) + Schedule(T+3, JIHCAL) + Cashflow(consideration + commission) + Settlement(Strate, physical) + corporate-action extensions. Lifecycle: EquityTradeBooked -> EquityCorporateActionApplied -> EquitySettlementInstructed.",
  },
  lifecycleEventFamily: [
    "EquityTradeBooked",
    "EquityCorporateActionApplied",
    "EquitySettlementInstructed",
  ],
  riskProfile: {
    marketRiskDimensions: ["delta"],
    creditRiskShape: "principal-on-settlement",
    liquidityClassification: "non-hqla",
    fundingProfile: "cash-funded",
    modelRiskTier: "tier-2",
  },
  accountingClassification: {
    ifrs9Family: "fvtpl",
    ifrs13FairValueHierarchy: "level-1",
    ias21FxTreatment: "n/a",
    baReturnLineMapping: ["BA100.line.34", "BA200.line.18"],
  },
  legalDocumentation: {
    masterAgreement: "none-listed",
    ectaExecutionPath: "electronic-default",
    jurisdictionMatrix: ["ZA"],
  },
  operationalReadiness: {
    settlementPath: "Strate T+3",
    reconciliationCadence: "daily",
    substrateCompletenessGate: "M1-exit",
  },
  securityProfile: {
    threatModelRef: "ORG-CY-01",
    hsmCustodyRequired: false,
    zeroTrustPosture: "default",
  },
  policyAttestations: [],
  lifecycle: "conceptualised",
  citations: [
    "D-MARKETS-SCHEMA-FOUNDATION",
    "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
    "JSE-RULES-EQUITIES",
    "FMA-S5",
    "ORG-AC-01",
  ],
};

/**
 * M2 — vanilla fixed-coupon SAGB bond (design fixture; primitives that
 * land at M2 in `cdm/bond.ts` are referenced by name today). Used by
 * Slice 3's composition runtime to assert that a single canonical path
 * composes both M1 and M2 products deterministically (Q1 resolution).
 */
export const M2_SAGB_FIXED_COUPON_FIXTURE: Product = {
  productId: "prd:bank:bond:sagb-fixed-coupon",
  family: "listed-bond",
  version: "1.0.0",
  name: "SAGB fixed-coupon bond",
  description:
    "South African government bond, fixed coupon. Semi-annual coupon, ACT/365 day-count (SA convention), Strate-bond settlement. Tradeable across primary auction and secondary market; eligible for repo (M2 repo product references this asset).",
  franchiseScope: "institutional",
  legalEntityId: "LE-BANK-SA",
  currency: "ZAR",
  jurisdiction: "ZA",
  cdmComposition: {
    primitives: [
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "instrumentSchema",
        role: "the bond (class: listed-bond)",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "identifierSchema",
        role: "SAGB ISIN",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "cdmDateSchema",
        role: "coupon schedule (semi-annual) + maturity dates",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "priceSchema",
        role: "clean / dirty price",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "moneySchema",
        role: "consideration in ZAR",
      },
      {
        module: "@platform/markets/cdm/primitives",
        symbol: "quantitySchema",
        role: "face-value held (unit: bond-face)",
      },
      {
        // M2 deliverable in cdm/bond.ts. Composition runtime tolerates
        // forward references; the composeProduct() validator only
        // asserts the role + module path are well-formed.
        module: "@platform/markets/cdm/bond",
        symbol: "couponScheduleSchema",
        role: "coupon + redemption schedule (planned M2 in cdm/bond.ts)",
      },
      {
        module: "@platform/markets/cdm/bond",
        symbol: "fixedCashflowSchema",
        role: "fixed coupon + redemption cashflows (planned M2 in cdm/bond.ts)",
      },
    ],
    extensions: [
      {
        name: "ACT/365 SA day-count",
        module: "@platform/markets/cdm/bond",
        citationUrn: "[register: route to Mira — JSE-DEBT-LISTING-RULES day-count convention]",
      },
    ],
    compositionRule:
      "Asset(bond) + Identification(ISIN) + Schedule(coupon + maturity) + Cashflow(fixed-coupon + redemption) + Settlement(Strate-bond). Lifecycle: BondTradeBooked -> BondCouponPaid x N -> BondRedeemed -> BondSettlementInstructed.",
  },
  lifecycleEventFamily: [
    "BondTradeBooked",
    "BondCouponPaid",
    "BondRedeemed",
    "BondSettlementInstructed",
  ],
  riskProfile: {
    marketRiskDimensions: ["curve", "basis"],
    creditRiskShape: "principal-on-settlement",
    liquidityClassification: "hqla-eligible-l1",
    fundingProfile: "repo-funded",
    modelRiskTier: "tier-2",
  },
  accountingClassification: {
    ifrs9Family: "fvoci",
    ifrs13FairValueHierarchy: "level-2",
    ias21FxTreatment: "n/a",
    baReturnLineMapping: ["BA100.line.31", "BA325.line.10"],
  },
  legalDocumentation: {
    masterAgreement: "none-listed",
    ectaExecutionPath: "electronic-default",
    jurisdictionMatrix: ["ZA"],
  },
  operationalReadiness: {
    settlementPath: "Strate-bond T+3",
    reconciliationCadence: "daily",
    substrateCompletenessGate: "M2-exit",
  },
  securityProfile: {
    threatModelRef: "ORG-CY-01",
    hsmCustodyRequired: false,
    zeroTrustPosture: "default",
  },
  policyAttestations: [],
  lifecycle: "conceptualised",
  citations: [
    "D-MARKETS-SCHEMA-FOUNDATION",
    "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
    "[register: route to Mira — JSE-DEBT-LISTING-RULES]",
    "FMA-S5",
    "ORG-AC-01",
  ],
};
