// runtime/agents/metadata/iris.ts
// Per-agent handler metadata for Iris (POPIA / Privacy Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../handlers-metadata";
import { entry } from "./_entry";

export const IRIS_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Iris", "popia-controls-snapshot", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "51 7 * * 3",
  }),
  // iris:goal-loop — cohort-3 (on-request only).
  entry("Iris", "goal-loop", "on-request"),
  entry("Iris", "event-triage", "event-driven", {
    subscribesTo: [
      "PersonalInformationCompromiseSuspected",
      "DSARReceived",
      "NewProcessingPurposeProposed",
      "ConsentWithdrawn",
      "CrossBorderTransferRequested",
      "InformationRegulatorInquiry",
      "AgentEscalation",
    ],
  }),
];
