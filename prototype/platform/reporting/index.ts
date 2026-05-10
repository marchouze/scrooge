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
