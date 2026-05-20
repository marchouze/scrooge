// platform/risk/sa-ccr/index.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 4 — SA-CCR Replacement Cost + add-on engine.
// Barrel export.
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20),
//   Phase 4.
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
export { ALPHA_SA_CCR, computeAddOn, supervisoryFactor } from "./pfe-addon";
export { computeEad } from "./ead";
export { computeAndEmit } from "./compute-and-emit";
