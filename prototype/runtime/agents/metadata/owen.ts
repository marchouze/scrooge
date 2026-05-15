// runtime/agents/metadata/owen.ts
// Per-agent handler metadata for Owen (Company Secretary / Governance).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const OWEN_HANDLER_METADATA: readonly HandlerMetadata[] = [
  // owen:goal-loop — daily 07:00 UTC; cohort-1 activation per D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  entry("Owen", "goal-loop", "scheduled", {
    cadenceHours: 24,
    cronExpression: "0 7 * * *",
  }),
  entry("Owen", "governance-cycle-prep", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "31 7 * * 2",
  }),
  entry("Owen", "event-triage", "event-driven", {
    subscribesTo: [
      "ResolutionRequired",
      "ConflictDeclared",
      "RelatedPartyTransactionProposed",
      "WhistleblowingDisclosure",
      "PAIARequest",
      "MOIChangeProposed",
      "SupervisoryLetterReceived",
      "AgentEscalation",
    ],
  }),
];
