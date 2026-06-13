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
// NOTE: `resolveMtm` / `resolveCollateral` are RETIRED at the SA-CCR alias-flip
// (WS-V2-BBAAS, D-SACCR-V2-CUTOVER-ACCELERATE). The defective v1 `resolveMtm`
// FX-summing path is severed; RC inputs are now FIL-mediated
// (`fil-valuable-collateral-feed.ts`). No live fallback to the v1 resolution
// layer survives the cutover (Nadia MV-SACCR-V2-003).
export { computeAndEmit, computeAndEmitFor } from "./compute-and-emit";
export type { ComputeAndEmitForInput, ComputeAndEmitInput } from "./compute-and-emit";
