// platform/event-store/registry/seed-management.ts
//
// Seed-management event-type registry rows (objective 1 of
// D-TRUSTED-FIGURES-PROGRAM-V1). Covers SeedDescoped + SeedPromotedToSimulated,
// the two operator/agent decisions that make the boot-seed layer controllable
// from the UI. Both are governance-grade decisions about what the build-phase
// event store contains, so they carry 7y governance retention.
//
// Author: Atlas (Core banking platform architect, engineering).

import { seedDescopedPayloadSchema, seedPromotedToSimulatedPayloadSchema } from "../event-types";
import { type EventTypeMetadata, RETENTION_GOVERNANCE_7Y } from "./types";

export const SEED_MANAGEMENT_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "SeedDescoped",
    class: "governance",
    payloadSchema: seedDescopedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Atlas", "Vera"],
    replay: "append-only-audit",
    citationsHint: ["D-TRUSTED-FIGURES-PROGRAM-V1"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "seeds/manifest.ts; platform/event-store/event-types/seed-management.ts",
  },
  {
    type: "SeedPromotedToSimulated",
    class: "governance",
    payloadSchema: seedPromotedToSimulatedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Atlas", "Vera"],
    replay: "append-only-audit",
    citationsHint: ["D-TRUSTED-FIGURES-PROGRAM-V1"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "seeds/manifest.ts; platform/event-store/event-types/seed-management.ts",
  },
];
