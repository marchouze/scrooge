// platform/recon/v2-posture-dimension-vocab.ts
//
// Required structural-applicability dimension keys for the V2 W8 posture
// register (Slice B). These are the entity / approach / permission dimensions
// extracted from BCBS CRE/MAR + the PA capital framework that the anchor bank
// must carry as posture facts so that downstream agents can resolve the
// correct supervisory approach (SA vs IRB/IMA) and entity-classification for
// every capital/RWA computation.
//
// Each key here maps to a `parameters.dimensionKey` value on one or more active
// postures seeded by `scripts/seed-v2-posture-dimensions.ts`. The coverage
// floor in `v2-posture-register-integrity.ts` asserts ≥1 active posture per key.
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-W8-PARAMETRIC-TRAINING-POSITION;
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS. Principle 2 (single-graph discipline).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

export const REQUIRED_POSTURE_DIMENSION_KEYS = [
  "entity.class",
  "approach.credit-rwa",
  "approach.market-risk",
  "approach.counterparty-credit",
  "entity.consolidation-level",
  "permission.supervisory",
] as const;

export type RequiredPostureDimensionKey = (typeof REQUIRED_POSTURE_DIMENSION_KEYS)[number];
