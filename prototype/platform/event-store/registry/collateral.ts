// platform/event-store/registry/collateral.ts
//
// Collateral inventory event-type registry rows.
//
// Covers:
//   CollateralInventorySnapshot — daily HQLA buffer snapshot with cap checks.
//   CollateralUpdated           — per-security inventory change (add/remove/revalue).
//
// Retention classification:
//   - CollateralInventorySnapshot → RETENTION_BANKING_5Y
//     (prudential record; regulatory LCR measurement once trading commences)
//   - CollateralUpdated → RETENTION_BANKING_5Y
//     (position-level audit trail required for BA 325 compliance)
//
// Authority: BA 325 Annex 1; Banks Act Reg 26; D-TREASURY-GAPS-WAVE1.
// Author: Atlas (Core banking platform architect, engineering)

import {
  collateralInventorySnapshotPayloadSchema,
  collateralUpdatedPayloadSchema,
} from "../event-types/collateral";
import { RETENTION_BANKING_5Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * Collateral inventory event-type registry rows.
 *
 * Subscribers:
 *   Eitan (Treasurer, governance) — HQLA buffer measurement for ALCO.
 *   Ravi (Treasury/ALM Engineer, engineering) — ALM-readiness pipeline tracking.
 *   Helena (Chief Risk Officer, governance) — LCR / NSFR risk appetite inputs.
 *   Atlas (platform) — substrate monitoring.
 */
export const COLLATERAL_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "CollateralInventorySnapshot",
    class: "markets",
    issuer: "Atlas",
    subscribers: ["Eitan", "Ravi", "Helena", "Atlas"],
    replay: "latest-wins-per-key",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: collateralInventorySnapshotPayloadSchema,
    citationsHint: ["BA-325-ANNEX-1", "BANKS-REG-26", "D-TREASURY-GAPS-WAVE1"],
    source: "platform/event-store/event-types/collateral.ts",
  },
  {
    type: "CollateralUpdated",
    class: "markets",
    issuer: "Atlas",
    subscribers: ["Eitan", "Ravi", "Helena", "Atlas"],
    replay: "append",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: collateralUpdatedPayloadSchema,
    citationsHint: ["BA-325-ANNEX-1", "BANKS-REG-26", "D-TREASURY-GAPS-WAVE1"],
    source: "platform/event-store/event-types/collateral.ts",
  },
];
