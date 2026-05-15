// platform/event-store/registry/intranet.ts
//
// Event-type registry rows for intranet operations.
//
// Covers:
//   - IntranetFeatureShipped  — a new intranet feature has been shipped
//   - DesignReviewComplete    — a design review outcome has been recorded
//   - UXFindingRaised         — a UX finding has been raised
//
// Authority: Principle 1 — events-first authoring per CLAUDE.md
//   §"Events-first authoring". Every significant intranet state change
//   lands as a typed event before any other record.
//
// Author: Noa (Intranet Product Owner & UI Architect, reporting to CEO)

import {
  designReviewCompletePayloadSchema,
  intranetFeatureShippedPayloadSchema,
  uxFindingRaisedPayloadSchema,
} from "../event-types/intranet";
import { type EventTypeMetadata, RETENTION_GOVERNANCE_7Y } from "./types";

export const INTRANET_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "IntranetFeatureShipped",
    class: "governance",
    payloadSchema: intranetFeatureShippedPayloadSchema,
    issuer: "Noa",
    subscribers: ["Noa", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["P1-EVENTS-AS-TRUTH"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "prototype/platform/event-store/event-types/intranet.ts",
  },
  {
    type: "DesignReviewComplete",
    class: "governance",
    payloadSchema: designReviewCompletePayloadSchema,
    issuer: "Noa",
    subscribers: ["Noa", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["P1-EVENTS-AS-TRUTH"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "prototype/platform/event-store/event-types/intranet.ts",
  },
  {
    type: "UXFindingRaised",
    class: "governance",
    payloadSchema: uxFindingRaisedPayloadSchema,
    issuer: "Noa",
    subscribers: ["Noa", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["P1-EVENTS-AS-TRUTH"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "prototype/platform/event-store/event-types/intranet.ts",
  },
];
