// v2-core/fil-models/fx/index.ts
//
// Barrel export for FIL FX Language Phase 1.
// Spot, Forward, Swap, NDF models + shared types + performance metrics.
//
// Author: Atlas (Core banking platform architect, engineering).

// Type definitions + lifecycles
export * from "./types/fx-lifecycles.ts";
export * from "./types/fx-type-definitions.ts";

// Shared
export * from "./shared/fx-positions.ts";
export * from "./shared/fx-observables.ts";
export * from "./shared/fx-interpolation.ts";

// Performance methodology
export * from "./performance/fx-performance-methodology.ts";

// Performance metrics
export * from "./performance/fx-performance-metrics.ts";

// Models
export * from "./spot/fx-spot-model.ts";
export * from "./forward/fx-forward-model.ts";
export * from "./swap/fx-swap-model.ts";
export * from "./ndf/fx-ndf-model.ts";
