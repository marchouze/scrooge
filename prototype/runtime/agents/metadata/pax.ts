// runtime/agents/metadata/pax.ts
// Per-agent handler metadata for PAX (Research Assistant).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../handlers-metadata";
import { entry } from "./_entry";

export const PAX_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("PAX", "role-research-queue", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "11 8 * * 5",
  }),
  entry("PAX", "event-triage", "event-driven", {
    subscribesTo: ["RoleResearchRequested", "MandateGapDetected", "AgentEscalation"],
  }),
];
