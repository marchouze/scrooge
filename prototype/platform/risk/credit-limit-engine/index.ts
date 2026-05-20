// platform/risk/credit-limit-engine/index.ts
//
// WS-CREDIT-LIMIT-ENGINE — barrel export for the credit-limit engine.
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20).
//
// Author: Atlas (Core banking platform architect, engineering).

export type {
  CreditLimit,
  CreditLimitHeadroom,
  CreditLimitStatus,
  LargeExposureCheck,
} from "./types";

export {
  CREDIT_LIMIT_LIFECYCLE_TYPES,
  getCreditLimit,
  getLimitHistory,
  listActiveLimits,
} from "./projection";

export type { HeadroomCheckResult } from "./pre-deal-check";
export { checkHeadroom } from "./pre-deal-check";

export { detectBreaches } from "./breach-detector";

export {
  checkLargeExposure,
  checkLargeExposureAcrossPortfolio,
} from "./large-exposure";
