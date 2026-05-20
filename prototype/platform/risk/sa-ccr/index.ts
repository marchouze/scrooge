// platform/risk/sa-ccr/index.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 5 — SA-CCR Replacement Cost + add-on engine.
// Barrel export.
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20),
//   Phase 5 (v1 upgrade: MTM/collateral auto-resolution + BCBS multiplier
//   + maturity factor + supervisory factors + delta adjustments).
//
// Author: Rohan (Market risk quantitative engineer, engineering).

export type {
  AddOnComponent,
  EadComputation,
  NettingSet,
  ReplacementCost,
  SaCcrAssetClass,
  TradeSummary,
} from "./types";

export { computeReplacementCost } from "./replacement-cost";
export {
  ALPHA_SA_CCR,
  MARGINED_MATURITY_FACTOR,
  MPOR_BUSINESS_DAYS,
  PFE_MULTIPLIER_FLOOR,
  computeAddOn,
  hedgingSetKey,
  maturityFactor,
  pfeMultiplier,
  supervisoryFactor,
  tradeDelta,
} from "./pfe-addon";
export { computeEad } from "./ead";
export {
  computeAndEmit,
  computeAndEmitFor,
  resolveCollateral,
  resolveMtm,
} from "./compute-and-emit";
export type { ComputeAndEmitForInput, ComputeAndEmitInput } from "./compute-and-emit";
