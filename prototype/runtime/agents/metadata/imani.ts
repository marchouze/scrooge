// runtime/agents/metadata/imani.ts
// Per-agent handler metadata for Imani (Legal / ISDA / Contract Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../handlers-metadata";
import { entry } from "./_entry";

export const IMANI_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Imani", "legal-readiness", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "9 7 * * 5",
  }),
  // imani:goal-loop — cohort-3 (on-request only).
  entry("Imani", "goal-loop", "on-request"),
  entry("Imani", "event-triage", "event-driven", {
    subscribesTo: [
      "ContractDraftRequested",
      "ClauseChangeProposed",
      "SignatureRequested",
      "ECTAExceptionFlagged",
      "LegalEntityChange",
      "ObligationRegistered",
    ],
  }),
];
