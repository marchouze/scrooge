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
