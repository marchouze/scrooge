// platform/risk/liquidity-limit-engine/index.ts
//
// WS-LIQUIDITY-LIMIT-ENGINE — barrel export for the liquidity-limit engine.
//
// Standing authority:
//   - D-RAS (CEO-approved 2026-05-06).
//   - Liquidity Risk Management Policy v1 (Camille + Eitan + Helena,
//     2026-05-11).
//   - brief:ravi:liquidity-limit-engine-mirroring-credit-limit-en:2026-05-21.
//
// Author: Ravi (Treasury and ALM engineer, engineering — reports to Eitan
//   (Treasurer, governance)).

export type {
  LiquidityLimitConfig,
  LiquidityLimitLineStatus,
  LiquidityLimitObservation,
  LiquidityLimitStatus,
} from "./types";

export { DEFAULT_LIMIT_CONFIGS } from "./config";

export type { ConcentrationFeed, OpenBreachSummary } from "./projection";
export {
  LIQUIDITY_LIMIT_LIFECYCLE_TYPES,
  LIQUIDITY_MEASUREMENT_TYPES,
  getBreachHistory,
  getConcentrationObservations,
  getPortfolioObservations,
  listOpenBreaches,
} from "./projection";

export type {
  BreachDetectionResult,
  DetectBreachesOpts,
  TierStatusSummary,
} from "./breach-detector";
export {
  detectBreaches,
  observationBreachesConfig,
  resetBreachIdCounter,
  tierStatus,
} from "./breach-detector";

export type { LiquidityGateBlockReason, LiquidityGateResult } from "./gateway";
export { checkLiquidityGate } from "./gateway";
