// v2-core/bucket-a-a2/money-wire.ts
//
// THIN RE-EXPORT SHIM (Bucket C prep, D-BANK-WIDE-V2-MIGRATION).
//
// The MoneyWire control-plane primitive has been relocated to its canonical
// home `v2-core/core/money-wire.ts` (it is no longer A2-specific — it is used
// by `V2RiskAppetiteSet.floor` (#1404) and Bucket C as well as the batch-A2
// store-tee codecs). This shim re-exports the canonical module so existing
// imports of `v2-core/bucket-a-a2/money-wire` keep working for one cycle while
// callers migrate to the canonical path. Remove the shim once all callers have
// moved.
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Author: Atlas (Core banking platform architect, engineering).

export {
  type MoneyWire,
  isMoneyWire,
  moneyWireFromMajorNumber,
  moneyWireFromMajorString,
  moneyWireFromMinorNumber,
  moneyWireSchema,
} from "../core/money-wire";
