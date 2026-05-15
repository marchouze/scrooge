// runtime/agents/metadata/niko.ts
// Per-agent handler metadata for Niko (Client Lifecycle Engineer — paused until licence-day).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const NIKO_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Niko", "event-triage", "event-driven", {
    subscribesTo: [
      "LeadCaptured",
      "SuitabilityAssessmentRequired",
      "AdviceRecordRequested",
      "OnboardingHandoffPending",
      "ConsentWithdrawn",
    ],
  }),
  // Niko — scheduled client-lifecycle cycle.
  entry("Niko", "client-lifecycle", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "23 8 * * MON",
  }),
];
