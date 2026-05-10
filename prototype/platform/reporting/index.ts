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

export {
  BA_600_NAMESPACE,
  BA_600_REQUIRED_ELEMENTS,
  BA_600_XSD_URI,
  ba600ToXmlPayload,
} from "./ba-600-xml-adapter";
