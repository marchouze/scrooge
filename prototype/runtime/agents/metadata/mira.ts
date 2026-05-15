// runtime/agents/metadata/mira.ts
// Per-agent handler metadata for Mira (Compliance / RegTech Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
import { entry } from "./_entry";

export const MIRA_HANDLER_METADATA: readonly HandlerMetadata[] = [
  entry("Mira", "obligations-snapshot", "scheduled", {
    cadenceHours: 24 * 7,
    cronExpression: "29 7 * * 3",
  }),
  entry("Mira", "citation-gate", "on-request"),
  // mira:goal-loop — event-driven only; cohort-1 activation per D-T-01-PERMISSION-GATE-SECURE-DEFAULT.
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  entry("Mira", "goal-loop", "event-driven", {
    subscribesTo: [
      "RegulatoryInstrumentUpdate",
      "ObligationRegistered",
      "SanctionsListPublished",
      "PepListPublished",
    ],
  }),
  // M1 — Mira's regulator-citation-URN handler.
  entry("Mira", "m1-regulator-citation-urns", "event-driven", {
    subscribesTo: ["CeoDecision"],
  }),
  // PROC-FC-01 — Mira's KYC onboarding gateway.
  // Authority: PROC-FC-01 (Approved), KYC/CDD/EDD Policy (BRC-approved).
  entry("Mira", "kyc-onboarding-gateway", "event-driven", {
    subscribesTo: ["ClientCandidateRegistered"],
  }),
  entry("Mira", "event-triage", "event-driven", {
    subscribesTo: [
      "ClientCandidateRegistered",
      "TransactionPosted",
      "SanctionsListPublished",
      "PepListPublished",
      "AdverseMediaPublished",
      "RegulatoryInstrumentUpdate",
      "AlertOpened",
    ],
  }),
];
