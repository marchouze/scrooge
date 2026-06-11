// platform/event-store/registry/obligation-lifecycle.ts
//
// Registry rows for the bank-obligation lifecycle event family (Plane B,
// D-REGULATORY-ARCHITECTURE-TWO-PLANE):
//   - ObligationAdopted — the bank decides to be bound by an obligation.
//   - ObligationLifecycleTransitioned — a downstream lifecycle step.
//
// The ORG-* obligations register is a projection over these events
// (platform/obligations/projection.ts).
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import {
  obligationAdoptedPayloadSchema,
  obligationLifecycleTransitionedPayloadSchema,
  provisionScopeAdoptedPayloadSchema,
} from "../event-types/obligation-lifecycle";
import { RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const CITATIONS = [
  "D-REGULATORY-ARCHITECTURE-TWO-PLANE",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
] as const;

const SUBSCRIBERS = ["Mira", "Owen", "Zara", "Vera", "Atlas"] as const;

export const OBLIGATION_LIFECYCLE_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "ObligationAdopted",
    class: "governance",
    issuer: "Mira",
    subscribers: SUBSCRIBERS,
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: obligationAdoptedPayloadSchema,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/obligation-lifecycle.ts",
  },
  {
    type: "ObligationLifecycleTransitioned",
    class: "governance",
    issuer: "any-agent",
    subscribers: SUBSCRIBERS,
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: obligationLifecycleTransitionedPayloadSchema,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/obligation-lifecycle.ts",
  },
  {
    type: "ProvisionScopeAdopted",
    class: "governance",
    issuer: "Mira",
    subscribers: SUBSCRIBERS,
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: provisionScopeAdoptedPayloadSchema,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/obligation-lifecycle.ts",
  },
];
