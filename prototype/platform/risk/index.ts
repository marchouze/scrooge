// platform/risk/index.ts
//
// Public surface of the risk engine package.
//
// Slice 3 of D-REGULATORY-READINESS-W2 ships the standardised-approach RWA
// engine producing credit / market / operational risk-weighted assets per
// Reg 38 + BCBS Basel III/IV (CRE20, MAR, OPE25). Reporting Slices 4-5
// consume this package via the `RwaEngineOutput` contract for the BA 700
// (capital adequacy), BA 350 (market risk), BA 340 (operational risk),
// and BA 400 (credit risk) generators.
//
// IRB foundation / IRB advanced approaches register under separate
// `version`-bumped semantic entries in a later slice; the v0.1 engine
// names the standardised approach.
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO)
//   + Camille (Chief Financial Officer, governance — reports to CEO).

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
