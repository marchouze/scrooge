// v2-core/fil-models/ir/money-market/index.ts
//
// Barrel export for Phase 3b money-market FIL models (asset class `ir`):
// unsecured (IBL / funding line), fixed-term deposit, classic repo. Each
// implements Valuable (amortised cost) + Performable (daily accrual carry).
//
// Authority: D-V1-REMOVAL-PHASE-3B.
// Author: Atlas (Core banking platform architect, engineering).

// Types + lifecycles
export * from "./types/mm-lifecycles.ts";
export * from "./types/mm-type-definitions.ts";

// Shared positions + methodology
export * from "./shared/mm-positions.ts";
export * from "./performance/mm-methodology.ts";

// Models
export * from "./unsecured/mm-unsecured-model.ts";
export * from "./deposit/mm-deposit-model.ts";
export * from "./repo/mm-repo-model.ts";
