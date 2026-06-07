// platform/event-store/event-types/collateral.ts
//
// Collateral inventory event-payload schemas.
//
// Covers:
//   CollateralInventorySnapshotted — daily snapshot of the HQLA buffer
//     position, cap check results, and aggregate totals.
//
// Note: `CollateralUpdated` is already defined in `markets-trading-extended.ts`
// (markets/margin schema). The Ravi ALM readiness handler references
// `CollateralUpdated` as a zero-count event type via that existing definition.
//
// Authority: BA 110 Annex 1; Banks Act Reg 26 (LCR); D-TREASURY-GAPS-WAVE1.
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// CollateralInventorySnapshotted
// ---------------------------------------------------------------------------

export const collateralInventorySnapshotPayloadSchema = z.object({
  snapshotId: z.string().min(1),
  asOf: z.string().min(1),
  totalHQLAZar: z.number().nonnegative(),
  l1Zar: z.number().nonnegative(),
  l2aZar: z.number().nonnegative(),
  l2bZar: z.number().nonnegative(),
  l2CapBreached: z.boolean(),
  l2bCapBreached: z.boolean(),
  securityCount: z.number().int().nonnegative(),
  currency: z.string().min(3).max(3),
});

export type CollateralInventorySnapshotPayload = z.infer<
  typeof collateralInventorySnapshotPayloadSchema
>;

export function makeCollateralInventorySnapshotted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CollateralInventorySnapshotPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CollateralInventorySnapshotted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: collateralInventorySnapshotPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const COLLATERAL_TYPED_EVENT_TYPES = ["CollateralInventorySnapshotted"] as const;
