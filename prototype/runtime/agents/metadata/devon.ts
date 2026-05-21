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
  // FX market-data ingest — daily (open-er-api updates ~00:00 UTC; fire at 02:00 UTC).
  entry("Devon", "fx-rates-ingest", "scheduled", {
    cadenceHours: 24,
    cronExpression: "0 2 * * *",
  }),
  // FX market-data ingest — hourly (Twelve Data free tier; offset minute 5).
  entry("Devon", "fx-twelvedata-ingest", "scheduled", {
    cadenceHours: 1,
    cronExpression: "5 * * * *",
  }),
];
