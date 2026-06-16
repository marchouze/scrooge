// platform/event-store/registry/bond-accounting-v2.ts
//
// EVENT_TYPE_REGISTRY rows for the V2-PARALLEL JSE bond lifecycle events. These
// run dual-parallel to the V1 rows in `registry/bonds.ts`
// (D-V1-REMOVAL-PHASE-3C): the V1 rows stay `v1-only`; these 5 rows are
// `v2-parallel` and back the V2 bond GL posting handlers + the V1↔V2 bond GL
// parity gate.
//
// 5 events registered:
//   BondTradeExecutedV2, BondInterestAccruedV2, BondPositionRevaluedV2,
//   BondMaturedV2, BondSoldV2
//
// Authority: D-V1-REMOVAL-PHASE-3C (CEO-approved 2026-06-16);
//            D-ENGINEERING-INTEGRITY-CHARTER;
//            IFRS 9 §3.1.1, §3.2.3, §4.1.4, §5.4.1, §5.7.1; IAS 32;
//            Banks Act 94 of 1990.
//
// Retention: RETENTION_JSE_TRADE_7Y (mirrors the V1 bond-trade retention).
//
// Author: Atlas (Core banking platform architect, engineering).

import {
  bondInterestAccruedV2PayloadSchema,
  bondMaturedV2PayloadSchema,
  bondPositionRevaluedV2PayloadSchema,
  bondSoldV2PayloadSchema,
  bondTradeExecutedV2PayloadSchema,
} from "../event-types/bond-accounting-v2";
import { RETENTION_JSE_TRADE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const SOURCE = "platform/event-store/event-types/bond-accounting-v2.ts";

/**
 * Registry rows for the V2-parallel JSE bond lifecycle event types.
 *
 * Subscribers mirror the V1 rows:
 *   Bea (Accounting & financial reporting engineer) — V2 GL posting rules
 *     (PR-BOND-*-V2).
 *   Camille (CFO) — bond lifecycle for financial reporting.
 *   Helena (CRO) — bond positions + modified duration for risk oversight.
 *   Atlas (platform) — substrate / parity-gate monitoring.
 */
export const BOND_ACCOUNTING_V2_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "BondTradeExecutedV2",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: bondTradeExecutedV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3C", "IFRS9-3-1-1", "IAS32"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "BondInterestAccruedV2",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: bondInterestAccruedV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3C", "IFRS9-5-4-1"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "BondPositionRevaluedV2",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Atlas"],
    replay: "latest-wins-per-key",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: bondPositionRevaluedV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3C", "IFRS9-5-7-1"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "BondMaturedV2",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: bondMaturedV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3C", "IFRS9-3-2-3"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
  {
    type: "BondSoldV2",
    class: "markets",
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Helena", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: bondSoldV2PayloadSchema,
    citationsHint: ["D-V1-REMOVAL-PHASE-3C", "IFRS9-3-2-3"],
    source: SOURCE,
    v2Status: "v2-parallel",
  },
];
