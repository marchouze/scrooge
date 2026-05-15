// runtime/agents/metadata/rashida.ts
// Per-agent handler metadata for Rashida (CISO / Cyber Resilience).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const RASHIDA_HANDLER_METADATA: readonly HandlerMetadata[] = [
  // rashida:goal-loop — cohort-3 (on-request only).
  entry("Rashida", "goal-loop", "on-request"),
  entry("Rashida", "cyber-resilience-snapshot", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "49 7 * * 4",
  }),
  entry("Rashida", "event-triage", "event-driven", {
    subscribesTo: [
      "SecurityIncidentRaised",
      "ThreatModelExceptionRequested",
      "ThreatModelGateDecision",
      "KeyCeremonyScheduled",
      "SBOMAcceptanceRequired",
      "VendorSecurityReview",
      "RegulatorCyberInquiry",
      "PersonalInformationCompromiseSuspected",
      "AgentEscalation",
    ],
  }),
];
