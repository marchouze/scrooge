// v2-core/money-free-batch-3/index.ts
//
// Barrel export for the Wave 2 batch-3 money-free sub-package.
//
// Public surface:
//   events      — re-declared money-free payload schemas for six V1 domains
//                 (intranet, sla-approval, regulatory-pa, seed-management,
//                 model-risk, regulatory-reporting money-free rows) + the batch
//                 type/schema manifest (re-declared + foothold type names).
//   projection  — MoneyFreeBatch3Register, foldMoneyFreeBatch3Register
//                 (the event-list parity projection).
//
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC.
// Author: Atlas (Core banking platform architect, engineering).

export * from "./events";
export * from "./projection";
