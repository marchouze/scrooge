// platform/event-store/registry/margin-collateral.ts
//
// F-032 typed registry rows for the SUT-internal margin-call + collateral family
// (WS-FX-V2-SIMULATOR Phase 2, M8). The bank's own variation-margin acts:
// issuing calls, recording posted/returned collateral, closing calls. SUT-
// internal — NOT simulator emissions.
//
// Born V2 (v2-parallel) — never v1-only (D-V1-REMOVAL-PHASE-1).
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20); ISDA CSA; BCBS d317.
// Author: Atlas (Core banking platform architect, engineering).

import {
  collateralPostedPayloadSchema,
  collateralReturnedPayloadSchema,
  marginCallIssuedPayloadSchema,
  marginCallSettledPayloadSchema,
} from "../event-types/margin-collateral";
import { type EventTypeMetadata, RETENTION_BANKING_5Y } from "./types";

const SOURCE = "platform/event-store/event-types/margin-collateral.ts";
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST"];

export const MARGIN_COLLATERAL_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "MarginCallIssued",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Rohan", "Tomas", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: marginCallIssuedPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    v2Status: "v2-parallel",
  },
  {
    type: "CollateralPosted",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Rohan", "Bea", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: collateralPostedPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    v2Status: "v2-parallel",
  },
  {
    type: "CollateralReturned",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Rohan", "Bea", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: collateralReturnedPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    v2Status: "v2-parallel",
  },
  {
    type: "MarginCallSettled",
    class: "markets",
    issuer: "substrate",
    subscribers: ["Rohan", "Tomas", "Vera"],
    replay: "append-only-audit",
    retention: RETENTION_BANKING_5Y,
    payloadSchema: marginCallSettledPayloadSchema,
    source: SOURCE,
    citationsHint: CITATIONS,
    v2Status: "v2-parallel",
  },
];
