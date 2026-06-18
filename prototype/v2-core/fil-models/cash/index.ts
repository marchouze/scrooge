// v2-core/fil-models/cash/index.ts
//
// Barrel export for the Cash FIL asset class (D-CASH-ASSET-CLASS-V1).
// Cash is a first-class FIL asset class, SEPARATE from `fx`. The Valuable /
// Accountable / RiskMeasurable implementations for cash continue to live in
// `fx-valuation/cash-model.ts` (the cash Valuable arithmetic is shared with the
// FX position — that shared arithmetic IS the settlement-continuity guarantee),
// re-pointed onto the `fil:type:cash:*` scope.
//
// Author: Atlas (Core banking platform architect, engineering).

// Type definition + lifecycle.
export * from "./types/cash-lifecycles.ts";
export * from "./types/cash-type-definitions.ts";
