// platform/alm/index.ts
//
// ALM engine barrel export.
//
// Exports all four ALM engines:
//   - repricing-gap    — BCBS 319 repricing gap schedule (RSA/RSL/Gap/Cumulative)
//   - eve              — ΔEVE sensitivities for six BCBS d365 shock scenarios
//   - nii              — ΔNII sensitivities for four parallel shocks (12-month horizon)
//   - intraday-stress  — BCBS 248 intraday HQLA-stress projection (BAU + stress,
//                        4 SAMOS windows)
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
  SAMOS_WINDOWS,
  runIntradayStress,
} from "./intraday-stress";

export type {
  IntradayScenario,
  IntradayStressResult,
  IntradayWindowResult,
  IntradayWindowStatus,
  SAMOSWindow,
} from "./intraday-stress";
