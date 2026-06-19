// platform/event-store/registry/v2-fx-gateway.ts
//
// V1-side F-032 registry row for the V2-NATIVE FX pre-trade gateway-rejection
// event (`V2FxOrderRejectedAtGateway`) — WS-FX-OTC-CLOSURE FU3.
//
// The event type lives in `v2-core/fx-gateway/events.ts` (the v2 package); the
// registry entry lives here (v1-side infra) for the same reason as
// `v2-control-plane.ts` / `v2-banking.ts`:
//   a) The registry infrastructure (`EventTypeMetadata`, retention constants)
//      is v1 code — the v2 package must not import it (no-v1-import boundary).
//   b) The v1 event store's `validatePayload()` and the
//      `recon:event-type-registry-coverage` gate operate over these rows, so a
//      V2-native type still registers here to stay audit-checkable.
//
// The Zod schema is imported FROM the v2 package (permitted direction: v1→v2).
//
// This event is emitted ONLY into the V2 control-plane store (the V2/FIL world)
// — it NEVER touches the v1 canonical store. The V1 gateway pipeline keeps
// emitting its own `OrderRejectedAtGateway`; the V1→V2 emitter cutover is the
// tracked substrate gap (FU3 PR body).
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG (CEO scope-extension 2026-06-19);
//   D-BANK-WIDE-V2-MIGRATION.
// Author: Atlas (Core banking platform architect, engineering).

import type { z } from "zod";

import { v2FxOrderRejectedAtGatewayPayloadSchema } from "../../../v2-core/fx-gateway/events";
import { RETENTION_JSE_TRADE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

export const V2_FX_GATEWAY_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "V2FxOrderRejectedAtGateway",
    class: "markets",
    // Issuer: the pre-trade gateway aggregator (a service actor, not a persona).
    // The V1 cousin's issuer is Kai's aggregator; the V2-native emitter (when it
    // ships) is the same gateway seat. Named here by the engineering seat that
    // owns the substrate row.
    issuer: "Kai",
    subscribers: ["Saskia", "Mira", "Rohan", "Vera", "dashboard"],
    replay: "append-only-audit",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: v2FxOrderRejectedAtGatewayPayloadSchema as unknown as z.ZodType<
      Record<string, unknown>
    >,
    citationsHint: ["JSE-RULES-EQUITIES", "FMA-S5", "D-FX-OTC-CLOSURE-BACKLOG"],
    source: "v2-core/fx-gateway/events.ts — V2FxOrderRejectedAtGateway",
    v2Status: "v2-parallel",
  },
];
