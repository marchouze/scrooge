// runtime/agents/metadata/thandiwe.ts
// Per-agent handler metadata for Thandiwe (Chief Audit Executive).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../handlers-metadata";
import { entry } from "./_entry";

export const THANDIWE_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Thandiwe", "audit-committee-prep", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "47 7 * * 2",
  }),
  // thandiwe:goal-loop — no cron; shadow mode for cohort-3 (on-request only).
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  entry("Thandiwe", "goal-loop", "on-request"),
  entry("Thandiwe", "event-triage", "event-driven", {
    subscribesTo: [
      "AuditFinding",
      "AuditIssueOpened",
      "AuditIssueClosed",
      "AgentEscalation",
      "WhistleblowingDisclosure",
      "ExternalAuditorInquiry",
      "AppetiteBreach",
    ],
  }),
];
