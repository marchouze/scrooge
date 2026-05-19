// platform/event-store/event-types/collateral.ts
//
// Collateral inventory event-payload schemas.
//
// Covers:
//   CollateralInventorySnapshot — daily snapshot of the HQLA buffer position,
//     cap check results, and aggregate totals.
//   CollateralUpdated — per-security inventory change event (add/remove/revalue).
//
// Note: `CollateralUpdated` is referenced in `runtime/agents/ravi-alm-readiness.ts`
// as a zero-count event type — this file provides the typed schema registration.
//
// Authority: BA 325 Annex 1; Banks Act Reg 26 (LCR); D-TREASURY-GAPS-WAVE1.
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// CollateralInventorySnapshot
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

export function makeCollateralInventorySnapshot(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CollateralInventorySnapshotPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CollateralInventorySnapshot",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: collateralInventorySnapshotPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// CollateralUpdated
// ---------------------------------------------------------------------------

export const collateralUpdatedPayloadSchema = z.object({
  updateId: z.string().min(1),
  asOf: z.string().min(1),
  isin: z.string().min(1),
  updateKind: z.enum(["added", "removed", "revalued"]),
  marketValueZar: z.number().nonnegative(),
  hqlaLevel: z.enum(["L1", "L2a", "L2b", "non-HQLA"]),
  haircut: z.number().min(0).max(1),
  currency: z.string().min(3).max(3),
});

export type CollateralUpdatedPayload = z.infer<typeof collateralUpdatedPayloadSchema>;

export function makeCollateralUpdated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CollateralUpdatedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CollateralUpdated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: collateralUpdatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const COLLATERAL_TYPED_EVENT_TYPES = [
  "CollateralInventorySnapshot",
  "CollateralUpdated",
] as const;
