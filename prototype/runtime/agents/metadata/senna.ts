// runtime/agents/metadata/senna.ts
// Per-agent handler metadata for Senna (DevSecOps / Security Substrate Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const SENNA_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Senna", "security-substrate-state", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "37 7 * * 4",
  }),
  // senna:goal-loop — cohort-3 (on-request only).
  entry("Senna", "goal-loop", "on-request"),
  // M1 — Senna's trading-stack threat-model handler.
  entry("Senna", "m1-trading-stack-threat-model", "event-driven", {
    subscribesTo: ["CeoDecision"],
  }),
  entry("Senna", "event-triage", "event-driven", {
    subscribesTo: [
      "MergeRequested",
      "SecurityIncidentRaised",
      "KeyRotationDue",
      "DependencyVulnDetected",
      "SuspiciousAuthEvent",
      "SBOMRequired",
    ],
  }),
];
