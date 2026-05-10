// platform/semantic/index.ts
//
// Public surface of the semantic-layer registry. Slice 1 of D-REPORTING-
// CAPABILITY-M2-M3-BUILD-PLAN. Downstream consumers (Slice 2 period-close
// events; Slice 3 BA 325 LCR generator harness; Slice 4+ M2/M3 generators)
// import from `@platform/semantic` and never reach into the sub-modules.
//
// Author: Anya (Data / analytics engineer, engineering — reports to Devon
//   COO; semantic-layer + projection-runtime curator)

export type {
  CitationCoverageRow,
  IfrsClassification,
  IfrsLineMapping,
  RegulatoryCellMapping,
  SemanticCitation,
  SemanticDimension,
  SemanticEntry,
  SemanticEntryId,
  SemanticEntryRef,
  SemanticEntryStatus,
  SemanticSigner,
  SemanticUnit,
} from "./types";

export { SemanticRegistry, SemanticRegistryError } from "./registry";

export { SLICE_1_ENTRIES, balance, cashAndBalancesAtSARB, exposure } from "./entries";

export {
  SLICE_3_LIQUIDITY_ENTRIES,
  hqlaLevel1,
  hqlaLevel2A,
  hqlaLevel2B,
  lcrCashOutflows30D,
  lcrCashInflows30D,
  liquidityCoverageRatio,
} from "./liquidity-entries";

export {
  SLICE_4_CAPITAL_ENTRIES,
  commonEquityTier1Capital,
  additionalTier1Capital,
  tier2Capital,
  regulatoryCapitalDeductions,
  riskWeightedAssets,
  commonEquityTier1Ratio,
  tier1CapitalRatio,
  totalCapitalRatio,
} from "./capital-entries";

export {
  SLICE_3_RWA_ENTRIES,
  creditRwa,
  marketRwa,
  operationalRwa,
  riskWeight,
  totalRwa,
} from "./risk-weight-entries";

export {
  SLICE_5_MARKET_RISK_ENTRIES,
  interestRateGeneralRisk,
  interestRateSpecificRisk,
  equityPositionRisk,
  foreignExchangeRisk,
  commodityRisk,
  marketRiskRwa,
} from "./market-risk-entries";

export {
  SLICE_5_OP_RISK_ENTRIES,
  grossIncomeBusinessLine,
  opRiskCapitalBia,
  opRiskCapitalTsa,
  opRiskRwa,
} from "./op-risk-entries";

export {
  SLICE_6_IFRS_ENTRIES,
  netCashFromFinancing,
  netCashFromInvesting,
  netCashFromOperating,
  otherComprehensiveIncome,
  profitOrLoss,
  totalAssets,
  totalComprehensiveIncome,
  totalEquity,
  totalLiabilities,
} from "./ifrs-classification-entries";
