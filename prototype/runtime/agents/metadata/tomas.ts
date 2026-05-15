// runtime/agents/metadata/tomas.ts
// Per-agent handler metadata for Tomas (Payments Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../handlers-metadata";
import { entry } from "./_entry";

export const TOMAS_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Tomas", "payments-readiness", "scheduled", {
    cadenceHours: 24,
    cronExpression: "21 4 * * *",
  }),
  // tomas:goal-loop — cohort-3 (on-request only).
  entry("Tomas", "goal-loop", "on-request"),
  entry("Tomas", "event-triage", "event-driven", {
    subscribesTo: [
      "SettlementInstructionReceived",
      "PaymentInitiated",
      "ReconciliationBreak",
      "CutOffBreach",
      "SchemeRuleChange",
      "CSPAttestationDue",
      "SanctionsHoldRaised",
    ],
  }),
];
