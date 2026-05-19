// runtime/agents/metadata/anya.ts
// Per-agent handler metadata for Anya (Data / Analytics Engineer).
// To add a handler: add an entry here, then add one spread in handlers-metadata.ts.

import type { HandlerMetadata } from "../../types";
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
  // D-TREASURY-GAPS-WAVE1 — daily LCR / NSFR projection run.
  // Runs at 04:00 SAST (02:00 UTC) each business day, after Ravi's FTP curve
  // publication (03:17 UTC). Cadence aligned to ALCO daily pack cycle.
  // Authority: D-TREASURY-GAPS-WAVE1; BA 325; BA 326.
  entry("Anya", "liquidity-projection", "scheduled", {
    cadenceHours: 24,
    cronExpression: "0 2 * * 1-5",
  }),
];
