// platform/reporting/index.ts
//
// Public surface of the reporting package — D-REPORTING-CAPABILITY-M2-M3-
// BUILD-PLAN Slice 3 + downstream slices.
//
// Slice 3 ships BA 325 (LCR) end-to-end as the proof-of-architecture for
// the BA-form generator pipeline. Slices 4-5 add BA 700 / BA 350 / BA 600,
// the regulator-portal handshake, and the SARB XML render. Slice 6+ adds
// IFRS AFS skeletons + capital-stack + RWA projections.
//
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; package owner).

export {
  type AccountLiquidityClassification,
  type Ba325CashFlowSection,
  type Ba325GeneratorInput,
  Ba325GeneratorError,
  type Ba325HqlaSection,
  type Ba325LineItem,
  type Ba325Output,
  BA_325_BANK_ENTITIES,
  applyHqlaCaps,
  generateBa325Lcr,
  type HqlaLevel,
} from "./ba-325-lcr";

export {
  Ba325RenderSchema,
  type Ba325Render,
  BA_325_SCHEMA_URL,
  BA_325_RENDERER_VERSION,
  canonicaliseBa325,
  renderBa325Canonical,
  renderBa325ToJson,
  type RenderBa325Options,
} from "./ba-325-render";

// ---------------------------------------------------------------------------
// WS-FINANCE-BA-RETURNS-QUINTET — BA 100 (Balance Sheet) + BA 300 (Income
// Statement) projections. Standing authority D-REPORTING-CAPABILITY-M2-M3-
// BUILD-PLAN extended 2026-05-17 by Marc's directive.
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
  type Ba100Section_Output,
  BA_100_BANK_ENTITIES,
  generateBa100BalanceSheet,
} from "./ba-100-balance-sheet";

export {
  Ba100RenderSchema,
  type Ba100Render,
  BA_100_SCHEMA_URL,
  BA_100_RENDERER_VERSION,
  canonicaliseBa100,
  renderBa100Canonical,
  renderBa100ToJson,
  type RenderBa100Options,
} from "./ba-100-render";

export {
  type Ba300ClassificationGap,
  type Ba300ClassificationMap,
  type Ba300GeneratorInput,
  Ba300GeneratorError,
  type Ba300IncomeStatement,
  type Ba300LineCategory,
  type Ba300LineCategorySection,
  type Ba300LineClassification,
  type Ba300LineItem,
  BA_300_BANK_ENTITIES,
  generateBa300IncomeStatement,
} from "./ba-300-income-statement";

export {
  Ba300RenderSchema,
  type Ba300Render,
  BA_300_SCHEMA_URL,
  BA_300_RENDERER_VERSION,
  canonicaliseBa300,
  renderBa300Canonical,
  renderBa300ToJson,
  type RenderBa300Options,
} from "./ba-300-render";

// ---------------------------------------------------------------------------
// Slice 4 — BA 700 Capital Adequacy Return
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
  BA_700_BANK_ENTITIES,
  type CapitalTier,
  computeRequiredMinimums,
  generateBa700Capital,
  type RegulatoryDeduction,
  type RwaDecomposition,
} from "./ba-700-capital";

export {
  Ba700RenderSchema,
  type Ba700Render,
  BA_700_SCHEMA_URL,
  BA_700_RENDERER_VERSION,
  canonicaliseBa700,
  renderBa700Canonical,
  renderBa700ToJson,
  type RenderBa700Options,
} from "./ba-700-render";

// ---------------------------------------------------------------------------
// Slice 5 — BA 350 (market risk), BA 600 (operational risk), XML render
// layer.
// ---------------------------------------------------------------------------

export {
  type Ba350GeneratorInput,
  Ba350GeneratorError,
  type Ba350LineItem,
  type Ba350Output,
  type Ba350IrGeneralSection,
  type Ba350IrSpecificSection,
  type Ba350EquitySection,
  type Ba350FxSection,
  type Ba350CommoditySection,
  type IrMaturityBandRow,
  type IrSpecificRiskRow,
  type EquityRow,
  type FxPositionRow,
  type CommodityPositionRow,
  BA_350_BANK_ENTITIES,
  generateBa350MarketRisk,
} from "./ba-350-market-risk";

export {
  type Ba600GeneratorInput,
  Ba600GeneratorError,
  type Ba600LineItem,
  type Ba600Output,
  type Ba600BiaSection,
  type Ba600TsaSection,
  type BaselBusinessLine,
  type OpRiskGrossIncomeRow,
  BA_600_BANK_ENTITIES,
  BUSINESS_LINE_BETA,
  generateBa600OpRisk,
} from "./ba-600-op-risk";

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
  BA_350_NAMESPACE,
  BA_350_REQUIRED_ELEMENTS,
  BA_350_XSD_URI,
  ba350ToXmlPayload,
} from "./ba-350-xml-adapter";

// ---------------------------------------------------------------------------
// FX adapter — bridges fxPositionCalculator output to BA 350 FxPositionRow[]
// ---------------------------------------------------------------------------

export {
  fxPositionsToBa350Input,
  fxPositionSummaryNote,
} from "./ba-350-fx-adapter";

// ---------------------------------------------------------------------------
// P1-compliant events-first entry points (C-2 / C-3 fixes).
//
// These adapters fold primary trade events directly from the event store,
// bypassing the trial-balance projection. Callers with EventStore access
// should prefer these paths.
// Authority: Principles/1-events-are-truth.md, D-MARKETS-CAPITAL-TIME-SHAPE.
// ---------------------------------------------------------------------------

export {
  type Ba350FromEventsInput,
  generateBa350MarketRiskFromEvents,
} from "./ba-350-events-adapter";

export {
  type Ba700FromEventsInput,
  generateBa700CapitalFromEvents,
} from "./ba-700-events-adapter";

export {
  BA_600_NAMESPACE,
  BA_600_REQUIRED_ELEMENTS,
  BA_600_XSD_URI,
  ba600ToXmlPayload,
} from "./ba-600-xml-adapter";

// ---------------------------------------------------------------------------
// Slice 9 — BA 120 (Off-Balance-Sheet Activities) monthly return
// ---------------------------------------------------------------------------

export {
  type Ba120ClassificationEntry,
  type Ba120ClassificationMap,
  type Ba120CommitmentsEntry,
  type Ba120CommitmentsRow,
  type Ba120CommitmentsSection,
  type Ba120DerivativeEntry,
  type Ba120DerivativeProductType,
  type Ba120DerivativeRow,
  type Ba120DerivativesSection,
  type Ba120DocumentarySection,
  type Ba120GeneratorInput,
  Ba120GeneratorError,
  type Ba120GuaranteeRow,
  type Ba120GuaranteesEntry,
  type Ba120GuaranteesSection,
  type Ba120MaturityBand,
  type Ba120OffBalanceSheet,
  type Ba120OtherItem,
  type Ba120OtherSection,
  type Ba120Section,
  type Ba120Total,
  BA_120_BANK_ENTITIES,
  fingerprintClassificationMap,
  generateBa120OffBalanceSheet,
  maturityBandFromDays,
  remainingDaysTo,
} from "./ba-120-off-balance-sheet";

export {
  Ba120RenderSchema,
  type Ba120Render,
  BA_120_SCHEMA_URL,
  BA_120_RENDERER_VERSION,
  canonicaliseBa120,
  renderBa120Canonical,
  renderBa120ToJson,
  type RenderBa120Options,
} from "./ba-120-render";

// ---------------------------------------------------------------------------
// Slice 6 — IFRS statement renderer (BS / IS / CF / Equity / Notes skeleton)
// ---------------------------------------------------------------------------

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
