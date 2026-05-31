// runtime/agents/metadata/helena.ts
// Per-agent handler metadata for Helena (Chief Risk Officer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const HELENA_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Helena", "risk-appetite-watch", "scheduled", {
    cadenceHours: 24,
    cronExpression: "30 4 * * *",
  }),
  // helena:goal-loop — daily 04:47 UTC; autonomous promotion (risk/treasury pilot),
  // placed after helena:risk-appetite-watch (04:30) so a same-day RiskAppetiteSnapshot exists.
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3; D-AGENT-AUTONOMY-RISK-TREASURY-PILOT.
  entry("Helena", "goal-loop", "scheduled", {
    cadenceHours: 24,
    cronExpression: "47 4 * * *",
  }),
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
