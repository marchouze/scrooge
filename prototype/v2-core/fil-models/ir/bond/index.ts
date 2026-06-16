// v2-core/fil-models/ir/bond/index.ts
//
// Barrel export for the Phase 3c FVTPL fixed-rate vanilla bond FIL model
// (asset class `ir`). The one DISCOUNTING instrument in the V1-removal batch:
// Valuable (PV of remaining cash flows at a market yield, FVTPL) + Performable
// (accrued-coupon carry) + RiskMeasurable (modified duration).
//
// Authority: D-V1-REMOVAL-PHASE-3C.
// Author: Atlas (Core banking platform architect, engineering).

// Types + lifecycles
export * from "./types/bond-lifecycles.ts";
export * from "./types/bond-type-definitions.ts";

// Shared positions + observables + methodology
export * from "./shared/bond-positions.ts";
export * from "./shared/bond-observables.ts";
export * from "./performance/bond-methodology.ts";

// Model
export * from "./bond-model.ts";
