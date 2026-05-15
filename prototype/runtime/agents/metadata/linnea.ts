// runtime/agents/metadata/linnea.ts
// Per-agent handler metadata for Linnea (COO / Operations Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const LINNEA_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Linnea", "event-triage", "event-driven", {
    subscribesTo: ["CeoDecision", "WorkstreamRegistered", "AgentEscalation"],
  }),
  // Linnea — scheduled ops-cycle.
  entry("Linnea", "ops-cycle", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "29 8 * * TUE",
  }),
];
