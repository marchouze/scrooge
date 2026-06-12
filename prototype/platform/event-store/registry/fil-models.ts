// platform/event-store/registry/fil-models.ts
//
// Registry row for the V2 S0 FIL-Models declaration event family:
//   - FilModelImplementationDeclared — declares a FIL-Model: a versioned,
//     citable implementation of one or more FIL facets over a taxonomy scope
//     (D-FIL-FRAMEWORK-UNIFICATION §2/§3).
//
// The FIL-Models register is a projection over these events
// (`v2-core/fil-models/registry.ts`, folded by `recon:fil-conformance`).
// LATEST declaration per (modelId, facet, scope, version) wins (P1).
//
// S0: registered but EMPTY — no declaration is emitted until S7-FIL lands the
// SA-CCR first entry. No live-bus subscriber here (brief §"Out of scope").
//
// Author: Atlas (Core banking platform architect, engineering).

import type { z } from "zod";
import { filModelImplementationDeclaredPayloadSchema } from "../event-types/fil-models";
import { RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const CITATIONS = [
  "D-FIL-FRAMEWORK-UNIFICATION",
  "D-MODEL-BINDING-CONTRACT-V1",
  "D-V2-REPO-STRATEGY-REEXAMINATION",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
] as const;

export const FIL_MODELS_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "FilModelImplementationDeclared",
    class: "governance",
    issuer: "Atlas",
    subscribers: ["Atlas", "Rohan", "Nadia", "Vera", "Scrooge"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: filModelImplementationDeclaredPayloadSchema as unknown as z.ZodType<
      Record<string, unknown>
    >,
    citationsHint: CITATIONS,
    source: "platform/event-store/event-types/fil-models.ts",
  },
];
