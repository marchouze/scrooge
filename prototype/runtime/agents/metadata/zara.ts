// runtime/agents/metadata/zara.ts
// Per-agent handler metadata for Zara (MLRO / FIC Compliance Officer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../handlers-metadata";
import { entry } from "./_entry";

export const ZARA_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Zara", "mlro-supervision", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "30 5 * * MON",
  }),
  // zara:goal-loop — cohort-3 (on-request only).
  entry("Zara", "goal-loop", "on-request"),
  entry("Zara", "event-triage", "event-driven", {
    subscribesTo: [
      "STRCandidate",
      "SanctionsHit",
      "PEPMatchExceedsThreshold",
      "FAISConductBreachSuspected",
      "RegulatorInquiry",
      "PolicyChange",
      "AgentEscalation",
    ],
  }),
];
