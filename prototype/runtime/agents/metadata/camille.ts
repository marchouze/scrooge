// runtime/agents/metadata/camille.ts
// Per-agent handler metadata for Camille (CFO / Financial Controller).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../handlers-metadata";
import { entry } from "./_entry";

export const CAMILLE_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Camille", "financial-position-snapshot", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "41 6 * * MON",
  }),
  // camille:goal-loop — cohort-3 (on-request only).
  entry("Camille", "goal-loop", "on-request"),
  entry("Camille", "event-triage", "event-driven", {
    subscribesTo: [
      "RestatementProposed",
      "CapitalEvent",
      "MaterialIFRSClassificationChange",
      "AgentEscalation",
      "AuditFinding",
      "RegulatorRequest",
    ],
  }),
];
