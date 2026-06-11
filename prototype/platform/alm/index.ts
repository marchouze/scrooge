// platform/alm/index.ts
//
// ALM engine barrel export.
//
// Exports all four ALM engines:
//   - repricing-gap    — BCBS 319 repricing gap schedule (RSA/RSL/Gap/Cumulative)
//   - eve              — ΔEVE sensitivities for six BCBS d365 shock scenarios
//   - nii              — ΔNII sensitivities for four parallel shocks (12-month horizon)
//   - intraday-stress  — BCBS 248 intraday HQLA-stress projection (BAU + stress,
//                        4 NPS settlement windows)
//
// Authority: D-TREASURY-GAPS-WAVE1; BCBS d365; BCBS 248; Banks Act Reg 26/27.
// Author: Ravi (Treasury/ALM Engineer, engineering)

export {
  REPRICING_BUCKETS,
  computeRepricingGap,
} from "./repricing-gap";

export type {
  RepricingBucket,
  RepricingGapRow,
  RepricingGapSchedule,
} from "./repricing-gap";

export {
  EVE_SHOCK_DESCRIPTIONS,
  EVE_SHOCK_LABELS,
  computeEVE,
} from "./eve";

export type {
  EVEReport,
  EVEResult,
  EVEShockLabel,
} from "./eve";

export {
  NII_SHOCK_DESCRIPTIONS,
  NII_SHOCK_LABELS,
  computeNII,
} from "./nii";

export type {
  NIIReport,
  NIIResult,
  NIIShockLabel,
} from "./nii";

export {
  INTRADAY_FLOOR_ZAR,
  SETTLEMENT_WINDOWS,
  runIntradayStress,
} from "./intraday-stress";

export type {
  IntradayScenario,
  IntradayStressResult,
  IntradayWindowResult,
  IntradayWindowStatus,
  SettlementWindow,
} from "./intraday-stress";

// WS-TREASURER-WAVE1-SUBSTRATE — BCBS 248 seven intraday monitoring metrics.
// `computeIntradayLiquidityMetrics` is the RAS `appetite:liquidity:intraday`
// measurement binding (Helena (Chief Risk Officer, governance) follow-on).
export {
  BCBS_248_TOOL_LABELS,
  computeIntradayLiquidityMetrics,
} from "./intraday-liquidity-metrics";

export type {
  ComputeIntradayLiquidityMetricsOpts,
  IntradayLiquidityMetricsResult,
  IntradayThroughputRow,
  IntradayUsageRow,
  TimeSpecificObligation,
} from "./intraday-liquidity-metrics";

// WS-TREASURER-WAVE1-SUBSTRATE — CFP EWI evaluation engine (LRM Policy v1 §5.2).
export {
  EWI_MONITOR_MEASUREMENT_TYPES,
  EWI_WIRED_TRIGGER_TYPES,
  FUNDING_CONCENTRATION_COUNTERPARTY_LIMIT_PCT,
  INTRADAY_STRESS_USAGE_PCT,
  LCR_INTERNAL_FLOOR_PCT,
  LCR_REGULATORY_MINIMUM_PCT,
  NSFR_REGULATORY_MINIMUM_PCT,
  evaluateCfpEwis,
  loadCfpEwiInputs,
  wiredCfpTiers,
} from "./cfp-ewi";

export type {
  CfpEwiInputs,
  CfpTriggerEvaluation,
  ExternalCreditEventObservation,
  RecoveryEwiObservation,
} from "./cfp-ewi";
