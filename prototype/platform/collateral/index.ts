// platform/collateral/index.ts
//
// Barrel export for the collateral inventory module.
//
// Exports:
//   - HQLA classifier (classifyHQLA, SecurityDescriptor, HQLAClassification)
//   - Collateral inventory projection (getCollateralInventory, CollateralInventoryResult)
//
// Authority: BA 325 Annex 1; Banks Act Reg 26.
// Author: Atlas (Core banking platform architect, engineering)

export {
  classifyHQLA,
  type HQLAClassification,
  type SecurityDescriptor,
} from "./hqla-classifier";

export {
  computeInventoryTotals,
  getCollateralInventory,
  type CollateralInventoryResult,
  type CollateralPosition,
} from "./inventory";
