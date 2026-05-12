// platform/forward-obligations/index.ts
//
// Re-exports for the `@platform/forward-obligations` path alias.
// Consumers import from `@platform/forward-obligations` rather than
// referencing internal module paths.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION · TRADING-MANDATE-V1 (PR #256) ·
// P1-EVENTS-ARE-TRUTH · ORG-MK-10
//
// Author: Atlas (Core banking platform architect, engineering)

export type {
  ForwardObligation,
  ForwardObligationKind,
  ForwardObligationsBoardView,
  ForwardObligationStatus,
} from "./types";
export {
  forwardObligationKindSchema,
  forwardObligationSchema,
  forwardObligationStatusSchema,
} from "./types";
export { getSeedObligations } from "./seed";
export { projectForwardObligations } from "./projection";
