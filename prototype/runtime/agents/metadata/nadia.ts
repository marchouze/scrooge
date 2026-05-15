// runtime/agents/metadata/nadia.ts
// Per-agent handler metadata for Nadia (Model Validation Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../handlers-metadata";
import { entry } from "./_entry";

export const NADIA_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Nadia", "event-triage", "event-driven", {
    subscribesTo: [
      "ModelRegistered",
      "ProductionUseRequested",
      "MethodologyChangeRequested",
      "BacktestTriggered",
      "ModelDriftDetected",
      "ValidationFindingRaised",
      "RiskPolicyChange",
    ],
  }),
  // Nadia — scheduled validation-cycle.
  entry("Nadia", "validation-cycle", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "17 7 * * THU",
  }),
];
