// platform/event-store/registry/external-credit-rating.ts
//
// F-032 typed registry row for the external credit-rating feed event family
// (WS-FX-V2-SIMULATOR Phase 2, M6). The OUTSIDE WORLD's rating-agency feed — an
// external-party fact the simulator emits (scenario-confined, `simulated`
// provenance); the SUT maps it to a Basel class. NOT a production read path.
//
// Born V2 (v2-parallel) — never v1-only (D-V1-REMOVAL-PHASE-1).
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20). BCBS CRE20.
// Author: Atlas (Core banking platform architect, engineering).

import { externalCreditRatingReceivedPayloadSchema } from "../event-types/external-credit-rating";
import { type EventTypeMetadata, RETENTION_BANKING_5Y } from "./types";

const SOURCE = "platform/event-store/event-types/external-credit-rating.ts";
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST"];

export const EXTERNAL_CREDIT_RATING_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "ExternalCreditRatingReceived",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Rohan", "Helena", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: externalCreditRatingReceivedPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    v2Status: "v2-parallel",
  },
];
