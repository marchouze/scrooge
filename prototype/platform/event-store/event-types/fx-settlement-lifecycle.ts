// platform/event-store/event-types/fx-settlement-lifecycle.ts
//
// FX settlement-lifecycle event family (WS-FX-V2-SIMULATOR, M5). These model the
// OUTSIDE world's settlement behaviour for an affirmed FX trade — the
// correspondent/counterparty acting on a settlement instruction the bank issued:
//
//   FxSimSettlementInstructed  — the bank issued the settlement instruction (the
//                             counterparty's view of receipt — an external fact)
//   FxSimSettlementFailed      — the counterparty/correspondent failed to settle a
//                             leg (+ reason); drives the SUT retry branch
//   FxSimSettlementConfirmed   — both legs settled at the correspondent (external
//                             confirmation the bank's nostro reconciliation reads)
//
// They are external-party events the simulator emits, gated by a counterparty
// behaviour profile (reliable / slow / occasional-fail / unreliable). The bank's
// own settlement actions — materialising the settled cash leg as a `fil:type:cash`
// instrument-of-record, nostro reconciliation — are SUT-internal and live outside
// this family (see platform/markets/settlement/settle-fx-leg.ts).
//
// Distinct from the V1 `SettlementConfirmed` / `SettlementFailed` family (used by
// the legacy post-trade lifecycle): these are FX-V2-simulator-confined, born V2,
// carry `simulated` provenance, and never enter the production read path. Naming
// is prefixed `Fx…` to avoid colliding with the V1 family in the registry.
//
// Born V2 (D-V1-REMOVAL-PHASE-1) — never v1-only. THREE-SITE REGISTRATION
// (F-032): event-types (this file) → registry → provenance-category.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   D-CASH-ASSET-CLASS-V1 (settled cash leg materialises as fil:type:cash).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const fxSimSettlementInstructedPayloadSchema = z.object({
  tradeId: z.string().min(1),
  counterpartyId: z.string().min(1),
  /** Settlement date the instruction targets (YYYY-MM-DD). */
  settlementDate: z.string().min(1),
  /** Settlement channel (SWIFT MT202/MT300 in a real flow). */
  channel: z.literal("MT202"),
});
export type FxSimSettlementInstructedPayload = z.infer<
  typeof fxSimSettlementInstructedPayloadSchema
>;

export const fxSimSettlementFailedPayloadSchema = fxSimSettlementInstructedPayloadSchema.extend({
  reason: z.string().min(1),
  /** Retry attempt index this failure occurred on (0-based). */
  attempt: z.number().int().min(0),
});
export type FxSimSettlementFailedPayload = z.infer<typeof fxSimSettlementFailedPayloadSchema>;

export const fxSimSettlementConfirmedPayloadSchema = fxSimSettlementInstructedPayloadSchema.extend({
  /** Retry attempt index that finally settled (0-based; 0 = first try). */
  attempt: z.number().int().min(0),
  /** The PAID (delivered) leg — bank's outflow. */
  payCurrency: z.string().min(1),
  payAmountMajor: z.number(),
  /** The RECEIVED leg — bank's inflow. */
  receiveCurrency: z.string().min(1),
  receiveAmountMajor: z.number(),
});
export type FxSimSettlementConfirmedPayload = z.infer<
  typeof fxSimSettlementConfirmedPayloadSchema
>;

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function makeFxSimSettlementInstructed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FxSimSettlementInstructedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FxSimSettlementInstructed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fxSimSettlementInstructedPayloadSchema.parse(args.payload),
    ...(args.provenance !== undefined ? { provenance: args.provenance } : {}),
  });
}

export function makeFxSimSettlementFailed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FxSimSettlementFailedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FxSimSettlementFailed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fxSimSettlementFailedPayloadSchema.parse(args.payload),
    ...(args.provenance !== undefined ? { provenance: args.provenance } : {}),
  });
}

export function makeFxSimSettlementConfirmed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: FxSimSettlementConfirmedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "FxSimSettlementConfirmed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: fxSimSettlementConfirmedPayloadSchema.parse(args.payload),
    ...(args.provenance !== undefined ? { provenance: args.provenance } : {}),
  });
}

export const FX_SIM_SETTLEMENT_LIFECYCLE_EVENT_TYPES = [
  "FxSimSettlementInstructed",
  "FxSimSettlementFailed",
  "FxSimSettlementConfirmed",
] as const;
export type FxSimSettlementLifecycleEventType =
  (typeof FX_SIM_SETTLEMENT_LIFECYCLE_EVENT_TYPES)[number];
