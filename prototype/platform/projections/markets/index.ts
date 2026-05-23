// platform/projections/markets/index.ts
//
// Public surface of the M1 markets projections.
//
// Author: Anya · M1 per D-MARKETS-SCHEMA-FOUNDATION.

export type {
  EquityCorporateActionAppliedEvent,
  EquityLifecycleEvent,
  EquitySettlementInstructedEvent,
  EquityTradeBookedEvent,
  MarketsProjectionName,
  SemanticLayerEntry,
} from "./types";
export { MARKETS_PROJECTION_NAMES, SEMANTIC_LAYER_ENTRIES } from "./types";

export type { TradeRecordRow, TradeRecordState } from "./trade-record";
export { tradeRecordInitial, tradeRecordProjection } from "./trade-record";

export type { PositionKey, PositionRow, PositionState } from "./position";
export { positionInitial, positionProjection } from "./position";

export type { SubLedgerLegKind, SubLedgerRow, SubLedgerState } from "./sub-ledger";
export { subLedgerInitial, subLedgerProjection } from "./sub-ledger";

// Slice 5 — pre-trade risk controls + correspondent routing
export type { LimitUtilisationRow } from "./limit-utilisation";
export {
  getFxNetPositions,
  getLimitUtilisations,
  rebuildLimitUtilisation,
} from "./limit-utilisation";

export type { CorrespondentRoutingRow, HerstattRisk, SchemeType } from "./correspondent-routing";
export { getCorrespondentRouting, rebuildCorrespondentRouting } from "./correspondent-routing";

// D-FINANCIAL-INSTRUMENT-ENTITY Slice 3 — SecurityMaster projection
export type { SecurityMasterRow, SecurityMasterState } from "./security-master";
export { securityMasterInitial, securityMasterProjection } from "./security-master";

// D-FINANCIAL-INSTRUMENT-ENTITY Slice 11 — unified cross-asset position projection
export type {
  UnifiedPositionKey,
  UnifiedPositionRow,
  UnifiedPositionState,
} from "./unified-position";
export { unifiedPositionInitial, unifiedPositionProjection } from "./unified-position";
