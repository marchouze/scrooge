// runtime/agents/metadata/sade.ts
// Per-agent handler metadata for Sade (AgentOps & Token Efficiency Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../handlers-metadata";
import { entry } from "./_entry";

export const SADE_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Sade", "agentops-readiness", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "41 7 * * 5",
  }),
  // Daily full-fleet token analysis.
  entry("Sade", "token-usage-analysis", "scheduled", {
    cadenceHours: 24,
    cronExpression: "0 5 * * *",
  }),
  // Efficiency advisory — fires on every AgentRun completion.
  entry("Sade", "efficiency-advisory", "event-driven", {
    subscribesTo: ["AgentRunCompleted", "TokenUsageRecorded"],
  }),
  // Daily fleet prompt/mandate optimisation cycle.
  entry("Sade", "fleet-optimisation", "scheduled", {
    cadenceHours: 24,
    cronExpression: "30 5 * * *",
  }),
  entry("Sade", "event-triage", "event-driven", {
    subscribesTo: [
      "AgentRegistered",
      "AgentRetired",
      "AgentCapabilityChanged",
      "PersonaSpecChanged",
      "HireConfirmed",
      "Termination",
      "LeaveGranted",
      "DisciplinaryActionRequested",
    ],
  }),
];
