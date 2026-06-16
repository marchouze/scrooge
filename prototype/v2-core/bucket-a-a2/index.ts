// v2-core/bucket-a-a2/index.ts
//
// Barrel export for the Wave 2 Bucket-A batch-A2 sub-package (nine emittable
// numeric-money, non-financial types migrated to v2 via the store-tee +
// MoneyWire codec dual-write pattern).
//
// Public surface:
//   money-wire  — MoneyWire shape + MAJOR/MINOR-unit builders (v2-native, no
//                 platform import — the no-v1-import boundary).
//   events      — re-declared v2 payload schemas + per-type tee codecs + the
//                 batch manifest (BUCKET_A_A2_SPECS / _TYPES / _CODEC_BY_TYPE).
//   projection  — BucketAA2Register + foldBucketAA2Register (decoded-decimal
//                 parity projection: V1 side codec-applied, v2 side as-stored).
//
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC;
//   D-V2-CORE-MONEY-DECIMAL-NATIVE.
// Author: Atlas (Core banking platform architect, engineering).

export * from "./money-wire";
export * from "./events";
export * from "./projection";
