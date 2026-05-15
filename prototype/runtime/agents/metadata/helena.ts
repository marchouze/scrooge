// runtime/agents/metadata/helena.ts
// Per-agent handler metadata for Helena (Chief Risk Officer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../handlers-metadata";
import { entry } from "./_entry";

export const HELENA_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Helena", "risk-appetite-watch", "scheduled", {
    cadenceHours: 24,
    cronExpression: "30 4 * * *",
  }),
  // helena:goal-loop — no cron; shadow mode for first cohort ticks (on-request only).
  // Cohort-3 agent. Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  entry("Helena", "goal-loop", "on-request"),
  entry("Helena", "event-triage", "event-driven", {
    subscribesTo: [
      "AppetiteBreach",
      "ModelRiskDecisionRequired",
      "SupervisoryLetterReceived",
      "IcaapIlaapInputReady",
      "RiskPolicyChangeProposal",
    ],
  }),
];
