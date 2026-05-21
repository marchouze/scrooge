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
  // FX market-data ingest handlers — kept as on-request callables so
  // `bun run agent:devon-fx-rates-ingest` etc. still work for ad-hoc
  // invocation and testing. Scheduled cadence is owned by the
  // **standalone launchd plists** (com.scrooge.fx-rates-ingest,
  // com.scrooge.fx-twelvedata-ingest) which were already the local
  // convention before this handler was added — making these `scheduled`
  // in the scheduler-tick cron map would double-fire.
  entry("Devon", "fx-rates-ingest", "on-request"),
  entry("Devon", "fx-twelvedata-ingest", "on-request"),
];
