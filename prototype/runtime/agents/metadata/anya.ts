// runtime/agents/metadata/anya.ts
// Per-agent handler metadata for Anya (Data / Analytics Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../handlers-metadata";
import { entry } from "./_entry";

export const ANYA_HANDLER_METADATA: readonly HandlerMetadata[] = [
  // anya:goal-loop — no cron; shadow mode for cohort-3 (on-request only).
  // Authority: D-AGENT-AUTONOMY-OPERATIONAL Slice 3.
  entry("Anya", "goal-loop", "on-request"),
  entry("Anya", "projection-drift", "scheduled", {
    cadenceHours: 24,
    cronExpression: "17 3 * * *",
  }),
  entry("Anya", "projection-refresh", "event-driven", {
    subscribesTo: [
      "SubstrateStateSnapshot",
      "WorkstreamRegistered",
      "WorkstreamCompleted",
      "CeoDecision",
    ],
  }),
  // M1 — Anya's projection-runtime-mapping handler.
  entry("Anya", "m1-projection-runtime-mapping", "event-driven", {
    subscribesTo: ["CeoDecision", "CdmBindingsRegenerated"],
  }),
  entry("Anya", "event-triage", "event-driven", {
    subscribesTo: ["EventSchemaPublished", "ObligationRegistered", "PolicyChange"],
  }),
];
