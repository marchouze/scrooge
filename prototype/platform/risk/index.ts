// platform/risk/index.ts
//
// Public surface of the risk engine package.
//
// Slice 3 of D-REGULATORY-READINESS-W2 ships the standardised-approach RWA
// engine producing credit / market / operational risk-weighted assets per
// Reg 38 + BCBS Basel III/IV (CRE20, MAR, OPE25). Reporting Slices 4-5
// consume this package via the `RwaEngineOutput` contract for the BA 100
// (capital adequacy), BA 350 (market risk), BA 340 (operational risk),
// and BA 300 (credit risk) generators.
//
// IRB foundation / IRB advanced approaches register under separate
// `version`-bumped semantic entries in a later slice; the v0.1 engine
// names the standardised approach.
//
// Slice 4 of D-REGULATORY-READINESS-W2 adds the stress-projection engine
// (3-year quarterly projection of CET1 / Tier1 / Total / Leverage / LCR /
// NSFR under base + adverse + severely-adverse + reverse-stress scenarios
// per `ORG-PR-12`), the Pillar-2 add-on computation, and the ICAAP
// narrative-data feed (typed shape consumed by Helena's narrative author).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; Slice 3)
//   + Camille (Chief Financial Officer, governance — reports to CEO; Slice 3)
//   + Rohan (Risk engineer, engineering — reports to Helena CRO; Slice 4)
//   + Helena (Chief Risk Officer, governance — reports to CEO; Slice 4)
//   + Nadia (Independent-validation engineer, engineering — peer-in-second-
//     line under Helena; Slice 4 model validation).

export {
  type BusinessIndicatorInput,
  BIC_BUCKET_1_BIC_AT_THRESHOLD_EUR_MINOR,
  BIC_BUCKET_2_BIC_AT_THRESHOLD_EUR_MINOR,
  BIC_THRESHOLD_1_EUR_MINOR,
  BIC_THRESHOLD_2_EUR_MINOR,
  type CounterpartyType,
  type CreditExposure,
  type CreditRatingBucket,
  type CreditRwaSection,
  computeBic,
  computeRwa,
  type LtvBucket,
  type MarketRiskType,
  type MarketRwaSection,
  type OperationalRwaSection,
  type ResidualMaturityBucket,
  type RwaBreakdownLine,
  type RwaEngineInput,
  type RwaEngineOutput,
  RwaEngineError,
  RWA_BANK_ENTITIES,
  rwaEngine,
  standardisedRiskWeight,
  type TradingBookPosition,
} from "./rwa-engine";

// W2 Slice 4 — stress-projection engine + Pillar-2 add-on + ICAAP
// narrative-data feed
export {
  ADVERSE_SCENARIO,
  BASE_SCENARIO,
  REVERSE_STRESS_SCENARIO,
  SEVERELY_ADVERSE_SCENARIO,
  STANDARD_STRESS_SCENARIO_BUNDLE,
  STRESS_HORIZON_QUARTERS,
  STRESS_SCENARIO_CITATIONS,
  STRESS_SCENARIO_CITATION_LIST,
  type QuarterlyShock,
  type ReverseStressTarget,
  type StressScenario,
  type StressScenarioId,
} from "./stress-scenarios";

export {
  type CurrentStateCapital,
  type CurrentStateLeverage,
  type CurrentStateLiquidity,
  type QuarterlyProjection,
  type ScenarioProjection,
  type StressEngineInput,
  type StressEngineOutput,
  StressEngineError,
  projectStress,
  stressEngine,
} from "./stress-engine";

export {
  PILLAR_2_CITATIONS,
  type Pillar2AddOnInput,
  type Pillar2AddOnOutput,
  type Pillar2RiskBucket,
  type Pillar2RiskBucketCategory,
  type Pillar2RiskBucketLine,
  type StressDeficitDecomposition,
  Pillar2AddOnError,
  computePillar2AddOn,
} from "./pillar-2-addon";

export {
  ICAAP_NARRATIVE_CITATIONS,
  type CapitalAdequacySection,
  type CapitalPlanningSection,
  type IcaapNarrativeDataFeed,
  type IcaapNarrativeDataInput,
  type Pillar2Section,
  type ScenarioSummaryLine,
  type StressTestingSection,
  IcaapNarrativeDataError,
  buildIcaapNarrativeData,
} from "./icaap-narrative-data";

// Canonical Risk Taxonomy v1 — typed mirror of
// `Regulations/_risk-taxonomy.md` (Helena CRO + Rohan Risk engineer).
// Eleven level-1 risk types + 56 level-2 + 27 level-3 nodes. Every
// policy, obligation, RAS line, control, incident, finding maps to
// exactly one terminal node (Principle 2 — single-graph discipline).
export {
  RISK_TAXONOMY,
  RISK_TAXONOMY_CODES,
  type RiskTaxonomyCode,
  type RiskTaxonomyNode,
  getRiskTaxonomyNode,
  isTerminal,
} from "./taxonomy";
