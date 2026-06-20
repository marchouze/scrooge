// platform/event-store/registry/margin-call-response.ts
//
// F-032 typed registry row for the margin-call response event family
// (WS-FX-V2-SIMULATOR Phase 2, M8). The OUTSIDE WORLD's response to a bank
// margin call — an external-party fact the simulator emits (scenario-confined,
// `simulated` provenance). NOT a production read path.
//
// Born V2 (v2-parallel) — never v1-only (D-V1-REMOVAL-PHASE-1).
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20); ISDA CSA.
// Author: Atlas (Core banking platform architect, engineering).

import { marginCallRespondedPayloadSchema } from "../event-types/margin-call-response";
import { type EventTypeMetadata, RETENTION_BANKING_5Y } from "./types";

const SOURCE = "platform/event-store/event-types/margin-call-response.ts";
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST"];

export const MARGIN_CALL_RESPONSE_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "MarginCallResponded",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Rohan", "Tomas", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: marginCallRespondedPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    v2Status: "v2-parallel",
  },
];
