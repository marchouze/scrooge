// platform/forward-obligations/index.ts
//
// Forward Obligations projection — public API.
//
// Re-exports all types, the projection entrypoint, and the VIEWS registry.
// Adding a new view requires:
//   1. Create `views/<name>.ts` implementing ForwardObligationView<T>.
//   2. Add it to the VIEWS map below.
// Nothing else changes — the projection core and HTTP layer are untouched.
//
// Authority: CEO design brief 2026-05-12 (multi-source projection + pluggable views).
// Author: Atlas (Core banking platform architect, engineering)

export type {
  ForwardObligation,
  ForwardObligationView,
  HorizonOpts,
  LiquidityViewBucket,
  LiquidityViewItem,
  LiquidityViewOutput,
  ObligationCertainty,
  ObligationSource,
  PlanningBucket,
  PlanningViewOutput,
  PlanningViewRow,
} from "./types";

export { CERTAINTY_WEIGHTS } from "./types";

export {
  DEFAULT_HORIZON_DAYS,
  buildForwardObligations,
  resolveHorizon,
} from "./projection";

export type { ForwardObligationsResult, ProjectionOpts } from "./projection";

export { liquidityView } from "./views/liquidity";
export { planningView } from "./views/planning";

// ---------------------------------------------------------------------------
// VIEWS registry
//
// Keyed by the view name (used as the `?view=` query param).
// Each entry is a ForwardObligationView<unknown> — callers cast to the
// specific output type they need.
// ---------------------------------------------------------------------------

import { liquidityView } from "./views/liquidity";
import { planningView } from "./views/planning";
import type { ForwardObligationView } from "./types";

// biome-ignore lint/suspicious/noExplicitAny: view registry intentionally holds mixed output types
export const VIEWS: Record<string, ForwardObligationView<any>> = {
  [planningView.name]: planningView,
  [liquidityView.name]: liquidityView,
};

/** Ordered list of view names for UI tab rendering. */
export const VIEW_NAMES: string[] = Object.keys(VIEWS);
