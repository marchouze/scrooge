// v2-core/reference-data/index.ts
//
// Barrel export for the Wave 2 batch-1 reference-data sub-package.
//
// Public surface:
//   events      — re-declared money-free payload schemas for four V1 domains
//                 (regulatory, market-data, obligation-review,
//                 obligation-equivalence) + the batch type/schema manifest.
//   projection  — ReferenceDataRegister, foldReferenceDataRegister (the
//                 event-list parity projection).
//
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC.
// Author: Atlas (Core banking platform architect, engineering).

export * from "./events";
export * from "./projection";
