// platform/reporting/index.ts
//
// Public surface of the reporting package — D-REPORTING-CAPABILITY-M2-M3-
// BUILD-PLAN Slice 3 + downstream slices.
//
// Slice 3 ships BA 110 (LCR) end-to-end as the proof-of-architecture for
// the BA-form generator pipeline. Slices 4-5 add BA 100 / BA 310 / BA 300,
// the regulator-portal handshake, and the SARB XML render. Slice 6+ adds
// IFRS AFS skeletons + capital-stack + RWA projections.
//
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; package owner).

export {
  type AccountLiquidityClassification,
  type Ba300LcrCashFlowSection,
  type Ba300LcrGeneratorInput,
  Ba300LcrGeneratorError,
  type Ba300LcrHqlaSection,
  type Ba300LcrLineItem,
  type Ba300LcrOpts,
  type Ba300LcrOutput,
  BA_300_LCR_BANK_ENTITIES,
  applyHqlaCaps,
  generateBa300Lcr,
  generateBa300LcrWithEvents,
  type HqlaLevel,
} from "./ba-300-lcr";

// D-FINANCIAL-INSTRUMENT-ENTITY Slice 9 — SecurityMaster HQLA override utility.
// Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).
export {
  type HqlaLevelOverride,
  buildHqlaOverridesFromSecurityMaster,
} from "./hqla-overrides";

export {
  type NsfrInputs,
  type NsfrProjection,
  type NsfrComponents,
  NsfrGeneratorError,
  generateNsfrProjection,
} from "./ba-300-nsfr";

export {
  Ba300LcrRenderSchema,
  type Ba300LcrRender,
  BA_300_LCR_SCHEMA_URL,
  BA_300_LCR_RENDERER_VERSION,
  canonicaliseBa300Lcr,
  renderBa300LcrCanonical,
  renderBa300LcrToJson,
  type RenderBa300LcrOptions,
} from "./ba-300-lcr-render";

// ---------------------------------------------------------------------------
// WS-FINANCE-BA-RETURNS-QUINTET — BA 600 (Balance Sheet) + BA 610 (Income
// Statement) + BA 610 detail (Selected Income-Statement Information) projections.
// Standing authority D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN extended
// 2026-05-17 by Marc's directive.
// ---------------------------------------------------------------------------

export {
  type Ba100BalanceSheet,
  type Ba100BalanceCheck,
  type Ba100ClassificationGap,
  type Ba100ClassificationMap,
  type Ba100GeneratorInput,
  Ba100GeneratorError,
  type Ba100LineClassification,
  type Ba100LineItem,
  type Ba100PerCurrencyTotal,
  type Ba100Section,
  type Ba600Section_Output,
  type Ba100SectorSplit,
  type Ba100LineSectorBreakdown,
  type Ba100SectorBreakdown,
  BA_600_BANK_ENTITIES,
  generateBa100BalanceSheet,
} from "./ba-100-balance-sheet";

export {
  Ba100RenderSchema,
  type Ba100Render,
  BA_600_SCHEMA_URL,
  BA_600_RENDERER_VERSION,
  canonicaliseBa600,
  renderBa600Canonical,
  renderBa600ToJson,
  type RenderBa600Options,
} from "./ba-100-render";

export {
  type Ba120ClassificationGap,
  type Ba120ClassificationMap,
  type Ba120GeneratorInput,
  Ba120GeneratorError,
  type Ba120IncomeStatement,
  type Ba120LineCategory,
  type Ba120LineCategorySection,
  type Ba120LineClassification,
  type Ba120LineItem,
  BA_610_BANK_ENTITIES,
  generateBa120IncomeStatement,
} from "./ba-120-income-statement";

export {
  Ba120RenderSchema,
  type Ba120Render,
  BA_610_SCHEMA_URL,
  BA_610_RENDERER_VERSION,
  canonicaliseBa120,
  renderBa610Canonical,
  renderBa120ToJson,
  type RenderBa120Options,
} from "./ba-120-render";

export {
  type Ba120DetailAlmBandingSection,
  type Ba120DetailBandingEntry,
  type Ba120DetailBandingMap,
  type Ba120DetailEfficiencySection,
  type Ba120DetailFtpRateBand,
  type Ba120DetailFtpRates,
  type Ba120DetailGeneratorInput,
  Ba120DetailGeneratorError,
  type Ba120DetailIncomeDetail,
  type Ba120DetailInstrumentClass,
  type Ba120DetailLineItem,
  type Ba120DetailMaturityBand,
  type Ba120DetailNiiBreakdown,
  type Ba120DetailNiiByBand,
  type Ba120DetailNiiByClass,
  type Ba120DetailNimSection,
  type Ba120DetailNonInterestSection,
  BA_610_DETAIL_BANK_ENTITIES,
  generateBa120DetailIncomeDetail,
} from "./ba-120-income-detail";

export {
  Ba120DetailRenderSchema,
  type Ba120DetailRender,
  BA_610_DETAIL_SCHEMA_URL,
  BA_610_DETAIL_RENDERER_VERSION,
  canonicaliseBa120Detail,
  renderBa120DetailCanonical,
  renderBa120DetailToJson,
  type RenderBa120DetailOptions,
} from "./ba-120-detail-render";

// ---------------------------------------------------------------------------
// Slice 4 — BA 100 Capital Adequacy Return
// ---------------------------------------------------------------------------

export {
  type AccountCapitalClassification,
  type Ba700CapitalStackSection,
  type Ba700CapitalTierSection,
  type Ba700GeneratorInput,
  Ba700GeneratorError,
  type Ba700LineItem,
  type Ba700Output,
  type Ba700RatiosSection,
  type Ba700RwaSection,
  type BufferRequirements,
  BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS,
  BA_100_BANK_ENTITIES,
  type CapitalTier,
  computeRequiredMinimums,
  generateBa700Capital,
  type RegulatoryDeduction,
  type RwaDecomposition,
} from "./ba-700-capital";

export {
  Ba700RenderSchema,
  type Ba700Render,
  BA_100_SCHEMA_URL,
  BA_100_RENDERER_VERSION,
  canonicaliseBa100,
  renderBa100Canonical,
  renderBa100ToJson,
  type RenderBa100Options,
} from "./ba-700-render";

// Basel III leverage ratio (BCBS §147–§165) — separate primitive composed
// into BA 100 when the caller supplies an exposure-measure decomposition.
export {
  BCBS_LEVERAGE_RATIO_REGULATORY_MINIMUM,
  BUILD_PHASE_LEVERAGE_BASELINE_EXPOSURE_MINOR,
  BUILD_PHASE_LEVERAGE_BASELINE_TIER1_MINOR,
  LEVERAGE_RATIO_BANK_ENTITIES,
  type LeverageExposureDecomposition,
  type LeverageExposureSection,
  type LeverageRatioGeneratorInput,
  LeverageRatioGeneratorError,
  type LeverageRatioOutput,
  generateLeverageRatio,
} from "./ba-700-leverage-ratio";

// ---------------------------------------------------------------------------
// Slice 5 — BA 310 (market risk), BA 300 (operational risk), XML render
// layer.
// ---------------------------------------------------------------------------

export {
  type Ba320GeneratorInput,
  Ba320GeneratorError,
  type Ba320LineItem,
  type Ba320Output,
  type Ba320IrGeneralSection,
  type Ba320IrSpecificSection,
  type Ba320EquitySection,
  type Ba320FxSection,
  type Ba320CommoditySection,
  type IrMaturityBandRow,
  type IrSpecificRiskRow,
  type EquityRow,
  type FxPositionRow,
  type CommodityPositionRow,
  BA_310_BANK_ENTITIES,
  generateBa320MarketRisk,
} from "./ba-320-market-risk";

export {
  type Ba400GeneratorInput,
  Ba400GeneratorError,
  type Ba400LineItem,
  type Ba400Output,
  type Ba400BiaSection,
  type Ba400TsaSection,
  type BaselBusinessLine,
  type OpRiskGrossIncomeRow,
  BA_300_BANK_ENTITIES,
  BUSINESS_LINE_BETA,
  generateBa400OpRisk,
} from "./ba-400-op-risk";

export {
  type Ba400AttributionKey,
  type Ba400FoldedGrossIncomeLine,
  type Ba400FromEventsOutput,
  generateBa400OpRiskFromEvents,
  UNATTRIBUTED_BUSINESS_LINE,
} from "./ba-400-events-adapter";

export {
  type RenderXmlOptions,
  type SarbXmlReportPayload,
  type SarbXmlSection,
  type SarbXmlValue,
  XmlRenderError,
  renderSarbXml,
  validateSarbXmlStructural,
} from "./xml-render";

export {
  BA_310_NAMESPACE,
  BA_310_REQUIRED_ELEMENTS,
  BA_310_XSD_URI,
  ba320ToXmlPayload,
} from "./ba-320-xml-adapter";

// ---------------------------------------------------------------------------
// FX adapter — bridges fxPositionCalculator output to BA 310 FxPositionRow[]
// ---------------------------------------------------------------------------

export {
  fxPositionsToBa320Input,
  fxPositionSummaryNote,
} from "./ba-320-fx-adapter";

// ---------------------------------------------------------------------------
// P1-compliant events-first entry points (C-2 / C-3 fixes).
//
// These adapters fold primary trade events directly from the event store,
// bypassing the trial-balance projection. Callers with EventStore access
// should prefer these paths.
// Authority: Principles/1-events-are-truth.md, D-MARKETS-CAPITAL-TIME-SHAPE.
// ---------------------------------------------------------------------------

export {
  type Ba320FromEventsInput,
  generateBa320MarketRiskFromEvents,
} from "./ba-320-events-adapter";

export {
  type Ba700FromEventsInput,
  buildLeverageExposureWithBa110,
  generateBa700CapitalFromEvents,
} from "./ba-700-events-adapter";

export {
  BA_300_NAMESPACE,
  BA_300_REQUIRED_ELEMENTS,
  BA_300_XSD_URI,
  ba300ToXmlPayload,
} from "./ba-400-xml-adapter";

export {
  BA_300_LCR_NAMESPACE,
  BA_300_LCR_REQUIRED_ELEMENTS,
  BA_300_LCR_XSD_URI,
  ba300LcrToXmlPayload,
} from "./ba-300-lcr-xml-adapter";

export {
  BA_100_NAMESPACE,
  BA_100_REQUIRED_ELEMENTS,
  BA_100_XSD_URI,
  ba100ToXmlPayload,
} from "./ba-700-xml-adapter";

// ---------------------------------------------------------------------------
// Slice 9 — off-balance-sheet (Off-Balance-Sheet Activities) monthly return
// ---------------------------------------------------------------------------

export {
  type OffBalanceSheetClassificationEntry,
  type OffBalanceSheetClassificationMap,
  type OffBalanceSheetCommitmentsEntry,
  type OffBalanceSheetCommitmentsRow,
  type OffBalanceSheetCommitmentsSection,
  type OffBalanceSheetDerivativeEntry,
  type OffBalanceSheetDerivativeProductType,
  type OffBalanceSheetDerivativeRow,
  type OffBalanceSheetDerivativesSection,
  type OffBalanceSheetDocumentarySection,
  type OffBalanceSheetGeneratorInput,
  OffBalanceSheetGeneratorError,
  type OffBalanceSheetGuaranteeRow,
  type OffBalanceSheetGuaranteesEntry,
  type OffBalanceSheetGuaranteesSection,
  type OffBalanceSheetMaturityBand,
  type OffBalanceSheet,
  type OffBalanceSheetOtherItem,
  type OffBalanceSheetOtherSection,
  type OffBalanceSheetSection,
  type OffBalanceSheetTotal,
  OFF_BALANCE_SHEET_BANK_ENTITIES,
  fingerprintClassificationMap,
  generateOffBalanceSheet,
  maturityBandFromDays,
  remainingDaysTo,
} from "./off-balance-sheet";

export {
  OffBalanceSheetRenderSchema,
  type OffBalanceSheetRender,
  OFF_BALANCE_SHEET_SCHEMA_URL,
  OFF_BALANCE_SHEET_RENDERER_VERSION,
  canonicaliseOffBalanceSheet,
  renderOffBalanceSheetCanonical,
  renderOffBalanceSheetToJson,
  type RenderOffBalanceSheetOptions,
} from "./off-balance-sheet-render";

// ---------------------------------------------------------------------------
// WS-BA-RETURNS-P1-SOURCING Phase 4 — BA 110 (Off-Balance-Sheet Activities),
// events-first. Canonical numbering per D-BA-RETURN-NUMBERING-EXCEL-CANONICAL.
// ---------------------------------------------------------------------------

export {
  type Ba110OffBalanceSheet,
  type Ba110ObsLineItem,
  type Ba110ObsSection,
  Ba110OffBalanceSheetGeneratorError,
  BA_110_BANK_ENTITIES as BA_110_OBS_BANK_ENTITIES,
  BA_110_DERIVATIVE_BUILD_PHASE_CCF,
  ba110ToLeverageOffBalanceSheetExposure,
  generateBa110OffBalanceSheetFromEvents,
} from "./ba-110-off-balance-sheet";

export {
  Ba110ObsRenderSchema,
  type Ba110ObsRender,
  BA_110_OBS_SCHEMA_URL,
  BA_110_OBS_RENDERER_VERSION,
  canonicaliseBa110Obs,
  renderBa110ObsCanonical,
  renderBa110ObsToJson,
  type RenderBa110ObsOptions,
} from "./ba-110-render";

// ---------------------------------------------------------------------------
// Slice 6 — IFRS statement renderer (BS / IS / CF / Equity / Notes skeleton)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Slice 11 — BA 310 (Credit-Risk Loans-and-Advances Breakdown)
// ---------------------------------------------------------------------------

export {
  type Ba200CreditRisk,
  type Ba200CategorySection,
  type Ba200ClassificationEntry,
  type Ba200GeneratorInput,
  Ba200GeneratorError,
  type Ba200LoanEntry,
  type Ba200Stage,
  type Ba200StageSection,
  type Ba200Total,
  BA_200_BANK_ENTITIES,
  ba200CategorySectionSchema,
  ba200StageSectionSchema,
  ba200TotalSchema,
  generateBa200CreditRisk,
  generateBa200CreditRiskFromEvents,
  DEFAULT_BA200_CLASSIFICATION_MAP,
} from "./ba-200-credit-risk";

export {
  Ba200RenderSchema,
  type Ba200Render,
  BA_200_SCHEMA_URL,
  BA_200_RENDERER_VERSION,
  canonicaliseBa200,
  renderBa200Canonical,
  renderBa200ToJson,
  type RenderBa200Options,
} from "./ba-200-render";

// ---------------------------------------------------------------------------
// WS-BA-RETURNS-FOLLOWON — BA 210 (Credit Concentration Risk / Large
// Exposures, LEX). Events-first generator + JSON renderer.
// Authority: D-BA-RETURNS-FOLLOWON-BATCH.
// ---------------------------------------------------------------------------

export {
  type Ba210GeneratorInput,
  type Ba210ObligorExposure,
  type Ba210Output,
  Ba210GeneratorError,
  BA_210_BANK_ENTITIES,
  LEX_LARGE_EXPOSURE_THRESHOLD_PCT,
  LEX_HARD_LIMIT_PCT,
  ba210ObligorExposureSchema,
  generateBa210LargeExposures,
  generateBa210LargeExposuresFromEvents,
} from "./ba-210-large-exposures";

export {
  Ba210RenderSchema,
  type Ba210Render,
  BA_210_SCHEMA_URL,
  BA_210_RENDERER_VERSION,
  canonicaliseBa210,
  renderBa210Canonical,
  renderBa210ToJson,
  type RenderBa210Options,
} from "./ba-210-render";

export {
  type IfrsAccountClass,
  type IfrsAccountClassification,
  type IfrsCashFlowClass,
  type IfrsGeneratorInput,
  type IfrsLineItem,
  type IfrsOpeningEquityComponents,
  type IfrsOutputMeta,
  IFRS_AFS_BASE_CITATIONS,
  IFRS_BANK_ENTITIES,
  IfrsGeneratorError,
  assertIfrsBankEntity,
  fingerprintIfrsClassifications,
  indexClassifications,
} from "./ifrs-types";

export {
  type IfrsBalanceSheetOutput,
  type IfrsBalanceSheetSection,
  generateIfrsBalanceSheet,
} from "./ifrs-balance-sheet";

export {
  type IfrsIncomeSection,
  type IfrsIncomeStatementOutput,
  generateIfrsIncomeStatement,
} from "./ifrs-income-statement";

export {
  type IfrsCashFlowOutput,
  type IfrsCashFlowSection,
  generateIfrsCashFlow,
} from "./ifrs-cash-flow";

export {
  type EquityComponentKey,
  type EquityComponentMovement,
  type IfrsChangesInEquityOutput,
  generateIfrsChangesInEquity,
} from "./ifrs-changes-in-equity";

export {
  type IfrsNoteHeading,
  type IfrsNotesOutput,
  generateIfrsNotes,
} from "./ifrs-notes";

export {
  type IfrsBalanceSheetRender,
  type IfrsBundleInput,
  type IfrsBundleRender,
  type IfrsCashFlowRender,
  type IfrsChangesInEquityRender,
  type IfrsIncomeStatementRender,
  type IfrsNotesRender,
  type RenderIfrsOptions,
  IFRS_RENDERER_VERSION,
  IFRS_SCHEMA_BASE_URL,
  IfrsBalanceSheetRenderSchema,
  IfrsBundleRenderSchema,
  IfrsCashFlowRenderSchema,
  IfrsChangesInEquityRenderSchema,
  IfrsIncomeStatementRenderSchema,
  IfrsNotesRenderSchema,
  canonicaliseIfrs,
  renderIfrsBalanceSheet,
  renderIfrsBundle,
  renderIfrsBundleCanonical,
  renderIfrsCashFlow,
  renderIfrsChangesInEquity,
  renderIfrsIncomeStatement,
  renderIfrsNotes,
} from "./ifrs-render";
