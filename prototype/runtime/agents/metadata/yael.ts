// runtime/agents/metadata/yael.ts
// Per-agent handler metadata for Yael (Tax Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const YAEL_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Yael", "tax-readiness", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "7 6 * * THU",
  }),
  entry("Yael", "event-triage", "event-driven", {
    subscribesTo: [
      "SARSGuidanceUpdate",
      "IFRS9ECLChange",
      "InterEntityTransactionProposed",
      "ClientCandidateRegistered",
      "ClientReviewTriggered",
    ],
  }),
];
