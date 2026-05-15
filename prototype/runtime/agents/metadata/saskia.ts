// runtime/agents/metadata/saskia.ts
// Per-agent handler metadata for Saskia (Head of Global Markets).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../handlers-metadata";
import { entry } from "./_entry";

export const SASKIA_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Saskia", "markets-readiness-snapshot", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "33 5 * * MON",
  }),
  // saskia:goal-loop — cohort-3 (on-request only).
  entry("Saskia", "goal-loop", "on-request"),
  entry("Saskia", "event-triage", "event-driven", {
    subscribesTo: [
      "DealerMandateBreach",
      "SurveillanceAlert",
      "CurveSourceAnomaly",
      "CounterpartyEvent",
      "RASCalibrationChange",
      "LicenceGranted",
      "CEODecision",
      "AgentEscalation",
    ],
  }),
];
