// runtime/agents/metadata/scrooge.ts
// Per-agent handler metadata for Scrooge (Chief of Staff / Orchestrator).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../handlers-metadata";
import { entry } from "./_entry";

export const SCROOGE_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Scrooge", "inbox-hygiene", "scheduled", {
    cadenceHours: 24,
    cronExpression: "27 4 * * *",
  }),
  entry("Scrooge", "ceo-decision-record", "on-request"),
  entry("Scrooge", "follow-on-router", "event-driven", {
    subscribesTo: ["CeoDecision"],
  }),
  // D-OWNER-INBOX-AUTO-ARCHIVE — auto-archiver for decision-required cards.
  entry("Scrooge", "owner-inbox-archiver", "event-driven", {
    subscribesTo: ["CeoDecision"],
  }),
  entry("Scrooge", "event-triage", "event-driven", {
    subscribesTo: [
      "AgentEscalation",
      "WorkstreamCompleted",
      "WorkstreamRegistered",
      "HireConfirmed",
      "MandateGapDetected",
    ],
  }),
];
