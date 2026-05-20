// platform/markets/netting-sets/index.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 5 — Netting-set register barrel export.
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved
// 2026-05-20), Phase 5 — canonical netting-set register projection.
//
// Author: Imani (Legal-as-code engineer, engineering).

export type {
  JurisdictionEnforceability,
  NettingSet,
  NettingSetRegistryEntry,
  NettingSetStatus,
} from "./types";

export {
  NETTING_SET_LIFECYCLE_TYPES,
  getNettingSet,
  getNettingSetsByCounterparty,
  listActiveNettingSets,
  listAllNettingSetEntries,
  nettingSetIdFor,
  resolveNettingSet,
} from "./projection";

export { getEnforceabilityReason, isEnforceable } from "./enforceability";
