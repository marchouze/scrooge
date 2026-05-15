// runtime/agents/metadata/eitan.ts
// Per-agent handler metadata for Eitan (Liquidity / Capital Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const EITAN_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Eitan", "liquidity-snapshot", "scheduled", {
    cadenceHours: 24,
    cronExpression: "53 6 * * *",
  }),
  // eitan:goal-loop — cohort-3 (on-request only).
  entry("Eitan", "goal-loop", "on-request"),
  entry("Eitan", "event-triage", "event-driven", {
    subscribesTo: [
      "IRRBBExcursion",
      "FXPositionBreach",
      "LCRRatioProjection",
      "NSFRRatioProjection",
      "CapitalActionTrigger",
      "AgentEscalation",
      "PolicyChange",
    ],
  }),
];
