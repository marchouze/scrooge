// platform/event-store/event-types/v2-fx-gateway.ts
//
// V1-SIDE event-type factory for the V2-native FX pre-trade gateway-rejection
// event (`V2FxOrderRejectedAtGateway`) — WS-FX-OTC-CLOSURE FU3.
//
// This file lives on the V1 side and IMPORTS the canonical payload schema FROM
// v2-core (the permitted dependency direction v1→v2; v2-core never imports
// back, enforced by `recon:v2-no-v1-import`). It provides the `make<Type>`
// factory the F-032 registry-coverage gate expects, mirroring the established
// `v2-control-plane.ts` / `v2-banking.ts` pattern for V2-native types.
//
// The event is stored in the V2 control-plane store (a separate SQLite DB), not
// the main V1 event store. The factory produces an `Event`-shaped record
// conforming to the envelope so v1 tooling can construct + validate the payload
// before it is mirrored into the V2 store as a `CpEvent` (a strict subset of
// `Event`). No V2 emitter ships yet — the V1 gateway aggregator still emits its
// own `OrderRejectedAtGateway`; the V1→V2 emitter cutover is the tracked
// substrate gap (FU3 PR body). This factory is the construction contract that
// cutover will use.
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG (CEO scope-extension 2026-06-19);
//   D-BANK-WIDE-V2-MIGRATION.
// Author: Atlas (Core banking platform architect, engineering).

import {
  type V2FxOrderRejectedAtGatewayPayload,
  v2FxOrderRejectedAtGatewayPayloadSchema,
} from "../../../v2-core/fx-gateway/events";
import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// Re-export the payload type + schema for v1-side consumers.
export type { V2FxOrderRejectedAtGatewayPayload };
export { v2FxOrderRejectedAtGatewayPayloadSchema };

/**
 * Build a validated `V2FxOrderRejectedAtGateway` event envelope. The payload is
 * parsed against the v2-core schema (fail-closed on a malformed payload). The
 * `kind` discriminator on the payload and the `type` literal agree by
 * construction.
 */
export function makeV2FxOrderRejectedAtGateway(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: V2FxOrderRejectedAtGatewayPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "V2FxOrderRejectedAtGateway",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: v2FxOrderRejectedAtGatewayPayloadSchema.parse(args.payload),
  });
}
