// v2-core/cross-tenant/index.ts
//
// Barrel export for the cross-tenant CSI gate sub-package (V2 S12).
//
// Public surface:
//   csi-blocklist — CSI category event family + canonical seed taxonomy.
//   projection    — CsiBlocklist register fold (foldCsiBlocklist / emptyCsiBlocklist).
//   gate          — LearningFlow descriptor + screenCrossTenantLearningFlow
//                   (fail-closed) + typed gate-outcome events.
//
// Authority: D-W7-VENDOR-ENTITY-STRUCTURE; D-V2-TENANCY-ARCHITECTURE;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Atlas (Substrate Architect, engineering).

export * from "./csi-blocklist";
export * from "./projection";
export * from "./gate";
