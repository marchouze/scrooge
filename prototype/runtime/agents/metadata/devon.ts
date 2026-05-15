// runtime/agents/metadata/devon.ts
// Per-agent handler metadata for Devon (Operational Resilience Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const DEVON_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Devon", "operational-resilience-snapshot", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "23 5 * * MON",
  }),
  // devon:goal-loop — cohort-3 (on-request only).
  entry("Devon", "goal-loop", "on-request"),
  entry("Devon", "event-triage", "event-driven", {
    subscribesTo: [
      "IncidentRaised",
      "SLOBudgetBurn",
      "CapacityBreach",
      "ChangeApprovalRequested",
      "AgentEscalation",
      "ResilienceTestResult",
      "AuditFinding",
    ],
  }),
];
