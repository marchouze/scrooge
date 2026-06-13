// v2-core/fil-instances/index.ts
//
// FIL instances — the registered lifecycle event family + the live-instance
// projection. The anchor book's IR + FX trades are materialised as native FIL
// instances via this family (the materialisation backfill is a v1-side script
// that reads v1 and emits into the v2 anchor store).
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1.
// Author: Atlas (Substrate Architect, engineering).

export * from "./events";
export * from "./projection";
