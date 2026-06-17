// v2-core/money-tail/index.ts
//
// Barrel export for the money-bearing non-financial TAIL sub-package (two
// EMITTABLE numeric-money OPERATIONAL-reconciliation types — ReconciliationBreak,
// DailyReconciliationReport — migrated to v2 via the store-tee + MoneyWire codec
// dual-write pattern).
//
// Public surface:
//   events     — re-declared v2 payload schemas + per-type tee codecs + the batch
//                manifest (MONEY_TAIL_SPECS / _TYPES / _CODEC_BY_TYPE).
//   projection — MoneyTailRegister + foldMoneyTailRegister (decoded-decimal parity
//                projection: V1 side codec-applied, v2 side as-stored).
//
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC;
//   D-V2-CORE-MONEY-DECIMAL-NATIVE.
// Author: Atlas (Core banking platform architect, engineering).

export * from "./events";
export * from "./projection";
