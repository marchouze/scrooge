// runtime/agents/metadata/nolan.ts
// Per-agent handler metadata for Nolan (HR / Hiring Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const NOLAN_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Nolan", "event-triage", "event-driven", {
    subscribesTo: ["RoleBriefDelivered", "MandateGapDetected", "WorkstreamRegistered"],
  }),
  // Nolan — scheduled hiring-cycle.
  entry("Nolan", "hiring-cycle", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "53 8 * * FRI",
  }),
];
